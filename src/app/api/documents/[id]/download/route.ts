import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SignDocument from "@/models/Document";
import User from "@/models/User";
import { getCurrentUser, canStaffAccessUser } from "@/lib/auth";
import {
  fetchCloudinaryAssetBuffer,
  uploadBufferToCloudinary,
} from "@/lib/cloudinary";
import { generateDocumentPdfBuffer } from "@/lib/pdfSign";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const doc = await SignDocument.findById(params.id);
    if (!doc) {
      return NextResponse.json(
        { success: false, msg: "Document not found" },
        { status: 404 }
      );
    }

    if (!doc.isGlobal && doc.user) {
      const ownerUser = await User.findById(doc.user);
      if (ownerUser && !canStaffAccessUser(viewer, ownerUser)) {
        return NextResponse.json(
          { success: false, msg: "Access denied" },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(req.url);
    const inline = searchParams.get("inline") === "1";
    const baseName = (doc.fileName || doc.title || "document").replace(
      /\.[^.]+$/,
      ""
    );
    const downloadFileName = `${baseName}.pdf`;

    // 1. Load original unmodified file buffer from Cloudinary or data URI
    let originalBuffer: Buffer | null = null;
    if (doc.fileUrl && doc.fileUrl.startsWith("data:")) {
      const commaIdx = doc.fileUrl.indexOf(",");
      if (commaIdx !== -1) {
        originalBuffer = Buffer.from(doc.fileUrl.slice(commaIdx + 1), "base64");
      }
    } else if (
      (doc.fileUrl && doc.fileUrl.startsWith("http")) ||
      doc.publicId
    ) {
      const asset = await fetchCloudinaryAssetBuffer(
        doc.fileUrl,
        doc.publicId
      );
      if (asset && asset.buffer.length > 0) {
        originalBuffer = asset.buffer;
      }
    }

    // 2. Serve the original PDF directly without modifying or stamping the document
    if (
      originalBuffer &&
      originalBuffer.length > 4 &&
      originalBuffer.subarray(0, 5).toString("ascii") === "%PDF-"
    ) {
      return new NextResponse(new Uint8Array(originalBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${
            inline ? "inline" : "attachment"
          }; filename="${downloadFileName}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // 3. Fallback for text-generated documents without an uploaded PDF file (still unmodified by signature)
    const pdfBuffer = await generateDocumentPdfBuffer({
      title: doc.title,
      fileName: doc.fileName,
      folder: doc.folder,
      description: doc.description,
      contentPreview: doc.documentContentPreview,
      originalPdfBuffer: originalBuffer,
      signature: null,
    });

    if (!doc.fileUrl || !doc.fileUrl.includes("cloudinary.com")) {
      uploadBufferToCloudinary(pdfBuffer, {
        folder: "signdocs_documents/generated",
        mimeType: "application/pdf",
        fileName: downloadFileName,
      })
        .then(async (uploaded) => {
          await SignDocument.updateOne(
            { _id: doc._id },
            {
              $set: {
                fileUrl: uploaded.secure_url,
                publicId: uploaded.public_id,
                fileSize: uploaded.bytes || pdfBuffer.length,
              },
            }
          );
        })
        .catch(() => {});
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${
          inline ? "inline" : "attachment"
        }; filename="${downloadFileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Download PDF error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to load PDF" },
      { status: 500 }
    );
  }
}

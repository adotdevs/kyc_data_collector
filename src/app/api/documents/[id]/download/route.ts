import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SignDocument from "@/models/Document";
import User from "@/models/User";
import { getCurrentUser, canStaffAccessUser } from "@/lib/auth";
import { generateDocumentPdfBuffer } from "@/lib/pdfSign";

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

    const ownerUser = await User.findById(doc.user);
    if (ownerUser && !canStaffAccessUser(viewer, ownerUser)) {
      return NextResponse.json(
        { success: false, msg: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const inline = searchParams.get("inline") === "1";

    // Try to load original PDF buffer if uploaded to Cloudinary or stored as data URI
    let originalBuffer: Buffer | null = null;
    if (doc.fileUrl && doc.fileUrl.startsWith("data:application/pdf;base64,")) {
      const b64 = doc.fileUrl.replace(/^data:application\/pdf;base64,/, "");
      originalBuffer = Buffer.from(b64, "base64");
    } else if (doc.fileUrl && doc.fileUrl.startsWith("http")) {
      try {
        const res = await fetch(doc.fileUrl);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          originalBuffer = Buffer.from(arr);
        }
      } catch {
        originalBuffer = null;
      }
    }

    const pdfBuffer = await generateDocumentPdfBuffer({
      title: doc.title,
      fileName: doc.fileName,
      folder: doc.folder,
      description: doc.description,
      contentPreview: doc.documentContentPreview,
      originalPdfBuffer: originalBuffer,
      signature:
        doc.status === "signed" && doc.signature
          ? {
              signatureDataUrl: doc.signature.signatureDataUrl,
              signerName: doc.signature.signerName,
              signerEmail: doc.signature.signerEmail,
              signerTitle: doc.signature.signerTitle,
              signedAt: doc.signature.signedAt,
              certificateId: doc.signature.certificateId,
              ipAddress: doc.signature.ipAddress,
            }
          : null,
    });

    const baseName = doc.fileName.replace(/\.[^.]+$/, "");
    const downloadFileName =
      doc.status === "signed" ? `${baseName}_Signed.pdf` : `${baseName}.pdf`;

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
      { success: false, msg: error?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

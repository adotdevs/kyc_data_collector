import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { fetchCloudinaryAssetBuffer } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string; docType: string } }
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

    const { userId, docType } = params;
    if (docType !== "cnic" && docType !== "bill") {
      return NextResponse.json(
        { success: false, msg: "Invalid KYC document type" },
        { status: 400 }
      );
    }

    const targetId = userId === "me" ? String(viewer._id) : userId;
    const user = await User.findById(targetId);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "User not found" },
        { status: 404 }
      );
    }

    const isSelf = String(viewer._id) === String(user._id);
    const isStaff = isStaffRole(viewer.role);
    if (!isSelf && !isStaff) {
      return NextResponse.json(
        { success: false, msg: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const shouldDownload = searchParams.get("download") === "1";
    const historyParam = searchParams.get("history");

    let docUrl = user.submitDoc?.[docType];
    let defaultName =
      user.submitDoc?.[`${docType}Name` as "cnicName" | "billName"] ||
      `${user.firstName}_${docType.toUpperCase()}`;
    let docMimeType =
      user.submitDoc?.[
        `${docType}MimeType` as "cnicMimeType" | "billMimeType"
      ];

    if (historyParam !== null && isStaff && Array.isArray(user.kycHistory)) {
      const idx = parseInt(historyParam, 10);
      const entry = user.kycHistory[idx];
      if (entry && entry[docType as "cnic" | "bill"]) {
        docUrl = entry[docType as "cnic" | "bill"];
        defaultName =
          entry[`${docType}Name` as "cnicName" | "billName"] || defaultName;
        docMimeType =
          entry[`${docType}MimeType` as "cnicMimeType" | "billMimeType"] ||
          docMimeType;
      }
    }

    if (!docUrl) {
      return NextResponse.json(
        { success: false, msg: "KYC document not found" },
        { status: 404 }
      );
    }

    if (docUrl.startsWith("data:")) {
      const matches = docUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return NextResponse.json(
          { success: false, msg: "Malformed document data" },
          { status: 400 }
        );
      }
      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const ext = mimeType.includes("pdf")
        ? ".pdf"
        : mimeType.includes("png")
        ? ".png"
        : ".jpg";
      const fileName = defaultName.includes(".")
        ? defaultName
        : `${defaultName}${ext}`;

      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `${
            shouldDownload ? "attachment" : "inline"
          }; filename="${fileName}"`,
        },
      });
    }

    // Fetch remote Cloudinary URL (with signed private_download_url fallback for PDFs)
    const asset = await fetchCloudinaryAssetBuffer(docUrl);
    if (!asset) {
      return NextResponse.redirect(docUrl);
    }

    const contentType =
      user.submitDoc?.[`${docType}MimeType` as "cnicMimeType" | "billMimeType"] ||
      asset.contentType ||
      "application/octet-stream";

    return new NextResponse(new Uint8Array(asset.buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${
          shouldDownload ? "attachment" : "inline"
        }; filename="${defaultName}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to load KYC file" },
      { status: 500 }
    );
  }
}


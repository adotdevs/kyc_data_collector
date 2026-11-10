import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SignDocument, { DocumentFolder, FileTypeCategory } from "@/models/Document";
import User from "@/models/User";
import Notification from "@/models/Notification";
import {
  getCurrentUser,
  isStaffRole,
  canStaffAccessUser,
  subadminAccessibleUsersQuery,
} from "@/lib/auth";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

function detectFileTypeCategory(fileName: string, mimeType: string): FileTypeCategory {
  const lower = (fileName || "").toLowerCase();
  if (
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    mimeType.includes("word") ||
    mimeType.includes("officedocument")
  ) {
    return "doc";
  }
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    mimeType.startsWith("image/")
  ) {
    return "image";
  }
  return "pdf";
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    const folder = searchParams.get("folder");
    const status = searchParams.get("status");
    const search = (searchParams.get("search") || "").trim();

    const baseScopeQuery: any = {};

    if (!isStaffRole(viewer.role)) {
      baseScopeQuery.user = viewer._id;
    } else if (targetUserId) {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser || !canStaffAccessUser(viewer, targetUser)) {
        return NextResponse.json(
          { success: false, msg: "Access denied" },
          { status: 403 }
        );
      }
      baseScopeQuery.user = targetUser._id;
    } else if (viewer.role === "subadmin") {
      const accessibleUsers = await User.find(
        subadminAccessibleUsersQuery(viewer._id),
        "_id"
      ).lean();
      baseScopeQuery.user = { $in: accessibleUsers.map((u) => u._id) };
    }

    const filterQuery: any = { ...baseScopeQuery };

    if (folder && folder !== "All") {
      filterQuery.folder = folder;
    }

    if (status === "pending_signature" || status === "signed") {
      filterQuery.status = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filterQuery.$or = [
        { title: regex },
        { fileName: regex },
        { description: regex },
        { folder: regex },
      ];
    }

    const [documents, allScopedDocs] = await Promise.all([
      SignDocument.find(filterQuery)
        .sort({ createdAt: -1 })
        .populate("user", "firstName lastName email kyc verified"),
      SignDocument.find(
        baseScopeQuery,
        "folder status fileSize requiresSignature"
      ).lean(),
    ]);

    const folderCounts: Record<string, number> = {
      Contracts: 0,
      Agreements: 0,
      NDAs: 0,
      "KYC & Compliance": 0,
      Other: 0,
    };

    let pendingCount = 0;
    let signedCount = 0;
    let totalBytes = 0;

    for (const d of allScopedDocs) {
      const f = d.folder || "Other";
      folderCounts[f] = (folderCounts[f] || 0) + 1;
      if (d.status === "signed") {
        signedCount++;
      } else {
        pendingCount++;
      }
      totalBytes += d.fileSize || 0;
    }

    return NextResponse.json({
      success: true,
      documents,
      summary: {
        total: allScopedDocs.length,
        pendingSignature: pendingCount,
        signed: signedCount,
        totalBytes,
        folderCounts,
      },
    });
  } catch (error: any) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const uploader = await getCurrentUser(req);
    if (!uploader) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const targetUserId =
        String(formData.get("userId") || "") || String(uploader._id);
      const folder = (String(formData.get("folder") || "Agreements") as DocumentFolder);
      const customTitle = String(formData.get("title") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const contentPreview = String(formData.get("documentContentPreview") || "").trim();
      const requiresSignature =
        formData.get("requiresSignature") !== "false";

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return NextResponse.json(
          { success: false, msg: "Recipient user not found" },
          { status: 404 }
        );
      }

      if (!canStaffAccessUser(uploader, targetUser)) {
        return NextResponse.json(
          { success: false, msg: "You do not have access to upload documents for this client" },
          { status: 403 }
        );
      }

      const files = formData.getAll("files") as File[];
      const singleFile = formData.get("file") as File | null;
      const uploadList = files.length > 0 ? files : singleFile ? [singleFile] : [];

      if (uploadList.length === 0) {
        // Allow creating a generated agreement/contract document even without a binary file
        if (!customTitle) {
          return NextResponse.json(
            { success: false, msg: "Please select a file to upload or provide a document title" },
            { status: 400 }
          );
        }

        const safeFileName = customTitle.toLowerCase().endsWith(".pdf")
          ? customTitle
          : `${customTitle}.pdf`;

        const created = await SignDocument.create({
          user: targetUser._id,
          uploadedBy: uploader._id,
          uploadedByName: `${uploader.firstName} ${uploader.lastName}`,
          uploadedByRole: uploader.role,
          title: safeFileName,
          fileName: safeFileName,
          description:
            description ||
            `Compliance document assigned to ${targetUser.firstName} ${targetUser.lastName}.`,
          folder,
          fileType: "pdf",
          mimeType: "application/pdf",
          fileSize: 1548200,
          fileUrl: "/api/documents/sample/pdf",
          pageCount: 3,
          requiresSignature,
          status: requiresSignature ? "pending_signature" : "completed",
          documentContentPreview: contentPreview,
        });

        await notifyRecipientOfNewDocument(targetUser, created, uploader);

        return NextResponse.json(
          {
            success: true,
            msg: "Document created and assigned for signature",
            documents: [created],
          },
          { status: 201 }
        );
      }

      const createdDocs = [];

      for (const file of uploadList) {
        if (!file || file.size === 0) continue;
        const arrayBuf = await file.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const fileName = file.name;
        const docTitle =
          uploadList.length === 1 && customTitle ? customTitle : fileName;
        const mimeType = file.type || "application/pdf";
        const fileType = detectFileTypeCategory(fileName, mimeType);

        let fileUrl = "/api/documents/sample/pdf";
        let publicId = "";
        let pages = 3;

        try {
          const uploaded = await uploadBufferToCloudinary(buf, {
            folder: `signdocs_documents/${targetUser._id}`,
            mimeType,
            fileName,
          });
          fileUrl = uploaded.secure_url;
          publicId = uploaded.public_id;
          pages = uploaded.pages || 3;
        } catch (err) {
          console.warn("Cloudinary document upload fallback:", err);
          if (buf.length < 4 * 1024 * 1024) {
            fileUrl = `data:${mimeType};base64,${buf.toString("base64")}`;
          }
        }

        const doc = await SignDocument.create({
          user: targetUser._id,
          uploadedBy: uploader._id,
          uploadedByName: `${uploader.firstName} ${uploader.lastName}`,
          uploadedByRole: uploader.role,
          title: docTitle,
          fileName,
          description:
            description ||
            `Uploaded by ${uploader.firstName} ${uploader.lastName} for digital review and execution.`,
          folder,
          fileType,
          mimeType,
          fileSize: file.size || buf.length,
          fileUrl,
          publicId,
          pageCount: pages,
          requiresSignature,
          status: requiresSignature ? "pending_signature" : "completed",
          documentContentPreview: contentPreview,
        });

        createdDocs.push(doc);
        await notifyRecipientOfNewDocument(targetUser, doc, uploader);
      }

      return NextResponse.json(
        {
          success: true,
          msg:
            createdDocs.length > 1
              ? `${createdDocs.length} documents uploaded successfully`
              : "Document uploaded successfully",
          documents: createdDocs,
        },
        { status: 201 }
      );
    }

    // JSON payload fallback
    const body = await req.json();
    const targetUserId = body.userId || String(uploader._id);
    const targetUser = await User.findById(targetUserId);
    if (!targetUser || !canStaffAccessUser(uploader, targetUser)) {
      return NextResponse.json(
        { success: false, msg: "Recipient not found or access denied" },
        { status: 403 }
      );
    }

    const title = (body.title || body.fileName || "Compliance Agreement.pdf").trim();
    const fileName = title.includes(".") ? title : `${title}.pdf`;

    const doc = await SignDocument.create({
      user: targetUser._id,
      uploadedBy: uploader._id,
      uploadedByName: `${uploader.firstName} ${uploader.lastName}`,
      uploadedByRole: uploader.role,
      title,
      fileName,
      description: body.description || "",
      folder: body.folder || "Agreements",
      fileType: detectFileTypeCategory(fileName, body.mimeType || "application/pdf"),
      mimeType: body.mimeType || "application/pdf",
      fileSize: body.fileSize || 1843200,
      fileUrl: body.fileUrl || "/api/documents/sample/pdf",
      pageCount: body.pageCount || 3,
      requiresSignature: body.requiresSignature !== false,
      status: "pending_signature",
      documentContentPreview: body.documentContentPreview || "",
    });

    await notifyRecipientOfNewDocument(targetUser, doc, uploader);

    return NextResponse.json(
      {
        success: true,
        msg: "Document assigned for signature",
        documents: [doc],
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/documents error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to upload document" },
      { status: 500 }
    );
  }
}

async function notifyRecipientOfNewDocument(
  recipient: any,
  doc: any,
  uploader: any
) {
  if (String(recipient._id) === String(uploader._id)) return;

  await Notification.create({
    userId: recipient._id,
    recipientRole: "user",
    type: "document_uploaded",
    title: "New Document Ready to Sign",
    content: `${uploader.firstName} ${uploader.lastName} uploaded "${doc.title}" to your ${doc.folder} folder for signature.`,
    link: `/documents?doc=${doc._id}`,
    userEmail: recipient.email,
    userName: `${recipient.firstName} ${recipient.lastName}`,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const html = buildBrandedEmailHtml({
    title: "New Document Ready for Your Signature",
    greeting: `Hello ${recipient.firstName},`,
    bodyLines: [
      `A new document ("${doc.title}") has been uploaded to your SignDocs account in the ${doc.folder} folder.`,
      "Please sign in to review the document and complete your electronic signature online.",
    ],
    ctaLabel: "Review & Sign Document",
    ctaUrl: `${baseUrl}/documents`,
  });

  sendEmail(
    recipient.email,
    `SignDocs — Document Ready for Signature: ${doc.title}`,
    `A new document (${doc.title}) is waiting for your signature on SignDocs.`,
    html
  ).catch(() => {});
}

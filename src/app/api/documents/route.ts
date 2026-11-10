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
  escapeRegex,
  isValidObjectId,
} from "@/lib/auth";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "@/lib/cloudinary";
import { generateDocumentPdfBuffer } from "@/lib/pdfSign";
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

    let baseScopeQuery: any = {};
    let singleClientTargetId: string | null = null;

    if (!isStaffRole(viewer.role)) {
      singleClientTargetId = String(viewer._id);
      const signedGlobalParents = await SignDocument.find(
        { user: viewer._id, globalParentId: { $ne: null } },
        "globalParentId"
      ).lean();
      const excludedGlobalIds = signedGlobalParents
        .map((d) => d.globalParentId)
        .filter(Boolean);

      baseScopeQuery = {
        $or: [
          { user: viewer._id },
          {
            isGlobal: true,
            ...(excludedGlobalIds.length > 0
              ? { _id: { $nin: excludedGlobalIds } }
              : {}),
          },
        ],
      };
    } else if (targetUserId) {
      const targetUser = await User.findById(targetUserId);
      if (!targetUser || !canStaffAccessUser(viewer, targetUser)) {
        return NextResponse.json(
          { success: false, msg: "Access denied" },
          { status: 403 }
        );
      }
      singleClientTargetId = String(targetUser._id);
      const signedGlobalParents = await SignDocument.find(
        { user: targetUser._id, globalParentId: { $ne: null } },
        "globalParentId"
      ).lean();
      const excludedGlobalIds = signedGlobalParents
        .map((d) => d.globalParentId)
        .filter(Boolean);

      baseScopeQuery = {
        $or: [
          { user: targetUser._id },
          {
            isGlobal: true,
            ...(excludedGlobalIds.length > 0
              ? { _id: { $nin: excludedGlobalIds } }
              : {}),
          },
        ],
      };
    } else if (viewer.role === "subadmin") {
      const accessibleUsers = await User.find(
        subadminAccessibleUsersQuery(viewer._id),
        "_id"
      ).lean();
      baseScopeQuery = {
        $or: [
          { isGlobal: true },
          { user: { $in: accessibleUsers.map((u) => u._id) } },
        ],
      };
    }

    const andConditions: any[] = [];
    if (Object.keys(baseScopeQuery).length > 0) {
      andConditions.push(baseScopeQuery);
    }

    if (folder && folder !== "All") {
      andConditions.push({ folder });
    }

    if (status === "pending_signature" || status === "signed") {
      andConditions.push({ status });
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      andConditions.push({
        $or: [
          { title: regex },
          { fileName: regex },
          { description: regex },
          { folder: regex },
        ],
      });
    }

    const filterQuery: any =
      andConditions.length === 0
        ? {}
        : andConditions.length === 1
        ? andConditions[0]
        : { $and: andConditions };

    const [documents, allScopedDocs] = await Promise.all([
      SignDocument.find(filterQuery)
        .sort({ createdAt: -1 })
        .populate("user", "firstName lastName email kyc verified"),
      SignDocument.find(
        baseScopeQuery,
        "folder status fileSize requiresSignature isGlobal"
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

    if (!isStaffRole(uploader.role)) {
      return NextResponse.json(
        {
          success: false,
          msg: "Only administrators with document permissions can upload documents",
        },
        { status: 403 }
      );
    }

    if (
      (uploader.role === "admin" &&
        uploader.adminPermissions?.canManageDocuments === false) ||
      (uploader.role === "subadmin" &&
        uploader.permissions?.canManageDocuments === false)
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your account does not have permission to upload or manage documents",
        },
        { status: 403 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const rawUserId = String(formData.get("userId") || "").trim();
      const isGlobalFlag =
        formData.get("isGlobal") === "true" ||
        rawUserId === "global" ||
        rawUserId === "__GLOBAL__";

      const folder = (String(formData.get("folder") || "Agreements") as DocumentFolder);
      const customTitle = String(formData.get("title") || "").trim();
      const description = String(formData.get("description") || "").trim();
      const contentPreview = String(formData.get("documentContentPreview") || "").trim();
      const requiresSignature =
        formData.get("requiresSignature") !== "false";

      let targetUser: any = null;

      if (isGlobalFlag) {
        if (!isStaffRole(uploader.role)) {
          return NextResponse.json(
            {
              success: false,
              msg: "Only administrators can upload global documents",
            },
            { status: 403 }
          );
        }
      } else {
        const targetUserId =
          rawUserId || (!isStaffRole(uploader.role) ? String(uploader._id) : "");

        if (!targetUserId) {
          return NextResponse.json(
            {
              success: false,
              msg: "Please select a client or choose Global sharing before uploading",
            },
            { status: 400 }
          );
        }

        targetUser = await User.findById(targetUserId);
        if (!targetUser) {
          return NextResponse.json(
            { success: false, msg: "Recipient user not found" },
            { status: 404 }
          );
        }

        if (!canStaffAccessUser(uploader, targetUser)) {
          return NextResponse.json(
            {
              success: false,
              msg: "You do not have access to upload documents for this client",
            },
            { status: 403 }
          );
        }
      }

      const files = formData.getAll("files") as File[];
      const singleFile = formData.get("file") as File | null;
      const uploadList = files.length > 0 ? files : singleFile ? [singleFile] : [];

      if (uploadList.length === 0) {
        // Allow creating a generated agreement/contract document even without a binary file
        if (!customTitle) {
          return NextResponse.json(
            {
              success: false,
              msg: "Please select a file to upload or provide a document title",
            },
            { status: 400 }
          );
        }

        const safeFileName = customTitle.toLowerCase().endsWith(".pdf")
          ? customTitle
          : `${customTitle}.pdf`;

        const docDescription =
          description ||
          (isGlobalFlag
            ? "Global compliance document shared with all clients for review and signature."
            : `Compliance document assigned to ${targetUser.firstName} ${targetUser.lastName}.`);

        // Generate real PDF buffer and upload to Cloudinary
        const generatedBuffer = await generateDocumentPdfBuffer({
          title: safeFileName,
          fileName: safeFileName,
          folder,
          description: docDescription,
          contentPreview,
        });

        let genFileUrl = "/api/documents/sample/pdf";
        let genPublicId = "";
        let genSize = generatedBuffer.length;
        try {
          const uploadedGen = await uploadBufferToCloudinary(generatedBuffer, {
            folder: isGlobalFlag
              ? "signdocs_documents/global"
              : `signdocs_documents/${targetUser._id}`,
            mimeType: "application/pdf",
            fileName: safeFileName,
          });
          genFileUrl = uploadedGen.secure_url;
          genPublicId = uploadedGen.public_id;
          genSize = uploadedGen.bytes || generatedBuffer.length;
        } catch (err) {
          console.warn("Cloudinary generated PDF upload fallback:", err);
        }

        const created = await SignDocument.create({
          user: isGlobalFlag ? null : targetUser._id,
          isGlobal: isGlobalFlag,
          globalParentId: null,
          uploadedBy: uploader._id,
          uploadedByName: `${uploader.firstName} ${uploader.lastName}`,
          uploadedByRole: uploader.role,
          title: safeFileName,
          fileName: safeFileName,
          description: docDescription,
          folder,
          fileType: "pdf",
          mimeType: "application/pdf",
          fileSize: genSize,
          fileUrl: genFileUrl,
          publicId: genPublicId,
          pageCount: 1,
          requiresSignature,
          status: requiresSignature ? "pending_signature" : "completed",
          documentContentPreview: contentPreview,
        });

        if (isGlobalFlag) {
          notifyAllClientsOfGlobalDocument(created, uploader).catch(() => {});
        } else if (targetUser) {
          await notifyRecipientOfNewDocument(targetUser, created, uploader);
        }

        return NextResponse.json(
          {
            success: true,
            msg: isGlobalFlag
              ? "Document created and shared globally with all clients!"
              : "Document created and assigned for signature",
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
            folder: isGlobalFlag
              ? "signdocs_documents/global"
              : `signdocs_documents/${targetUser._id}`,
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
          user: isGlobalFlag ? null : targetUser._id,
          isGlobal: isGlobalFlag,
          globalParentId: null,
          uploadedBy: uploader._id,
          uploadedByName: `${uploader.firstName} ${uploader.lastName}`,
          uploadedByRole: uploader.role,
          title: docTitle,
          fileName,
          description:
            description ||
            (isGlobalFlag
              ? `Global document uploaded by ${uploader.firstName} ${uploader.lastName} for all clients.`
              : `Uploaded by ${uploader.firstName} ${uploader.lastName} for digital review and execution.`),
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
        if (isGlobalFlag) {
          notifyAllClientsOfGlobalDocument(doc, uploader).catch(() => {});
        } else if (targetUser) {
          await notifyRecipientOfNewDocument(targetUser, doc, uploader);
        }
      }

      return NextResponse.json(
        {
          success: true,
          msg: isGlobalFlag
            ? createdDocs.length > 1
              ? `${createdDocs.length} documents shared globally with all clients!`
              : "Document uploaded and shared globally with all clients!"
            : createdDocs.length > 1
            ? `${createdDocs.length} documents uploaded successfully`
            : "Document uploaded successfully",
          documents: createdDocs,
        },
        { status: 201 }
      );
    }

    // JSON payload fallback
    const body = await req.json();
    const isGlobalJson =
      Boolean(body.isGlobal) ||
      body.userId === "global" ||
      body.userId === "__GLOBAL__";

    let targetUser: any = null;
    if (isGlobalJson) {
      if (!isStaffRole(uploader.role)) {
        return NextResponse.json(
          {
            success: false,
            msg: "Only administrators can upload global documents",
          },
          { status: 403 }
        );
      }
    } else {
      const targetUserId =
        body.userId || (!isStaffRole(uploader.role) ? String(uploader._id) : "");
      if (!targetUserId) {
        return NextResponse.json(
          {
            success: false,
            msg: "Please select a client or choose Global sharing",
          },
          { status: 400 }
        );
      }
      targetUser = await User.findById(targetUserId);
      if (!targetUser || !canStaffAccessUser(uploader, targetUser)) {
        return NextResponse.json(
          { success: false, msg: "Recipient not found or access denied" },
          { status: 403 }
        );
      }
    }

    const title = (body.title || body.fileName || "Compliance Agreement.pdf").trim();
    const fileName = title.includes(".") ? title : `${title}.pdf`;

    const doc = await SignDocument.create({
      user: isGlobalJson ? null : targetUser._id,
      isGlobal: isGlobalJson,
      globalParentId: null,
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

    if (isGlobalJson) {
      notifyAllClientsOfGlobalDocument(doc, uploader).catch(() => {});
    } else if (targetUser) {
      await notifyRecipientOfNewDocument(targetUser, doc, uploader);
    }

    return NextResponse.json(
      {
        success: true,
        msg: isGlobalJson
          ? "Document shared globally with all clients!"
          : "Document assigned for signature",
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

async function notifyAllClientsOfGlobalDocument(doc: any, uploader: any) {
  try {
    const clients = await User.find(
      { role: "user" },
      "_id firstName lastName email"
    ).lean();
    if (!clients || clients.length === 0) return;

    const notifications = clients.map((client) => ({
      userId: client._id,
      recipientRole: "user",
      type: "document_uploaded",
      title: "New Global Document Ready to Sign",
      content: `${uploader.firstName} ${uploader.lastName} shared "${doc.title}" globally in ${doc.folder} for signature.`,
      link: `/documents?doc=${doc._id}`,
      userEmail: client.email,
      userName: `${client.firstName} ${client.lastName}`,
    }));

    await Notification.insertMany(notifications, { ordered: false }).catch(
      () => {}
    );
  } catch {
    // Non-blocking notification
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

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    if (!isStaffRole(viewer.role)) {
      return NextResponse.json(
        {
          success: false,
          msg: "Only Superadmin or Administrators with document permission can delete documents",
        },
        { status: 403 }
      );
    }

    if (
      (viewer.role === "admin" &&
        viewer.adminPermissions?.canManageDocuments === false) ||
      (viewer.role === "subadmin" &&
        viewer.permissions?.canManageDocuments === false)
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your account does not have permission to delete documents",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawIds: any[] = Array.isArray(body.ids) ? body.ids : [];
    const validIds = Array.from(
      new Set(
        rawIds
          .map((id) => String(id || "").trim())
          .filter((id) => isValidObjectId(id))
      )
    );

    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, msg: "No valid documents selected for deletion" },
        { status: 400 }
      );
    }

    const docs = await SignDocument.find({ _id: { $in: validIds } });
    if (docs.length === 0) {
      return NextResponse.json(
        { success: false, msg: "Selected documents were not found" },
        { status: 404 }
      );
    }

    const deletableDocIds: string[] = [];
    const globalMasterIds: string[] = [];

    for (const doc of docs) {
      if (doc.isGlobal) {
        if (viewer.role !== "superadmin" && viewer.role !== "admin") {
          continue;
        }
        deletableDocIds.push(String(doc._id));
        if (!doc.user) {
          globalMasterIds.push(String(doc._id));
        }
        if (
          (doc.fileUrl && doc.fileUrl.includes("cloudinary.com")) ||
          doc.publicId
        ) {
          deleteFromCloudinary(doc.fileUrl || doc.publicId || "").catch(
            () => {}
          );
        }
      } else if (doc.user) {
        const ownerUser = await User.findById(doc.user);
        if (ownerUser && !canStaffAccessUser(viewer, ownerUser)) {
          continue;
        }
        deletableDocIds.push(String(doc._id));
        if (
          !doc.globalParentId &&
          ((doc.fileUrl && doc.fileUrl.includes("cloudinary.com")) ||
            doc.publicId)
        ) {
          deleteFromCloudinary(doc.fileUrl || doc.publicId || "").catch(
            () => {}
          );
        }
      } else {
        deletableDocIds.push(String(doc._id));
      }
    }

    if (deletableDocIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          msg: "You do not have permission to delete the selected documents",
        },
        { status: 403 }
      );
    }

    if (globalMasterIds.length > 0) {
      await SignDocument.deleteMany({
        globalParentId: { $in: globalMasterIds },
      });
    }

    await SignDocument.deleteMany({ _id: { $in: deletableDocIds } });

    return NextResponse.json({
      success: true,
      deletedCount: deletableDocIds.length,
      msg: `Deleted ${deletableDocIds.length} document(s) successfully`,
    });
  } catch (error: any) {
    console.error("Bulk DELETE /api/documents error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Bulk document deletion failed" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import SignDocument from "@/models/Document";
import User from "@/models/User";
import Notification from "@/models/Notification";
import SystemSettings from "@/models/SystemSettings";
import { getCurrentUser, canStaffAccessUser } from "@/lib/auth";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const signer = await getCurrentUser(req);
    if (!signer) {
      return NextResponse.json(
        { success: false, msg: "Please sign in to execute this document" },
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

    let ownerUser: any = doc.user ? await User.findById(doc.user) : null;
    if (!doc.isGlobal) {
      if (!ownerUser) {
        return NextResponse.json(
          { success: false, msg: "Document owner not found" },
          { status: 404 }
        );
      }

      if (!canStaffAccessUser(signer, ownerUser)) {
        return NextResponse.json(
          {
            success: false,
            msg: "You are not authorized to sign this document",
          },
          { status: 403 }
        );
      }
    } else {
      ownerUser = signer;
    }

    if (signer.isComplianceRestricted) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your account is currently under compliance review and cannot execute documents.",
        },
        { status: 403 }
      );
    }

    const settings = await SystemSettings.findOne();
    if (
      settings?.requireKycBeforeSign &&
      signer.role === "user" &&
      !signer.kyc
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Please complete your KYC verification before signing documents.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      signatureDataUrl,
      signatureMode = "draw",
      signerName,
      signerTitle = "",
      pageNumber = doc.pageCount || 1,
      positionX = 65,
      positionY = 78,
      saveForFuture = true,
    } = body;

    // Strict validation: only handwritten drawn signature is accepted, and signing is compulsory
    if (signatureMode === "type") {
      return NextResponse.json(
        {
          success: false,
          msg: "Typed signatures are not accepted. Please draw your handwritten signature.",
        },
        { status: 400 }
      );
    }

    if (
      !signatureDataUrl ||
      typeof signatureDataUrl !== "string" ||
      !signatureDataUrl.startsWith("data:image/") ||
      signatureDataUrl.length < 200
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Handwritten signature is compulsory. Please draw your signature before saving.",
        },
        { status: 400 }
      );
    }

    const finalSignerName = (
      signerName || `${signer.firstName} ${signer.lastName}`
    ).trim();

    if (!finalSignerName) {
      return NextResponse.json(
        {
          success: false,
          msg: "Please enter your full legal name before signing.",
        },
        { status: 400 }
      );
    }

    const certificateId = `SD-CERT-${new Date().getFullYear()}-${crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()}`;

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "SignDocs Web Client";

    // Signing does NOT modify the PDF file itself; it marks the document as signed
    // and stores the handwritten signature record to display to Admin and Client.
    const signaturePayload = {
      signatureDataUrl,
      signatureMode: "draw" as const,
      typedText: "",
      fontFamily: "",
      signerName: finalSignerName,
      signerEmail: signer.email,
      signerTitle: signerTitle.trim(),
      signedAt: new Date(),
      ipAddress,
      userAgent,
      certificateId,
      pageNumber: Number(pageNumber) || 1,
      positionX: Number(positionX) || 65,
      positionY: Number(positionY) || 78,
      signedFileUrl: null,
    };

    let signedDocRecord = doc;

    if (doc.isGlobal && !doc.user) {
      // Create or update a per-signer signed record referencing the original unmodified fileUrl
      const existingCopy = await SignDocument.findOne({
        user: signer._id,
        globalParentId: doc._id,
      });

      if (existingCopy) {
        existingCopy.status = "signed";
        existingCopy.signature = signaturePayload;
        await existingCopy.save();
        signedDocRecord = existingCopy;
      } else {
        signedDocRecord = await SignDocument.create({
          user: signer._id,
          isGlobal: false,
          globalParentId: doc._id,
          uploadedBy: doc.uploadedBy,
          uploadedByName: doc.uploadedByName,
          uploadedByRole: doc.uploadedByRole,
          title: doc.title,
          fileName: doc.fileName,
          description: doc.description,
          folder: doc.folder,
          fileType: doc.fileType,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          fileUrl: doc.fileUrl,
          publicId: doc.publicId,
          pageCount: doc.pageCount,
          requiresSignature: true,
          status: "signed",
          documentContentPreview: doc.documentContentPreview,
          signature: signaturePayload,
        });
      }
    } else {
      doc.status = "signed";
      doc.signature = signaturePayload;
      await doc.save();
      signedDocRecord = doc;
    }

    if (saveForFuture && signatureDataUrl) {
      signer.savedSignature = signatureDataUrl;
      await signer.save({ validateBeforeSave: false });
    }

    const notifyTargetUserId = ownerUser?._id || signer._id;

    await Notification.create({
      userId: notifyTargetUserId,
      recipientRole: "admin",
      type: "document_signed",
      title: "Document Signed by Client",
      content: `${finalSignerName} (${signer.email}) signed "${signedDocRecord.title}" with a handwritten signature.`,
      link: `/admin/users/${notifyTargetUserId}?tab=documents`,
      userEmail: signer.email,
      userName: finalSignerName,
    });

    const html = buildBrandedEmailHtml({
      title: "Document Signed Successfully",
      greeting: `Hello ${finalSignerName},`,
      bodyLines: [
        `You have signed "${signedDocRecord.title}".`,
        `Certificate ID: ${certificateId}`,
        `Timestamp: ${new Date().toUTCString()}`,
        "Your handwritten signature is now recorded and visible in your SignDocs portal.",
      ],
    });

    sendEmail(
      signer.email,
      `SignDocs — Signature Confirmation: ${signedDocRecord.title}`,
      `You have signed "${signedDocRecord.title}". Certificate ID: ${certificateId}`,
      html
    ).catch(() => {});

    const populated = await SignDocument.findById(signedDocRecord._id).populate(
      "user",
      "firstName lastName email kyc verified"
    );

    return NextResponse.json({
      success: true,
      msg: `"${signedDocRecord.title}" signed successfully!`,
      document: populated,
    });
  } catch (error: any) {
    console.error("Sign document error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to sign document" },
      { status: 500 }
    );
  }
}

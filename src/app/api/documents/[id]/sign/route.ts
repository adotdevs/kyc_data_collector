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

    const ownerUser = await User.findById(doc.user);
    if (!ownerUser) {
      return NextResponse.json(
        { success: false, msg: "Document owner not found" },
        { status: 404 }
      );
    }

    if (!canStaffAccessUser(signer, ownerUser)) {
      return NextResponse.json(
        { success: false, msg: "You are not authorized to sign this document" },
        { status: 403 }
      );
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
      typedText = "",
      fontFamily = "Dancing Script",
      signerName,
      signerTitle = "",
      pageNumber = doc.pageCount || 1,
      positionX = 65,
      positionY = 78,
      saveForFuture = true,
    } = body;

    if (!signatureDataUrl && !typedText) {
      return NextResponse.json(
        {
          success: false,
          msg: "Please draw or type your signature before submitting",
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

    const finalSignerName =
      (signerName || `${signer.firstName} ${signer.lastName}`).trim();

    doc.status = "signed";
    doc.signature = {
      signatureDataUrl: signatureDataUrl || "",
      signatureMode,
      typedText,
      fontFamily,
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
    };

    await doc.save();

    if (saveForFuture && signatureDataUrl) {
      signer.savedSignature = signatureDataUrl;
      await signer.save({ validateBeforeSave: false });
    }

    await Notification.create({
      userId: ownerUser._id,
      recipientRole: "admin",
      type: "document_signed",
      title: "Document Digitally Signed",
      content: `${finalSignerName} (${signer.email}) signed "${doc.title}" (Cert: ${certificateId}).`,
      link: `/admin/users/${ownerUser._id}?tab=documents`,
      userEmail: signer.email,
      userName: finalSignerName,
    });

    const html = buildBrandedEmailHtml({
      title: "Document Executed & Signed Successfully",
      greeting: `Hello ${finalSignerName},`,
      bodyLines: [
        `You have electronically signed "${doc.title}".`,
        `Digital Audit Certificate ID: ${certificateId}`,
        `Timestamp: ${new Date().toUTCString()}`,
        "You can download a copy of the signed PDF with the embedded signature certificate anytime from your SignDocs portal.",
      ],
    });

    sendEmail(
      signer.email,
      `SignDocs — Signed Copy Confirmation: ${doc.title}`,
      `You have signed "${doc.title}". Certificate ID: ${certificateId}`,
      html
    ).catch(() => {});

    const populated = await SignDocument.findById(doc._id).populate(
      "user",
      "firstName lastName email kyc verified"
    );

    return NextResponse.json({
      success: true,
      msg: `"${doc.title}" signed and certified successfully!`,
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

import { NextRequest, NextResponse } from "next/server";
import {
  getEffectiveSmtpConfig,
  sendEmail,
  EmailAttachment,
} from "@/lib/email";

export const dynamic = "force-dynamic";

const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024; // 8 MB per file
const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "pdf",
  "doc",
  "docx",
  "txt",
  "eml",
  "msg",
]);

function getField(formData: FormData, key: string): string {
  const val = formData.get(key);
  if (typeof val !== "string") return "";
  return val.trim();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const fullName = getField(formData, "full_name");
    const idPassport = getField(formData, "id_passport");
    const email = getField(formData, "email");
    const phone = getField(formData, "phone");
    const street = getField(formData, "street_address");
    const addressLine = getField(formData, "address_line");
    const city = getField(formData, "city");
    const state = getField(formData, "state");
    const postal = getField(formData, "postal");
    const country = getField(formData, "country");
    const companyName = getField(formData, "company_name");
    const platformDiscovery = getField(formData, "platform_discovery");
    const contactMethod = getField(formData, "contact_method");
    const lossDetails = getField(formData, "loss_details");
    const additionalLoss = getField(formData, "additional_loss_details");
    const reportedRaw = getField(formData, "reported_authorities");
    const reportedAuthorities =
      reportedRaw === "Yes" || reportedRaw === "No"
        ? reportedRaw
        : "Not specified";
    const agreeTerms = formData.get("agree_terms");
    const signatureRaw = getField(formData, "signature");

    // Extract help_with[]
    const helpWithEntries = [
      ...formData.getAll("help_with[]"),
      ...formData.getAll("help_with"),
    ]
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);

    // Validate required fields
    if (
      !fullName ||
      !idPassport ||
      !email ||
      !phone ||
      !street ||
      !city ||
      !postal ||
      !country ||
      !agreeTerms
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please complete all required fields.",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    if (helpWithEntries.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please select at least one option under "I need help with".',
        },
        { status: 400 }
      );
    }

    const sigMatch = signatureRaw.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!sigMatch) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide a valid signature.",
        },
        { status: 400 }
      );
    }

    const sigFormat = sigMatch[1].toLowerCase();
    const sigExt = sigFormat === "png" ? "png" : "jpg";
    const sigMime = sigExt === "png" ? "image/png" : "image/jpeg";
    const sigBuffer = Buffer.from(sigMatch[2], "base64");
    if (!sigBuffer || sigBuffer.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Could not read signature data.",
        },
        { status: 400 }
      );
    }

    const attachments: EmailAttachment[] = [
      {
        filename: `signature.${sigExt}`,
        content: sigBuffer,
        contentType: sigMime,
      },
    ];

    // Process uploaded evidence_files[]
    const rawFiles = [
      ...formData.getAll("evidence_files[]"),
      ...formData.getAll("evidence_files"),
    ];

    for (const item of rawFiles) {
      if (!item || typeof item === "string") continue;
      const file = item as File;
      if (!file.name || file.size === 0) continue;

      if (file.size > MAX_EVIDENCE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: "Each evidence file must be 8 MB or smaller.",
          },
          { status: 400 }
        );
      }

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          {
            success: false,
            message: `File type not allowed: ${file.name}`,
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const safeFilename =
        file.name.replace(/[^\w.\- ()]/g, "_") || `evidence.${ext}`;
      attachments.push({
        filename: safeFilename,
        content: Buffer.from(arrayBuffer),
        contentType: file.type || "application/octet-stream",
      });
    }

    const safeFullName = fullName.replace(/[\r\n]+/g, " ");
    const subject = `Client onboarding — ${safeFullName}`;

    const lines = [
      "New client onboarding / agreement submission",
      "============================================",
      "",
      `Full name: ${fullName}`,
      `ID / Passport: ${idPassport}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      "",
      "Address",
      "-------",
      `Street: ${street}`,
      `Address line 2: ${addressLine !== "" ? addressLine : "—"}`,
      `City: ${city}`,
      `State / Province / Region: ${state !== "" ? state : "—"}`,
      `Postal / ZIP: ${postal}`,
      `Country: ${country}`,
      "",
      "What they need help with",
      "------------------------",
      helpWithEntries.join(", "),
      "",
      "Company / platform name",
      "-----------------------",
      companyName !== "" ? companyName : "—",
      "",
      "How they came across the platform",
      "---------------------------------",
      platformDiscovery !== "" ? platformDiscovery : "—",
      "",
      "Main way of contact with the platform",
      "-------------------------------------",
      contactMethod !== "" ? contactMethod : "—",
      "",
      "Details of the loss (amounts, dates, currency)",
      "----------------------------------------------",
      lossDetails !== "" ? lossDetails : "—",
      "",
      "Additional loss details",
      "-----------------------",
      additionalLoss !== "" ? additionalLoss : "—",
      "",
      `Reported to authorities: ${reportedAuthorities}`,
      "",
      "Agreement checkbox: Confirmed",
      "",
      "(Signature image and any evidence files are attached to this email.)",
    ];

    const textBody = lines.join("\r\n");

    // Resolve SMTP configured from Superadmin's profile / global settings
    const smtpConfig = await getEffectiveSmtpConfig();
    const recipientEmail = smtpConfig.fromEmail || smtpConfig.user;

    const sendResult = await sendEmail(
      recipientEmail,
      subject,
      textBody,
      null,
      smtpConfig,
      {
        replyTo: `"${safeFullName}" <${email}>`,
        attachments,
      }
    );

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "We could not send your submission right now. Please try again later or email us directly.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your agreement was submitted. We will be in touch by email.",
    });
  } catch (error: any) {
    console.error("POST /api/submit-agreement error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "We could not send your submission right now. Please try again later or email us directly.",
      },
      { status: 500 }
    );
  }
}


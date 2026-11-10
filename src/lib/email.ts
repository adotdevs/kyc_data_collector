import nodemailer from "nodemailer";
import { Resend } from "resend";
import { connectDB } from "@/lib/db";
import SystemSettings from "@/models/SystemSettings";
import User from "@/models/User";

export interface CustomSmtpOptions {
  enabled?: boolean;
  host?: string | null;
  port?: number | null;
  secure?: boolean | null;
  user?: string | null;
  pass?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  adminAlertEmail?: string | null;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailExtraOptions {
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function getEffectiveSmtpConfig(
  customSmtp?: CustomSmtpOptions | null
): Promise<{
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  adminAlertEmail: string;
}> {
  const brandName = process.env.WebName || "GOin SAS";
  let effectiveSmtp: CustomSmtpOptions | null =
    customSmtp && customSmtp.host && customSmtp.user && customSmtp.pass
      ? customSmtp
      : null;

  if (!effectiveSmtp) {
    try {
      await connectDB();
      // 1. Check Superadmin's profile smtpConfig first
      const superadmin = await User.findOne({ role: "superadmin" }).lean();
      if (
        superadmin?.smtpConfig &&
        superadmin.smtpConfig.enabled !== false &&
        superadmin.smtpConfig.host &&
        superadmin.smtpConfig.user &&
        superadmin.smtpConfig.pass
      ) {
        effectiveSmtp = superadmin.smtpConfig;
      }

      // 2. Check Global SystemSettings smtpConfig
      if (!effectiveSmtp) {
        const settings = await SystemSettings.findOne().lean();
        if (
          settings?.smtpConfig &&
          settings.smtpConfig.enabled !== false &&
          settings.smtpConfig.host &&
          settings.smtpConfig.user &&
          settings.smtpConfig.pass
        ) {
          effectiveSmtp = settings.smtpConfig;
        }
      }
    } catch {
      // ignore DB lookup error and use env fallback
    }
  }

  const host = (
    effectiveSmtp?.host ||
    process.env.EMAILHOST ||
    "smtp.hostinger.com"
  ).trim();
  const port = Number(effectiveSmtp?.port || process.env.EMAIL_PORT || 465);
  const secure =
    typeof effectiveSmtp?.secure === "boolean"
      ? effectiveSmtp.secure
      : port === 465;
  const user = (
    effectiveSmtp?.user ||
    process.env.EMAILUSER ||
    "support@betabase.pro"
  ).trim();
  const pass = effectiveSmtp?.pass || process.env.EMAILPASS || "";
  const fromEmail = (
    effectiveSmtp?.fromEmail ||
    process.env.HOST_EMAIL ||
    user
  ).trim();
  const fromName = (effectiveSmtp?.fromName || brandName).trim();
  const adminAlertEmail = (
    effectiveSmtp?.adminAlertEmail ||
    process.env.ADMIN_ALERT_EMAIL ||
    "info@goin-in-vest.com"
  ).trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
    adminAlertEmail,
  };
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string | null,
  customSmtp?: CustomSmtpOptions | null,
  extraOptions?: SendEmailExtraOptions
) {
  const emailContent = html || text.replace(/\n/g, "<br>");
  const { host, port, secure, user, pass, fromEmail, fromName } =
    await getEffectiveSmtpConfig(customSmtp);

  // 1. Try SMTP via Nodemailer first
  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 12000,
      });

      const result = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        replyTo: extraOptions?.replyTo || undefined,
        subject,
        text,
        html: emailContent,
        attachments: extraOptions?.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      });

      return {
        success: true,
        provider: "smtp",
        messageId: result.messageId,
        fromEmail,
      };
    } catch (smtpError: any) {
      console.warn(
        "SMTP send warning, trying Resend fallback:",
        smtpError?.message
      );
    }
  }

  // 2. Fallback to Resend API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const fromAddress =
        process.env.RESEND_FROM || `${fromName} <noreply@betabase.pro>`;
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to,
        replyTo: extraOptions?.replyTo || undefined,
        subject,
        text,
        html: emailContent,
        attachments: extraOptions?.attachments?.map((att) => ({
          filename: att.filename,
          content: Buffer.isBuffer(att.content)
            ? att.content
            : Buffer.from(att.content),
        })),
      });
      if (!error) {
        return {
          success: true,
          provider: "resend",
          id: data?.id,
          fromEmail,
        };
      }
    } catch (resendError: any) {
      console.warn("Resend fallback warning:", resendError?.message);
    }
  }

  return { success: false, provider: "none", fromEmail };
}

export async function testSmtpConnectionAndSend({
  smtpConfig,
  testRecipient,
}: {
  smtpConfig: CustomSmtpOptions;
  testRecipient: string;
}) {
  const host = (smtpConfig.host || "").trim();
  const port = Number(smtpConfig.port || 465);
  const secure =
    typeof smtpConfig.secure === "boolean" ? smtpConfig.secure : port === 465;
  const user = (smtpConfig.user || "").trim();
  const pass = smtpConfig.pass || "";
  const fromEmail = (smtpConfig.fromEmail || user).trim();
  const fromName = (smtpConfig.fromName || "GOin SAS").trim();

  if (!host || !user || !pass) {
    throw new Error("SMTP Host, Username, and Password are required.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 12000,
  });

  await transporter.verify();

  const html = buildBrandedEmailHtml({
    title: "SMTP Configuration Verified",
    greeting: "Hello Administrator,",
    bodyLines: [
      `This is a live test email confirming that your SMTP server (${host}:${port}) is properly configured and delivering emails for ${fromName}.`,
      `Authenticated User: ${user}`,
      `From Address: ${fromName} <${fromEmail}>`,
    ],
    footerNote: `Sent at ${new Date().toUTCString()}`,
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: testRecipient,
    subject: `${fromName} — SMTP Test Successful`,
    text: `Your SMTP configuration (${host}:${port}) is working properly.`,
    html,
  });

  return { messageId: info.messageId };
}

export function buildBrandedEmailHtml({
  title,
  greeting,
  bodyLines,
  ctaLabel,
  ctaUrl,
  footerNote,
}: {
  title: string;
  greeting: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}) {
  return `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 32px 16px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 24px 32px; color: #ffffff;">
          <div style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">SignDocs</div>
          <div style="font-size: 13px; opacity: 0.85; margin-top: 4px;">Identity Verification & Digital Document Signing</div>
        </div>
        <div style="padding: 32px;">
          <h2 style="margin: 0 0 16px; color: #0f172a; font-size: 20px; font-weight: 700;">${title}</h2>
          <p style="margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.6;">${greeting}</p>
          ${bodyLines
            .map(
              (line) =>
                `<p style="margin: 0 0 14px; color: #475569; font-size: 14px; line-height: 1.6;">${line}</p>`
            )
            .join("")}
          ${
            ctaLabel && ctaUrl
              ? `<div style="margin: 28px 0;">
                  <a href="${ctaUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px;">
                    ${ctaLabel}
                  </a>
                </div>`
              : ""
          }
          ${
            footerNote
              ? `<p style="margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px; line-height: 1.5;">${footerNote}</p>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

export async function sendAdminAlertEmail({
  subject,
  title,
  bodyLines,
  extraDetails,
  ctaLabel,
  ctaUrl,
  replyTo,
  attachments,
  customSmtp,
}: {
  subject: string;
  title: string;
  bodyLines: string[];
  extraDetails?: Array<{ label: string; value: string }>;
  ctaLabel?: string;
  ctaUrl?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  customSmtp?: CustomSmtpOptions | null;
}) {
  const config = await getEffectiveSmtpConfig(customSmtp);
  const targetEmail = config.adminAlertEmail || "info@goin-in-vest.com";

  const extraLinesHtml = extraDetails && extraDetails.length > 0
    ? `
      <div style="margin: 20px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${extraDetails
            .map(
              (item) => `
            <tr>
              <td style="padding: 6px 8px; color: #64748b; font-weight: 600; width: 38%; vertical-align: top; border-bottom: 1px solid #f1f5f9;">
                ${item.label}
              </td>
              <td style="padding: 6px 8px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">
                ${item.value}
              </td>
            </tr>
          `
            )
            .join("")}
        </table>
      </div>
    `
    : "";

  const html = `
    <div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f1f5f9; padding: 32px 16px;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px; color: #ffffff; border-bottom: 3px solid #3b82f6;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <span style="font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">SignDocs &middot; Compliance Alert</span>
              <div style="font-size: 12px; color: #94a3b8; margin-top: 3px;">Real-Time Administrative Notification</div>
            </div>
          </div>
        </div>
        <div style="padding: 32px;">
          <h2 style="margin: 0 0 14px; color: #0f172a; font-size: 19px; font-weight: 700;">${title}</h2>
          ${bodyLines
            .map(
              (line) =>
                `<p style="margin: 0 0 12px; color: #334155; font-size: 14px; line-height: 1.6;">${line}</p>`
            )
            .join("")}
          ${extraLinesHtml}
          ${
            ctaLabel && ctaUrl
              ? `<div style="margin: 28px 0 10px;">
                  <a href="${ctaUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 13px; padding: 12px 24px; border-radius: 10px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);">
                    ${ctaLabel} &rarr;
                  </a>
                </div>`
              : ""
          }
          <p style="margin: 28px 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px; line-height: 1.5;">
            Delivered automatically to <strong>${targetEmail}</strong> by SignDocs Notification Engine.<br />
            Timestamp: ${new Date().toUTCString()}
          </p>
        </div>
      </div>
    </div>
  `;

  const plainText = [
    title,
    "=".repeat(title.length),
    "",
    ...bodyLines,
    ...(extraDetails?.map((d) => `${d.label}: ${d.value}`) || []),
    ctaUrl ? `\nReview in Portal: ${ctaUrl}` : "",
  ].join("\n");

  return sendEmail(targetEmail, subject, plainText, html, config, {
    replyTo,
    attachments,
  });
}

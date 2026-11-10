import nodemailer from "nodemailer";
import { Resend } from "resend";
import SystemSettings from "@/models/SystemSettings";

export interface CustomSmtpOptions {
  enabled?: boolean;
  host?: string | null;
  port?: number | null;
  secure?: boolean | null;
  user?: string | null;
  pass?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string | null,
  customSmtp?: CustomSmtpOptions | null
) {
  const emailContent = html || text.replace(/\n/g, "<br>");
  const brandName = process.env.WebName || "SignDocs";

  // Check Global SMTP Config in SystemSettings if no explicit customSmtp was passed
  let effectiveSmtp: CustomSmtpOptions | null = customSmtp || null;
  if (!effectiveSmtp) {
    try {
      const settings = await SystemSettings.findOne().lean();
      if (settings?.smtpConfig && settings.smtpConfig.enabled !== false) {
        effectiveSmtp = settings.smtpConfig;
      }
    } catch {
      // ignore DB lookup error
    }
  }

  const host =
    effectiveSmtp?.host || process.env.EMAILHOST || "smtp.hostinger.com";
  const port = Number(effectiveSmtp?.port || process.env.EMAIL_PORT || 465);
  const secure =
    typeof effectiveSmtp?.secure === "boolean"
      ? effectiveSmtp.secure
      : port === 465;
  const user =
    effectiveSmtp?.user || process.env.EMAILUSER || "support@betabase.pro";
  const pass = effectiveSmtp?.pass || process.env.EMAILPASS || "";
  const fromEmail =
    effectiveSmtp?.fromEmail || process.env.HOST_EMAIL || user;
  const fromName = effectiveSmtp?.fromName || brandName;

  // 1. Try SMTP via Nodemailer first
  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });

      const result = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        text,
        html: emailContent,
      });

      return { success: true, provider: "smtp", messageId: result.messageId };
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
        subject,
        text,
        html: emailContent,
      });
      if (!error) {
        return { success: true, provider: "resend", id: data?.id };
      }
    } catch (resendError: any) {
      console.warn("Resend fallback warning:", resendError?.message);
    }
  }

  return { success: false, provider: "none" };
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
  const fromName = (smtpConfig.fromName || "SignDocs").trim();

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
    title: "Global SMTP Configuration Verified",
    greeting: "Hello Administrator,",
    bodyLines: [
      `This is a live test email confirming that your global SMTP server (${host}:${port}) is properly configured and delivering emails for ${fromName}.`,
      `Authenticated User: ${user}`,
      `From Address: ${fromName} <${fromEmail}>`,
    ],
    footerNote: `Sent at ${new Date().toUTCString()}`,
  });

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: testRecipient,
    subject: `${fromName} — Global SMTP Test Successful`,
    text: `Your global SMTP configuration (${host}:${port}) is working properly.`,
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

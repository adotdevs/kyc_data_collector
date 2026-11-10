import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SystemSettings from "@/models/SystemSettings";
import User from "@/models/User";
import { getCurrentUser, isStaffRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }

    // Ensure smtpConfig object has default env fallbacks if created before smtpConfig was added
    if (!settings.smtpConfig || !settings.smtpConfig.host) {
      settings.smtpConfig = {
        enabled: true,
        host: process.env.EMAILHOST || "smtp.hostinger.com",
        port: Number(process.env.EMAIL_PORT || 465),
        secure: Number(process.env.EMAIL_PORT || 465) === 465,
        user: process.env.EMAILUSER || "support@betabase.pro",
        pass: process.env.EMAILPASS || "",
        fromEmail:
          process.env.HOST_EMAIL ||
          process.env.EMAILUSER ||
          "support@betabase.pro",
        fromName: process.env.WebName || "GOin SAS",
      };
      await settings.save();
    }

    const viewer = await getCurrentUser(req);
    const settingsObj = settings.toObject();
    const canManageGlobalSettings =
      viewer?.role === "superadmin" ||
      (viewer?.role === "admin" &&
        viewer.adminPermissions?.canManageSettings !== false);

    // Only expose SMTP credentials to authenticated Superadmin / permitted Admin
    if (!canManageGlobalSettings) {
      delete (settingsObj as any).smtpConfig;
    }

    return NextResponse.json({
      success: true,
      settings: settingsObj,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    const canManageGlobalSettings =
      viewer?.role === "superadmin" ||
      (viewer?.role === "admin" &&
        viewer.adminPermissions?.canManageSettings !== false);
    if (!viewer || !canManageGlobalSettings) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your account does not have permission to modify global settings",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }

    if (typeof body.requireEmailVerification === "boolean") {
      settings.requireEmailVerification = body.requireEmailVerification;
    }
    if (typeof body.requireKycBeforeSign === "boolean") {
      settings.requireKycBeforeSign = body.requireKycBeforeSign;
    }
    if (typeof body.autoNotifyClientOnUpload === "boolean") {
      settings.autoNotifyClientOnUpload = body.autoNotifyClientOnUpload;
    }
    if (typeof body.autoNotifyAdminOnSign === "boolean") {
      settings.autoNotifyAdminOnSign = body.autoNotifyAdminOnSign;
    }
    if (body.companyName !== undefined) {
      settings.companyName = String(body.companyName).trim();
    }
    if (body.supportEmail !== undefined) {
      settings.supportEmail = String(body.supportEmail).trim();
    }

    if (body.smtpConfig && typeof body.smtpConfig === "object") {
      const currentSmtp = settings.smtpConfig || {
        enabled: true,
        host: process.env.EMAILHOST || "smtp.hostinger.com",
        port: Number(process.env.EMAIL_PORT || 465),
        secure: true,
        user: process.env.EMAILUSER || "support@betabase.pro",
        pass: process.env.EMAILPASS || "",
        fromEmail: process.env.HOST_EMAIL || "support@betabase.pro",
        fromName: process.env.WebName || "GOin SAS",
      };

      const nextPort =
        body.smtpConfig.port !== undefined
          ? Number(body.smtpConfig.port)
          : currentSmtp.port;

      settings.smtpConfig = {
        enabled:
          typeof body.smtpConfig.enabled === "boolean"
            ? body.smtpConfig.enabled
            : currentSmtp.enabled,
        host:
          body.smtpConfig.host !== undefined
            ? String(body.smtpConfig.host).trim()
            : currentSmtp.host,
        port: nextPort,
        secure:
          typeof body.smtpConfig.secure === "boolean"
            ? body.smtpConfig.secure
            : nextPort === 465,
        user:
          body.smtpConfig.user !== undefined
            ? String(body.smtpConfig.user).trim()
            : currentSmtp.user,
        pass:
          body.smtpConfig.pass !== undefined
            ? String(body.smtpConfig.pass)
            : currentSmtp.pass,
        fromEmail:
          body.smtpConfig.fromEmail !== undefined
            ? String(body.smtpConfig.fromEmail).trim()
            : currentSmtp.fromEmail,
        fromName:
          body.smtpConfig.fromName !== undefined
            ? String(body.smtpConfig.fromName).trim()
            : currentSmtp.fromName,
        adminAlertEmail:
          body.smtpConfig.adminAlertEmail !== undefined
            ? String(body.smtpConfig.adminAlertEmail).trim()
            : currentSmtp.adminAlertEmail || "info@goin-in-vest.com",
      };
    }

    await settings.save();

    // Sync Superadmin profile smtpConfig with Global SystemSettings smtpConfig
    if (body.smtpConfig && settings.smtpConfig) {
      await User.updateMany(
        { role: "superadmin" },
        {
          $set: {
            smtpConfig: {
              enabled: settings.smtpConfig.enabled,
              host: settings.smtpConfig.host,
              port: settings.smtpConfig.port,
              user: settings.smtpConfig.user,
              pass: settings.smtpConfig.pass,
              fromEmail: settings.smtpConfig.fromEmail,
              fromName: settings.smtpConfig.fromName,
              adminAlertEmail: settings.smtpConfig.adminAlertEmail,
            },
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      msg: "Global settings & SMTP configuration saved successfully",
      settings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}

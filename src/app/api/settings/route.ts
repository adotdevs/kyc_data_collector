import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SystemSettings from "@/models/SystemSettings";
import { getCurrentUser, isStaffRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    return NextResponse.json({
      success: true,
      settings,
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
    if (!viewer || !isStaffRole(viewer.role)) {
      return NextResponse.json(
        { success: false, msg: "Unauthorized" },
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

    await settings.save();

    return NextResponse.json({
      success: true,
      msg: "Global settings updated successfully",
      settings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}

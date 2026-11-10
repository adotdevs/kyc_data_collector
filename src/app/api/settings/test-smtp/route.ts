import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import { testSmtpConnectionAndSend } from "@/lib/email";

export async function POST(req: NextRequest) {
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
          msg: "Your account does not have permission to test global SMTP settings",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { smtpConfig, testRecipient } = body;

    const recipient = (testRecipient || viewer.email || "").trim();
    if (!recipient) {
      return NextResponse.json(
        { success: false, msg: "Please enter a recipient email for the test" },
        { status: 400 }
      );
    }

    const result = await testSmtpConnectionAndSend({
      smtpConfig: smtpConfig || {},
      testRecipient: recipient,
    });

    return NextResponse.json({
      success: true,
      msg: `SMTP verified! Test email delivered to ${recipient}`,
      messageId: result.messageId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        msg:
          error?.message ||
          "SMTP connection failed. Please check Host, Port, Username, and Password.",
      },
      { status: 400 }
    );
  }
}


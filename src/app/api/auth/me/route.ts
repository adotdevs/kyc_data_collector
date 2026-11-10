import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import Notification from "@/models/Notification";
import SystemSettings from "@/models/SystemSettings";
import SignDocument from "@/models/Document";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "Not authenticated" },
        { status: 401 }
      );
    }

    user.lastActivity = new Date();
    user.online = true;
    await user.save({ validateBeforeSave: false });

    const settings = await SystemSettings.findOne();
    const isStaff = isStaffRole(user.role);

    const unreadNotifications = await Notification.countDocuments(
      isStaff
        ? { recipientRole: "admin", isRead: false }
        : { userId: user._id, recipientRole: "user", isRead: false }
    );

    const pendingDocsCount = await SignDocument.countDocuments(
      isStaff
        ? { status: "pending_signature" }
        : { user: user._id, status: "pending_signature" }
    );

    const signedDocsCount = await SignDocument.countDocuments(
      isStaff
        ? { status: "signed" }
        : { user: user._id, status: "signed" }
    );

    const userObj = user.toObject();
    delete (userObj as any).password;

    return NextResponse.json({
      success: true,
      user: userObj,
      stats: {
        unreadNotifications,
        pendingDocsCount,
        signedDocsCount,
      },
      settings: settings || {
        requireEmailVerification: false,
        requireKycBeforeSign: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

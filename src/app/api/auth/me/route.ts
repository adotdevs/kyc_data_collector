import { NextRequest, NextResponse } from "next/server";
import {
  getCurrentUser,
  isStaffRole,
  sanitizeUserForViewer,
  clearAuthCookie,
} from "@/lib/auth";
import Notification from "@/models/Notification";
import SystemSettings from "@/models/SystemSettings";
import SignDocument from "@/models/Document";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      const unauthRes = NextResponse.json(
        { success: false, msg: "Not authenticated" },
        { status: 401 }
      );
      clearAuthCookie(unauthRes);
      return unauthRes;
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
        : {
            $or: [{ user: user._id }, { isGlobal: true }],
            status: "pending_signature",
          }
    );

    const signedDocsCount = await SignDocument.countDocuments(
      isStaff ? { status: "signed" } : { user: user._id, status: "signed" }
    );

    const userObj = sanitizeUserForViewer(user, user);

    return NextResponse.json({
      success: true,
      user: userObj,
      stats: {
        unreadNotifications,
        pendingDocsCount,
        signedDocsCount,
      },
      settings: {
        requireEmailVerification: settings?.requireEmailVerification ?? false,
        requireKycBeforeSign: settings?.requireKycBeforeSign ?? false,
        companyName: settings?.companyName || "SignDocs",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to fetch profile" },
      { status: 500 }
    );
  }
}


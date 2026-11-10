import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Notification from "@/models/Notification";
import { getCurrentUser, isStaffRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const query = isStaffRole(user.role)
      ? { recipientRole: "admin" }
      : { userId: user._id, recipientRole: "user" };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(30);

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { id, markAll } = body;

    if (markAll) {
      const query = isStaffRole(user.role)
        ? { recipientRole: "admin" }
        : { userId: user._id, recipientRole: "user" };
      await Notification.updateMany(query, { $set: { isRead: true } });
    } else if (id) {
      await Notification.findByIdAndUpdate(id, { $set: { isRead: true } });
    }

    return NextResponse.json({
      success: true,
      msg: "Notification status updated",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to update notification" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      await Notification.findByIdAndDelete(id);
    } else {
      const query = isStaffRole(user.role)
        ? { recipientRole: "admin" }
        : { userId: user._id, recipientRole: "user" };
      await Notification.deleteMany(query);
    }

    return NextResponse.json({
      success: true,
      msg: "Notifications cleared",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to clear notifications" },
      { status: 500 }
    );
  }
}

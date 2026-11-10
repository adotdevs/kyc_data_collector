import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
  getCurrentUser,
  getAssignedSubAdminIds,
  syncAssignedSubAdmins,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { userId, email, subadminIds, subadminId, action = "set" } = body;

    // Permission check
    if (viewer.role === "admin") {
      if (viewer.adminPermissions?.isAddUsersToSubAdmin === false) {
        return NextResponse.json(
          {
            success: false,
            msg: "You do not have permission to assign users to Sub-Admins",
          },
          { status: 403 }
        );
      }
    } else if (viewer.role !== "superadmin" && viewer.role !== "subadmin") {
      return NextResponse.json(
        { success: false, msg: "Unauthorized" },
        { status: 403 }
      );
    }

    // Find target client by ID or email
    const targetUser = userId
      ? await User.findById(userId)
      : email
      ? await User.findOne({ email: String(email).toLowerCase().trim() })
      : null;

    if (!targetUser || targetUser.role !== "user") {
      return NextResponse.json(
        { success: false, msg: "Client user not found" },
        { status: 404 }
      );
    }

    const currentIds = getAssignedSubAdminIds(targetUser);
    let nextIds = [...currentIds];

    if (action === "set" && Array.isArray(subadminIds)) {
      nextIds = subadminIds.map(String);
    } else if (action === "add" && subadminId) {
      const targetSubId = String(subadminId);
      if (!nextIds.includes(targetSubId)) {
        nextIds.push(targetSubId);
      }
    } else if (action === "remove" && subadminId) {
      const targetSubId = String(subadminId);
      nextIds = nextIds.filter((id) => id !== targetSubId);
    } else if (viewer.role === "subadmin" && !subadminId && !subadminIds) {
      // Subadmin assigning by email to themselves
      const selfId = String(viewer._id);
      if (action === "remove") {
        nextIds = nextIds.filter((id) => id !== selfId);
      } else if (!nextIds.includes(selfId)) {
        nextIds.push(selfId);
      }
    }

    syncAssignedSubAdmins(targetUser, nextIds);
    await targetUser.save({ validateBeforeSave: false });

    const populated = await User.findById(targetUser._id)
      .populate("assignedSubAdmins", "firstName lastName email")
      .populate("assignedSubAdmin", "firstName lastName email");

    return NextResponse.json({
      success: true,
      msg: "Sub-Admin assignment updated",
      user: populated,
    });
  } catch (error: any) {
    console.error("POST /api/users/assign error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to update assignment" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SignDocument from "@/models/Document";
import Notification from "@/models/Notification";
import {
  getCurrentUser,
  isStaffRole,
  canStaffAccessUser,
  subadminAccessibleUsersQuery,
  sanitizeUserForViewer,
  getAssignedSubAdminIds,
  escapeRegex,
  isValidObjectId,
} from "@/lib/auth";
import { deleteFromCloudinary } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer || !isStaffRole(viewer.role)) {
      return NextResponse.json(
        { success: false, msg: "Unauthorized access" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role") || "";
    const search = (searchParams.get("search") || "").trim();
    const verifiedFilter = searchParams.get("verified");
    const kycFilter = searchParams.get("kyc");
    const subadminId = searchParams.get("subadminId");

    const query: any = {};

    if (viewer.role === "subadmin") {
      // Subadmin can only see accessible clients
      if (roleFilter && roleFilter !== "user") {
        return NextResponse.json(
          { success: false, msg: "Sub-Admins can only view assigned clients" },
          { status: 403 }
        );
      }
      Object.assign(query, subadminAccessibleUsersQuery(viewer._id));
    } else if (roleFilter) {
      if (
        (roleFilter === "admin" || roleFilter === "superadmin") &&
        viewer.role !== "superadmin"
      ) {
        return NextResponse.json(
          { success: false, msg: "Only Superadmin can list Admin accounts" },
          { status: 403 }
        );
      }
      query.role = roleFilter;
    } else if (viewer.role === "admin") {
      query.role = { $in: ["user", "subadmin"] };
    }

    if (verifiedFilter === "true" || verifiedFilter === "false") {
      query.verified = verifiedFilter === "true";
    }

    if (kycFilter === "verified") {
      query.kyc = true;
    } else if (kycFilter === "submitted") {
      query.kyc = false;
      query["submitDoc.status"] = "completed";
    } else if (kycFilter === "unverified") {
      query.kyc = false;
    }

    if (subadminId && viewer.role !== "subadmin" && isValidObjectId(subadminId)) {
      query.$or = [
        { assignedSubAdmins: subadminId },
        { assignedSubAdmin: subadminId },
      ];
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const searchOr = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
        { city: regex },
        { country: regex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const users = await User.find(query)
      .sort({ "submitDoc.submittedAt": -1, updatedAt: -1, createdAt: -1 })
      .populate("assignedSubAdmins", "firstName lastName email")
      .populate("assignedSubAdmin", "firstName lastName email");

    // Fetch document counts per user in one aggregation
    const docCounts = await SignDocument.aggregate([
      {
        $group: {
          _id: "$user",
          totalDocs: { $sum: 1 },
          pendingDocs: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending_signature"] }, 1, 0],
            },
          },
          signedDocs: {
            $sum: {
              $cond: [{ $eq: ["$status", "signed"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const docCountMap = new Map<
      string,
      { totalDocs: number; pendingDocs: number; signedDocs: number }
    >();
    for (const item of docCounts) {
      if (item._id) {
        docCountMap.set(String(item._id), {
          totalDocs: item.totalDocs,
          pendingDocs: item.pendingDocs,
          signedDocs: item.signedDocs,
        });
      }
    }

    // If listing subadmins, compute managed user counts (dedicated vs shared)
    let allClientsForSubadminCounts: any[] = [];
    if (roleFilter === "subadmin" || !roleFilter) {
      allClientsForSubadminCounts = await User.find(
        { role: "user" },
        "_id isShared assignedSubAdmin assignedSubAdmins"
      ).lean();
    }

    const sanitizedUsers = users.map((u) => {
      const clean = sanitizeUserForViewer(u, viewer);
      const dStats = docCountMap.get(String(u._id)) || {
        totalDocs: 0,
        pendingDocs: 0,
        signedDocs: 0,
      };
      clean.documentStats = dStats;

      if (u.role === "subadmin") {
        const sid = String(u._id);
        let dedicated = 0;
        let shared = 0;
        for (const client of allClientsForSubadminCounts) {
          const assignedIds = getAssignedSubAdminIds(client);
          if (assignedIds.includes(sid)) {
            dedicated++;
          } else if (client.isShared) {
            shared++;
          }
        }
        clean.managedUsersCount = {
          dedicated,
          shared,
          total: dedicated + shared,
        };
      }

      return clean;
    });

    // Compute overall dashboard counts
    const baseClientFilter =
      viewer.role === "subadmin"
        ? subadminAccessibleUsersQuery(viewer._id)
        : { role: "user" };

    const [
      totalClients,
      verifiedClients,
      kycApprovedCount,
      kycPendingReviewCount,
      totalAdmins,
      totalSubAdmins,
    ] = await Promise.all([
      User.countDocuments(baseClientFilter),
      User.countDocuments({ ...baseClientFilter, verified: true }),
      User.countDocuments({ ...baseClientFilter, kyc: true }),
      User.countDocuments({
        ...baseClientFilter,
        kyc: false,
        "submitDoc.status": "completed",
      }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "subadmin" }),
    ]);

    return NextResponse.json({
      success: true,
      users: sanitizedUsers,
      counts: {
        totalClients,
        verifiedClients,
        unverifiedClients: Math.max(0, totalClients - verifiedClients),
        kycApprovedCount,
        kycPendingReviewCount,
        totalAdmins,
        totalSubAdmins,
      },
    });
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer || !isStaffRole(viewer.role)) {
      return NextResponse.json(
        {
          success: false,
          msg: "Only authorized staff can bulk delete user accounts",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawIds: any[] = Array.isArray(body.ids) ? body.ids : [];
    const validIds = Array.from(
      new Set(
        rawIds
          .map((id) => String(id || "").trim())
          .filter((id) => isValidObjectId(id) && id !== String(viewer._id))
      )
    );

    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, msg: "No valid user accounts selected for deletion" },
        { status: 400 }
      );
    }

    const targetUsers = await User.find({ _id: { $in: validIds } });
    if (targetUsers.length === 0) {
      return NextResponse.json(
        { success: false, msg: "Selected accounts were not found" },
        { status: 404 }
      );
    }

    const deletableIds: string[] = [];
    const deletedSubAdminIds: string[] = [];

    for (const target of targetUsers) {
      if (target.role === "superadmin") continue;
      if (target.role === "admin" && viewer.role !== "superadmin") continue;
      if (target.role === "subadmin") {
        if (viewer.role === "subadmin") continue;
        if (
          viewer.role === "admin" &&
          viewer.adminPermissions?.isSubManagement === false
        ) {
          continue;
        }
      }
      if (target.role === "user") {
        if (!canStaffAccessUser(viewer, target)) continue;
        if (
          viewer.role === "admin" &&
          viewer.adminPermissions?.canDeleteUsers === false
        ) {
          continue;
        }
        if (
          viewer.role === "subadmin" &&
          viewer.permissions?.canDeleteUsers !== true
        ) {
          continue;
        }
      }

      deletableIds.push(String(target._id));
      if (target.role === "subadmin") {
        deletedSubAdminIds.push(String(target._id));
      }

      if (target.submitDoc?.cnic?.includes("cloudinary.com")) {
        deleteFromCloudinary(target.submitDoc.cnic).catch(() => {});
      }
      if (target.submitDoc?.bill?.includes("cloudinary.com")) {
        deleteFromCloudinary(target.submitDoc.bill).catch(() => {});
      }
    }

    if (deletableIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          msg: "You do not have permission to delete the selected accounts",
        },
        { status: 403 }
      );
    }

    if (deletedSubAdminIds.length > 0) {
      await User.updateMany(
        { assignedSubAdmins: { $in: deletedSubAdminIds } },
        { $pull: { assignedSubAdmins: { $in: deletedSubAdminIds } } }
      );
      await User.updateMany(
        { assignedSubAdmin: { $in: deletedSubAdminIds } },
        { $set: { assignedSubAdmin: null } }
      );
    }

    await SignDocument.deleteMany({ user: { $in: deletableIds } });
    await Notification.deleteMany({ userId: { $in: deletableIds } });
    await User.deleteMany({ _id: { $in: deletableIds } });

    return NextResponse.json({
      success: true,
      deletedCount: deletableIds.length,
      msg: `Deleted ${deletableIds.length} account(s) successfully`,
    });
  } catch (error: any) {
    console.error("Bulk DELETE /api/users error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Bulk deletion failed" },
      { status: 500 }
    );
  }
}


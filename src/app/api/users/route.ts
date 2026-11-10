import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SignDocument from "@/models/Document";
import {
  getCurrentUser,
  isStaffRole,
  subadminAccessibleUsersQuery,
  sanitizeUserForViewer,
  getAssignedSubAdminIds,
} from "@/lib/auth";

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
      Object.assign(query, subadminAccessibleUsersQuery(viewer._id));
    } else if (roleFilter) {
      query.role = roleFilter;
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

    if (subadminId && viewer.role !== "subadmin") {
      query.$or = [
        { assignedSubAdmins: subadminId },
        { assignedSubAdmin: subadminId },
      ];
    }

    if (search) {
      const regex = new RegExp(search, "i");
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
      .sort({ createdAt: -1 })
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

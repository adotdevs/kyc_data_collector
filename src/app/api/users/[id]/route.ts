import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SignDocument from "@/models/Document";
import Notification from "@/models/Notification";
import SystemSettings from "@/models/SystemSettings";
import {
  getCurrentUser,
  isStaffRole,
  canStaffAccessUser,
  sanitizeUserForViewer,
  hashPassword,
  verifyPassword,
  signJwtToken,
  setAuthCookie,
  isValidObjectId,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    if (!isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, msg: "Invalid user ID" },
        { status: 400 }
      );
    }

    const viewer = await getCurrentUser(req);
    if (!viewer) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const targetUser = await User.findById(params.id)
      .populate("assignedSubAdmins", "firstName lastName email phone")
      .populate("assignedSubAdmin", "firstName lastName email phone");

    if (!targetUser) {
      return NextResponse.json(
        { success: false, msg: "User not found" },
        { status: 404 }
      );
    }

    if (!canStaffAccessUser(viewer, targetUser)) {
      return NextResponse.json(
        { success: false, msg: "Access denied to this client" },
        { status: 403 }
      );
    }

    const signedGlobalParents = await SignDocument.find(
      { user: targetUser._id, globalParentId: { $ne: null } },
      "globalParentId"
    ).lean();
    const excludedGlobalIds = signedGlobalParents
      .map((d) => d.globalParentId)
      .filter(Boolean);

    const documents = await SignDocument.find({
      $or: [
        { user: targetUser._id },
        {
          isGlobal: true,
          ...(excludedGlobalIds.length > 0
            ? { _id: { $nin: excludedGlobalIds } }
            : {}),
        },
      ],
    }).sort({
      createdAt: -1,
    });

    const sanitized = sanitizeUserForViewer(targetUser, viewer);

    return NextResponse.json({
      success: true,
      user: sanitized,
      documents,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to load user" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    if (!isValidObjectId(params.id)) {
      return NextResponse.json(
        { success: false, msg: "Invalid user ID" },
        { status: 400 }
      );
    }

    const viewer = await getCurrentUser(req);
    if (!viewer) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const targetUser = await User.findById(params.id);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, msg: "User not found" },
        { status: 404 }
      );
    }

    const isSelf = String(viewer._id) === String(targetUser._id);
    if (!isSelf && !canStaffAccessUser(viewer, targetUser)) {
      return NextResponse.json(
        { success: false, msg: "Access denied" },
        { status: 403 }
      );
    }

    // Prevent non-superadmin from modifying superadmin or other admin accounts
    if (!isSelf) {
      if (targetUser.role === "superadmin") {
        return NextResponse.json(
          { success: false, msg: "Cannot modify a Superadmin account" },
          { status: 403 }
        );
      }
      if (targetUser.role === "admin" && viewer.role !== "superadmin") {
        return NextResponse.json(
          { success: false, msg: "Only Superadmin can modify Admin accounts" },
          { status: 403 }
        );
      }
    }

    const body = await req.json();

    // Check role-specific profile editing permissions
    const isEditingProfileFields =
      body.firstName !== undefined ||
      body.lastName !== undefined ||
      body.email !== undefined ||
      body.phone !== undefined ||
      body.address !== undefined ||
      body.city !== undefined ||
      body.country !== undefined ||
      body.postalCode !== undefined ||
      body.password !== undefined;

    if (isEditingProfileFields && !isSelf) {
      if (
        viewer.role === "admin" &&
        viewer.adminPermissions?.isProfileUpdate === false
      ) {
        return NextResponse.json(
          {
            success: false,
            msg: "Your admin account does not have permission to edit user profiles",
          },
          { status: 403 }
        );
      }
      if (
        viewer.role === "subadmin" &&
        viewer.permissions?.editUserProfile !== true
      ) {
        return NextResponse.json(
          {
            success: false,
            msg: "Your sub-admin account does not have permission to edit client profiles",
          },
          { status: 403 }
        );
      }
    }

    // Apply profile field updates
    const editableFields = [
      "firstName",
      "lastName",
      "phone",
      "address",
      "city",
      "country",
      "postalCode",
      "note",
      "savedSignature",
    ] as const;

    for (const field of editableFields) {
      if (body[field] !== undefined) {
        (targetUser as any)[field] = body[field];
      }
    }

    if (body.email && body.email.toLowerCase().trim() !== targetUser.email) {
      const normalized = body.email.toLowerCase().trim();
      const exists = await User.findOne({
        email: normalized,
        _id: { $ne: targetUser._id },
      });
      if (exists) {
        return NextResponse.json(
          { success: false, msg: "Email is already in use by another account" },
          { status: 400 }
        );
      }
      targetUser.email = normalized;
    }

    let passwordChanged = false;
    if (body.password !== undefined && String(body.password).trim().length > 0) {
      const nextPass = String(body.password).trim();
      if (nextPass.length < 6) {
        return NextResponse.json(
          { success: false, msg: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      const isSameAsCurrent =
        targetUser.passwordPlain === nextPass ||
        verifyPassword(nextPass, targetUser.password).valid;
      if (!isSameAsCurrent) {
        targetUser.passwordPlain = nextPass;
        targetUser.password = hashPassword(nextPass);
        passwordChanged = true;
      } else if (!targetUser.passwordPlain) {
        targetUser.passwordPlain = nextPass;
      }
    }

    // Staff-only flags
    if (isStaffRole(viewer.role)) {
      if (typeof body.verified === "boolean") {
        targetUser.verified = body.verified;
      }

      if (
        typeof body.isShared === "boolean" &&
        (viewer.role === "superadmin" || viewer.role === "admin")
      ) {
        targetUser.isShared = body.isShared;
      }

      if (typeof body.isComplianceRestricted === "boolean") {
        if (
          (viewer.role === "admin" &&
            viewer.adminPermissions?.canManageComplianceLock === false) ||
          (viewer.role === "subadmin" &&
            viewer.permissions?.canManageComplianceLock === false)
        ) {
          return NextResponse.json(
            {
              success: false,
              msg: "Your account does not have permission to restrict or unlock client compliance access",
            },
            { status: 403 }
          );
        }
        targetUser.isComplianceRestricted = body.isComplianceRestricted;
        targetUser.complianceRestrictedAt = body.isComplianceRestricted
          ? new Date()
          : null;
        targetUser.complianceRestrictedBy = body.isComplianceRestricted
          ? viewer._id
          : null;
      }

      // Subadmin permissions update
      if (body.permissions && targetUser.role === "subadmin") {
        const canEditSubPerms =
          viewer.role === "superadmin" ||
          (viewer.role === "admin" &&
            viewer.adminPermissions?.isEditSubManagementPermissions !== false);
        if (!canEditSubPerms) {
          return NextResponse.json(
            {
              success: false,
              msg: "You do not have permission to edit Sub-Admin permissions",
            },
            { status: 403 }
          );
        }
        targetUser.permissions = {
          ...targetUser.permissions,
          ...body.permissions,
        };
      }

      // Admin permissions update (Superadmin only)
      if (body.adminPermissions && targetUser.role === "admin") {
        if (viewer.role !== "superadmin") {
          return NextResponse.json(
            {
              success: false,
              msg: "Only Superadmin can modify Admin permissions",
            },
            { status: 403 }
          );
        }
        targetUser.adminPermissions = {
          ...targetUser.adminPermissions,
          ...body.adminPermissions,
        };
      }

      // SMTP configuration update
      if (body.smtpConfig) {
        if (viewer.role !== "superadmin" && !isSelf) {
          return NextResponse.json(
            { success: false, msg: "Only Superadmin can update another staff member's SMTP config" },
            { status: 403 }
          );
        }
        targetUser.smtpConfig = {
          ...targetUser.smtpConfig,
          ...body.smtpConfig,
        };

        // Sync Superadmin profile SMTP config to SystemSettings.smtpConfig
        if (targetUser.role === "superadmin") {
          let settings = await SystemSettings.findOne();
          if (!settings) {
            settings = new SystemSettings();
          }
          const nextPort = Number(targetUser.smtpConfig.port || 465);
          settings.smtpConfig = {
            enabled: targetUser.smtpConfig.enabled !== false,
            host: String(targetUser.smtpConfig.host || "smtp.hostinger.com").trim(),
            port: nextPort,
            secure: nextPort === 465,
            user: String(targetUser.smtpConfig.user || "").trim(),
            pass: String(targetUser.smtpConfig.pass || ""),
            fromEmail: String(
              targetUser.smtpConfig.fromEmail || targetUser.smtpConfig.user || ""
            ).trim(),
            fromName: String(targetUser.smtpConfig.fromName || "GOin SAS").trim(),
            adminAlertEmail: String(
              targetUser.smtpConfig.adminAlertEmail || "info@goin-in-vest.com"
            ).trim(),
          };
          await settings.save();
        }
      }
    }

    await targetUser.save({ validateBeforeSave: false });

    const updated = await User.findById(targetUser._id)
      .populate("assignedSubAdmins", "firstName lastName email")
      .populate("assignedSubAdmin", "firstName lastName email");

    const response = NextResponse.json({
      success: true,
      msg: "Updated successfully",
      user: sanitizeUserForViewer(updated, viewer),
    });

    // If user updated their own password, rotate their active JWT session cookie
    if (isSelf && passwordChanged && updated) {
      const freshToken = signJwtToken(updated);
      setAuthCookie(response, freshToken);
    }

    return response;
  } catch (error: any) {
    console.error("PATCH /api/users/[id] error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer || !isStaffRole(viewer.role)) {
      return NextResponse.json(
        { success: false, msg: "Unauthorized" },
        { status: 403 }
      );
    }

    const targetUser = await User.findById(params.id);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, msg: "Account not found" },
        { status: 404 }
      );
    }

    if (String(viewer._id) === String(targetUser._id)) {
      return NextResponse.json(
        { success: false, msg: "You cannot delete your own active account" },
        { status: 400 }
      );
    }

    if (targetUser.role === "superadmin") {
      return NextResponse.json(
        { success: false, msg: "Superadmin accounts cannot be deleted" },
        { status: 403 }
      );
    }

    if (targetUser.role === "admin" && viewer.role !== "superadmin") {
      return NextResponse.json(
        { success: false, msg: "Only Superadmin can delete Admin accounts" },
        { status: 403 }
      );
    }

    if (targetUser.role === "user") {
      if (!canStaffAccessUser(viewer, targetUser)) {
        return NextResponse.json(
          { success: false, msg: "Access denied to this client account" },
          { status: 403 }
        );
      }
      if (
        viewer.role === "admin" &&
        viewer.adminPermissions?.canDeleteUsers === false
      ) {
        return NextResponse.json(
          {
            success: false,
            msg: "Your Admin account does not have permission to delete client accounts",
          },
          { status: 403 }
        );
      }
      if (
        viewer.role === "subadmin" &&
        viewer.permissions?.canDeleteUsers !== true
      ) {
        return NextResponse.json(
          {
            success: false,
            msg: "Your Sub-Admin account does not have permission to delete client accounts",
          },
          { status: 403 }
        );
      }
    }

    if (targetUser.role === "subadmin") {
      const canManageSub =
        viewer.role === "superadmin" ||
        (viewer.role === "admin" &&
          viewer.adminPermissions?.isSubManagement !== false);
      if (!canManageSub) {
        return NextResponse.json(
          { success: false, msg: "You do not have permission to delete Sub-Admins" },
          { status: 403 }
        );
      }

      // Remove this subadmin from any users assigned to them
      await User.updateMany(
        { assignedSubAdmins: targetUser._id },
        { $pull: { assignedSubAdmins: targetUser._id } }
      );
      await User.updateMany(
        { assignedSubAdmin: targetUser._id },
        { $set: { assignedSubAdmin: null } }
      );
    }

    await SignDocument.deleteMany({ user: targetUser._id });
    await Notification.deleteMany({ userId: targetUser._id });
    await User.findByIdAndDelete(targetUser._id);

    return NextResponse.json({
      success: true,
      msg: "Account deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}


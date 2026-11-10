import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Notification from "@/models/Notification";
import {
  getCurrentUser,
  isStaffRole,
  canStaffAccessUser,
  sanitizeUserForViewer,
  isValidObjectId,
} from "@/lib/auth";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await connectDB();
    if (!isValidObjectId(params.userId)) {
      return NextResponse.json(
        { success: false, msg: "Invalid client ID" },
        { status: 400 }
      );
    }

    const staff = await getCurrentUser(req);
    if (!staff || !isStaffRole(staff.role)) {
      return NextResponse.json(
        { success: false, msg: "Unauthorized" },
        { status: 403 }
      );
    }

    if (
      staff.role === "admin" &&
      staff.adminPermissions?.canManageKyc === false
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your Admin account does not have permission to approve/reject KYC",
        },
        { status: 403 }
      );
    }

    if (
      staff.role === "subadmin" &&
      staff.permissions?.canReviewKyc === false
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your Sub-Admin account does not have permission to approve/reject KYC",
        },
        { status: 403 }
      );
    }

    const user = await User.findById(params.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "Client not found" },
        { status: 404 }
      );
    }

    if (!canStaffAccessUser(staff, user)) {
      return NextResponse.json(
        { success: false, msg: "Access denied to this client" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, reason } = body; // action: 'approve' | 'reject' | 'toggle'

    const approve =
      action === "approve"
        ? true
        : action === "reject"
          ? false
          : !user.kyc;

    const currentDoc = user.submitDoc || {};
    const defaultRejectMsg =
      "Your KYC verification documents were reviewed and rejected by compliance. Please upload valid, legible, and unexpired documents.";
    const effectiveReason = reason?.trim() || defaultRejectMsg;

    if (approve) {
      user.kyc = true;
      user.submitDoc = {
        ...currentDoc,
        status: "verified",
        verifiedAt: new Date(),
        rejectionReason: null,
      };

      if (!user.kycHistory) user.kycHistory = [];
      user.kycHistory.unshift({
        cnic: currentDoc.cnic || null,
        cnicName: currentDoc.cnicName || null,
        cnicMimeType: currentDoc.cnicMimeType || null,
        bill: currentDoc.bill || null,
        billName: currentDoc.billName || null,
        billMimeType: currentDoc.billMimeType || null,
        idType: currentDoc.idType || "national_id",
        idNumber: currentDoc.idNumber || "",
        dateOfBirth: currentDoc.dateOfBirth || "",
        nationality: currentDoc.nationality || "",
        submittedAt: currentDoc.submittedAt || new Date(),
        decision: "approved",
        decidedAt: new Date(),
        decidedByName: `${staff.firstName} ${staff.lastName} (${staff.role})`,
        rejectionReason: null,
      });
      user.markModified("kycHistory");
    } else {
      const hasUploadedDocs = Boolean(currentDoc.cnic || currentDoc.bill);
      const isAlreadyRejected =
        currentDoc.status === "rejected" && !hasUploadedDocs;

      // Prevent repetitive empty rejections if client is already rejected with no new documents
      if (isAlreadyRejected) {
        return NextResponse.json(
          {
            success: false,
            msg: "Client KYC is already marked as rejected. No new documents have been uploaded to reject.",
          },
          { status: 400 }
        );
      }

      user.kyc = false;

      // Save previous submission to history ONLY IF there are actual documents being rejected
      if (hasUploadedDocs) {
        if (!user.kycHistory) user.kycHistory = [];
        user.kycHistory.unshift({
          cnic: currentDoc.cnic || null,
          cnicName: currentDoc.cnicName || null,
          cnicMimeType: currentDoc.cnicMimeType || null,
          bill: currentDoc.bill || null,
          billName: currentDoc.billName || null,
          billMimeType: currentDoc.billMimeType || null,
          idType: currentDoc.idType || "national_id",
          idNumber: currentDoc.idNumber || "",
          dateOfBirth: currentDoc.dateOfBirth || "",
          nationality: currentDoc.nationality || "",
          submittedAt: currentDoc.submittedAt || new Date(),
          decision: "rejected",
          decidedAt: new Date(),
          decidedByName: `${staff.firstName} ${staff.lastName} (${staff.role})`,
          rejectionReason: effectiveReason,
        });
        user.markModified("kycHistory");
      }

      // Remove uploaded documents from user side so client can re-upload fresh files
      user.submitDoc = {
        status: "rejected",
        cnic: null,
        cnicName: null,
        cnicMimeType: null,
        bill: null,
        billName: null,
        billMimeType: null,
        idType: currentDoc.idType || "national_id",
        idNumber: currentDoc.idNumber || "",
        dateOfBirth: currentDoc.dateOfBirth || "",
        nationality: currentDoc.nationality || "",
        submittedAt: currentDoc.submittedAt || null,
        verifiedAt: null,
        rejectionReason: effectiveReason,
      };
    }

    user.markModified("submitDoc");
    user.updatedAt = new Date();
    await user.save({ validateBeforeSave: false });

    await Notification.create({
      userId: user._id,
      recipientRole: "user",
      type: approve ? "kyc_approved" : "kyc_rejected",
      title: approve ? "KYC Verification Approved" : "KYC Verification Update",
      content: approve
        ? "Your identity and address verification (KYC) has been approved by our compliance team."
        : `Your KYC verification requires attention: ${user.submitDoc.rejectionReason}`,
      link: "/kyc",
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
    });

    const html = buildBrandedEmailHtml({
      title: approve
        ? "Your KYC Verification is Approved"
        : "KYC Verification Status Update",
      greeting: `Hello ${user.firstName},`,
      bodyLines: approve
        ? [
          "Congratulations! Your KYC identity and address verification documents have been reviewed and approved by our compliance team.",
          "You now have full verified status on GOin SAS.",
        ]
        : [
          "Our compliance team reviewed your KYC submission and requires an update:",
          `Note: ${user.submitDoc.rejectionReason}`,
          "Please sign in to your GOin SAS portal to upload updated verification documents.",
        ],
    });

    sendEmail(
      user.email,
      approve
        ? "GOin SAS — KYC Verification Approved"
        : "GOin SAS — Action Required on Your KYC Verification",
      approve
        ? "Your KYC verification has been approved."
        : `Your KYC verification requires attention: ${user.submitDoc.rejectionReason}`,
      html
    ).catch(() => { });

    const userObj = sanitizeUserForViewer(user, staff);

    return NextResponse.json({
      success: true,
      msg: approve
        ? "Client KYC approved successfully"
        : "Client KYC rejected. Client can now re-submit updated documents.",
      user: userObj,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to update KYC status" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await connectDB();
    if (!isValidObjectId(params.userId)) {
      return NextResponse.json(
        { success: false, msg: "Invalid client ID" },
        { status: 400 }
      );
    }

    const staff = await getCurrentUser(req);
    if (!staff || !isStaffRole(staff.role)) {
      return NextResponse.json(
        { success: false, msg: "Unauthorized" },
        { status: 403 }
      );
    }

    if (
      (staff.role === "admin" &&
        staff.adminPermissions?.canManageKyc === false) ||
      (staff.role === "subadmin" &&
        (staff.permissions?.canReviewKyc === false ||
          staff.permissions?.canDeleteKyc !== true))
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your account does not have permission to delete KYC documents",
        },
        { status: 403 }
      );
    }

    const user = await User.findById(params.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "User not found" },
        { status: 404 }
      );
    }

    if (!canStaffAccessUser(staff, user)) {
      return NextResponse.json(
        { success: false, msg: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const clearHistoryParam = searchParams.get("clearHistory");
    const historyIndexParam = searchParams.get("historyIndex");
    const historyIdParam = searchParams.get("historyId");
    const docType = searchParams.get("docType") as "cnic" | "bill" | null;

    // 1. Clear all history records
    if (clearHistoryParam === "true" || clearHistoryParam === "1") {
      user.kycHistory = [];
      user.markModified("kycHistory");
      await user.save({ validateBeforeSave: false });
      const userObj = sanitizeUserForViewer(user, staff);
      return NextResponse.json({
        success: true,
        msg: "All KYC upload and decision history records cleared successfully",
        user: userObj,
      });
    }

    // 2. Delete a single history record by ID or index
    if (historyIdParam !== null || historyIndexParam !== null) {
      if (!Array.isArray(user.kycHistory) || user.kycHistory.length === 0) {
        return NextResponse.json(
          { success: false, msg: "No history records found to delete" },
          { status: 404 }
        );
      }

      if (historyIdParam) {
        user.kycHistory = user.kycHistory.filter(
          (h: any) => String(h._id) !== historyIdParam
        );
      } else {
        const idx = parseInt(historyIndexParam!, 10);
        if (isNaN(idx) || idx < 0 || idx >= user.kycHistory.length) {
          return NextResponse.json(
            { success: false, msg: "Invalid history record index" },
            { status: 400 }
          );
        }
        user.kycHistory.splice(idx, 1);
      }

      user.markModified("kycHistory");
      await user.save({ validateBeforeSave: false });
      const userObj = sanitizeUserForViewer(user, staff);
      return NextResponse.json({
        success: true,
        msg: "History record deleted successfully",
        user: userObj,
      });
    }

    // 3. Delete active uploaded document (cnic or bill)
    if (docType !== "cnic" && docType !== "bill") {
      return NextResponse.json(
        {
          success: false,
          msg: "Invalid action. Specify docType (cnic/bill), clearHistory=true, or historyIndex.",
        },
        { status: 400 }
      );
    }

    const currentUrl = user.submitDoc?.[docType];
    if (currentUrl && currentUrl.includes("cloudinary.com")) {
      await deleteFromCloudinary(currentUrl);
    }

    if (docType === "cnic") {
      user.submitDoc.cnic = null;
      user.submitDoc.cnicName = null;
      user.submitDoc.cnicMimeType = null;
    } else {
      user.submitDoc.bill = null;
      user.submitDoc.billName = null;
      user.submitDoc.billMimeType = null;
    }

    user.kyc = false;
    if (!user.submitDoc.cnic && !user.submitDoc.bill) {
      user.submitDoc.status = "pending";
    }

    await user.save({ validateBeforeSave: false });

    const userObj = sanitizeUserForViewer(user, staff);

    return NextResponse.json({
      success: true,
      msg: `${docType === "cnic" ? "Government ID" : "Proof of Address"} removed successfully`,
      user: userObj,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to delete KYC document" },
      { status: 500 }
    );
  }
}


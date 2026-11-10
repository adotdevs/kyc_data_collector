import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Notification from "@/models/Notification";
import {
  getCurrentUser,
  isStaffRole,
  canStaffAccessUser,
} from "@/lib/auth";
import { deleteFromCloudinary } from "@/lib/cloudinary";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await connectDB();
    const staff = await getCurrentUser(req);
    if (!staff || !isStaffRole(staff.role)) {
      return NextResponse.json(
        { success: false, msg: "Unauthorized" },
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

    if (approve) {
      user.kyc = true;
      user.submitDoc = {
        ...user.submitDoc,
        status: "verified",
        verifiedAt: new Date(),
        rejectionReason: null,
      };
    } else {
      user.kyc = false;
      user.submitDoc = {
        ...user.submitDoc,
        status: reason ? "rejected" : "pending",
        rejectionReason:
          reason || "Your KYC verification was revoked or requires re-submission.",
      };
    }

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
            "You now have full verified status on SignDocs.",
          ]
        : [
            "Our compliance team reviewed your KYC submission and requires an update:",
            `Note: ${user.submitDoc.rejectionReason}`,
            "Please sign in to your SignDocs portal to upload updated verification documents.",
          ],
    });

    sendEmail(
      user.email,
      approve
        ? "SignDocs — KYC Verification Approved"
        : "SignDocs — Action Required on Your KYC Verification",
      approve
        ? "Your KYC verification has been approved."
        : `Your KYC verification requires attention: ${user.submitDoc.rejectionReason}`,
      html
    ).catch(() => {});

    const userObj = user.toObject();
    delete (userObj as any).password;

    return NextResponse.json({
      success: true,
      msg: approve
        ? "Client KYC approved successfully"
        : "Client KYC status set to unverified",
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
    const staff = await getCurrentUser(req);
    if (!staff || !isStaffRole(staff.role)) {
      return NextResponse.json(
        { success: false, msg: "Unauthorized" },
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
    const docType = searchParams.get("docType") as "cnic" | "bill";

    if (docType !== "cnic" && docType !== "bill") {
      return NextResponse.json(
        { success: false, msg: "Invalid document type (must be cnic or bill)" },
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

    const userObj = user.toObject();
    delete (userObj as any).password;

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

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { getCurrentUser } from "@/lib/auth";
import { uploadBufferToCloudinary } from "@/lib/cloudinary";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "Please sign in to submit KYC documents" },
        { status: 401 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let cnicUrl = user.submitDoc?.cnic || null;
    let cnicName = user.submitDoc?.cnicName || null;
    let cnicMimeType = user.submitDoc?.cnicMimeType || null;

    let billUrl = user.submitDoc?.bill || null;
    let billName = user.submitDoc?.billName || null;
    let billMimeType = user.submitDoc?.billMimeType || null;

    let idType = user.submitDoc?.idType || "national_id";
    let idNumber = user.submitDoc?.idNumber || "";
    let dateOfBirth = user.submitDoc?.dateOfBirth || "";
    let nationality = user.submitDoc?.nationality || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const cnicFile = formData.get("cnic") as File | null;
      const billFile = formData.get("bill") as File | null;

      if (formData.get("idType")) idType = String(formData.get("idType")) as any;
      if (formData.get("idNumber") !== null) idNumber = String(formData.get("idNumber"));
      if (formData.get("dateOfBirth") !== null) dateOfBirth = String(formData.get("dateOfBirth"));
      if (formData.get("nationality") !== null) nationality = String(formData.get("nationality"));

      if (formData.get("address")) user.address = String(formData.get("address")).trim();
      if (formData.get("city")) user.city = String(formData.get("city")).trim();
      if (formData.get("country")) user.country = String(formData.get("country")).trim();
      if (formData.get("postalCode")) user.postalCode = String(formData.get("postalCode")).trim();
      if (formData.get("phone")) user.phone = String(formData.get("phone")).trim();

      const maxBytes = 10 * 1024 * 1024; // 10 MB

      if (cnicFile && cnicFile.size > 0) {
        if (cnicFile.size > maxBytes) {
          return NextResponse.json(
            { success: false, msg: "Government ID file cannot exceed 10 MB" },
            { status: 400 }
          );
        }
        const arrayBuf = await cnicFile.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        cnicName = cnicFile.name;
        cnicMimeType = cnicFile.type || "image/jpeg";
        try {
          const uploaded = await uploadBufferToCloudinary(buf, {
            folder: "signdocs_kyc/id",
            mimeType: cnicMimeType,
            fileName: cnicName,
          });
          cnicUrl = uploaded.secure_url;
        } catch {
          cnicUrl = `data:${cnicMimeType};base64,${buf.toString("base64")}`;
        }
      }

      if (billFile && billFile.size > 0) {
        if (billFile.size > maxBytes) {
          return NextResponse.json(
            { success: false, msg: "Proof of Address file cannot exceed 10 MB" },
            { status: 400 }
          );
        }
        const arrayBuf = await billFile.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        billName = billFile.name;
        billMimeType = billFile.type || "image/jpeg";
        try {
          const uploaded = await uploadBufferToCloudinary(buf, {
            folder: "signdocs_kyc/address",
            mimeType: billMimeType,
            fileName: billName,
          });
          billUrl = uploaded.secure_url;
        } catch {
          billUrl = `data:${billMimeType};base64,${buf.toString("base64")}`;
        }
      }
    } else {
      const body = await req.json();
      if (body.cnic) cnicUrl = body.cnic;
      if (body.cnicName) cnicName = body.cnicName;
      if (body.cnicMimeType) cnicMimeType = body.cnicMimeType;
      if (body.bill) billUrl = body.bill;
      if (body.billName) billName = body.billName;
      if (body.billMimeType) billMimeType = body.billMimeType;
      if (body.idType) idType = body.idType;
      if (body.idNumber !== undefined) idNumber = body.idNumber;
      if (body.dateOfBirth !== undefined) dateOfBirth = body.dateOfBirth;
      if (body.nationality !== undefined) nationality = body.nationality;
      if (body.address) user.address = body.address;
      if (body.city) user.city = body.city;
      if (body.country) user.country = body.country;
      if (body.postalCode) user.postalCode = body.postalCode;
    }

    if (!cnicUrl && !billUrl) {
      return NextResponse.json(
        {
          success: false,
          msg: "Please upload at least one verification document (Government ID or Proof of Address)",
        },
        { status: 400 }
      );
    }

    const bothPresent = Boolean(cnicUrl && billUrl);

    user.submitDoc = {
      status: bothPresent ? "completed" : "pending",
      cnic: cnicUrl,
      cnicName,
      cnicMimeType,
      bill: billUrl,
      billName,
      billMimeType,
      idType: idType as any,
      idNumber,
      dateOfBirth,
      nationality,
      submittedAt: new Date(),
      verifiedAt: user.submitDoc?.verifiedAt || null,
      rejectionReason: null,
    };

    if (bothPresent) {
      user.kyc = false; // Pending admin review
    }

    await user.save({ validateBeforeSave: false });

    await Notification.create({
      userId: user._id,
      recipientRole: "admin",
      type: "kyc_submitted",
      title: "New KYC Verification Submitted",
      content: `${user.firstName} ${user.lastName} (${user.email}) uploaded KYC verification documents for compliance review.`,
      link: `/admin/users/${user._id}?tab=kyc`,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
    });

    const html = buildBrandedEmailHtml({
      title: "KYC Documents Received",
      greeting: `Hello ${user.firstName},`,
      bodyLines: [
        "We have received your KYC identity and address verification documents.",
        "Our compliance team is reviewing your submission and will notify you once your verification status is updated.",
      ],
    });

    sendEmail(
      user.email,
      "SignDocs — KYC Verification Documents Received",
      "We have received your KYC documents and our compliance team is reviewing them.",
      html
    ).catch(() => {});

    const userObj = user.toObject();
    delete (userObj as any).password;

    return NextResponse.json({
      success: true,
      msg: bothPresent
        ? "KYC documents submitted! Your verification is now under compliance review."
        : "Document saved! Please upload the remaining document to complete your KYC submission.",
      user: userObj,
    });
  } catch (error: any) {
    console.error("KYC submit error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to upload KYC documents" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SystemSettings from "@/models/SystemSettings";
import VerificationToken from "@/models/VerificationToken";
import { getCurrentUser, signJwtToken } from "@/lib/auth";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      address = "",
      city = "",
      country = "",
      postalCode = "",
      role = "user",
      note = "",
      autoLogin = false,
    } = body;

    if (!firstName || !lastName || !email || !phone || !password) {
      return NextResponse.json(
        {
          success: false,
          msg: "First name, last name, email, phone, and password are required",
        },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { success: false, msg: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { success: false, msg: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Check if an authenticated staff member is creating this account
    const currentUser = await getCurrentUser(req);
    let finalRole: "user" | "subadmin" | "admin" | "superadmin" = "user";

    if (role !== "user") {
      if (!currentUser) {
        return NextResponse.json(
          { success: false, msg: "Unauthorized to create staff roles" },
          { status: 403 }
        );
      }
      if (role === "admin" || role === "superadmin") {
        if (currentUser.role !== "superadmin") {
          return NextResponse.json(
            { success: false, msg: "Only Superadmin can create Admin accounts" },
            { status: 403 }
          );
        }
        finalRole = role;
      } else if (role === "subadmin") {
        const canCreateSubAdmin =
          currentUser.role === "superadmin" ||
          (currentUser.role === "admin" &&
            currentUser.adminPermissions?.isSubManagement !== false);
        if (!canCreateSubAdmin) {
          return NextResponse.json(
            {
              success: false,
              msg: "You do not have permission to create Sub-Admins",
            },
            { status: 403 }
          );
        }
        finalRole = "subadmin";
      }
    }

    const settings = await SystemSettings.findOne();
    const requireVerification =
      (settings?.requireEmailVerification ?? false) &&
      finalRole === "user" &&
      !currentUser;

    const assignedSubAdmins =
      currentUser?.role === "subadmin" && finalRole === "user"
        ? [currentUser._id]
        : [];

    const newUser = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      password,
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      postalCode: postalCode.trim(),
      note: note.trim(),
      role: finalRole,
      verified: !requireVerification,
      assignedSubAdmin: assignedSubAdmins[0] || null,
      assignedSubAdmins,
    });

    if (requireVerification) {
      const vToken = await VerificationToken.create({
        userId: newUser._id,
        token: crypto.randomBytes(32).toString("hex"),
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        req.nextUrl.origin ||
        "http://localhost:3000";
      const verifyUrl = `${baseUrl}/verify/${newUser._id}/${vToken.token}`;

      const html = buildBrandedEmailHtml({
        title: "Welcome to SignDocs — Verify Your Email",
        greeting: `Hello ${newUser.firstName},`,
        bodyLines: [
          "Thank you for registering with SignDocs. Please click the button below to verify your email address and begin your KYC onboarding and document signing.",
        ],
        ctaLabel: "Verify Account",
        ctaUrl: verifyUrl,
      });

      sendEmail(
        newUser.email,
        "Verify your SignDocs Account",
        `Verify your account: ${verifyUrl}`,
        html
      ).catch(() => {});

      return NextResponse.json(
        {
          success: true,
          requiresVerification: true,
          msg: "Account created! A verification link has been sent to your email.",
        },
        { status: 201 }
      );
    }

    const userObj = newUser.toObject();
    delete (userObj as any).password;

    const response = NextResponse.json(
      {
        success: true,
        requiresVerification: false,
        msg: currentUser
          ? `${finalRole === "user" ? "Client" : finalRole.toUpperCase()} account created successfully`
          : "Account created successfully!",
        user: userObj,
      },
      { status: 201 }
    );

    if (autoLogin && !currentUser) {
      const token = signJwtToken(String(newUser._id));
      response.cookies.set("jwttoken", token, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 3,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to register account" },
      { status: 500 }
    );
  }
}

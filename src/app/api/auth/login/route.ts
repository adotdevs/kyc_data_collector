import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SystemSettings from "@/models/SystemSettings";
import VerificationToken from "@/models/VerificationToken";
import { signJwtToken } from "@/lib/auth";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, msg: "Please enter both email and password" },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.password !== password) {
      return NextResponse.json(
        { success: false, msg: "Invalid email or password" },
        { status: 401 }
      );
    }

    const settings = await SystemSettings.findOne();
    const requireEmailVerification =
      settings?.requireEmailVerification ?? false;

    if (requireEmailVerification && !user.verified && user.role === "user") {
      let vToken = await VerificationToken.findOne({ userId: user._id });
      if (!vToken) {
        vToken = await VerificationToken.create({
          userId: user._id,
          token: crypto.randomBytes(32).toString("hex"),
        });
      }
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin || "http://localhost:3000";
      const verifyUrl = `${baseUrl}/verify/${user._id}/${vToken.token}`;

      const html = buildBrandedEmailHtml({
        title: "Verify Your SignDocs Account",
        greeting: `Hi ${user.firstName},`,
        bodyLines: [
          "Please verify your email address to activate your SignDocs account and access your KYC & document signing portal.",
        ],
        ctaLabel: "Verify Email Address",
        ctaUrl: verifyUrl,
        footerNote: "If you did not attempt to sign in, you can safely ignore this email.",
      });

      sendEmail(
        user.email,
        "Verify your SignDocs account",
        `Verify your account here: ${verifyUrl}`,
        html
      ).catch(() => {});

      return NextResponse.json(
        {
          success: false,
          msg: "A verification link has been sent to your email. Please verify to sign in.",
        },
        { status: 403 }
      );
    }

    if (!requireEmailVerification && !user.verified) {
      user.verified = true;
    }

    user.online = true;
    user.lastOnline = new Date();
    user.lastActivity = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signJwtToken(String(user._id));
    const userObj = user.toObject();
    delete (userObj as any).password;

    const response = NextResponse.json({
      success: true,
      msg: "Signed in successfully",
      user: userObj,
      token,
    });

    response.cookies.set("jwttoken", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 3, // 3 days
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, msg: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

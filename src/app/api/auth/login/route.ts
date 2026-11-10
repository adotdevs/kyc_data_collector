import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import SystemSettings from "@/models/SystemSettings";
import VerificationToken from "@/models/VerificationToken";
import {
  signJwtToken,
  verifyPassword,
  hashPassword,
  setAuthCookie,
  sanitizeUserForViewer,
  getClientIp,
  checkRateLimit,
  resetRateLimit,
} from "@/lib/auth";
import { sendEmail, buildBrandedEmailHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, msg: "Please enter both email and password" },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);
    const rateKey = `login:${clientIp}:${email}`;
    const rateLimit = checkRateLimit(rateKey, 10, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          msg: `Too many failed sign-in attempts. Please try again in ${Math.ceil(
            rateLimit.retryAfterSeconds / 60
          )} minute(s).`,
        },
        { status: 429 }
      );
    }

    const user = await User.findOne({ email });
    const passwordCheck = user
      ? verifyPassword(password, user.password)
      : { valid: false, needsRehash: false };

    if (!user || !passwordCheck.valid) {
      return NextResponse.json(
        { success: false, msg: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Clear failed login rate limit counter upon valid credentials
    resetRateLimit(rateKey);

    // Transparently upgrade legacy plaintext password to scrypt hash and keep passwordPlain synced
    if (user.passwordPlain !== password) {
      user.passwordPlain = password;
    }
    if (passwordCheck.needsRehash) {
      user.password = hashPassword(password);
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
        process.env.NEXT_PUBLIC_BASE_URL ||
        req.nextUrl.origin ||
        "http://localhost:3000";
      const verifyUrl = `${baseUrl}/verify/${user._id}/${vToken.token}`;

      const html = buildBrandedEmailHtml({
        title: "Verify Your SignDocs Account",
        greeting: `Hi ${user.firstName},`,
        bodyLines: [
          "Please verify your email address to activate your SignDocs account and access your KYC & document signing portal.",
        ],
        ctaLabel: "Verify Email Address",
        ctaUrl: verifyUrl,
        footerNote:
          "If you did not attempt to sign in, you can safely ignore this email.",
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

    // Superadmin and staff roles never require email verification or KYC
    if (
      user.role === "superadmin" ||
      user.role === "admin" ||
      user.role === "subadmin"
    ) {
      user.verified = true;
      user.kyc = true;
    } else if (!requireEmailVerification && !user.verified) {
      user.verified = true;
    }

    user.online = true;
    user.lastOnline = new Date();
    user.lastActivity = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signJwtToken(user);
    const userObj = sanitizeUserForViewer(user, user);

    const response = NextResponse.json({
      success: true,
      msg: "Signed in successfully",
      user: userObj,
    });

    setAuthCookie(response, token);

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, msg: "Authentication failed" },
      { status: 500 }
    );
  }
}


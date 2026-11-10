import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import VerificationToken from "@/models/VerificationToken";
import { isValidObjectId } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; token: string } }
) {
  try {
    await connectDB();
    const { id, token } = params;

    if (!isValidObjectId(id) || !token) {
      return NextResponse.json(
        { success: false, msg: "Invalid verification link" },
        { status: 400 }
      );
    }

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { success: false, msg: "Invalid verification link" },
        { status: 400 }
      );
    }

    if (user.verified) {
      return NextResponse.json({
        success: true,
        msg: "Email is already verified. You can sign in now.",
      });
    }

    const vToken = await VerificationToken.findOne({
      userId: user._id,
      token,
    });

    if (!vToken) {
      return NextResponse.json(
        { success: false, msg: "Verification link expired or invalid" },
        { status: 400 }
      );
    }

    user.verified = true;
    await user.save({ validateBeforeSave: false });
    await VerificationToken.deleteOne({ _id: vToken._id });

    return NextResponse.json({
      success: true,
      msg: "Email verified successfully! You may now sign in.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Verification failed" },
      { status: 500 }
    );
  }
}


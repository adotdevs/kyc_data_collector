import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, clearAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (user) {
      user.online = false;
      user.lastOnline = new Date();
      await user.save({ validateBeforeSave: false });
    }

    const response = NextResponse.json({
      success: true,
      msg: "Logged out successfully",
    });

    clearAuthCookie(response);
    return response;
  } catch {
    const response = NextResponse.json({
      success: true,
      msg: "Logged out",
    });
    clearAuthCookie(response);
    return response;
  }
}


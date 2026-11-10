import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

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

    response.cookies.set("jwttoken", "", {
      httpOnly: true,
      path: "/",
      expires: new Date(0),
    });

    return response;
  } catch {
    const response = NextResponse.json({
      success: true,
      msg: "Logged out",
    });
    response.cookies.delete("jwttoken");
    return response;
  }
}

import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "./db";
import User, { IUser } from "@/models/User";

const JWT_SECRET = process.env.SECRET_JWT || "xdaxddxkjwcxdjiwxjiedxjikdexjidex";
const JWT_EXPIRE = process.env.SECRET_EXPIRE || "3d";

export function signJwtToken(userId: string): string {
  return jwt.sign({ _id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE as any,
  });
}

export function verifyJwtToken(token: string): { _id: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { _id: string };
  } catch {
    return null;
  }
}

export async function getCurrentUser(req?: NextRequest): Promise<IUser | null> {
  await connectDB();

  let token: string | undefined;

  if (req) {
    token = req.cookies.get("jwttoken")?.value;
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7).trim();
      }
    }
  } else {
    const { cookies } = await import("next/headers");
    const cookieStore = cookies();
    token = cookieStore.get("jwttoken")?.value;
  }

  if (!token || token === "null" || token === "undefined") {
    return null;
  }

  const decoded = verifyJwtToken(token);
  if (!decoded?._id) {
    return null;
  }

  const user = await User.findById(decoded._id);
  return user;
}

export function isStaffRole(role?: string): boolean {
  return role === "superadmin" || role === "admin" || role === "subadmin";
}

// ==================== SUB-ADMIN ASSIGNMENT HELPERS (Ported from sample) ====================

export function normalizeIdString(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

export function getAssignedSubAdminIds(userDoc: any): string[] {
  if (!userDoc) return [];
  const ids: string[] = [];
  const seen = new Set<string>();

  if (Array.isArray(userDoc.assignedSubAdmins)) {
    for (const item of userDoc.assignedSubAdmins) {
      const id = normalizeIdString(item);
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }

  const legacyId = normalizeIdString(userDoc.assignedSubAdmin);
  if (legacyId && !seen.has(legacyId)) {
    seen.add(legacyId);
    ids.push(legacyId);
  }

  return ids;
}

export function syncAssignedSubAdmins(userDoc: any, nextIds: any[]): string[] {
  const uniqueIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of nextIds || []) {
    const id = normalizeIdString(rawId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniqueIds.push(id);
  }

  userDoc.assignedSubAdmins = uniqueIds.map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  userDoc.assignedSubAdmin = uniqueIds[0]
    ? new mongoose.Types.ObjectId(uniqueIds[0])
    : null;
  return uniqueIds;
}

export function hasSubAdminAccessToUser(subadminId: any, userDoc: any): boolean {
  if (!subadminId || !userDoc) return false;
  if (userDoc.isShared === true) return true;
  const targetId = normalizeIdString(subadminId);
  if (!targetId) return false;
  return getAssignedSubAdminIds(userDoc).includes(targetId);
}

export function subadminAccessibleUsersQuery(subadminId: any) {
  const objId = new mongoose.Types.ObjectId(String(subadminId));
  return {
    role: "user",
    $or: [
      { assignedSubAdmins: objId },
      { assignedSubAdmin: objId },
      { isShared: true },
    ],
  };
}

export function canStaffAccessUser(staff: IUser, targetUser: any): boolean {
  if (staff.role === "superadmin" || staff.role === "admin") return true;
  if (staff.role === "subadmin") {
    return hasSubAdminAccessToUser(staff._id, targetUser);
  }
  return String(staff._id) === String(targetUser._id);
}

export function sanitizeUserForViewer(targetUser: any, viewer: IUser) {
  const obj =
    typeof targetUser.toObject === "function"
      ? targetUser.toObject()
      : { ...targetUser };
  delete obj.password;

  // Respect subadmin privacy permission (`viewClientDetails`) from sample
  if (
    viewer.role === "subadmin" &&
    viewer.permissions?.viewClientDetails === false &&
    obj.role === "user"
  ) {
    obj.email = "hidden@privacy.protected";
    obj.phone = "••••••••••";
    obj.address = "Hidden by administrator policy";
    obj.city = "Hidden";
    obj.postalCode = "•••••";
  }

  return obj;
}

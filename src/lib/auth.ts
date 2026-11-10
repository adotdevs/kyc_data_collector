import crypto from "crypto";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "./db";
import User, { IUser } from "@/models/User";

const JWT_SECRET =
  process.env.SECRET_JWT || "xdaxddxkjwcxdjiwxjiedxjikdexjidex";
const JWT_EXPIRE = process.env.SECRET_EXPIRE || "3d";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 3; // 3 days in seconds

// ==================== PASSWORD HASHING & TIMING-SAFE VERIFICATION ====================

const SCRYPT_PREFIX = "scrypt$";

export function isPasswordHashed(password?: string | null): boolean {
  return Boolean(password && password.startsWith(SCRYPT_PREFIX));
}

export function hashPassword(plainPassword: string): string {
  if (isPasswordHashed(plainPassword)) {
    return plainPassword;
  }
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .scryptSync(String(plainPassword), salt, 64)
    .toString("hex");
  return `${SCRYPT_PREFIX}${salt}$${derivedKey}`;
}

export function verifyPassword(
  plainPassword: string,
  storedPassword?: string | null
): { valid: boolean; needsRehash: boolean } {
  if (!plainPassword || !storedPassword) {
    return { valid: false, needsRehash: false };
  }

  if (storedPassword.startsWith(SCRYPT_PREFIX)) {
    const parts = storedPassword.split("$");
    // Format: scrypt$<salt>$<hash>
    if (parts.length !== 3) {
      return { valid: false, needsRehash: false };
    }
    const [, salt, storedHashHex] = parts;
    try {
      const derivedKey = crypto.scryptSync(String(plainPassword), salt, 64);
      const storedKey = Buffer.from(storedHashHex, "hex");
      if (derivedKey.length !== storedKey.length) {
        return { valid: false, needsRehash: false };
      }
      const valid = crypto.timingSafeEqual(derivedKey, storedKey);
      return { valid, needsRehash: false };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // Legacy plaintext fallback (transparently upgraded to scrypt on login)
  const a = Buffer.from(String(plainPassword), "utf8");
  const b = Buffer.from(String(storedPassword), "utf8");
  if (a.length !== b.length) {
    return { valid: false, needsRehash: false };
  }
  const valid = crypto.timingSafeEqual(a, b);
  return { valid, needsRehash: valid };
}

export function computePasswordTag(
  passwordHash?: string | null,
  role?: string | null
): string {
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${passwordHash || ""}:${role || "user"}`)
    .digest("hex")
    .slice(0, 16);
}

// ==================== JWT SIGNING, VERIFICATION & COOKIES ====================

export interface JwtPayloadData {
  _id: string;
  role?: string;
  pwdTag?: string;
  iat?: number;
  exp?: number;
}

export function signJwtToken(
  userOrId:
    | string
    | { _id: any; role?: string | null; password?: string | null }
): string {
  const payload: Record<string, any> =
    typeof userOrId === "string"
      ? { _id: userOrId }
      : {
          _id: String(userOrId._id),
          role: userOrId.role || "user",
          pwdTag: computePasswordTag(userOrId.password, userOrId.role),
        };

  return jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: JWT_EXPIRE as any,
  });
}

export function verifyJwtToken(token: string): JwtPayloadData | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as JwtPayloadData;
    if (!decoded || typeof decoded !== "object" || !decoded._id) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set("jwttoken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set("jwttoken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

// ==================== RATE LIMITING & INPUT GUARDS ====================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "127.0.0.1"
  );
}

export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 15 * 60 * 1000
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > maxAttempts) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

export function escapeRegex(input: string): string {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidObjectId(id: any): boolean {
  if (!id || typeof id !== "string") return false;
  return mongoose.Types.ObjectId.isValid(id);
}

// ==================== CURRENT USER RESOLUTION ====================

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
  if (!decoded?._id || !isValidObjectId(String(decoded._id))) {
    return null;
  }

  const user = await User.findById(decoded._id);
  if (!user) {
    return null;
  }

  // If token includes pwdTag, verify password/role hasn't been changed since token issuance
  if (decoded.pwdTag) {
    const expectedTag = computePasswordTag(user.password, user.role);
    if (decoded.pwdTag !== expectedTag) {
      return null;
    }
  }

  return user;
}

export function isStaffRole(role?: string): boolean {
  return role === "superadmin" || role === "admin" || role === "subadmin";
}

// ==================== SUB-ADMIN ASSIGNMENT & ACCESS CONTROL ====================

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
    if (!id || !isValidObjectId(id) || seen.has(id)) continue;
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
  if (userDoc.role && userDoc.role !== "user") return false;
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
  if (!staff || !targetUser) return false;
  if (String(staff._id) === String(targetUser._id)) return true;

  if (staff.role === "superadmin") return true;

  if (staff.role === "admin") {
    // Admin can access clients and subadmins, never superadmin
    return targetUser.role === "user" || targetUser.role === "subadmin";
  }

  if (staff.role === "subadmin") {
    return (
      targetUser.role === "user" && hasSubAdminAccessToUser(staff._id, targetUser)
    );
  }

  return false;
}

export function sanitizeUserForViewer(targetUser: any, viewer?: IUser | null) {
  if (!targetUser) return null;
  const obj =
    typeof targetUser.toObject === "function"
      ? targetUser.toObject()
      : { ...targetUser };

  const isSuperAdminViewer = viewer?.role === "superadmin";
  const isPermittedAdminViewer =
    viewer?.role === "admin" &&
    viewer.adminPermissions?.isProfileUpdate !== false &&
    canStaffAccessUser(viewer, targetUser);
  const isPermittedSubAdminViewer =
    viewer?.role === "subadmin" &&
    viewer.permissions?.editUserProfile === true &&
    canStaffAccessUser(viewer, targetUser);

  if (
    isSuperAdminViewer ||
    isPermittedAdminViewer ||
    isPermittedSubAdminViewer
  ) {
    const readablePassword =
      obj.passwordPlain ||
      (!isPasswordHashed(obj.password) ? obj.password : "");
    obj.password = readablePassword || "";
  } else {
    delete obj.password;
  }

  delete obj.passwordPlain;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  delete obj.__v;

  // Never expose another user's SMTP password unless viewer is superadmin or self
  const isSelf =
    viewer && obj._id && String(viewer._id) === String(obj._id);
  if (obj.smtpConfig && viewer?.role !== "superadmin" && !isSelf) {
    obj.smtpConfig = {
      ...obj.smtpConfig,
      pass: obj.smtpConfig.pass ? "••••••••" : "",
    };
  }

  // Respect subadmin privacy permission (`viewClientDetails`)
  if (
    viewer?.role === "subadmin" &&
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


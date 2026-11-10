import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET =
  process.env.SECRET_JWT || "xdaxddxkjwcxdjiwxjiedxjikdexjidex";

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function verifyEdgeJwt(
  token: string
): Promise<{ _id: string; role?: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const headerJson = JSON.parse(
      new TextDecoder().decode(base64UrlToUint8Array(headerB64))
    );
    if (headerJson.alg !== "HS256") return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToUint8Array(signatureB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature as unknown as BufferSource,
      data
    );
    if (!isValid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToUint8Array(payloadB64))
    );

    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
      return null;
    }

    if (!payload._id) return null;
    return payload;
  } catch {
    return null;
  }
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Apply security headers to API routes
  if (pathname.startsWith("/api")) {
    const res = NextResponse.next();
    return applySecurityHeaders(res);
  }

  const token = req.cookies.get("jwttoken")?.value;
  const session =
    token && token !== "null" && token !== "undefined"
      ? await verifyEdgeJwt(token)
      : null;

  const isStaff =
    session?.role === "superadmin" ||
    session?.role === "admin" ||
    session?.role === "subadmin";

  const isProtectedPage =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/documents") ||
    pathname.startsWith("/kyc") ||
    pathname.startsWith("/profile");

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  // 1. Unauthenticated access to protected page -> redirect to /login
  if (isProtectedPage && !session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("jwttoken");
    return applySecurityHeaders(res);
  }

  // 2. Non-staff client attempting to access /admin -> redirect to /documents
  if (pathname.startsWith("/admin") && session?.role === "user") {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/documents", req.url))
    );
  }

  // 3. Staff attempting to access client-only /kyc onboarding -> redirect to /admin
  if (pathname.startsWith("/kyc") && isStaff) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/admin", req.url))
    );
  }

  // 4. Already authenticated user visiting /login or /register -> redirect to dashboard
  if (isAuthPage && session && session.role) {
    const dest = isStaff ? "/admin" : "/documents";
    return applySecurityHeaders(NextResponse.redirect(new URL(dest, req.url)));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};


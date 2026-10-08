import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Edge-safe: jose only, no database access. Route handlers own all data
// access and re-check the ADMIN role in the database (requireAdmin()).
//
// Public paths (never gated here): /, /auth/**, /dev/**, /api/auth/** and
// static assets (_next/static, _next/image, favicon.ico - excluded by the
// matcher below). Only these prefixes require a session:
const PROTECTED_PREFIXES = ["/customer", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function redirectTo(url: URL, pathname: string): NextResponse {
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  // 1. No/invalid session -> /auth/login
  const token = request.cookies.get("session")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.AUTH_SECRET),
        { algorithms: ["HS256"] }
      );
      role = typeof payload.role === "string" ? payload.role : null;
    } catch {
      // invalid/expired token: fall through to the redirect below
    }
  }
  if (!role) {
    return redirectTo(request.nextUrl.clone(), "/auth/login");
  }

  // 2. /admin requires the ADMIN role (fast path from the JWT; API routes
  //    re-verify the role against the database before acting on it).
  const isAdminArea =
    pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminArea && role !== "ADMIN") {
    return redirectTo(request.nextUrl.clone(), "/customer");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization file)
     * - favicon.ico (favicon file)
     * - /auth/* (public auth routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|auth).*)",
  ],
};

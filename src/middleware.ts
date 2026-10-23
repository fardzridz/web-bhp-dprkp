import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dprkp-bhp-secret-key-2026-very-secure-random-token-32b"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets, public images & api/auth/login bypass
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname === "/favicon.ico" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("bhp_session")?.value;
  let user: { role: string; activeBidangId: string | null } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      user = payload as unknown as { role: string; activeBidangId: string | null };
    } catch {
      user = null;
    }
  }

  // If visiting /login while already logged in
  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Root redirect to dashboard or login
  if (pathname === "/") {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Protected routes require valid user
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes restricted to SUPERADMIN
  if (pathname.startsWith("/admin") && user.role !== "SUPERADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

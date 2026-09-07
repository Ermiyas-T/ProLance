// Route protection per role (Architecture.md §4).
// Since the session token lives in-memory (no cookie), this middleware only
// handles static route gating. The SessionProvider + client-side redirects
// handle the dynamic "already authenticated → /dashboard" case.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const PUBLIC_PREFIXES = ["/login", "/register", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and static assets through without checks
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // For now, let all other routes pass — the SessionProvider handles
  // client-side redirects when isAuthenticated changes. Role-based gating
  // will be added here once the session cookie strategy is finalized.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

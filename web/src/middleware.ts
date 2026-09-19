// Route protection middleware inspecting the prolance_token cookie
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public auth routes where authenticated users should be redirected to dashboard
const AUTH_ROUTES = ["/login", "/register"];

// Protected route prefixes requiring valid session authentication
const PROTECTED_PREFIXES = [
    "/dashboard",
    "/projects",
    "/proposals",
    "/marketplace",
    "/contracts",
    "/profile",
    "/settings",
    "/disputes",
    "/admin",
    "/freelancers",
];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    // read prolance_token cookie directly from the incoming request
    const token = request.cookies.get("prolance_token")?.value;

    // redirect authenticated users away from public auth pages (/login, /register) to /dashboard
    if (token && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // redirect unauthenticated visitors requesting protected routes to /login
    if (!token && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // allow all static assets and allowed requests to pass through
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};

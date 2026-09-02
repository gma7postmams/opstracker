import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/** Pages only administrators may open. The APIs enforce this again server-side. */
const ADMIN_ONLY = ["/admin"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = (req as any).nextauth?.token?.role;

    if (ADMIN_ONLY.some((p) => pathname.startsWith(p)) && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/assistance/:path*",
    "/tasks/:path*",
    "/records/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/admin/:path*",
  ],
};

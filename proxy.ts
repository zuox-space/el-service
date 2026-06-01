import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const roles = (token?.roles as string[]) || [];
    const path = req.nextUrl.pathname;
    console.log('111111111111111111111111111')
    // Защита админ-маршрутов
    if (path.startsWith("/admin")) {
      if (!roles.includes("ADMIN")) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    
    // Защита управления классами
    if (path.startsWith("/class-management")) {
      if (!roles.includes("ADMIN") && !roles.includes("HEAD_TEACHER") && !roles.includes("CLASS_TEACHER")) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/class-management/:path*",
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
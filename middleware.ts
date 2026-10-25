// middleware.ts
//
// Планшет охраны — отдельный контур: без cookie сразу отправляем на свою
// страницу входа. Полная проверка подписи выполняется в page/API (Node.js),
// здесь достаточно наличия cookie, чтобы не отдавать HTML.
import { NextRequest, NextResponse } from "next/server";
import { GUARD_COOKIE } from "@/lib/guard/constants";

const PUBLIC = new Set(["/guard/login", "/api/guard/login"]);

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    if (PUBLIC.has(pathname)) return NextResponse.next();

    if (!request.cookies.get(GUARD_COOKIE)?.value) {
        if (pathname.startsWith("/api/guard")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = request.nextUrl.clone();
        url.pathname = "/guard/login";
        url.search = "";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/guard", "/guard/:path*", "/api/guard/:path*"],
};

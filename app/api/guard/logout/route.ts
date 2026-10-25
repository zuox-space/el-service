// app/api/guard/logout/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { GUARD_COOKIE } from "@/lib/guard/auth";

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set(GUARD_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
}

// app/api/guard/login/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
    checkGuardCredentials,
    createGuardToken,
    GUARD_COOKIE,
    guardCookieOptions,
    hasGuardConfig,
} from "@/lib/guard/auth";

const guardGlobal = globalThis as typeof globalThis & {
    __guardLoginAttempts?: Map<string, { count: number; resetAt: number }>;
};
const attempts = (guardGlobal.__guardLoginAttempts ??= new Map());

export async function POST(request: NextRequest) {
    if (!hasGuardConfig()) {
        return NextResponse.json(
            { error: "Вход охраны не настроен: задайте GUARD_LOGIN, GUARD_PASSWORD и GUARD_SESSION_SECRET" },
            { status: 503 },
        );
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const now = Date.now();
    const current = attempts.get(ip);

    if (current && current.count >= 5 && current.resetAt > now) {
        return NextResponse.json(
            { error: "Слишком много попыток. Попробуйте через несколько минут." },
            { status: 429, headers: { "Retry-After": String(Math.ceil((current.resetAt - now) / 1000)) } },
        );
    }

    const body = await request.json().catch(() => null);
    const login = typeof body?.login === "string" ? body.login : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!checkGuardCredentials(login, password)) {
        attempts.set(ip, {
            count: (current?.resetAt && current.resetAt > now ? current.count : 0) + 1,
            resetAt: now + 5 * 60 * 1000,
        });
        return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    attempts.delete(ip);

    const response = NextResponse.json({ success: true });
    response.cookies.set(GUARD_COOKIE, createGuardToken(), guardCookieOptions());
    return response;
}

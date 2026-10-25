// lib/guard/auth.ts
//
// Отдельная авторизация планшета охраны: логин/пароль из переменных окружения,
// собственная подписанная cookie. Яндекс и NextAuth здесь не используются.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AccessInfo } from "@/lib/access/server";

export const GUARD_COOKIE = "guard_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
    const value = process.env.GUARD_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
    if (!value) throw new Error("Не задан GUARD_SESSION_SECRET");
    return value;
}

function sign(payload: string): string {
    return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createGuardToken(): string {
    const payload = Buffer.from(
        JSON.stringify({ sub: "guard", exp: Date.now() + SESSION_TTL_MS }),
        "utf8",
    ).toString("base64url");
    return `${payload}.${sign(payload)}`;
}

export function verifyGuardToken(token: string | undefined | null): boolean {
    if (!token) return false;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;

    try {
        const expected = sign(payload);
        const left = Buffer.from(signature);
        const right = Buffer.from(expected);
        if (left.length !== right.length || !timingSafeEqual(left, right)) return false;

        const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
            sub?: string;
            exp?: number;
        };
        return parsed.sub === "guard" && typeof parsed.exp === "number" && parsed.exp > Date.now();
    } catch {
        return false;
    }
}

export function guardCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_TTL_MS / 1000,
    };
}

export function checkGuardCredentials(login: string, password: string): boolean {
    const expectedLogin = process.env.GUARD_LOGIN;
    const expectedPassword = process.env.GUARD_PASSWORD;
    if (!expectedLogin || !expectedPassword) return false;

    const leftLogin = Buffer.from(login.trim().toLowerCase());
    const rightLogin = Buffer.from(expectedLogin.trim().toLowerCase());
    const leftPassword = Buffer.from(password);
    const rightPassword = Buffer.from(expectedPassword);

    return (
        leftLogin.length === rightLogin.length &&
        timingSafeEqual(leftLogin, rightLogin) &&
        leftPassword.length === rightPassword.length &&
        timingSafeEqual(leftPassword, rightPassword)
    );
}

export function hasGuardConfig(): boolean {
    return Boolean(process.env.GUARD_LOGIN && process.env.GUARD_PASSWORD && (process.env.GUARD_SESSION_SECRET || process.env.NEXTAUTH_SECRET));
}

let cachedGuardUserId: string | null = null;

/**
 * Системный пользователь для аудита: заявки подтверждает планшет охраны,
 * а KeyRequest.decidedById/KeyActivity.actorId ссылаются на User.
 */
export async function ensureGuardUser(): Promise<AccessInfo> {
    if (cachedGuardUserId) {
        return {
            userId: cachedGuardUserId,
            email: process.env.GUARD_EMAIL || "guard-tablet@school.local",
            isAdmin: false,
            roles: ["SECURITY"],
            override: false,
            sections: ["keys"],
        };
    }

    const email = (process.env.GUARD_EMAIL || "guard-tablet@school.local").trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        try {
            user = await prisma.user.create({
                data: {
                    email,
                    name: "Охрана",
                    archived: true,
                },
            });
        } catch {
            // параллельный первый вход уже создал пользователя
            user = await prisma.user.findUnique({ where: { email } });
            if (!user) throw new Error("Не удалось создать пользователя охраны");
        }
    }

    const securityRole = await prisma.role.findUnique({ where: { name: "SECURITY" } });
    if (securityRole) {
        const existing = await prisma.userRole.findFirst({
            where: { userId: user.id, roleId: securityRole.id },
        });
        if (!existing) {
            await prisma.userRole.create({ data: { userId: user.id, roleId: securityRole.id } });
        }
    }

    cachedGuardUserId = user.id;

    return {
        userId: user.id,
        email,
        isAdmin: false,
        roles: ["SECURITY"],
        override: false,
        sections: ["keys"],
    };
}

/** Проверка cookie планшета и доступ к ключам. */
export async function getGuardAccess(): Promise<AccessInfo | null> {
    const token = cookies().get(GUARD_COOKIE)?.value;
    if (!verifyGuardToken(token)) return null;
    return ensureGuardUser();
}

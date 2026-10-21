// lib/access/session.ts
//
// Лёгкая проверка «кто вызывает API и админ ли он»: используется в админских
// роутах управления доступами, чтобы не тянуть весь AccessInfo.
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessForUser } from "./server";

export interface SessionAccess {
    userId: string;
    email: string;
    isAdmin: boolean;
}

export async function getSession(): Promise<SessionAccess | null> {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return null;

    const user = await prisma.user.findUnique({
        where: { email },
        include: { userRoles: { include: { role: true } } },
    });

    if (!user) return null;

    return {
        userId: user.id,
        email,
        isAdmin: user.userRoles.some(item => item.role.name === "ADMIN"),
    };
}

/** Пригодится страницам, которым нужен полный доступ вместе с сессией. */
export async function getSessionWithAccess() {
    const session = await getSession();
    if (!session) return null;
    const access = await getAccessForUser(session.userId);
    return { session, access };
}

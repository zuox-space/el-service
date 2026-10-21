// app/api/violations/mine/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAccess } from "@/lib/access/server";

/**
 * «Мои нарушения» — замечания, которые сотрудник зафиксировал сам.
 *
 * Доступно любому авторизованному: человек видит только свои записи и статус
 * их отработки (кто и когда разобрал, что сделано). Раздел доступа здесь не
 * нужен — данные и так принадлежат сотруднику.
 */
export async function GET(request: NextRequest) {
    const access = await getSessionAccess();
    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resolution = searchParams.get("resolution") || ""; // resolved | unresolved
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 300) : 200;

    const where = {
        teacherId: access.userId,
        ...(resolution === "resolved" ? { resolvedAt: { not: null } } : {}),
        ...(resolution === "unresolved" ? { resolvedAt: null } : {}),
    };

    const [violations, total, resolved, unresolved] = await Promise.all([
        prisma.violation.findMany({
            where,
            orderBy: [{ date: "desc" }, { id: "asc" }],
            take: limit,
        }),
        prisma.violation.count({ where: { teacherId: access.userId } }),
        prisma.violation.count({ where: { teacherId: access.userId, resolvedAt: { not: null } } }),
        prisma.violation.count({ where: { teacherId: access.userId, resolvedAt: null } }),
    ]);

    return NextResponse.json({
        success: true,
        violations,
        stats: { total, resolved, unresolved, shown: violations.length },
    });
}

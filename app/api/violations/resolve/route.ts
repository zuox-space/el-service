// app/api/violations/resolve/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSection } from "@/lib/access/server";

/**
 * Отработка нарушений администрацией.
 *
 * Один вызов закрывает и одиночное, и групповое замечание: передаётся список id.
 * Комментарий о проделанной работе обязателен — иначе непонятно, что сделано.
 * Если `resolved: false`, отметка снимается (комментарий и автор очищаются).
 */
export async function POST(request: NextRequest) {
    const guard = await requireSection("violations");
    if (!guard.ok) return guard.response;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const rawIds: unknown = body.ids;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return NextResponse.json({ error: "Не выбраны нарушения" }, { status: 400 });
    }

    const ids = [...new Set(rawIds)]
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .slice(0, 200);

    if (ids.length === 0) {
        return NextResponse.json({ error: "Не выбраны нарушения" }, { status: 400 });
    }

    const resolved = body.resolved !== false;
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";

    if (resolved && comment.length < 3) {
        return NextResponse.json(
            { error: "Опишите, что сделано — хотя бы 3 символа" },
            { status: 400 },
        );
    }

    const result = await prisma.violation.updateMany({
        where: { id: { in: ids } },
        data: resolved
            ? {
                resolvedAt: new Date(),
                resolvedBy: session.user.id,
                resolvedByName: session.user.name ?? session.user.email ?? "Сотрудник",
                resolutionComment: comment,
            }
            : {
                resolvedAt: null,
                resolvedBy: null,
                resolvedByName: null,
                resolutionComment: null,
            },
    });

    return NextResponse.json({
        success: true,
        updated: result.count,
        resolved,
    });
}

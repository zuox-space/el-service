// app/api/violations/resolve/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnySection } from "@/lib/access/server";

/**
 * Отработка нарушений.
 *
 * Кто может отмечать:
 *  • раздел «Нарушения» — любые записи (администрация, в будущем соцпедагог);
 *  • раздел «Мой класс» — только нарушения своих классов (классный руководитель).
 *
 * Флаг `resolvedSource`: если отработку поставил именно классный руководитель
 * со своего экрана, сохраняем CLASS_TEACHER — это видно в истории у сотрудника.
 * Отметка из админки остаётся просто конкретным пользователем.
 */
export async function POST(request: NextRequest) {
    const guard = await requireAnySection(["violations", "myClass"]);
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

    const violations = await prisma.violation.findMany({
        where: { id: { in: ids } },
        select: { id: true, className: true },
    });

    if (violations.length === 0) {
        return NextResponse.json({ error: "Нарушения не найдены" }, { status: 404 });
    }

    // Классный руководитель — только по своим классам
    const hasFullAccess = guard.access.sections.includes("violations");
    if (!hasFullAccess) {
        const [owned, shared] = await Promise.all([
            prisma.class.findMany({ where: { ownerId: session.user.id }, select: { name: true } }),
            prisma.classShare.findMany({
                where: { teacherId: session.user.id },
                select: { class: { select: { name: true } } },
            }),
        ]);

        const ownClasses = new Set([
            ...owned.map(item => item.name),
            ...shared.map(item => item.class.name),
        ]);

        const foreign = violations.filter(item => !ownClasses.has(item.className));
        if (foreign.length > 0) {
            return NextResponse.json(
                { error: "Можно отрабатывать только нарушения своих классов" },
                { status: 403 },
            );
        }
    }

    const isClassTeacher = guard.access.roles.includes("CLASS_TEACHER");
    const wantsClassTeacher = body.source === "class_teacher";

    const result = await prisma.violation.updateMany({
        where: { id: { in: violations.map(item => item.id) } },
        data: resolved
            ? {
                resolvedAt: new Date(),
                resolvedBy: session.user.id,
                resolvedByName: session.user.name ?? session.user.email ?? "Сотрудник",
                resolutionComment: comment,
                resolvedSource: wantsClassTeacher && isClassTeacher ? "CLASS_TEACHER" : null,
            }
            : {
                resolvedAt: null,
                resolvedBy: null,
                resolvedByName: null,
                resolutionComment: null,
                resolvedSource: null,
            },
    });

    return NextResponse.json({
        success: true,
        updated: result.count,
        resolved,
        resolvedSource: wantsClassTeacher && isClassTeacher ? "CLASS_TEACHER" : null,
    });
}

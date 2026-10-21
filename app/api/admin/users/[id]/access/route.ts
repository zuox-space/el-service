// app/api/admin/users/[id]/access/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/access/session";
import { prisma } from "@/lib/prisma";
import { ACCESS_SECTIONS, isSectionId, sectionsForRoles, type AccessSectionId } from "@/lib/access/registry";
import { getAccessForUser } from "@/lib/access/server";

/**
 * Доступы сотрудника к разделам.
 *
 * GET  — что выдано индивидуально и что действует с учётом ролей.
 * PUT  — сохранить набор разделов. `override: false` возвращает расчёт по ролям,
 *        `override: true` — действует ровно переданный список.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const user = await prisma.user.findUnique({
        where: { id: params.id },
        include: { userRoles: { include: { role: true } }, sectionAccess: true },
    });

    if (!user) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

    const roles = user.userRoles.map(item => item.role.name);
    const granted = user.sectionAccess.filter(row => row.allowed).map(row => row.section);
    const access = await getAccessForUser(params.id);

    return NextResponse.json({
        override: user.accessOverride,
        granted,
        roles,
        roleDefaults: sectionsForRoles(roles),
        effective: access?.sections ?? [],
    });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Нельзя менять доступы самому себе — иначе легко остаться без админки
    if (session.userId === params.id) {
        return NextResponse.json({ error: "Нельзя менять собственные доступы" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const override = Boolean(body.override);
    const rawSections: unknown = body.sections ?? [];
    if (!Array.isArray(rawSections)) {
        return NextResponse.json({ error: "sections должен быть массивом" }, { status: 400 });
    }

    // «Персонал» выдавать нельзя никому — это админский раздел
    const adminOnly = new Set(ACCESS_SECTIONS.filter(section => section.adminOnly).map(section => section.id));
    const sections = [...new Set(rawSections)]
        .filter((value): value is string => typeof value === "string")
        .filter(isSectionId)
        .filter(section => !adminOnly.has(section)) as AccessSectionId[];

    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

    await prisma.$transaction(async tx => {
        await tx.user.update({
            where: { id: params.id },
            data: { accessOverride: override },
        });

        await tx.sectionAccess.deleteMany({ where: { userId: params.id } });

        if (override && sections.length > 0) {
            await tx.sectionAccess.createMany({
                data: sections.map(section => ({
                    userId: params.id,
                    section,
                    allowed: true,
                    assignedBy: session.userId,
                })),
            });
        }
    });

    const access = await getAccessForUser(params.id);

    return NextResponse.json({
        success: true,
        override,
        granted: sections,
        effective: access?.sections ?? [],
    });
}

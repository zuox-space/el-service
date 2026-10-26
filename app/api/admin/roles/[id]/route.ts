// app/api/admin/roles/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { ACCESS_SECTIONS, isSectionId } from "@/lib/access/registry";

/** Изменение и удаление роли. Раздел «Персонал» выдать нельзя. */
const adminOnlySections = new Set(
    ACCESS_SECTIONS.filter(section => section.adminOnly).map(section => section.id),
);

function normalizeSections(input: unknown): string[] {
    if (!Array.isArray(input)) return [];

    return [...new Set(input)]
        .filter((value): value is string => typeof value === "string")
        .filter(isSectionId)
        .filter(section => !adminOnlySections.has(section));
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const role = await prisma.role.findUnique({ where: { id: params.id } });
    if (!role) return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });

    // Роль ADMIN не редактируем: у администратора доступы всегда полные
    if (role.name === "ADMIN") {
        return NextResponse.json({ error: "Роль администратора изменить нельзя" }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description.trim() : role.description;
    const displayName =
        body.displayName === undefined
            ? role.displayName
            : typeof body.displayName === "string" && body.displayName.trim()
                ? body.displayName.trim()
                : null;

    if (displayName && (displayName.length < 2 || displayName.length > 60)) {
        return NextResponse.json({ error: "Название роли: от 2 до 60 символов" }, { status: 400 });
    }

    const defaultSections = body.defaultSections === undefined ? role.defaultSections : normalizeSections(body.defaultSections);

    const updated = await prisma.role.update({
        where: { id: params.id },
        data: {
            displayName,
            description: description || null,
            defaultSections,
        },
    });

    return NextResponse.json({
        success: true,
        role: {
            id: updated.id,
            name: updated.name,
            displayName: updated.displayName,
            description: updated.description,
            defaultSections: updated.defaultSections,
        },
    });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;

    const role = await prisma.role.findUnique({
        where: { id: params.id },
        include: { _count: { select: { userRoles: true } } },
    });

    if (!role) return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });

    if (role.name === "ADMIN") {
        return NextResponse.json({ error: "Роль администратора удалить нельзя" }, { status: 400 });
    }

    if (role._count.userRoles > 0) {
        return NextResponse.json(
            { error: `Роль выдана ${role._count.userRoles} сотрудникам — сначала снимите её` },
            { status: 400 },
        );
    }

    await prisma.role.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
}

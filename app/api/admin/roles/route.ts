// app/api/admin/roles/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { ACCESS_SECTIONS, isSectionId, sectionsForRole } from "@/lib/access/registry";

/**
 * Роли: список и создание.
 *
 * Роль хранит название, описание и `defaultSections` — доступы по умолчанию.
 * Если список пуст, используются значения из реестра (для встроенных ролей).
 */
export async function GET() {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;

    try {
        const roles = await prisma.role.findMany({
            orderBy: { name: "asc" },
            include: { _count: { select: { userRoles: true } } },
        });

        return NextResponse.json(
            roles.map(role => ({
                id: role.id,
                name: role.name,
                description: role.description,
                defaultSections: role.defaultSections,
                // Для встроенных ролей показываем, что даётся из реестра
                registryDefaults: sectionsForRole(role.name),
                usersCount: role._count.userRoles,
            })),
        );
    } catch (error) {
        console.error("Error fetching roles:", error);
        return NextResponse.json({ error: "Не удалось получить роли" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const rawName = typeof body.name === "string" ? body.name.trim().toUpperCase().replace(/\s+/g, "_") : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(rawName)) {
        return NextResponse.json(
            { error: "Название роли: латиница в верхнем регистре, от 2 до 40 символов (например, METHODIST)" },
            { status: 400 },
        );
    }

    // Раздел «Персонал» выдавать нельзя, поэтому он не может быть доступом роли
    const adminOnly = new Set(ACCESS_SECTIONS.filter(section => section.adminOnly).map(section => section.id));
    const requestedSections = Array.isArray(body.defaultSections)
        ? [...new Set(body.defaultSections)]
            .filter((value): value is string => typeof value === "string")
            .filter(isSectionId)
            .filter(section => !adminOnly.has(section))
        : [];

    // Для стандартных ролей (TEACHER, CLASS_TEACHER, METHODIST…) не заставляем
    // администратора заново расставлять галочки: подставляем доступы из реестра.
    const sections =
        requestedSections.length > 0
            ? requestedSections
            : sectionsForRole(rawName).filter(section => !adminOnly.has(section));

    const existing = await prisma.role.findUnique({ where: { name: rawName } });
    if (existing) {
        return NextResponse.json({ error: "Роль с таким названием уже существует" }, { status: 400 });
    }

    const role = await prisma.role.create({
        data: {
            name: rawName,
            description: description || null,
            defaultSections: sections,
        },
    });

    return NextResponse.json({
        success: true,
        role: {
            id: role.id,
            name: role.name,
            description: role.description,
            defaultSections: role.defaultSections,
            usersCount: 0,
        },
    });
}

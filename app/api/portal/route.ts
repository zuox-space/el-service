// app/api/portal/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionAccess } from "@/lib/access/server";
import { ACCESS_SECTIONS } from "@/lib/access/registry";
import { prisma } from "@/lib/prisma";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";

/**
 * Данные стартовой страницы-портала.
 *
 * Портал отвечает на вопрос «что мне доступно»: какие сервисы выданы
 * (разделы доступа), есть ли классное руководство и сколько учеников в классе.
 * Доступ к самому порталу есть у любого авторизованного сотрудника — поэтому
 * здесь нет requireSection.
 */
export async function GET() {
    const access = await getSessionAccess();
    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [owned, shared, user] = await Promise.all([
        prisma.class.findMany({
            where: { ownerId: access.userId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.classShare.findMany({
            where: { teacherId: access.userId },
            select: { class: { select: { id: true, name: true } } },
        }),
        prisma.user.findUnique({
            where: { id: access.userId },
            select: { name: true, email: true },
        }),
    ]);

    const classes = [...owned, ...shared.map(item => item.class)]
        .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    // Сколько учеников — только если класс есть и доступ к разделу выдан
    let studentsCount = 0;
    if (classes.length > 0 && access.sections.includes("myClass")) {
        try {
            const grouped = await getStudentsGroupedByClass();
            studentsCount = classes.reduce((sum, item) => sum + (grouped.get(item.name)?.length ?? 0), 0);
        } catch {
            // Не критично для портала: без статистики карточка всё равно работает
            studentsCount = 0;
        }
    }

    const services = ACCESS_SECTIONS
        .filter(section => section.href && section.id !== "myClass")
        .filter(section => access.sections.includes(section.id))
        .map(section => ({
            id: section.id,
            label: section.label,
            description: section.description,
            href: section.href as string,
            group: section.group,
        }));

    return NextResponse.json({
        user: {
            name: user?.name ?? "",
            email: user?.email ?? access.email,
            roles: access.roles,
        },
        myClass: {
            available: classes.length > 0 && access.sections.includes("myClass"),
            classes: classes.map(item => item.name),
            studentsCount,
        },
        services,
    });
}

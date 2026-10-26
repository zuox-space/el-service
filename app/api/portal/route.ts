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

    // Личный рейтинг считаем только по своим классам. Общие классы
    // (ClassShare) не дают классного руководства и в рейтинг не входят.
    let rating: {
        className: string;
        attendance: { present: number; total: number; percent: number };
        violationsResolved: number;
    } | null = null;

    if (owned.length > 0) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const ownedIds = owned.map(item => item.id);
        const ownedNames = owned.map(item => item.name);

        const [attendanceRows, violationsResolved] = await Promise.all([
            prisma.attendance.findMany({
                where: { classId: { in: ownedIds }, date: { gte: monthStart, lte: monthEnd } },
                select: { presentStudents: true, absentStudents: true },
            }),
            prisma.violation.count({
                where: {
                    className: { in: ownedNames },
                    resolvedBy: access.userId,
                    resolvedAt: { gte: monthStart, lte: monthEnd },
                },
            }),
        ]);

        let present = 0;
        let total = 0;
        for (const row of attendanceRows) {
            try {
                const presentStudents = JSON.parse(row.presentStudents);
                const absentStudents = JSON.parse(row.absentStudents);
                const presentCount = Array.isArray(presentStudents) ? presentStudents.length : 0;
                const absentCount = Array.isArray(absentStudents) ? absentStudents.length : 0;
                present += presentCount;
                total += presentCount + absentCount;
            } catch {
                // Старая/битая запись не должна ломать карточку
            }
        }

        rating = {
            className: owned.map(item => item.name).join(", "),
            attendance: {
                present,
                total,
                percent: total > 0 ? Math.round((present / total) * 100) : 0,
            },
            violationsResolved,
        };
    }

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
        rating,
        services,
    });
}

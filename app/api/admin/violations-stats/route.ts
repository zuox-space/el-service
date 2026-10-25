// app/api/admin/violations-stats/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { requireSection } from "@/lib/access/server";
import { getAcademicYearStart, getDayRange, parseLocalDate, toLocalISODate } from "@/lib/date";
import { classNamesForBuilding } from "@/lib/buildings";


/**
 * Статистика нарушений за период.
 *
 * Отдаёт готовые агрегаты, чтобы страница не считала их по сырым записям:
 *  • byType        — сколько нарушений каждой причины (форма, курение, …);
 *  • byTypeStudents— сколько РАЗНЫХ учеников по каждой причине;
 *  • byClass       — сколько нарушений в каждом классе;
 *  • byMonth       — динамика по месяцам;
 *  • byWeekday     — распределение по дням недели.
 *
 * Период по умолчанию — с 1 сентября текущего учебного года по сегодня.
 */
export async function GET(request: NextRequest) {
    const accessGuard = await requireSection("violationsStats");
    if (!accessGuard.ok) return accessGuard.response;


    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }


        const { searchParams } = new URL(request.url);
        const startParam = searchParams.get("startDate");
        const endParam = searchParams.get("endDate");
        const gradeGroup = searchParams.get("gradeGroup"); // 1-3 | 4-6 | 7-11
        const buildingId = searchParams.get("buildingId");

        const startDate = startParam ? parseLocalDate(startParam) : getAcademicYearStart();
        const endDate = endParam ? parseLocalDate(endParam) : new Date();

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return NextResponse.json({ error: "Некорректные даты периода" }, { status: 400 });
        }

        const start = getDayRange(startDate).start;
        const end = getDayRange(endDate).end;

        const where: Record<string, unknown> = { date: { gte: start, lte: end } };

        // Корпус: отбираем классы нужных параллелей и фильтруем по их названиям
        if (buildingId) {
            const buildingClasses = await classNamesForBuilding(buildingId);
            where.className = { in: buildingClasses };
        } else if (gradeGroup) {
            const grades =
                gradeGroup === "1-3" ? [1, 2, 3]
                    : gradeGroup === "4-6" ? [4, 5, 6]
                        : gradeGroup === "7-11" ? [7, 8, 9, 10, 11]
                            : [];

            if (grades.length > 0) {
                const classesInGroup = await prisma.class.findMany({
                    where: { grade: { in: grades } },
                    select: { name: true },
                });
                where.className = { in: classesInGroup.map(cls => cls.name) };
            }
        }

        const violations = await prisma.violation.findMany({
            where,
            select: {
                id: true,
                violationType: true,
                className: true,
                studentId: true,
                teacherName: true,
                date: true,
            },
        });

        const byType: Record<string, number> = {};
        const studentsByType: Record<string, Set<string>> = {};
        const byClass: Record<string, number> = {};
        const byMonth: Record<string, number> = {};
        const byWeekday = [0, 0, 0, 0, 0, 0, 0];
        const students = new Set<string>();
        const teachers: Record<string, number> = {};

        for (const violation of violations) {
            const type = violation.violationType || "other";
            byType[type] = (byType[type] ?? 0) + 1;

            (studentsByType[type] ??= new Set<string>()).add(String(violation.studentId));
            students.add(String(violation.studentId));

            if (violation.className) byClass[violation.className] = (byClass[violation.className] ?? 0) + 1;
            if (violation.teacherName) teachers[violation.teacherName] = (teachers[violation.teacherName] ?? 0) + 1;

            const date = violation.date instanceof Date ? violation.date : new Date(violation.date);
            byMonth[toLocalISODate(date).slice(0, 7)] = (byMonth[toLocalISODate(date).slice(0, 7)] ?? 0) + 1;
            byWeekday[date.getDay()] += 1;
        }

        const byTypeStudents: Record<string, number> = {};
        for (const [type, set] of Object.entries(studentsByType)) {
            byTypeStudents[type] = set.size;
        }

        return NextResponse.json({
            success: true,
            period: { startDate: toLocalISODate(startDate), endDate: toLocalISODate(endDate) },
            stats: {
                total: violations.length,
                uniqueStudents: students.size,
                uniqueClasses: Object.keys(byClass).length,
                byType,
                byTypeStudents,
                byClass,
                byMonth,
                byWeekday,
                byTeacher: teachers,
            },
        });
    } catch (error) {
        console.error("Error building violations stats:", error);
        return NextResponse.json({ error: "Не удалось построить статистику" }, { status: 500 });
    }
}

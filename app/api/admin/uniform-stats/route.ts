// app/api/admin/uniform-stats/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAcademicYearStart, getDayRange, parseLocalDate, toLocalISODate } from "@/lib/date";

/**
 * Статистика нарушений формы одежды.
 *
 * Считаем из сырых записей за период (их немного — сотни, не миллионы), зато
 * получаем всё, что нужно для аналитики: разрезы по классам, параллелям, месяцам,
 * дням недели и повторяемость по ученикам.
 *
 * Период по умолчанию — с 1 сентября учебного года. Фильтр `gradeGroup`
 * (1-3 / 4-6 / 7-11) отбирает классы нужных параллелей.
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const roles = (session.user?.roles as string[]) || [];
        if (!roles.includes("ADMIN")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const startParam = searchParams.get("startDate");
        const endParam = searchParams.get("endDate");
        const gradeGroup = searchParams.get("gradeGroup") || "";

        const startDate = startParam ? parseLocalDate(startParam) : getAcademicYearStart();
        const endDate = endParam ? parseLocalDate(endParam) : new Date();

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return NextResponse.json({ error: "Некорректные даты периода" }, { status: 400 });
        }

        const start = getDayRange(startDate).start;
        const end = getDayRange(endDate).end;
        const dateFilter = { gte: start, lte: end };

        // Классы выбранного корпуса (если фильтр задан)
        let classNames: string[] | null = null;
        if (gradeGroup) {
            const grades =
                gradeGroup === "1-3" ? [1, 2, 3]
                    : gradeGroup === "4-6" ? [4, 5, 6]
                        : gradeGroup === "7-11" ? [7, 8, 9, 10, 11]
                            : [];

            if (grades.length > 0) {
                const classes = await prisma.class.findMany({
                    where: { grade: { in: grades } },
                    select: { name: true },
                });
                classNames = classes.map(cls => cls.name);
            }
        }

        const baseWhere = classNames ? { className: { in: classNames } } : {};

        const [uniformRows, allViolationsCount] = await Promise.all([
            prisma.violation.findMany({
                where: { ...baseWhere, violationType: "uniform", date: dateFilter },
                select: { id: true, studentId: true, studentName: true, className: true, date: true, teacherName: true },
            }),
            prisma.violation.count({ where: { ...baseWhere, date: dateFilter } }),
        ]);

        const byClass: Record<string, number> = {};
        const studentsByClass: Record<string, Set<string>> = {};
        const byClassMonth: Record<string, Record<string, number>> = {};
        const byMonth: Record<string, number> = {};
        const byGrade: Record<string, number> = {};
        const byWeekday = [0, 0, 0, 0, 0, 0, 0];
        const studentCounts = new Map<string, { name: string; className: string; count: number }>();
        const students = new Set<string>();

        const gradeOf = (className: string | null | undefined): string => {
            const match = (className ?? "").match(/(\d+)/);
            if (!match) return "?";
            const grade = Number(match[1]);
            if (grade >= 1 && grade <= 3) return "1-3";
            if (grade >= 4 && grade <= 6) return "4-6";
            if (grade >= 7 && grade <= 11) return "7-11";
            return "?";
        };

        for (const row of uniformRows) {
            const className = row.className || "Без класса";
            const date = row.date instanceof Date ? row.date : new Date(row.date);
            const month = toLocalISODate(date).slice(0, 7);
            const grade = gradeOf(row.className);

            byClass[className] = (byClass[className] ?? 0) + 1;
            (studentsByClass[className] ??= new Set<string>()).add(String(row.studentId));

            byClassMonth[className] ??= {};
            byClassMonth[className][month] = (byClassMonth[className][month] ?? 0) + 1;

            byMonth[month] = (byMonth[month] ?? 0) + 1;
            byGrade[grade] = (byGrade[grade] ?? 0) + 1;
            byWeekday[date.getDay()] += 1;

            students.add(String(row.studentId));

            const key = String(row.studentId);
            const entry = studentCounts.get(key) ?? {
                name: row.studentName || "Неизвестный ученик",
                className,
                count: 0,
            };
            entry.count += 1;
            studentCounts.set(key, entry);
        }

        const byClassStudents: Record<string, number> = {};
        for (const [className, set] of Object.entries(studentsByClass)) {
            byClassStudents[className] = set.size;
        }


        const topStudents = [...studentCounts.entries()]
            .map(([id, entry]) => ({ id, ...entry }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return NextResponse.json({
            success: true,
            period: { startDate: toLocalISODate(startDate), endDate: toLocalISODate(endDate) },
            stats: {
                total: uniformRows.length,
                allViolations: allViolationsCount,
                share: allViolationsCount > 0 ? Math.round((uniformRows.length / allViolationsCount) * 100) : 0,
                uniqueStudents: students.size,
                uniqueClasses: Object.keys(byClass).length,
                byClass,
                byClassStudents,
                byClassMonth,
                byMonth,
                byGrade,
                byWeekday,

                topStudents,
            },
        });
    } catch (error) {
        console.error("Error building uniform stats:", error);
        return NextResponse.json({ error: "Не удалось построить статистику" }, { status: 500 });
    }
}

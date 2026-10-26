// app/api/admin/classes/[id]/stats/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAnySection } from "@/lib/access/server";
import { canAccessClass } from "@/lib/access/classes";
import { prisma } from "@/lib/prisma";
import { normalizeClassName } from "@/lib/class-name";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";
import {
    countSchoolDays,
    getAcademicYearStart,
    getDayRange,
    parseLocalDate,
    toLocalISODate,
} from "@/lib/date";

function parseArray(value: string | null | undefined): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function parseRecord(value: string | null | undefined): Record<string, string> {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function attendanceLevel(percent: number): "excellent" | "good" | "bad" | "veryBad" {
    return percent >= 90 ? "excellent" : percent >= 80 ? "good" : percent >= 50 ? "bad" : "veryBad";
}

function monthKey(date: Date): string {
    return toLocalISODate(date).slice(0, 7);
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    const guard = await requireAnySection(["classes", "myClass"]);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(request.url);
    const today = new Date();
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const from = parseLocalDate(fromParam || getAcademicYearStart(today));
    const to = parseLocalDate(toParam || today);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
        return NextResponse.json({ error: "Некорректный период" }, { status: 400 });
    }

    try {
        const classInfo = await prisma.class.findUnique({
            where: { id: params.id },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                building: { select: { id: true, name: true } },
                sharedWith: {
                    select: { teacher: { select: { id: true, name: true, email: true } } },
                },
            },
        });

        if (!classInfo) {
            return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
        }

        // Раздел «Классы» видит все классы, классный руководитель — только свой/расшаренный.
        if (!guard.access.sections.includes("classes") && !(await canAccessClass(guard.access, classInfo.id))) {
            return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
        }

        const className = normalizeClassName(classInfo.name);
        const fromRange = getDayRange(from);
        const toRange = getDayRange(to);

        let students: Array<{ id: string; name: string }> = [];
        try {
            const grouped = await getStudentsGroupedByClass();
            students = (grouped.get(className) ?? []).map(student => ({
                id: String(student.aisId),
                name: student.name,
            }));
        } catch {
            // Если АИС временно недоступна, остальная статистика всё равно полезна.
        }

        const [attendanceRows, violationRows, activeSchoolRecords] = await Promise.all([
            prisma.attendance.findMany({
                where: {
                    classId: classInfo.id,
                    date: { gte: fromRange.start, lte: toRange.end },
                },
                orderBy: { date: "asc" },
            }),
            prisma.violation.findMany({
                where: {
                    className,
                    date: { gte: fromRange.start, lte: toRange.end },
                },
                orderBy: { date: "desc" },
                select: {
                    id: true,
                    studentId: true,
                    studentName: true,
                    violationType: true,
                    date: true,
                    resolvedAt: true,
                    resolvedByName: true,
                    teacherName: true,
                },
            }),
            prisma.schoolRecord.count({ where: { className, isActive: true } }),
        ]);

        type DayStat = {
            date: string;
            present: number;
            absent: number;
            marked: boolean;
            reasons: Record<string, number>;
        };
        const daily = new Map<string, DayStat>();
        const reasonCounts: Record<string, number> = {};
        const absentByStudent = new Map<string, number>();
        let totalPresent = 0;
        let totalAbsent = 0;
        let lastMarkedAt: string | null = null;

        for (const row of attendanceRows) {
            const date = toLocalISODate(row.date);
            const present = parseArray(row.presentStudents);
            const absent = parseArray(row.absentStudents);
            const reasons = parseRecord(row.absentReasons);
            const current = daily.get(date) ?? {
                date,
                present: 0,
                absent: 0,
                marked: false,
                reasons: {},
            };
            current.present += present.length;
            current.absent += absent.length;
            current.marked = true;
            daily.set(date, current);

            totalPresent += present.length;
            totalAbsent += absent.length;
            lastMarkedAt = date;

            for (const id of absent) {
                const reason = reasons[id] || reasons[String(Number(id))] || "unknown";
                reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
                current.reasons[reason] = (current.reasons[reason] ?? 0) + 1;
                absentByStudent.set(id, (absentByStudent.get(id) ?? 0) + 1);
            }
        }

        const effectiveEnd = to > today ? today : to;
        const schoolDays = countSchoolDays(from, effectiveEnd);

        // Добавляем учебные дни без отметки: они не должны пропадать из графика.
        const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        const lastDay = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate());
        while (cursor <= lastDay) {
            const weekday = cursor.getDay();
            if (weekday !== 0 && weekday !== 6) {
                const date = toLocalISODate(cursor);
                if (!daily.has(date)) {
                    daily.set(date, {
                        date,
                        present: 0,
                        absent: 0,
                        marked: false,
                        reasons: {},
                    });
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        const dailyStats = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
        const markedDays = dailyStats.filter(item => item.marked).length;
        const attendancePercent = schoolDays > 0 ? Math.min(100, Math.round((markedDays / schoolDays) * 100)) : 0;

        type ResolutionCount = { resolved: number; unresolved: number };
        const byMonth = new Map<string, ResolutionCount>();
        const byType = new Map<string, ResolutionCount>();
        const byTypeMonth = new Map<string, Map<string, ResolutionCount>>();
        const violationsByStudent = new Map<string, { id: string; name: string; count: number }>();
        let resolvedCount = 0;

        const increment = (map: Map<string, ResolutionCount>, key: string, resolved: boolean) => {
            const current = map.get(key) ?? { resolved: 0, unresolved: 0 };
            if (resolved) current.resolved += 1;
            else current.unresolved += 1;
            map.set(key, current);
        };

        for (const row of violationRows) {
            const month = monthKey(row.date);
            const resolved = Boolean(row.resolvedAt);
            increment(byMonth, month, resolved);
            increment(byType, row.violationType, resolved);

            const typeMonths = byTypeMonth.get(row.violationType) ?? new Map<string, ResolutionCount>();
            increment(typeMonths, month, resolved);
            byTypeMonth.set(row.violationType, typeMonths);

            const student = violationsByStudent.get(row.studentId) ?? {
                id: row.studentId,
                name: row.studentName,
                count: 0,
            };
            student.count += 1;
            violationsByStudent.set(row.studentId, student);

            if (resolved) resolvedCount += 1;
        }

        const toMonths = (source: Map<string, ResolutionCount>) =>
            [...source.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, value]) => ({
                    month,
                    ...value,
                    count: value.resolved + value.unresolved,
                }));

        const byTypeMonthRows = [...byTypeMonth.entries()]
            .flatMap(([type, months]) =>
                toMonths(months).map(item => ({ type, ...item })),
            )
            .sort((a, b) => a.type.localeCompare(b.type) || a.month.localeCompare(b.month));

        const uniformMonths = byTypeMonth.get("uniform");
        const uniformByMonth = uniformMonths ? toMonths(uniformMonths) : [];
        const uniformCount = uniformByMonth.reduce((sum, item) => sum + item.count, 0);

        const studentName = (id: string) =>
            students.find(item => item.id === id)?.name ||
            violationRows.find(item => item.studentId === id)?.studentName ||
            "Неизвестный ученик";

        const truants = [...absentByStudent.entries()]
            .map(([id, count]) => ({ id, name: studentName(id), count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const recentViolations = violationRows.map(row => ({
            id: row.id,
            studentId: row.studentId,
            studentName: row.studentName,
            violationType: row.violationType,
            date: row.date.toISOString(),
            resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
            resolvedByName: row.resolvedByName,
            teacherName: row.teacherName,
        }));

        return NextResponse.json({
            classInfo: {
                id: classInfo.id,
                name: classInfo.name,
                grade: classInfo.grade,
                letter: classInfo.letter,
                building: classInfo.building,
                owner: classInfo.owner,
                sharedTeachers: classInfo.sharedWith.map(item => item.teacher),
            },
            period: { from: toLocalISODate(from), to: toLocalISODate(to) },
            students,
            summary: {
                studentCount: students.length,
                markedDays,
                schoolDays,
                attendancePercent,
                attendanceLevel: attendanceLevel(attendancePercent),
                presentCount: totalPresent,
                absentCount: totalAbsent,
                lastMarkedAt,
                violationsTotal: violationRows.length,
                violationsResolved: resolvedCount,
                violationsUnresolved: violationRows.length - resolvedCount,
                resolutionPercent: violationRows.length > 0
                    ? Math.round((resolvedCount / violationRows.length) * 100)
                    : 0,
                uniformCount,
                activeSchoolRecords,
            },
            attendance: {
                daily: dailyStats,
                reasons: Object.entries(reasonCounts)
                    .map(([reason, count]) => ({ reason, count }))
                    .sort((a, b) => b.count - a.count),
            },
            violations: {
                byType: [...byType.entries()]
                    .map(([type, value]) => ({
                        type,
                        ...value,
                        count: value.resolved + value.unresolved,
                    }))
                    .sort((a, b) => b.count - a.count),
                byMonth: toMonths(byMonth),
                byTypeMonth: byTypeMonthRows,
                topStudents: [...violationsByStudent.values()]
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10),
                recent: recentViolations,
            },
            uniform: {
                total: uniformCount,
                byMonth: uniformByMonth,
            },
            truants,
        });
    } catch (error) {
        console.error("Error loading class stats:", error);
        return NextResponse.json({ error: "Не удалось загрузить статистику класса" }, { status: 500 });
    }
}

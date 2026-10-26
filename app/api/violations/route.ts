// app/api/violations/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { requireAnySection, requireSection } from "@/lib/access/server";
import { getDayRange, parseLocalDate } from "@/lib/date";
import { normalizeClassName } from "@/lib/class-name";
import { classNamesForBuilding } from "@/lib/buildings";
import { accessibleClassNames, canAccessClass } from "@/lib/access/classes";
import { consumeRateLimit } from "@/lib/rate-limit";


const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

/** Безопасный разбор целого числа из query-строки. */
function parseIntParam(value: string | null, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

// GET: Получить нарушения с фильтрами, пагинацией и статистикой
export async function GET(req: NextRequest) {
    // Фиксировать нарушение может учитель на рабочем экране и раздел «Нарушения»
    const accessGuard = await requireAnySection(["violations", "myClass"]);
    if (!accessGuard.ok) return accessGuard.response;


    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");            // конкретный день YYYY-MM-DD
        const startDate = searchParams.get("startDate");  // начало периода YYYY-MM-DD
        const endDate = searchParams.get("endDate");      // конец периода YYYY-MM-DD
        const className = searchParams.get("className");  // фильтр по классу
        const gradeGroup = searchParams.get("gradeGroup"); // 1-3 | 4-6 | 7-11 (корпус)
        const buildingId = searchParams.get("buildingId");
        const violationType = searchParams.get("type");   // фильтр по типу нарушения
        const studentId = searchParams.get("studentId");  // для одного ученика
        const teacherId = searchParams.get("teacherId");  // для учителя
        const search = (searchParams.get("search") || "").trim(); // поиск по ученику/учителю/комментарию
        const resolution = searchParams.get("resolution") || ""; // resolved | unresolved — отработка
        const mine = searchParams.get("mine") === "1";           // только свои нарушения

        const page = parseIntParam(searchParams.get("page"), 1, 1, 100000);
        const pageSize = parseIntParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

        const sortByParam = searchParams.get("sortBy") || "date";
        const sortBy = (["date", "studentName", "className", "violationType"] as const)
            .includes(sortByParam as any) ? sortByParam : "date";
        const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

        // Если запрошена только страница без статистики (например, вкладка учителя за день)
        const withStats = searchParams.get("stats") !== "false";

        const where: any = {};

        // Фильтр по конкретной дате (границы суток — локальные, а не UTC)
        if (date) {
            const { start, end } = getDayRange(date);
            where.date = { gte: start, lte: end };
        }
        // Или по периоду
        else if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = parseLocalDate(startDate);
            if (endDate) where.date.lte = getDayRange(endDate).end;
        }

        if (className) where.className = normalizeClassName(className);

        // Фильтр по корпусу: у нарушения нет поля «параллель», поэтому берём классы
        // нужных параллелей и фильтруем по их названиям.
        if (buildingId && !className) {
            const buildingClasses = await classNamesForBuilding(buildingId);
            where.className = { in: buildingClasses };
        } else if (gradeGroup && !className) {
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
        // Учитель с myClass видит только свои/расшаренные классы.
        // Администратор и школьные разделы (нарушения/портфолио/ВШУ) — все.
        const allowedClassNames = await accessibleClassNames(accessGuard.access);
        if (allowedClassNames) {
            if (typeof where.className === "string" && !allowedClassNames.has(where.className)) {
                return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
            }
            if (where.className && typeof where.className === "object" && Array.isArray(where.className.in)) {
                where.className = {
                    in: where.className.in.filter((name: string) => allowedClassNames.has(name)),
                };
            } else if (!where.className) {
                where.className = { in: [...allowedClassNames] };
            }
        }

        if (violationType) where.violationType = violationType;

        // Фильтр по отработке: администрация отмечает, что замечание разобрано
        if (resolution === "resolved") where.resolvedAt = { not: null };
        if (resolution === "unresolved") where.resolvedAt = null;

        // «Мои фиксации» — столько, сколько зафиксировал текущий сотрудник
        if (mine) where.teacherId = session.user.id;
        if (studentId) where.studentId = String(studentId);
        if (teacherId) where.teacherId = teacherId;

        // 🔥 Поиск на сервере: по ученику, учителю и комментарию.
        // Это замена клиентской фильтрации, из-за которой статистика считалась по обрезанному списку.
        if (search) {
            where.OR = [
                { studentName: { contains: search, mode: "insensitive" } },
                { teacherName: { contains: search, mode: "insensitive" } },
                { comment: { contains: search, mode: "insensitive" } },
            ];
        }

        const orderBy: any = [{ [sortBy]: sortDir }, { id: "asc" }];

        // Считаем общее количество и статистику по ВСЕМ подходящим записям,
        // а не по текущей странице. Иначе «Всего нарушений» показывало размер страницы (было 100).
        const [violations, total, byTypeRaw, byClassRaw, uniqueStudents] = await Promise.all([
            prisma.violation.findMany({
                where,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.violation.count({ where }),
            withStats
                ? prisma.violation.groupBy({
                    by: ["violationType"],
                    where,
                    _count: { _all: true },
                })
                : Promise.resolve([]),
            withStats
                ? prisma.violation.groupBy({
                    by: ["className"],
                    where,
                    _count: { _all: true },
                })
                : Promise.resolve([]),
            withStats
                ? prisma.violation.findMany({
                    where,
                    distinct: ["studentId"],
                    select: { studentId: true },
                })
                : Promise.resolve([]),
        ]);

        const byType: Record<string, number> = {};
        byTypeRaw.forEach((row: any) => {
            byType[row.violationType] = row._count?._all ?? 0;
        });

        const byClass: Record<string, number> = {};
        byClassRaw.forEach((row: any) => {
            if (!row.className) return;
            byClass[row.className] = row._count?._all ?? 0;
        });

        // Сколько замечаний уже разобрано, а сколько ждёт администрацию
        const [resolvedCount, unresolvedCount] = withStats
            ? await Promise.all([
                prisma.violation.count({ where: { ...where, resolvedAt: { not: null } } }),
                prisma.violation.count({ where: { ...where, resolvedAt: null } }),
            ])
            : [0, 0];

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        return NextResponse.json({
            violations,
            total,
            page,
            pageSize,
            totalPages,
            hasMore: page * pageSize < total,
            stats: {
                total,
                byType,
                byClass,
                uniqueStudents: uniqueStudents.length,
                uniqueClasses: Object.keys(byClass).length,
                resolved: resolvedCount,
                unresolved: unresolvedCount,
            },
        });
    } catch (error) {
        console.error("Error fetching violations:", error);
        return NextResponse.json({ error: "Failed to fetch violations" }, { status: 500 });
    }
}

// POST: Создать нарушение
export async function POST(req: NextRequest) {
    // Фиксировать нарушение может учитель на рабочем экране и раздел «Нарушения»
    const accessGuard = await requireAnySection(["violations", "myClass"]);
    if (!accessGuard.ok) return accessGuard.response;

    const limit = consumeRateLimit(`violation-create:${accessGuard.access.userId}`, 60, 60_000);
    if (!limit.allowed) {
        return NextResponse.json(
            { error: "Слишком много нарушений за минуту" },
            { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
        );
    }

    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { studentId, studentName, className, violationType, comment } = body;

        if (!(await canAccessClass(accessGuard.access, className))) {
            return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
        }

        if (!studentId || !studentName || !violationType) {
            return NextResponse.json({
                error: "Missing required fields",
            }, { status: 400 });
        }

        const teacherName = session.user?.name || "Неизвестный";

        const violation = await prisma.violation.create({
            data: {
                studentId: String(studentId),
                studentName,
                className: normalizeClassName(className),
                violationType,
                comment: comment || "",
                teacherId: session.user.id,
                teacherName,
            },
        });

        return NextResponse.json(violation);
    } catch (error) {
        console.error("Error creating violation:", error);
        return NextResponse.json({ error: "Failed to create violation" }, { status: 500 });
    }
}

// DELETE: Удалить нарушение (для админов)
export async function DELETE(req: NextRequest) {
    // Просмотр нарушений доступен и учителю на рабочем экране (свой класс)
    const accessGuard = await requireSection("violations");
    if (!accessGuard.ok) return accessGuard.response;


    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }

        await prisma.violation.deleteMany({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting violation:", error);
        return NextResponse.json({ error: "Failed to delete violation" }, { status: 500 });
    }
}

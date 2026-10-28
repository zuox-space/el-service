import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";
import { requireAnySection, requireSection } from "@/lib/access/server";
import {
    canAccessSeatingClass,
    canEditSeatingClass,
    SEAT_ROWS,
    type SeatSide,
} from "@/lib/seating";

export const dynamic = "force-dynamic";

interface SeatPayload {
    row: number;
    desk: number;
    side: SeatSide;
    studentId: string | null;
    studentName: string | null;
}

function parseRow(value: unknown): number | null {
    const row = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    return Number.isInteger(row) && row >= 1 && row <= SEAT_ROWS ? row : null;
}

function parseDesk(value: unknown): number | null {
    const desk = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    return Number.isInteger(desk) && desk >= 1 && desk <= 3 ? desk : null;
}

export async function GET(req: NextRequest) {
    const guard = await requireAnySection(["seating", "myClass"]);
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") || "";
    if (!classId) {
        return NextResponse.json({ error: "Не выбран класс" }, { status: 400 });
    }

    if (!(await canAccessSeatingClass(guard.access, classId))) {
        return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
    }

    try {
        const classRow = await prisma.class.findUnique({
            where: { id: classId },
            select: { id: true, name: true },
        });
        if (!classRow) {
            return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
        }

        const grouped = await getStudentsGroupedByClass();
        const students = (grouped.get(classRow.name) ?? []).map(student => ({
            id: String(student.aisId),
            name: student.name,
        }));

        const seats = await prisma.seatAssignment.findMany({
            where: { classId },
            select: { id: true, row: true, desk: true, side: true, studentId: true, studentName: true },
            orderBy: [{ row: "asc" }, { desk: "asc" }, { side: "asc" }],
        });

        // Внешняя база могла изменить состав класса. Освобождаем места тех,
        // кого больше нет в актуальном списке. Если внешняя база временно
        // вернула пустой список, ничего не удаляем.
        const roster = new Map(students.map(student => [String(student.id), student.name]));
        const staleSeats = students.length > 0
            ? seats.filter(seat => seat.studentId && !roster.has(String(seat.studentId)))
            : [];

        if (staleSeats.length > 0) {
            await prisma.seatAssignment.deleteMany({
                where: { id: { in: staleSeats.map(seat => seat.id) } },
            });
        }

        const actualSeats = seats
            .filter(seat => !staleSeats.some(stale => stale.id === seat.id))
            .map(seat => {
                if (!seat.studentId) return seat;
                const currentName = roster.get(String(seat.studentId));
                return currentName ? { ...seat, studentName: currentName } : seat;
            });

        return NextResponse.json({
            class: classRow,
            students,
            seats: actualSeats,
            releasedSeats: staleSeats.length,
        });
    } catch (error) {
        console.error("Error loading seating:", error);
        return NextResponse.json({ error: "Не удалось загрузить рассадку" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    // Менять рассадку может только классный руководитель со страницы
    // «Мой класс». Сотруднику с разделом seating доступен только просмотр.
    const guard = await requireSection("myClass");
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const classId = typeof body.classId === "string" ? body.classId : "";
    const row = parseRow(body.row);
    const desk = parseDesk(body.desk);
    const left = body.left ?? null;
    const right = body.right ?? null;

    if (!classId || !row || !desk) {
        return NextResponse.json({ error: "Не выбран класс или парта" }, { status: 400 });
    }

    const leftId = typeof left === "string" && left.trim() ? left.trim() : null;
    const rightId = typeof right === "string" && right.trim() ? right.trim() : null;

    if (leftId && rightId && leftId === rightId) {
        return NextResponse.json({ error: "Один ученик не может занимать два места" }, { status: 400 });
    }

    if (!(await canEditSeatingClass(guard.access, classId))) {
        return NextResponse.json({ error: "Редактировать рассадку может только классный руководитель" }, { status: 403 });
    }

    try {
        const classRow = await prisma.class.findUnique({
            where: { id: classId },
            select: { id: true, name: true },
        });
        if (!classRow) {
            return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
        }

        const grouped = await getStudentsGroupedByClass();
        const students = grouped.get(classRow.name) ?? [];
        const studentMap = new Map(students.map(student => [String(student.aisId), student.name]));

        for (const studentId of [leftId, rightId]) {
            if (studentId && !studentMap.has(studentId)) {
                return NextResponse.json(
                    { error: "Ученик не найден в этом классе" },
                    { status: 400 },
                );
            }
        }

        const otherSeats = await prisma.seatAssignment.findMany({
            where: { classId, studentId: { not: null } },
            select: { row: true, desk: true, studentId: true },
        });
        const busyStudents = new Set(
            otherSeats
                .filter(seat => seat.row !== row || seat.desk !== desk)
                .map(seat => seat.studentId)
                .filter(Boolean),
        );
        if ((leftId && busyStudents.has(leftId)) || (rightId && busyStudents.has(rightId))) {
            return NextResponse.json(
                { error: "Ученик уже сидит за другой партой" },
                { status: 409 },
            );
        }

        const payload: SeatPayload[] = [];
        if (leftId) {
            payload.push({
                row,
                desk,
                side: "left",
                studentId: leftId,
                studentName: studentMap.get(leftId) ?? null,
            });
        }
        if (rightId) {
            payload.push({
                row,
                desk,
                side: "right",
                studentId: rightId,
                studentName: studentMap.get(rightId) ?? null,
            });
        }

        await prisma.$transaction(async tx => {
            await tx.seatAssignment.deleteMany({ where: { classId, row, desk } });
            if (payload.length > 0) {
                await tx.seatAssignment.createMany({
                    data: payload.map(item => ({ classId, ...item })),
                });
            }
        });

        return NextResponse.json({
            success: true,
            seats: payload,
        });
    } catch (error) {
        console.error("Error saving seating:", error);
        return NextResponse.json({ error: "Не удалось сохранить рассадку" }, { status: 500 });
    }
}

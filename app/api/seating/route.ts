import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";
import { requireAnySection } from "@/lib/access/server";
import { getDayRange, toLocalISODate } from "@/lib/date";
import {
    canAccessSeatingClass,
    SEAT_ROWS,
    type SeatSide,
} from "@/lib/seating";

export const dynamic = "force-dynamic";

interface SeatPayload {
    row: number;
    side: SeatSide;
    studentId: string | null;
    studentName: string | null;
}

function parseRow(value: unknown): number | null {
    const row = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    return Number.isInteger(row) && row >= 1 && row <= SEAT_ROWS ? row : null;
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
            select: { row: true, side: true, studentId: true, studentName: true },
            orderBy: [{ row: "asc" }, { side: "asc" }],
        });

        // Для отметки «н» нужны только отсутствующие сегодня.
        const date = searchParams.get("date") || toLocalISODate();
        const { start, end } = getDayRange(date);
        const attendance = await prisma.attendance.findFirst({
            where: { classId, date: { gte: start, lte: end } },
            select: { absentStudents: true },
        });

        let absentStudentIds: string[] = [];
        if (attendance?.absentStudents) {
            try {
                const parsed = JSON.parse(attendance.absentStudents);
                if (Array.isArray(parsed)) absentStudentIds = parsed.map(String);
            } catch {
                absentStudentIds = [];
            }
        }

        return NextResponse.json({
            class: classRow,
            students,
            seats,
            absentStudentIds,
            date,
        });
    } catch (error) {
        console.error("Error loading seating:", error);
        return NextResponse.json({ error: "Не удалось загрузить рассадку" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const guard = await requireAnySection(["seating", "myClass"]);
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    const classId = typeof body.classId === "string" ? body.classId : "";
    const row = parseRow(body.row);
    const left = body.left ?? null;
    const right = body.right ?? null;

    if (!classId || !row) {
        return NextResponse.json({ error: "Не выбран класс или парта" }, { status: 400 });
    }

    const leftId = typeof left === "string" && left.trim() ? left.trim() : null;
    const rightId = typeof right === "string" && right.trim() ? right.trim() : null;

    if (leftId && rightId && leftId === rightId) {
        return NextResponse.json({ error: "Один ученик не может занимать два места" }, { status: 400 });
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
            where: { classId, row: { not: row }, studentId: { not: null } },
            select: { studentId: true },
        });
        const busyStudents = new Set(otherSeats.map(seat => seat.studentId).filter(Boolean));
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
                side: "left",
                studentId: leftId,
                studentName: studentMap.get(leftId) ?? null,
            });
        }
        if (rightId) {
            payload.push({
                row,
                side: "right",
                studentId: rightId,
                studentName: studentMap.get(rightId) ?? null,
            });
        }

        await prisma.$transaction(async tx => {
            await tx.seatAssignment.deleteMany({ where: { classId, row } });
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

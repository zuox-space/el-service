// app/api/violations/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Получить нарушения с фильтрами
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");           // конкретная дата YYYY-MM-DD
        const startDate = searchParams.get("startDate"); // начало периода
        const endDate = searchParams.get("endDate");     // конец периода
        const className = searchParams.get("className"); // фильтр по классу
        const violationType = searchParams.get("type");  // фильтр по типу
        const studentId = searchParams.get("studentId"); // для одного ученика
        const teacherId = searchParams.get("teacherId"); // для учителя
        const limit = parseInt(searchParams.get("limit") || "100");

        const where: any = {};

        // Фильтр по конкретной дате
        if (date) {
            const dayStart = new Date(date + 'T00:00:00.000Z');
            const dayEnd = new Date(date + 'T23:59:59.999Z');
            where.date = { gte: dayStart, lte: dayEnd };
        }
        // Или по периоду
        else if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate + 'T00:00:00.000Z');
            if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
        }

        if (className) where.className = className;
        if (violationType) where.violationType = violationType;
        if (studentId) where.studentId = String(studentId);
        if (teacherId) where.teacherId = teacherId;

        const violations = await prisma.violation.findMany({
            where,
            orderBy: { date: "desc" },
            take: limit,
        });

        return NextResponse.json(violations);
    } catch (error) {
        console.error("Error fetching violations:", error);
        return NextResponse.json({ error: "Failed to fetch violations" }, { status: 500 });
    }
}

// POST: Создать нарушение
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { studentId, studentName, className, violationType, comment } = body;

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
                className: className || "",
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
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }

        await prisma.violation.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting violation:", error);
        return NextResponse.json({ error: "Failed to delete violation" }, { status: 500 });
    }
}
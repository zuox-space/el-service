// app/api/violations/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Получить все нарушения
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const classId = searchParams.get("classId");
        const limit = parseInt(searchParams.get("limit") || "50");

        const violations = await prisma.violation.findMany({
            where: classId ? { className: classId } : {},
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
                required: ["studentId", "studentName", "violationType"],
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
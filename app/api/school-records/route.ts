// app/api/school-records/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Получить записи ВШУ
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get("studentId");
        const onlyActive = searchParams.get("active") === "true";

        const where: any = {};
        if (studentId) where.studentId = String(studentId);
        if (onlyActive) where.isActive = true;

        const records = await prisma.schoolRecord.findMany({
            where,
            orderBy: { registeredAt: 'desc' },
        });

        return NextResponse.json(records);
    } catch (error) {
        console.error("Error fetching school records:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

// POST: Поставить на учёт
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { studentId, studentName, className, reason, registeredAt, plannedReleaseAt } = body;

        if (!studentId || !studentName || !reason) {
            return NextResponse.json({
                error: "Missing required fields",
            }, { status: 400 });
        }

        // Проверяем, нет ли уже активной записи
        const existing = await prisma.schoolRecord.findFirst({
            where: {
                studentId: String(studentId),
                isActive: true,
            },
        });

        if (existing) {
            return NextResponse.json({
                error: "Student is already registered",
                record: existing,
            }, { status: 400 });
        }

        const record = await prisma.schoolRecord.create({
            data: {
                studentId: String(studentId),
                studentName,
                className: className || "",
                registeredAt: registeredAt ? new Date(registeredAt) : new Date(),
                registeredBy: session.user.id,
                registeredByName: session.user.name || "Неизвестно",
                reason,
                // 🔥 Сохраняем предполагаемую дату снятия
                plannedReleaseAt: plannedReleaseAt ? new Date(plannedReleaseAt) : null,
                isActive: true,
            },
        });

        console.log(`✅ Student ${studentName} registered on school record`);

        return NextResponse.json(record);
    } catch (error) {
        console.error("Error creating school record:", error);
        return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }
}

// PUT: Снять с учёта
export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id, releaseReason, releasedAt } = body;

        if (!id || !releaseReason) {
            return NextResponse.json({
                error: "Missing required fields",
            }, { status: 400 });
        }

        const record = await prisma.schoolRecord.update({
            where: { id },
            data: {
                releasedAt: releasedAt ? new Date(releasedAt) : new Date(),
                releasedBy: session.user.id,
                releasedByName: session.user.name || "Неизвестно",
                releaseReason,
                isActive: false,
            },
        });

        console.log(`✅ Student ${record.studentName} released from school record`);

        return NextResponse.json(record);
    } catch (error) {
        console.error("Error updating school record:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

// DELETE: Удалить запись (только админ)
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

        await prisma.schoolRecord.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting school record:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
// app/api/authorizations/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Получить доверенности
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const className = searchParams.get("className");
        const isActive = searchParams.get("active");
        const studentId = searchParams.get("studentId");

        const where: any = {};
        if (className) where.className = className;
        if (studentId) where.studentId = String(studentId);
        if (isActive === "true") where.isActive = true;
        if (isActive === "false") where.isActive = false;

        const authorizations = await prisma.authorization.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(authorizations);
    } catch (error) {
        console.error("Error fetching authorizations:", error);
        return NextResponse.json([]);
    }
}

// POST: Создать доверенность
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const {
            studentId,
            studentName,
            className,
            trustedName,
            relation,
            phone,
            comment,
        } = body;

        if (!studentId || !studentName || !trustedName || !relation) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const authorization = await prisma.authorization.create({
            data: {
                studentId: String(studentId),
                studentName,
                className: className || "",
                trustedName,
                relation,
                phone: phone || null,
                comment: comment || null,
                teacherId: session.user.id,
                teacherName: session.user.name || "Неизвестно",
                isActive: true,
            },
        });

        console.log(`✅ Authorization created for ${studentName}`);

        return NextResponse.json(authorization);
    } catch (error) {
        console.error("Error creating authorization:", error);
        return NextResponse.json(
            { error: "Failed to create", details: String(error) },
            { status: 500 }
        );
    }
}

// PUT: Отозвать доверенность (в архив)
export async function PUT(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: "Missing id" }, { status: 400 });
        }

        const authorization = await prisma.authorization.update({
            where: { id },
            data: {
                isActive: false,
                revokedAt: new Date(),
                revokedBy: session.user.id,
                revokedByName: session.user.name || "Неизвестно",
            },
        });

        console.log(`🗑️ Authorization revoked for ${authorization.studentName}`);

        return NextResponse.json(authorization);
    } catch (error) {
        console.error("Error revoking authorization:", error);
        return NextResponse.json(
            { error: "Failed to revoke" },
            { status: 500 }
        );
    }
}

// DELETE: Полное удаление (только админ)
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

        await prisma.authorization.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting authorization:", error);
        return NextResponse.json(
            { error: "Failed to delete" },
            { status: 500 }
        );
    }
}
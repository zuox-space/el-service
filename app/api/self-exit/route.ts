export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Получить активные самовыводы
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (!classId) {
    return NextResponse.json([]);
  }

  try {
    const now = new Date();
    
    // Получаем только активные (дата окончания не прошла)
    const selfExits = await prisma.selfExit.findMany({
      where: {
        classId,
        endDate: { gte: now }
      },
      orderBy: { endDate: "asc" }
    });

    return NextResponse.json(selfExits);
  } catch (error) {
    console.error("Error fetching self-exits:", error);
    return NextResponse.json([]);
  }
}

// POST: Создать самовывод
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { studentId, studentName, startDate, endDate, photoUrl, reason, classId } = body;

    if (!studentId || !studentName || !startDate || !endDate || !photoUrl || !classId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const selfExit = await prisma.selfExit.create({
      data: {
        studentId: Number(studentId),
        studentName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        photoUrl,
        reason: reason || "",
        classId,
        teacherId: session.user.id,
      }
    });

    return NextResponse.json(selfExit);
  } catch (error) {
    console.error("Error creating self-exit:", error);
    return NextResponse.json({ error: "Failed to create self-exit" }, { status: 500 });
  }
}

// DELETE: Удалить самовывод (отменить)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await prisma.selfExit.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting self-exit:", error);
    return NextResponse.json({ error: "Failed to delete self-exit" }, { status: 500 });
  }
}
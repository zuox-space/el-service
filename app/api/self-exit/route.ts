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

    console.log("📝 Creating self-exit with data:", { studentId, studentName, startDate, endDate, classId });

    if (!studentId || !studentName || !startDate || !endDate || !classId) {
      return NextResponse.json({
        error: "Missing required fields",
        required: ["studentId", "studentName", "startDate", "endDate", "classId"],
        received: { studentId, studentName, startDate, endDate, classId }
      }, { status: 400 });
    }

    // Проверяем, что класс существует
    const classExists = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classExists) {
      return NextResponse.json({
        error: "Class not found",
        classId
      }, { status: 404 });
    }

    // 🔥 studentId теперь String, передаем как есть
    const selfExit = await prisma.selfExit.create({
      data: {
        studentId: String(studentId), // 👈 Преобразуем в строку

        studentName: studentName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        photoUrl: photoUrl || "",
        reason: reason || "",
        classId: classId,
        teacherId: session.user.id,
      }
    });

    console.log("✅ Self-exit created:", selfExit.id);

    return NextResponse.json(selfExit);
  } catch (error) {
    console.error("❌ Error creating self-exit:", error);
    return NextResponse.json({
      error: "Failed to create self-exit",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
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
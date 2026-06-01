import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET: Получить пропуски
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const date = searchParams.get("date");

  if (!classId || !date) {
    return NextResponse.json([]);
  }

  try {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const passes = await prisma.pass.findMany({
      where: {
        classId: classId,
        date: { gte: startDate, lte: endDate }
      },
      orderBy: { createdAt: "desc" }
    });

    const parsedPasses = passes.map(pass => ({
      ...pass,
      students: typeof pass.students === 'string' ? JSON.parse(pass.students) : pass.students
    }));

    return NextResponse.json(parsedPasses);
  } catch (error) {
    console.error(error);
    return NextResponse.json([]);
  }
}

// POST: Создать пропуск
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { date, classId, students, exitTime, reason } = body;

    const passDate = new Date(date);
    passDate.setHours(0, 0, 0, 0);

    const pass = await prisma.pass.create({
      data: {
        date: passDate,
        classId: classId,
        teacherId: session.user.id,
        students: JSON.stringify(students),
        exitTime: exitTime,
        reason: reason,
      },
    });

    return NextResponse.json({ ...pass, students: students });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create pass" }, { status: 500 });
  }
}

// PUT: Обновить пропуск (альтернатива PATCH)
export async function PUT(req: NextRequest) {
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
    const pass = await prisma.pass.update({
      where: { id },
      data: {
        used: true,
        usedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, pass });
  } catch (error) {
    console.error("Error marking pass as used:", error);
    return NextResponse.json({ error: "Failed to mark pass as used" }, { status: 500 });
  }
}

// DELETE: Удалить пропуск
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
    await prisma.pass.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete pass" }, { status: 500 });
  }
}
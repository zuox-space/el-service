import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { requireAnySection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { broadcastKeys } from "@/lib/keys/bus";


export const dynamic = 'force-dynamic';

// GET: Получить пропуски
export async function GET(req: NextRequest) {
    const accessGuard = await requireAnySection(["myClass", "dashboard"]);
    if (!accessGuard.ok) return accessGuard.response;


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
    const accessGuard = await requireAnySection(["myClass", "dashboard"]);
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { date, classId, students, exitTime, reason } = body;

    const parsedDate = date ? new Date(date) : new Date();
    const passDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    passDate.setHours(0, 0, 0, 0);

    // Каждому выбранному ребёнку — отдельный пропуск, а не одна запись на всех.
    const studentList = Array.isArray(students) ? students.filter(Boolean) : [];
    if (studentList.length === 0) {
      return NextResponse.json({ error: "Выберите хотя бы одного ученика" }, { status: 400 });
    }

    const created = await prisma.$transaction(
      studentList.map((student) =>
        prisma.pass.create({
          data: {
            date: passDate,
            classId: classId,
            teacherId: session.user.id,
            students: JSON.stringify([student]),
            exitTime: typeof exitTime === "string" && /^\d{2}:\d{2}$/.test(exitTime) ? exitTime : "13:00",
            reason: typeof reason === "string" && reason.trim() ? reason : "По заявлению родителей",
          },
        }),
      ),
    );

    broadcastKeys("update", { at: new Date().toISOString() });
    return NextResponse.json(
      created.map((pass, index) => ({ ...pass, students: [studentList[index]] })),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create pass" }, { status: 500 });
  }
}

// PUT: Обновить пропуск (альтернатива PATCH)
export async function PUT(req: NextRequest) {
    const accessGuard = await requireAnySection(["myClass", "dashboard"]);
    if (!accessGuard.ok) return accessGuard.response;


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

    broadcastKeys("update", { at: new Date().toISOString() });
    return NextResponse.json({ success: true, pass });
  } catch (error) {
    console.error("Error marking pass as used:", error);
    return NextResponse.json({ error: "Failed to mark pass as used" }, { status: 500 });
  }
}

// DELETE: Удалить пропуск
export async function DELETE(req: NextRequest) {
    const accessGuard = await requireAnySection(["myClass", "dashboard"]);
    if (!accessGuard.ok) return accessGuard.response;


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
    broadcastKeys("update", { at: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete pass" }, { status: 500 });
  }
}

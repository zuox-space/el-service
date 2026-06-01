export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET метод - получение отметки
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const date = searchParams.get("date");

  console.log("GET attendance - classId:", classId, "date:", date);

  if (!classId || !date) {
    return NextResponse.json(null);
  }

  try {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const attendance = await prisma.attendance.findFirst({
      where: {
        classId: classId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    console.log("Found attendance:", attendance ? "yes" : "no");

    if (attendance) {
      return NextResponse.json({
        ...attendance,
        presentStudents: JSON.parse(attendance.presentStudents),
        absentStudents: JSON.parse(attendance.absentStudents),
        absentReasons: JSON.parse(attendance.absentReasons)
      });
    }
    
    return NextResponse.json(null);
  } catch (error) {
    console.error("GET attendance error:", error);
    return NextResponse.json(null);
  }
}

// POST метод - сохранение отметки
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { date, classId, presentStudents, absentStudents, absentReasons } = body;

    console.log("Saving attendance:", { date, classId, presentStudents, absentStudents });

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Проверяем, существует ли уже запись
    const existing = await prisma.attendance.findFirst({
      where: {
        classId: classId,
        date: attendanceDate
      }
    });

    let attendance;
    if (existing) {
      // Обновляем существующую
      attendance = await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          presentStudents: JSON.stringify(presentStudents || []),
          absentStudents: JSON.stringify(absentStudents || []),
          absentReasons: JSON.stringify(absentReasons || {}),
          teacherId: session.user.id,
        }
      });
      console.log("Attendance updated:", attendance.id);
    } else {
      // Создаем новую
      attendance = await prisma.attendance.create({
        data: {
          date: attendanceDate,
          classId: classId,
          teacherId: session.user.id,
          presentStudents: JSON.stringify(presentStudents || []),
          absentStudents: JSON.stringify(absentStudents || []),
          absentReasons: JSON.stringify(absentReasons || {}),
        }
      });
      console.log("Attendance created:", attendance.id);
    }

    return NextResponse.json({
      ...attendance,
      presentStudents,
      absentStudents,
      absentReasons
    });

  } catch (error) {
    console.error("Error saving attendance:", error);
    return NextResponse.json({ 
      error: "Failed to save attendance", 
      details: String(error) 
    }, { status: 500 });
  }
}

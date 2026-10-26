export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { canAccessClass } from "@/lib/access/classes";
import { getDayRange } from "@/lib/date";


// GET метод - получение отметки
export async function GET(req: NextRequest) {
    const accessGuard = await requireSection("myClass");
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const date = searchParams.get("date");


  if (!classId || !date) {
    return NextResponse.json(null);
  }

  if (!(await canAccessClass(accessGuard.access, classId))) {
    return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
  }

  try {
    const { start: startDate, end: endDate } = getDayRange(date);

    const attendance = await prisma.attendance.findFirst({
      where: {
        classId: classId,
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    });


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
    const accessGuard = await requireSection("myClass");
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { date, classId, presentStudents, absentStudents, absentReasons } = body;

    if (!(await canAccessClass(accessGuard.access, classId))) {
      return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
    }


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

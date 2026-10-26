// app/api/admin/classes/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";
import { normalizeClassName } from "@/lib/class-name";
import { withDbMetrics, startDbMetrics } from "@/lib/dev-metrics";

import { requireSection } from "@/lib/access/server";
import { countSchoolDays, getAcademicYearStart, toLocalISODate } from "@/lib/date";


// GET: Получить все классы со студентами из MySQL
export async function GET() {
    const accessGuard = await requireSection("classes");
    if (!accessGuard.ok) return accessGuard.response;


  startDbMetrics();
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json([]);
    }

    const classes = await prisma.class.findMany({
      include: {
        building: { select: { id: true, name: true } },
      },
      orderBy: [
        { grade: "asc" },
        { letter: "asc" }
      ]
    });

    // Владельцы классов — одним запросом вместо запроса на каждый класс (был N+1)
    const ownerIds = [...new Set(classes.map(cls => cls.ownerId).filter((id): id is string => Boolean(id)))];
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, name: true, email: true },
    });
    const ownerById = new Map(owners.map(user => [user.id, user]));

    // Ученики — одним запросом ко всей школе вместо запроса на каждый класс
    const studentsByClass = await getStudentsGroupedByClass();

    // Частота отметок посещаемости: сколько учебных дней с 1 сентября класс был
    // отмечен, от общего числа учебных дней. Один запрос на всю школу.
    const academicYearStart = getAcademicYearStart();
    const attendanceRows = await prisma.attendance.findMany({
      where: { date: { gte: academicYearStart } },
      select: { classId: true, date: true },
    });

    const markedDaysByClass = new Map<string, Set<string>>();
    for (const row of attendanceRows) {
      const dates = markedDaysByClass.get(row.classId) ?? new Set<string>();
      dates.add(toLocalISODate(row.date));
      markedDaysByClass.set(row.classId, dates);
    }

    const schoolDays = countSchoolDays(academicYearStart, new Date());

    const parsedClasses = classes.map((cls) => {
      const owner = cls.ownerId ? ownerById.get(cls.ownerId) ?? null : null;
      const students = (studentsByClass.get(normalizeClassName(cls.name)) || []).map((student) => ({
        id: student.aisId,
        name: student.name
      }));

      const markedDays = markedDaysByClass.get(cls.id)?.size ?? 0;
      const percent = schoolDays > 0 ? Math.min(100, Math.round((markedDays / schoolDays) * 100)) : 0;

      // Пороги: ≥90 — отлично, ≥80 — хорошо, ≥50 — плохо, ниже — очень плохо
      const level = percent >= 90 ? "excellent" : percent >= 80 ? "good" : percent >= 50 ? "bad" : "veryBad";

      return {
        ...cls,
        buildingName: cls.building?.name ?? null,
        students: students,
        owner: owner,
        teacher: owner,
        attendance: {
          markedDays,
          schoolDays,
          percent,
          level,
          since: toLocalISODate(academicYearStart),
        },
      };
    });

    return withDbMetrics(NextResponse.json(parsedClasses));
  } catch (error) {
    console.error("Error fetching classes:", error);
    return NextResponse.json([]);
  }
}

// POST: Создать новый класс
export async function POST(req: NextRequest) {
    const accessGuard = await requireSection("classes");
    if (!accessGuard.ok) return accessGuard.response;


  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, grade, letter, ownerId } = body;

    if (!name || !grade || !letter || !ownerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Создаем класс с пустым массивом students
    const newClass = await prisma.class.create({
      data: {
        name,
        grade: parseInt(grade),
        letter: letter.toUpperCase(),
        ownerId: ownerId,
      }
    });

    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    // Ученики берутся из уже загруженного (и кэшированного) справочника
    const studentsByClass = await getStudentsGroupedByClass();
    const students = (studentsByClass.get(newClass.name) || []).map((student) => ({
      id: student.aisId,
      name: student.name
    }));

    return NextResponse.json({
      ...newClass,
      students: students,
      owner: owner,
      teacher: owner
    });
  } catch (error) {
    console.error("Error creating class:", error);
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}

// app/api/classes/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";
import { withDbMetrics, startDbMetrics } from "@/lib/dev-metrics";

export async function GET() {
  startDbMetrics();
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json([]);
    }

    // id пользователя уже есть в сессии — отдельный запрос к базе не нужен
    const userId = session.user.id;

    if (!userId) {
      return NextResponse.json([]);
    }

    // 1. Классы, где пользователь — владелец, и классы, которыми с ним поделились.
    //    Можно получить одним запросом вместо «найти шаринги → найти классы по id».
    const myClasses = await prisma.class.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { sharedWith: { some: { teacherId: userId } } },
        ],
      },
      include: {
        sharedWith: { select: { teacherId: true } },
      },
      orderBy: { name: 'asc' },
    });

    // 2. Ученики — одним запросом ко всей школе (был запрос на каждый класс)
    const studentsByClass = await getStudentsGroupedByClass();

    const parsedClasses = myClasses.map((cls) => {
      const isOwner = cls.ownerId === userId;
      const students = (studentsByClass.get(cls.name) || []).map((student) => ({
        id: student.aisId,
        name: student.name,
      }));

      const { sharedWith, ...rest } = cls;

      return {
        ...rest,
        isOwner,
        isShared: !isOwner,
        students,
        _meta: {
          source: 'mysql',
          count: students.length,
          className: cls.name,
        },
      };
    });

    return withDbMetrics(NextResponse.json(parsedClasses));

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json([]);
  }
}
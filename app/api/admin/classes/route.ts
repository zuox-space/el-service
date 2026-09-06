// app/api/admin/classes/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsByClass } from "@/lib/mysql_db";

// GET: Получить все классы со студентами из MySQL
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json([]);
    }

    const classes = await prisma.class.findMany({
      orderBy: [
        { grade: "asc" },
        { letter: "asc" }
      ]
    });

    const parsedClasses = await Promise.all(classes.map(async (cls) => {
      const owner = await prisma.user.findUnique({
        where: { id: cls.ownerId },
        select: {
          id: true,
          name: true,
          email: true,
        }
      });

      let students: any[] = [];
      try {
        const studentsFromMySQL = await getStudentsByClass(cls.name);
        students = studentsFromMySQL.map((student) => ({
          id: student.aisId,
          name: student.name
        }));
      } catch (error) {
        console.error(`❌ Error fetching students for class ${cls.name}:`, error);
        students = [];
      }

      return {
        ...cls,
        students: students,
        owner: owner,
        teacher: owner
      };
    }));

    return NextResponse.json(parsedClasses);
  } catch (error) {
    console.error("Error fetching classes:", error);
    return NextResponse.json([]);
  }
}

// POST: Создать новый класс
export async function POST(req: NextRequest) {
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

    // Получаем студентов из MySQL
    let students: any[] = [];
    try {
      const studentsFromMySQL = await getStudentsByClass(newClass.name);
      students = studentsFromMySQL.map((student) => ({
        id: student.aisId,
        name: student.name
      }));
    } catch (error) {
      console.error(`❌ Error fetching students for class ${newClass.name}:`, error);
      students = [];
    }

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
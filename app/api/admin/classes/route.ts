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

    // 🔥 ПОЛУЧАЕМ СТУДЕНТОВ ИЗ MYSQL ДЛЯ КАЖДОГО КЛАССА
    const parsedClasses = await Promise.all(classes.map(async (cls) => {
      // Получаем владельца
      const owner = await prisma.user.findUnique({
        where: { id: cls.ownerId },
        select: {
          id: true,
          name: true,
          email: true,
        }
      });

      // 🔥 ПОЛУЧАЕМ СТУДЕНТОВ ТОЛЬКО ИЗ MYSQL
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

    const newClass = await prisma.class.create({
      data: {
        name,
        grade: parseInt(grade),
        letter: letter.toUpperCase(),
        ownerId: ownerId,
        students: JSON.stringify([]), // Поле остается, но не используется
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

    return NextResponse.json({
      ...newClass,
      students: [], // Всегда пустой массив, данные берутся из MySQL
      owner: owner,
      teacher: owner
    });
  } catch (error) {
    console.error("Error creating class:", error);
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}

// PUT: Обновить класс
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, grade, letter, ownerId } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing class id" }, { status: 400 });
    }

    if (!ownerId) {
      return NextResponse.json({ error: "Missing ownerId" }, { status: 400 });
    }

    await prisma.class.update({
      where: { id },
      data: {
        name,
        grade: parseInt(grade),
        letter: letter.toUpperCase(),
        ownerId: ownerId,
        // Не трогаем поле students, оно не используется
      }
    });

    const updatedClass = await prisma.class.findUnique({
      where: { id }
    });

    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        id: true,
        name: true,
        email: true,
      }
    });

    // 🔥 ПОЛУЧАЕМ СТУДЕНТОВ ИЗ MYSQL ДЛЯ ОБНОВЛЕННОГО КЛАССА
    let students: any[] = [];
    if (updatedClass) {
      try {
        const studentsFromMySQL = await getStudentsByClass(updatedClass.name);
        students = studentsFromMySQL.map((student) => ({
          id: student.aisId,
          name: student.name
        }));
      } catch (error) {
        console.error(`❌ Error fetching students for class ${updatedClass.name}:`, error);
        students = [];
      }
    }

    return NextResponse.json({
      ...updatedClass,
      students: students,
      owner: owner,
      teacher: owner
    });
  } catch (error) {
    console.error("Error updating class:", error);
    return NextResponse.json({ error: "Failed to update class" }, { status: 500 });
  }
}

// DELETE: Удалить класс
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing class id" }, { status: 400 });
    }

    // Сначала удаляем связанные записи
    await prisma.classShare.deleteMany({ where: { classId: id } });
    await prisma.pass.deleteMany({ where: { classId: id } });
    await prisma.attendance.deleteMany({ where: { classId: id } });
    await prisma.news.deleteMany({ where: { classId: id } });
    await prisma.note.deleteMany({ where: { classId: id } });
    await prisma.selfExit.deleteMany({ where: { classId: id } });

    // Затем удаляем класс
    await prisma.class.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting class:", error);
    return NextResponse.json({ error: "Failed to delete class" }, { status: 500 });
  }
}
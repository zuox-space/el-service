import { NextRequest, NextResponse } from "next/server";

import { requireSection } from "@/lib/access/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { prisma } from "@/lib/prisma";


export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

    const accessGuard = await requireSection("myClass");
    if (!accessGuard.ok) return accessGuard.response;

  
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  if (classId) {
    const shares = await prisma.classShare.findMany({
      where: { classId: classId },
    });
    
    const sharesWithTeachers = await Promise.all(shares.map(async (share) => {
      const teacher = await prisma.user.findUnique({
        where: { id: share.teacherId },
        select: { id: true, name: true, email: true }
      });
      return { ...share, teacher };
    }));
    
    return NextResponse.json(sharesWithTeachers);
  }

  const teachers = await prisma.user.findMany({
    where: { id: { not: session.user.id } },
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" }
  });

  return NextResponse.json(teachers);
}

export async function POST(req: NextRequest) {

    const accessGuard = await requireSection("myClass");
    if (!accessGuard.ok) return accessGuard.response;

  
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  try {
    const body = await req.json();
    
    const { classId, teacherEmail } = body;

    if (!classId) {
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }
    
    if (!teacherEmail) {
      return NextResponse.json({ error: "Missing teacherEmail" }, { status: 400 });
    }

    const teacher = await prisma.user.findUnique({
      where: { email: teacherEmail }
    });

    if (!teacher) {
      return NextResponse.json({ error: "Учитель не найден" }, { status: 404 });
    }


    if (teacher.id === session.user.id) {
      return NextResponse.json({ error: "Нельзя поделиться с самим собой" }, { status: 400 });
    }

    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
    }


    // Проверяем, что пользователь - владелец класса
    if (classData.ownerId !== session.user.id) {
      return NextResponse.json({ 
        error: "Только владелец может делиться классом",
        debug: { 
          classOwnerId: classData.ownerId, 
          yourId: session.user.id,
          match: classData.ownerId === session.user.id
        }
      }, { status: 403 });
    }

    const existingShare = await prisma.classShare.findFirst({
      where: {
        classId: classId,
        teacherId: teacher.id
      }
    });

    if (existingShare) {
      return NextResponse.json({ error: "Класс уже поделен с этим учителем" }, { status: 400 });
    }

    const share = await prisma.classShare.create({
      data: {
        classId: classId,
        teacherId: teacher.id
      }
    });

    return NextResponse.json({ success: true, share });
    
  } catch (error) {
    console.error("Error in POST /api/share:", error);
    return NextResponse.json({ 
      error: "Ошибка при передаче класса", 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {

    const accessGuard = await requireSection("myClass");
    if (!accessGuard.ok) return accessGuard.response;

  
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }


  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const teacherId = searchParams.get("teacherId");


  if (!classId || !teacherId) {
    return NextResponse.json({ error: "Missing classId or teacherId" }, { status: 400 });
  }

  try {
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
    }


    if (classData.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Только владелец может отменить шаринг" }, { status: 403 });
    }

    await prisma.classShare.delete({
      where: {
        classId_teacherId: {
          classId: classId,
          teacherId: teacherId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/share:", error);
    return NextResponse.json({ error: "Ошибка при отзыве доступа" }, { status: 500 });
  }
}

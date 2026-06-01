import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  console.log("=== GET /api/share ===");
  
  const session = await getServerSession(authOptions);
  if (!session) {
    console.log("No session, returning 401");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Session user id:", session.user.id);

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  console.log("classId param:", classId);

  if (classId) {
    console.log("Fetching shares for classId:", classId);
    const shares = await prisma.classShare.findMany({
      where: { classId: classId },
    });
    console.log("Found shares:", shares.length);
    
    const sharesWithTeachers = await Promise.all(shares.map(async (share) => {
      const teacher = await prisma.user.findUnique({
        where: { id: share.teacherId },
        select: { id: true, name: true, email: true }
      });
      return { ...share, teacher };
    }));
    
    console.log("Returning shares with teachers:", sharesWithTeachers.length);
    return NextResponse.json(sharesWithTeachers);
  }

  console.log("Fetching all teachers except current user");
  const teachers = await prisma.user.findMany({
    where: { id: { not: session.user.id } },
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" }
  });
  console.log("Found teachers:", teachers.length);

  return NextResponse.json(teachers);
}

export async function POST(req: NextRequest) {
  console.log("\n=== POST /api/share START ===");
  
  const session = await getServerSession(authOptions);
  console.log("Session exists:", !!session);
  
  if (!session) {
    console.log("No session, returning 401");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Session user id:", session.user.id);
  console.log("Session user email:", session.user.email);

  try {
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));
    
    const { classId, teacherEmail } = body;

    if (!classId) {
      console.log("Missing classId");
      return NextResponse.json({ error: "Missing classId" }, { status: 400 });
    }
    
    if (!teacherEmail) {
      console.log("Missing teacherEmail");
      return NextResponse.json({ error: "Missing teacherEmail" }, { status: 400 });
    }

    console.log(`Searching for teacher with email: ${teacherEmail}`);
    const teacher = await prisma.user.findUnique({
      where: { email: teacherEmail }
    });

    if (!teacher) {
      console.log(`Teacher not found with email: ${teacherEmail}`);
      return NextResponse.json({ error: "Учитель не найден" }, { status: 404 });
    }

    console.log(`Teacher found: id=${teacher.id}, name=${teacher.name}, email=${teacher.email}`);

    if (teacher.id === session.user.id) {
      console.log("Attempt to share with yourself");
      return NextResponse.json({ error: "Нельзя поделиться с самим собой" }, { status: 400 });
    }

    console.log(`Searching for class with id: ${classId}`);
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      console.log(`Class not found with id: ${classId}`);
      return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
    }

    console.log(`Class found: id=${classData.id}, name=${classData.name}, ownerId=${classData.ownerId}`);
    console.log(`Current user id: ${session.user.id}`);
    console.log(`Is owner? ${classData.ownerId === session.user.id}`);

    // Проверяем, что пользователь - владелец класса
    if (classData.ownerId !== session.user.id) {
      console.log(`Access denied: user ${session.user.id} is not the owner (owner is ${classData.ownerId})`);
      return NextResponse.json({ 
        error: "Только владелец может делиться классом",
        debug: { 
          classOwnerId: classData.ownerId, 
          yourId: session.user.id,
          match: classData.ownerId === session.user.id
        }
      }, { status: 403 });
    }

    console.log("Checking if share already exists");
    const existingShare = await prisma.classShare.findFirst({
      where: {
        classId: classId,
        teacherId: teacher.id
      }
    });

    if (existingShare) {
      console.log(`Share already exists: ${existingShare.id}`);
      return NextResponse.json({ error: "Класс уже поделен с этим учителем" }, { status: 400 });
    }

    console.log("Creating new share...");
    const share = await prisma.classShare.create({
      data: {
        classId: classId,
        teacherId: teacher.id
      }
    });

    console.log(`Share created successfully: ${share.id}`);
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
  console.log("\n=== DELETE /api/share ===");
  
  const session = await getServerSession(authOptions);
  if (!session) {
    console.log("No session, returning 401");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("Session user id:", session.user.id);

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const teacherId = searchParams.get("teacherId");

  console.log(`classId: ${classId}, teacherId: ${teacherId}`);

  if (!classId || !teacherId) {
    console.log("Missing classId or teacherId");
    return NextResponse.json({ error: "Missing classId or teacherId" }, { status: 400 });
  }

  try {
    console.log(`Finding class with id: ${classId}`);
    const classData = await prisma.class.findUnique({
      where: { id: classId }
    });

    if (!classData) {
      console.log(`Class not found: ${classId}`);
      return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
    }

    console.log(`Class ownerId: ${classData.ownerId}, Current user: ${session.user.id}`);
    console.log(`Is owner? ${classData.ownerId === session.user.id}`);

    if (classData.ownerId !== session.user.id) {
      console.log("Access denied: not the owner");
      return NextResponse.json({ error: "Только владелец может отменить шаринг" }, { status: 403 });
    }

    console.log(`Deleting share for class ${classId} and teacher ${teacherId}`);
    await prisma.classShare.delete({
      where: {
        classId_teacherId: {
          classId: classId,
          teacherId: teacherId
        }
      }
    });

    console.log("Share deleted successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/share:", error);
    return NextResponse.json({ error: "Ошибка при отзыве доступа" }, { status: 500 });
  }
}
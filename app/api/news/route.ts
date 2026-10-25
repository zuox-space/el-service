export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

import { requireSection } from "@/lib/access/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import { canAccessClass } from "@/lib/access/classes";
import { getDayRange } from "@/lib/date";


// GET: Получить новости для класса на дату
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
    return NextResponse.json([]);
  }

  if (!(await canAccessClass(accessGuard.access, classId))) {
    return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
  }

  try {
    const { start: startDate, end: endDate } = getDayRange(date);

    const news = await prisma.news.findMany({
      where: {
        classId: classId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(news);
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json([]);
  }
}

// POST: Создать новость
export async function POST(req: NextRequest) {

    const accessGuard = await requireSection("myClass");
    if (!accessGuard.ok) return accessGuard.response;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, content, classId, date } = body;

    if (!(await canAccessClass(accessGuard.access, classId))) {
      return NextResponse.json({ error: "Нет доступа к классу" }, { status: 403 });
    }

    if (!title || !content || !classId || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newsDate = new Date(date);
    newsDate.setHours(0, 0, 0, 0);

    const news = await prisma.news.create({
      data: {
        title,
        content,
        date: newsDate,
        classId,
        teacherId: session.user.id,
      }
    });

    return NextResponse.json(news);
  } catch (error) {
    console.error("Error creating news:", error);
    return NextResponse.json({ error: "Failed to create news" }, { status: 500 });
  }
}

// DELETE: Удалить новость
export async function DELETE(req: NextRequest) {

    const accessGuard = await requireSection("myClass");
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
    await prisma.news.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting news:", error);
    return NextResponse.json({ error: "Failed to delete news" }, { status: 500 });
  }
}

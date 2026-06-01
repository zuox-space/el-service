export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json([]);
    }

    // Получаем всех пользователей (без фильтрации по роли)
    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id }
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json([]);
  }
}
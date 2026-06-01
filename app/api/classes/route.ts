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

    // Получаем пользователя из БД по email
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    if (!dbUser) {
      return NextResponse.json([]);
    }

    // 1. Получаем классы, где пользователь - владелец
    const myClasses = await prisma.class.findMany({
      where: { ownerId: dbUser.id }
    });

    // 2. Получаем ID классов, которыми поделились с пользователем
    const shares = await prisma.classShare.findMany({
      where: { teacherId: dbUser.id }
    });
    
    const sharedClassIds = shares.map(s => s.classId);
    
    // 3. Получаем классы, которыми поделились (только их!)
    const sharedClasses = await prisma.class.findMany({
      where: { id: { in: sharedClassIds } }
    });

    // 4. Объединяем и помечаем
    const allUserClasses = [
      ...myClasses.map(cls => ({
        ...cls,
        isOwner: true,
        isShared: false
      })),
      ...sharedClasses.map(cls => ({
        ...cls,
        isOwner: false,
        isShared: true
      }))
    ];

    // Парсим students из JSON строки
    const parsedClasses = allUserClasses.map(cls => ({
      ...cls,
      students: typeof cls.students === 'string' ? JSON.parse(cls.students) : cls.students
    }));
    
    console.log(`User ${dbUser.email} has ${myClasses.length} own classes and ${sharedClasses.length} shared classes`);
    
    return NextResponse.json(parsedClasses);
    
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json([]);
  }
}
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Init started for user:", session.user?.email);

    // Находим или создаем пользователя
    let user = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: session.user.email!,
          name: session.user.name!,
        }
      });
      console.log("User created:", user.id);
    } else {
      console.log("User already exists:", user.id);
    }

    // Проверяем, есть ли классы у пользователя
    const existingClasses = await prisma.class.findMany({
      where: { ownerId: user.id }
    });

    let createdClass = null;

    if (existingClasses.length === 0) {
      const students = [
        { id: 1, name: "Анна Иванова" },
        { id: 2, name: "Борис Петров" },
        { id: 3, name: "Виктор Сидоров" },
        { id: 4, name: "Галина Смирнова" },
        { id: 5, name: "Дмитрий Козлов" },
      ];

      createdClass = await prisma.class.create({
        data: {
          name: "7А",
          grade: 7,
          letter: "А",
          ownerId: user.id,
          students: JSON.stringify(students),
        }
      });
      console.log("Demo class created:", createdClass.id);
    } else {
      console.log("Classes already exist:", existingClasses.length);
    }

    return NextResponse.json({ 
      success: true, 
      user: { id: user.id, email: user.email, name: user.name },
      class: createdClass,
      hasClasses: existingClasses.length > 0
    });
    
  } catch (error) {
    console.error("Init error:", error);
    return NextResponse.json({ 
      error: String(error),
      success: false 
    }, { status: 500 });
  }
}
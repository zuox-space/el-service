export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  // Демо-инициализация создаёт класс 7А и не используется интерфейсом.
  // В production оставлять её доступной любому сотруднику нельзя.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


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
    } else {
    }

    // Проверяем, есть ли классы у пользователя
    const existingClasses = await prisma.class.findMany({
      where: { ownerId: user.id }
    });

    let createdClass = null;

    if (existingClasses.length === 0) {


      createdClass = await prisma.class.create({
        data: {
          name: "7А",
          grade: 7,
          letter: "А",
          ownerId: user.id,
        }
      });
    } else {
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

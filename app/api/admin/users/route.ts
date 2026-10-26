import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";


export async function GET() {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { email, name, role, syncEnabled } = body;

    if (!email || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 400 });
    }

    // Роль по умолчанию — «Сотрудник»: вход и главная страница, без доступов
    // к разделам. Роль можно не передавать — сотрудник всё равно её получит.
    const roleName = typeof role === "string" && role.trim()
      ? role.trim().toUpperCase().replace(/\s+/g, "_")
      : "EMPLOYEE";

    // Пользователь и его роль создаются одной транзакцией: при сбое на
    // втором шаге не останется сотрудник без роли.
    const userWithRoles = await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: String(name).trim(),
          // Создан вручную: по умолчанию синхронизацией не управляется
          syncEnabled: syncEnabled === true,
        }
      });

      const roleRecord = await tx.role.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          description: roleName === "EMPLOYEE" ? "Сотрудник: вход и главная страница" : null,
          defaultSections: [],
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: roleRecord.id,
          assignedBy: session.user.id
        }
      });

      return tx.user.findUnique({
        where: { id: newUser.id },
        include: {
          userRoles: {
            include: {
              role: true
            }
          }
        }
      });
    });

    return NextResponse.json(userWithRoles);
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 400 });
    }
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

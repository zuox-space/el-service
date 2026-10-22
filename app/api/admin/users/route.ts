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

    // Проверяем, существует ли пользователь
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 400 });
    }

    // Создаём пользователя
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        // Создан вручную: по умолчанию синхронизацией не управляется
        syncEnabled: syncEnabled === true,
      }
    });

    // Роль по умолчанию — «Сотрудник»: вход и главная страница, без доступов
    // к разделам. Роль можно не передавать — сотрудник всё равно её получит.
    const roleName = role || "EMPLOYEE";
    const roleRecord = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: roleName === "EMPLOYEE" ? "Сотрудник: вход и главная страница" : null,
        defaultSections: [],
      },
    });

    await prisma.userRole.create({
      data: {
        userId: newUser.id,
        roleId: roleRecord.id,
        assignedBy: session.user.id
      }
    });
    // Возвращаем пользователя с ролями
    const userWithRoles = await prisma.user.findUnique({
      where: { id: newUser.id },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    return NextResponse.json(userWithRoles);
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { ACCESS_SECTIONS, isSectionId, sectionsForRole } from "@/lib/access/registry";


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    include: { userRoles: { include: { role: true } } }
  });

  const isAdmin = currentUser?.userRoles.some(ur => ur.role.name === "ADMIN");

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { roleId } = body;

    if (!roleId) {
      return NextResponse.json({ error: "Missing roleId" }, { status: 400 });
    }

    const existing = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: params.id,
          roleId
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Role already assigned" }, { status: 400 });
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ error: "Роль не найдена" }, { status: 404 });
    }

    const userRole = await prisma.$transaction(async tx => {
      const created = await tx.userRole.create({
        data: {
          userId: params.id,
          roleId,
          assignedBy: session.user.id
        }
      });

      // Если у сотрудника включены индивидуальные доступы, роль раньше
      // игнорировалась. Добавляем стандартные разделы роли к его набору,
      // чтобы выдача роли сразу давала ожидаемые доступы.
      const target = await tx.user.findUnique({
        where: { id: params.id },
        select: { accessOverride: true },
      });
      if (target?.accessOverride) {
        const adminOnly = new Set(
          ACCESS_SECTIONS.filter(section => section.adminOnly).map(section => section.id),
        );
        const defaults = role.defaultSections.length > 0
          ? role.defaultSections.filter(isSectionId)
          : sectionsForRole(role.name);
        const sections = defaults.filter(section => !adminOnly.has(section));

        if (sections.length > 0) {
          await tx.sectionAccess.createMany({
            data: sections.map(section => ({
              userId: params.id,
              section,
              allowed: true,
              assignedBy: session.user.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return created;
    });

    return NextResponse.json(userRole);
  } catch (error) {
    console.error("Error assigning role:", error);
    return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
    const accessGuard = await requireSection("users");
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    include: { userRoles: { include: { role: true } } }
  });

  const isAdmin = currentUser?.userRoles.some(ur => ur.role.name === "ADMIN");

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const roleId = searchParams.get("roleId");

  if (!roleId) {
    return NextResponse.json({ error: "Missing roleId" }, { status: 400 });
  }

  try {
    // deleteMany вместо delete: повторное снятие уже снятой роли не должно
    // падать с 500 — интерфейс переключает чекбоксы и может отправить запрос дважды
    await prisma.userRole.deleteMany({
      where: {
        userId: params.id,
        roleId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing role:", error);
    return NextResponse.json({ error: "Failed to remove role" }, { status: 500 });
  }
}

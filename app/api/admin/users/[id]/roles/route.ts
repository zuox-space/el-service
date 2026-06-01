import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const userRole = await prisma.userRole.create({
      data: {
        userId: params.id,
        roleId,
        assignedBy: session.user.id
      }
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
    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: params.id,
          roleId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing role:", error);
    return NextResponse.json({ error: "Failed to remove role" }, { status: 500 });
  }
}
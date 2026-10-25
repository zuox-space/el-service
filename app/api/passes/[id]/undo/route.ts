import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { requireAnySection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { broadcastKeys } from "@/lib/keys/bus";


export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
    const accessGuard = await requireAnySection(["myClass", "dashboard"]);
    if (!accessGuard.ok) return accessGuard.response;


  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Вариант 1: Использовать Prisma (рекомендуется)
    await prisma.pass.update({
      where: { id: params.id },
      data: {
        used: false,  // ✅ Исправлено: false вместо 0
        usedAt: null
      }
    });

    broadcastKeys("update", { at: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error undoing mark:", error);
    return NextResponse.json({ error: "Failed to undo mark" }, { status: 500 });
  }
}

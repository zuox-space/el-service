// app/api/guard/passes/[id]/undo/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuardAccess } from "@/lib/guard/auth";

/** Охрана отменяет ошибочно отмеченный выход по пропуску. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
    const access = await getGuardAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pass = await prisma.pass.findUnique({ where: { id: params.id } });
    if (!pass) return NextResponse.json({ error: "Пропуск не найден" }, { status: 404 });

    await prisma.pass.update({
        where: { id: params.id },
        data: { used: false, usedAt: null },
    });

    return NextResponse.json({ success: true });
}

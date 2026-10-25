// app/api/guard/passes/[id]/use/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuardAccess } from "@/lib/guard/auth";

/** Охрана отмечает фактический выход по пропуску. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
    const access = await getGuardAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pass = await prisma.pass.findUnique({ where: { id: params.id } });
    if (!pass) return NextResponse.json({ error: "Пропуск не найден" }, { status: 404 });
    if (pass.used) return NextResponse.json({ success: true, already: true });

    await prisma.pass.update({
        where: { id: params.id },
        data: { used: true, usedAt: new Date() },
    });

    return NextResponse.json({ success: true });
}

// app/api/admin/users/[id]/sync/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";

/**
 * Флаг «подлежит синхронизации с АИС».
 *
 * true  — ФИО, почта, классы и роль классного руководителя управляются
 *         скриптом синхронизации; вручную такие данные лучше не править.
 * false — сотрудник ведётся вручную (например, охрана), синхронизация его не трогает.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const guard = await requireSection("users");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.syncEnabled !== "boolean") {
        return NextResponse.json({ error: "Нужен булев syncEnabled" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!target) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

    const updated = await prisma.user.update({
        where: { id: params.id },
        data: { syncEnabled: body.syncEnabled },
        select: { id: true, syncEnabled: true },
    });

    return NextResponse.json({ success: true, ...updated });
}

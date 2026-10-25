// app/api/buildings/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Справочник зданий с классами — для фильтров админских дашбордов.
 * Доступен любому авторизованному сотруднику: данные не персональные.
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const buildings = await prisma.keyBuilding.findMany({
        orderBy: { name: "asc" },
        include: {
            classes: {
                orderBy: { name: "asc" },
                select: { id: true, name: true, grade: true },
            },
        },
    });

    return NextResponse.json({ success: true, buildings });
}

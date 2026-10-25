// app/api/keys/classes/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";

/** Список классов для привязки к зданию. */
export async function GET() {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    const classes = await prisma.class.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, grade: true, buildingId: true },
    });

    return NextResponse.json({ success: true, classes });
}

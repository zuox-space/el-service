// app/api/keys/buildings/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { createBuilding, KeysConflictError } from "@/lib/keys/queries";

export async function GET() {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    const buildings = await prisma.keyBuilding.findMany({
        orderBy: { name: "asc" },
        include: { classes: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    });
    return NextResponse.json({ success: true, buildings });
}

export async function POST(request: NextRequest) {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    try {
        const result = await createBuilding({
            name: String(body?.name ?? ""),
            address: body?.address ? String(body.address) : "",
            classIds: body?.classIds,
        });
        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

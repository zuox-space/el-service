// app/api/keys/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { createKey, KeysConflictError, listAdminKeys } from "@/lib/keys/queries";
import type { KeyAccessScope } from "@prisma/client";

export async function GET() {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    const keys = await listAdminKeys();
    return NextResponse.json({ success: true, keys });
}

export async function POST(request: NextRequest) {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    try {
        const result = await createKey({
            buildingId: String(body?.buildingId ?? ""),
            roomNumber: String(body?.roomNumber ?? ""),
            roomName: body?.roomName ? String(body.roomName) : "",
            floor: body?.floor ? Number(body.floor) : 1,
            accessScope: (body?.accessScope as KeyAccessScope) ?? "ALL",
        });
        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

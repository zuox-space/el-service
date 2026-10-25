// app/api/keys/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { deleteKey, KeysConflictError, updateKey } from "@/lib/keys/queries";
import type { KeyAccessScope } from "@prisma/client";

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    try {
        await updateKey(params.id, {
            roomNumber: body?.roomNumber ? String(body.roomNumber) : undefined,
            roomName: body?.roomName !== undefined ? String(body.roomName) : undefined,
            floor: body?.floor !== undefined ? Number(body.floor) : undefined,
            accessScope: body?.accessScope as KeyAccessScope | undefined,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } },
) {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    try {
        await deleteKey(params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

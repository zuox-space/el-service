// app/api/keys/buildings/[id]/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { deleteBuilding, KeysConflictError, updateBuilding } from "@/lib/keys/queries";

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    const guard = await requireSection("buildingsAdmin");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    try {
        await updateBuilding(params.id, {
            name: body?.name !== undefined ? String(body.name) : undefined,
            address: body?.address !== undefined ? String(body.address) : undefined,
            classIds: body?.classIds,
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
    const guard = await requireSection("buildingsAdmin");
    if (!guard.ok) return guard.response;

    try {
        await deleteBuilding(params.id);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

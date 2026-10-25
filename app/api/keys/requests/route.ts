// app/api/keys/requests/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { createKeyRequest, KeysConflictError } from "@/lib/keys/queries";

export async function POST(request: NextRequest) {
    const guard = await requireSection("keys");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const type = body?.type;
    const keyIds = Array.isArray(body?.keyIds) ? body.keyIds.map(String) : [];

    try {
        const result = await createKeyRequest(guard.access, {
            type,
            keyIds,
            targetUserId: body?.targetUserId ? String(body.targetUserId) : null,
        });
        return NextResponse.json({ success: true, ...result }, { status: 201 });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

// app/api/keys/[id]/permissions/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import {
    getKeyPermissions,
    KeysConflictError,
    setKeyPermissions,
} from "@/lib/keys/queries";
import type { KeyAccessScope } from "@prisma/client";

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } },
) {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    try {
        const data = await getKeyPermissions(params.id);
        return NextResponse.json({ success: true, ...data });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        throw error;
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } },
) {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const userIds = Array.isArray(body?.userIds) ? body.userIds.map(String) : [];

    try {
        await setKeyPermissions(params.id, {
            accessScope: (body?.accessScope as KeyAccessScope) ?? "ALL",
            userIds,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

// app/api/guard/requests/[id]/decision/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getGuardAccess } from "@/lib/guard/auth";
import { decideKeyRequest, KeysConflictError } from "@/lib/keys/queries";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const access = await getGuardAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action !== "confirm" && action !== "cancel") {
        return NextResponse.json({ error: "Некорректное действие" }, { status: 400 });
    }

    try {
        await decideKeyRequest(access, params.id, action);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

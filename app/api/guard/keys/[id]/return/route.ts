// app/api/guard/keys/[id]/return/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getGuardAccess } from "@/lib/guard/auth";
import { confirmKeyReturnedByGuard, KeysConflictError } from "@/lib/keys/queries";

/** Охрана подтверждает сдачу ключа последним сотрудником. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
    const access = await getGuardAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const result = await confirmKeyReturnedByGuard(access, params.id);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

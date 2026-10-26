// app/api/keys/import/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { importKeysCsv, KeysConflictError } from "@/lib/keys/queries";

export async function POST(request: NextRequest) {
    // Импорт CSV создаёт и здания, и ключи — нужны оба админских раздела.
    const keysGuard = await requireSection("keysAdmin");
    if (!keysGuard.ok) return keysGuard.response;
    const buildingsGuard = await requireSection("buildingsAdmin");
    if (!buildingsGuard.ok) return buildingsGuard.response;

    const body = await request.json().catch(() => null);
    const text = typeof body?.csv === "string" ? body.csv : "";

    try {
        const result = await importKeysCsv(text);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        if (error instanceof KeysConflictError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        throw error;
    }
}

// app/api/keys/import/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { importKeysCsv, KeysConflictError } from "@/lib/keys/queries";

export async function POST(request: NextRequest) {
    const guard = await requireSection("keysAdmin");
    if (!guard.ok) return guard.response;

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

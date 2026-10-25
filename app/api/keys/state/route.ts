// app/api/keys/state/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAnySection } from "@/lib/access/server";
import { buildKeysState } from "@/lib/keys/queries";

export async function GET() {
    const guard = await requireAnySection(["keys", "keysAdmin"]);
    if (!guard.ok) return guard.response;

    const state = await buildKeysState(guard.access);
    return NextResponse.json({ success: true, state });
}

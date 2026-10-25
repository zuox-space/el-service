// app/api/keys/favorites/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";
import { toggleFavorite } from "@/lib/keys/queries";

export async function POST(request: NextRequest) {
    const guard = await requireSection("keys");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const keyId = body?.keyId ? String(body.keyId) : "";
    if (!keyId) return NextResponse.json({ error: "Не указан ключ" }, { status: 400 });

    const result = await toggleFavorite(guard.access.userId, keyId);
    return NextResponse.json({ success: true, ...result });
}

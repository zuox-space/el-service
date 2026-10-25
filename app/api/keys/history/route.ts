// app/api/keys/history/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAnySection } from "@/lib/access/server";
import { queryKeyHistory } from "@/lib/keys/queries";

export async function GET(request: NextRequest) {
    const guard = await requireAnySection(["keys", "keysAdmin"]);
    if (!guard.ok) return guard.response;

    const params = request.nextUrl.searchParams;
    const result = await queryKeyHistory(guard.access, {
        buildingId: params.get("buildingId"),
        floor: params.get("floor") ? Number(params.get("floor")) : null,
        keyId: params.get("keyId"),
        type: params.get("type"),
        status: params.get("status"),
        q: params.get("q"),
        participantId: params.get("participantId"),
        participantName: params.get("participantName"),
        dateFrom: params.get("dateFrom"),
        dateTo: params.get("dateTo"),
        limit: params.get("limit") ? Number(params.get("limit")) : 30,
        offset: params.get("offset") ? Number(params.get("offset")) : 0,
    });

    return NextResponse.json({ success: true, ...result });
}

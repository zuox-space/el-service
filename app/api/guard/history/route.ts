// app/api/guard/history/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getGuardAccess } from "@/lib/guard/auth";
import { queryKeyHistory } from "@/lib/keys/queries";

export async function GET(request: NextRequest) {
    const access = await getGuardAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const result = await queryKeyHistory(access, {
        buildingId: params.get("buildingId"),
        floor: params.get("floor") ? Number(params.get("floor")) : null,
        keyId: params.get("keyId"),
        type: params.get("type"),
        status: params.get("status"),
        q: params.get("q"),
        participantId: params.get("participantId"),
        dateFrom: params.get("dateFrom"),
        dateTo: params.get("dateTo"),
        limit: params.get("limit") ? Number(params.get("limit")) : 30,
        offset: params.get("offset") ? Number(params.get("offset")) : 0,
    });

    return NextResponse.json({ success: true, ...result });
}

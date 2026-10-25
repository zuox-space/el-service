// app/api/keys/users/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAnySection } from "@/lib/access/server";
import { listKeyUsers } from "@/lib/keys/queries";

/** Коллеги для передачи ключа и выдачи прав: только с доступом к ключам. */
export async function GET() {
    const guard = await requireAnySection(["keys", "keysAdmin"]);
    if (!guard.ok) return guard.response;

    const users = await listKeyUsers();
    return NextResponse.json({ success: true, users });
}

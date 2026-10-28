import { NextResponse } from "next/server";
import { requireAnySection } from "@/lib/access/server";
import { listSeatingClasses } from "@/lib/seating";

export const dynamic = "force-dynamic";

export async function GET() {
    const guard = await requireAnySection(["seating", "myClass"]);
    if (!guard.ok) return guard.response;

    try {
        return NextResponse.json({ classes: await listSeatingClasses(guard.access) });
    } catch (error) {
        console.error("Error loading seating classes:", error);
        return NextResponse.json({ error: "Не удалось загрузить классы" }, { status: 500 });
    }
}

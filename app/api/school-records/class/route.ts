// app/api/school-records/class/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { normalizeClassName } from "@/lib/class-name";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import { requireAnySection } from "@/lib/access/server";
import { prisma } from "@/lib/prisma";
import { canAccessClass } from "@/lib/access/classes";


export async function GET(req: NextRequest) {
    const accessGuard = await requireAnySection(["myClass", "schoolRecords"]);
    if (!accessGuard.ok) return accessGuard.response;


    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const className = normalizeClassName(searchParams.get("className"));

        if (!className) {
            return NextResponse.json([]);
        }

        console.log(`🔍 Loading school records for class: ${className}`);

        const records = await prisma.schoolRecord.findMany({
            where: {
                className: className,
                isActive: true,
            },
            orderBy: { registeredAt: 'desc' },
        });

        console.log(`📋 Found ${records.length} active school records`);

        return NextResponse.json(records);
    } catch (error) {
        console.error("❌ Error fetching class school records:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}

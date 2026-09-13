// app/api/students/search/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/mysql_db";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("q") || "";
        const limit = parseInt(searchParams.get("limit") || "20");

        if (search.length < 2) {
            return NextResponse.json([]);
        }

        const pattern = `%${search}%`;

        const students = await query<{
            aisId: string;
            name: string;
            className: string;
        }>(`
      SELECT 
        aisId,
        CONCAT(lastName, ' ', firstName) AS name,
        className 
      FROM students 
      WHERE archive = 0 
      AND (firstName LIKE ? OR lastName LIKE ?)
      ORDER BY lastName, firstName
      LIMIT ?
    `, [pattern, pattern, limit]);

        return NextResponse.json(students);
    } catch (error) {
        console.error("Error searching students:", error);
        return NextResponse.json([]);
    }
}
// app/api/guard/state/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuardAccess } from "@/lib/guard/auth";
import { buildKeysState } from "@/lib/keys/queries";

function dayRange(): { start: Date; end: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}

function parseStudents(raw: string): Array<{ id?: string | number; name?: string }> {
    try {
        const value = JSON.parse(raw);
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

export async function GET() {
    const access = await getGuardAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { start, end } = dayRange();

    const [keys, passes, selfExits] = await Promise.all([
        buildKeysState(access),
        prisma.pass.findMany({
            where: { date: { gte: start, lt: end } },
            orderBy: [{ exitTime: "asc" }, { createdAt: "desc" }],
        }),
        prisma.selfExit.findMany({
            where: { startDate: { lt: end }, endDate: { gte: start } },
            orderBy: { studentName: "asc" },
        }),
    ]);

    const classIds = [...new Set([...passes.map(item => item.classId), ...selfExits.map(item => item.classId)])];
    const classes = classIds.length
        ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true, grade: true } })
        : [];
    const className = new Map(classes.map(item => [item.id, item.name]));
    const classGrade = new Map(classes.map(item => [item.id, item.grade]));
    // Самовыходы бывают только у младших классов: 7–11 не показываем.
    const visibleSelfExits = selfExits.filter(item => (classGrade.get(item.classId) ?? 99) < 7);

    return NextResponse.json({
        success: true,
        serverTime: new Date().toISOString(),
        keys,
        passes: passes.map(item => ({
            id: item.id,
            classId: item.classId,
            className: className.get(item.classId) ?? "",
            exitTime: item.exitTime,
            reason: item.reason,
            used: item.used,
            usedAt: item.usedAt ? item.usedAt.toISOString() : null,
            students: parseStudents(item.students),
        })),
        selfExits: visibleSelfExits.map(item => ({
            id: item.id,
            studentName: item.studentName,
            classId: item.classId,
            className: className.get(item.classId) ?? "",
            reason: item.reason,
            startDate: item.startDate.toISOString(),
            endDate: item.endDate.toISOString(),
        })),
    });
}

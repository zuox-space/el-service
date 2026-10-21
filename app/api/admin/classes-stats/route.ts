// app/api/admin/classes-stats/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";

import { requireSection } from "@/lib/access/server";
import { withDbMetrics, startDbMetrics } from "@/lib/dev-metrics";


interface StudentInfo {
    aisId: string;
    name: string;
    className: string;
}

export async function GET() {
    const accessGuard = await requireSection("classesOverview");
    if (!accessGuard.ok) return accessGuard.response;


    startDbMetrics();
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    try {
        // 🔥 1. Только классы 1-4 параллелей
        const classes = await prisma.class.findMany({
            where: {
                grade: {
                    gte: 1,
                    lte: 4,
                },
            },
            orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
        });

        console.log(`📚 Найдено классов 1-4: ${classes.length}`);

        // 2. Все ученики: берём из общего (кэшированного) справочника, а не своим SQL
        const studentsByClass = await getStudentsGroupedByClass();

        // 3. Все активные самовыходы
        const today = new Date();
        const allSelfExits = await prisma.selfExit.findMany({
            where: {
                endDate: { gte: today },
            },
        });

        // 4. Все активные доверенности
        const allAuthorizations = await prisma.authorization.findMany({
            where: { isActive: true },
        });

        // 5. Формируем статистику по каждому классу
        const stats = classes.map(cls => {
            const students = studentsByClass.get(cls.name) || [];

            const activeSelfExits = allSelfExits.filter(s =>
                students.some(st => String(st.aisId) === String(s.studentId))
            );

            const activeAuths = allAuthorizations.filter(a => a.className === cls.name);

            const studentsWithSelfExit = new Set(
                activeSelfExits.map(s => String(s.studentId))
            );

            const studentsWithAuth = new Set(
                activeAuths.map(a => String(a.studentId))
            );

            return {
                classId: cls.id,
                className: cls.name,
                grade: cls.grade,
                letter: cls.letter,
                ownerId: cls.ownerId,
                totalStudents: students.length,
                activeSelfExits: activeSelfExits.length,
                studentsWithSelfExit: studentsWithSelfExit.size,
                activeAuthorizations: activeAuths.length,
                studentsWithAuth: studentsWithAuth.size,
            };
        });

        // 6. Общая статистика
        const totals = {
            totalClasses: classes.length,
            totalStudents: stats.reduce((sum, c) => sum + c.totalStudents, 0),
            totalActiveSelfExits: stats.reduce((sum, c) => sum + c.activeSelfExits, 0),
            totalStudentsWithSelfExit: stats.reduce((sum, c) => sum + c.studentsWithSelfExit, 0),
            totalActiveAuthorizations: stats.reduce((sum, c) => sum + c.activeAuthorizations, 0),
            totalStudentsWithAuth: stats.reduce((sum, c) => sum + c.studentsWithAuth, 0),
        };

        return withDbMetrics(NextResponse.json({ classes: stats, totals }));
    } catch (error) {
        console.error("❌ Error fetching classes stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch", details: String(error) },
            { status: 500 }
        );
    }
}

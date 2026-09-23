// app/api/admin/classes-stats/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/mysql_db";

interface StudentInfo {
    aisId: string;
    name: string;
    className: string;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        // 1. Все классы из PostgreSQL
        const classes = await prisma.class.findMany({
            where: {
                grade: {
                    gte: 1,
                    lte: 4,
                },
            },
            orderBy: [{ grade: 'asc' }, { letter: 'asc' }],
        });

        // 2. Все студенты из MySQL
        const allStudents = await query<StudentInfo>(`
      SELECT 
        aisId,
        CONCAT(lastName, ' ', firstName) AS name,
        className 
      FROM students 
      WHERE archive = 0
    `);

        // Группируем студентов по классам
        const studentsByClass = new Map<string, StudentInfo[]>();
        allStudents.forEach(s => {
            if (!studentsByClass.has(s.className)) {
                studentsByClass.set(s.className, []);
            }
            studentsByClass.get(s.className)!.push(s);
        });

        // 3. Все активные самовыводы
        const today = new Date();
        const allSelfExits = await prisma.selfExit.findMany({
            where: {
                endDate: { gte: today }, // активные
            },
        });

        // 4. Все активные доверенности
        const allAuthorizations = await prisma.authorization.findMany({
            where: { isActive: true },
        });

        // 5. Формируем статистику по каждому классу
        const stats = classes.map(cls => {
            const students = studentsByClass.get(cls.name) || [];

            // Активные самовыводы в классе
            const activeSelfExits = allSelfExits.filter(s => {
                // проверяем, есть ли ученик из этого класса
                return students.some(st => String(st.aisId) === String(s.studentId));
            });

            // Активные доверенности в классе
            const activeAuths = allAuthorizations.filter(a => a.className === cls.name);

            // Уникальные ученики с самовыводом
            const studentsWithSelfExit = new Set(
                activeSelfExits.map(s => String(s.studentId))
            );

            // Уникальные ученики с доверенностью
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
            totalStudents: allStudents.length,
            totalActiveSelfExits: allSelfExits.length,
            totalStudentsWithSelfExit: new Set(allSelfExits.map(s => String(s.studentId))).size,
            totalActiveAuthorizations: allAuthorizations.length,
            totalStudentsWithAuth: new Set(allAuthorizations.map(a => String(a.studentId))).size,
        };

        return NextResponse.json({ classes: stats, totals });
    } catch (error) {
        console.error("❌ Error fetching classes stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch", details: String(error) },
            { status: 500 }
        );
    }
}
// app/api/admin/classes-stats/[className]/route.ts
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

export async function GET(
    req: NextRequest,
    { params }: { params: { className: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const className = params.className;


        if (!className) {
            return NextResponse.json({ error: "Missing className" }, { status: 400 });
        }

        console.log(`🔍 Loading stats for class: ${className}`);

        // 1. Информация о классе
        const classData = await prisma.class.findFirst({
            where: { name: className },
        });

        if (!classData) {
            return NextResponse.json({ error: "Class not found" }, { status: 404 });
        }

        // 2. Владелец класса
        const owner = await prisma.user.findUnique({
            where: { id: classData.ownerId },
            select: { id: true, name: true, email: true },
        });

        // 3. Список учеников класса из MySQL
        const students = await query<StudentInfo>(`
      SELECT 
        aisId,
        CONCAT(lastName, ' ', firstName) AS name,
        className 
      FROM students 
      WHERE archive = 0 AND className = ?
      ORDER BY lastName, firstName
    `, [className]);

        // 4. Активные самовыводы класса
        const today = new Date();
        const studentIds = students.map(s => String(s.aisId));

        const activeSelfExits = await prisma.selfExit.findMany({
            where: {
                studentId: { in: studentIds },
                endDate: { gte: today },
            },
            orderBy: { startDate: 'desc' },
        });

        // 5. Все самовыводы (активные + завершённые) для подсчёта
        const allSelfExits = await prisma.selfExit.findMany({
            where: {
                studentId: { in: studentIds },
            },
        });

        // 6. Активные доверенности класса
        const activeAuthorizations = await prisma.authorization.findMany({
            where: {
                className: className,
                isActive: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // 7. Все доверенности (включая архивные)
        const allAuthorizations = await prisma.authorization.findMany({
            where: { className: className },
        });

        // 8. Формируем список учеников с флагами
        const studentsWithFlags = students.map(student => {
            const studentIdStr = String(student.aisId);

            // Самовывод ученика (активный)
            const activeSelfExit = activeSelfExits.find(
                s => String(s.studentId) === studentIdStr
            );

            // Самовыводы ученика (все)
            const studentSelfExits = allSelfExits.filter(
                s => String(s.studentId) === studentIdStr
            );

            // Доверенности ученика (активные)
            const studentAuths = activeAuthorizations.filter(
                a => String(a.studentId) === studentIdStr
            );

            // Доверенности ученика (все)
            const studentAllAuths = allAuthorizations.filter(
                a => String(a.studentId) === studentIdStr
            );

            return {
                aisId: student.aisId,
                name: student.name,
                className: student.className,
                hasActiveSelfExit: !!activeSelfExit,
                activeSelfExit: activeSelfExit || null,
                selfExitsCount: studentSelfExits.length,
                hasActiveAuthorization: studentAuths.length > 0,
                authorizationsCount: studentAuths.length,
                authorizations: studentAuths,
                totalAuthorizationsCount: studentAllAuths.length,
            };
        });

        // 9. Статистика по классу
        const stats = {
            totalStudents: students.length,
            activeSelfExits: activeSelfExits.length,
            studentsWithSelfExit: new Set(activeSelfExits.map(s => String(s.studentId))).size,
            totalSelfExits: allSelfExits.length,
            activeAuthorizations: activeAuthorizations.length,
            studentsWithAuth: new Set(activeAuthorizations.map(a => String(a.studentId))).size,
            totalAuthorizations: allAuthorizations.length,
            // 🔥 Ученики у кого есть ЛЮБОЕ разрешение (самовывод или доверенность)
            studentsWithAnyPermission: studentsWithFlags.filter(
                s => s.hasActiveSelfExit || s.hasActiveAuthorization
            ).length,
            // 🔥 Ученики без ограничений
            studentsWithoutPermission: studentsWithFlags.filter(
                s => !s.hasActiveSelfExit && !s.hasActiveAuthorization
            ).length,
        };

        console.log(`✅ Loaded: ${students.length} students, ${activeSelfExits.length} self-exits, ${activeAuthorizations.length} auths`);

        return NextResponse.json({
            class: {
                id: classData.id,
                name: classData.name,
                grade: classData.grade,
                letter: classData.letter,
                owner,
            },
            students: studentsWithFlags,
            activeSelfExits,
            activeAuthorizations,
            stats,
        });
    } catch (error) {
        console.error("❌ Error loading class details:", error);
        return NextResponse.json(
            { error: "Failed to load", details: String(error) },
            { status: 500 }
        );
    }
}
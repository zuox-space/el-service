// app/api/students/[aisId]/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/mysql_db";

interface StudentInfo {
    aisId: string;
    name: string;
    firstName: string;
    lastName: string;
    className: string;
}

export async function GET(
    req: NextRequest,
    { params }: { params: { aisId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { aisId } = params;

        if (!aisId) {
            return NextResponse.json({ error: "Missing student ID" }, { status: 400 });
        }

        console.log(`🔍 Loading student profile: ${aisId}`);

        // 1. Получаем основную информацию о студенте из MySQL
        const studentInfo = await query<StudentInfo>(`
      SELECT 
        aisId,
        CONCAT(lastName, ' ', firstName) AS name,
        firstName,
        lastName,
        className 
      FROM students 
      WHERE aisId = ? AND archive = 0
    `, [aisId]);

        if (!studentInfo || studentInfo.length === 0) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        const student = studentInfo[0];

        // 2. Получаем все пропуска студента
        // Pass хранит students как JSON, поэтому фильтруем все и ищем по ID
        const allPasses = await prisma.pass.findMany({
            orderBy: { date: 'desc' },
            take: 500,
        });

        const passes = allPasses
            .filter(pass => {
                try {
                    const students = JSON.parse(pass.students || '[]');
                    return students.some((s: any) => String(s.id) === String(aisId));
                } catch {
                    return false;
                }
            })
            .map(pass => {
                let studentsList: any[] = [];
                try {
                    studentsList = JSON.parse(pass.students || '[]');
                } catch { }
                return {
                    id: pass.id,
                    date: pass.date,
                    exitTime: pass.exitTime,
                    reason: pass.reason,
                    used: pass.used,
                    usedAt: pass.usedAt,
                    className: student.className,
                };
            });

        // 3. Получаем самовыводы студента
        const selfExits = await prisma.selfExit.findMany({
            where: {
                studentId: String(aisId),
            },
            orderBy: { startDate: 'desc' },
        });

        // 4. Получаем нарушения студента
        const violations = await prisma.violation.findMany({
            where: {
                studentId: String(aisId),
            },
            orderBy: { date: 'desc' },
        });

        // 5. Получаем отсутствия из Attendance
        const allAttendances = await prisma.attendance.findMany({
            orderBy: { date: 'desc' },
            take: 500,
        });

        const absences: any[] = [];
        for (const record of allAttendances) {
            try {
                const absentStudents = JSON.parse(record.absentStudents || '[]');
                const absentReasons = JSON.parse(record.absentReasons || '{}');

                if (absentStudents.some((id: any) => String(id) === String(aisId))) {
                    absences.push({
                        id: record.id,
                        date: record.date,
                        reason: absentReasons[aisId] || 'other',
                        className: student.className,
                    });
                }
            } catch (e) {
                // skip
            }
        }

        // 6. Считаем статистику
        const stats = {
            passes: {
                total: passes.length,
                used: passes.filter(p => p.used).length,
                notUsed: passes.filter(p => !p.used).length,
            },
            selfExits: {
                total: selfExits.length,
                active: selfExits.filter(e => new Date(e.endDate) >= new Date()).length,
            },
            violations: {
                total: violations.length,
                byType: violations.reduce((acc, v) => {
                    acc[v.violationType] = (acc[v.violationType] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
            },
            absences: {
                total: absences.length,
                byReason: absences.reduce((acc, a) => {
                    acc[a.reason] = (acc[a.reason] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
            },
        };

        console.log(`✅ Profile loaded: ${student.name} (${student.className})`);
        console.log(`📊 Stats:`, stats);

        return NextResponse.json({
            student,
            passes,
            selfExits,
            violations,
            absences,
            stats,
        });

    } catch (error) {
        console.error("❌ Error loading student profile:", error);
        return NextResponse.json(
            { error: "Failed to load student profile", details: String(error) },
            { status: 500 }
        );
    }
}
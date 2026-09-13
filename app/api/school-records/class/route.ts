// app/api/school-records/class/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const className = searchParams.get("className");

        if (!className) {
            return NextResponse.json([]);
        }

        console.log(`🔍 Loading school records for class: ${className}`);

        // Получаем все активные записи ВШУ для класса
        const records = await prisma.schoolRecord.findMany({
            where: {
                className: className,
                isActive: true,
            },
            orderBy: { registeredAt: 'desc' },
        });

        console.log(`📋 Found ${records.length} active school records`);

        // Для каждого ученика считаем дополнительную статистику
        const enrichedRecords = await Promise.all(
            records.map(async (record) => {
                // Считаем пропуска уроков
                const allAttendances = await prisma.attendance.findMany({
                    orderBy: { date: 'desc' },
                    take: 500,
                });

                let absenceCount = 0;
                for (const att of allAttendances) {
                    try {
                        const absentStudents = JSON.parse(att.absentStudents || '[]');
                        if (absentStudents.some((id: any) => String(id) === String(record.studentId))) {
                            absenceCount++;
                        }
                    } catch { }
                }

                // Считаем нарушения
                const violationCount = await prisma.violation.count({
                    where: { studentId: String(record.studentId) },
                });

                // Считаем пропуска
                const allPasses = await prisma.pass.findMany({
                    take: 500,
                });

                let passCount = 0;
                for (const pass of allPasses) {
                    try {
                        const students = JSON.parse(pass.students || '[]');
                        if (students.some((s: any) => String(s.id) === String(record.studentId))) {
                            passCount++;
                        }
                    } catch { }
                }

                return {
                    ...record,
                    stats: {
                        violations: violationCount,
                        absences: absenceCount,
                        passes: passCount,
                    },
                };
            })
        );

        return NextResponse.json(enrichedRecords);
    } catch (error) {
        console.error("❌ Error fetching class school records:", error);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }
}
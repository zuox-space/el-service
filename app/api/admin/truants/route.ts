// app/api/truants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/mysql_db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json({ error: "Missing date range" }, { status: 400 });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        console.log(`📊 Fetching truants from ${start.toISOString()} to ${end.toISOString()}`);

        // 1. Получаем все записи посещаемости за период (БЕЗ include)
        const attendances = await prisma.attendance.findMany({
            where: {
                date: {
                    gte: start,
                    lte: end
                }
            }
        });

        console.log(`📋 Found ${attendances.length} attendance records`);

        // 2. Получаем ВСЕ классы для сопоставления ID -> название
        const allClasses = await prisma.class.findMany({
            select: {
                id: true,
                name: true
            }
        });

        // Создаем карту классов
        const classMap = new Map<string, string>();
        allClasses.forEach(cls => {
            classMap.set(cls.id, cls.name);
        });

        // 3. Собираем всех студентов из MySQL
        const allStudentsFromMySQL = await query<{
            aisId: number;
            name: string;
            className: string;
        }>(`
            SELECT 
                aisId,
                CONCAT(lastName, ' ', firstName) AS name,
                className 
            FROM students 
            WHERE archive = 0
        `);

        console.log(`👥 Found ${allStudentsFromMySQL.length} students in MySQL`);

        // Создаем карту студентов
        const studentMap = new Map<number, { name: string; className: string }>();
        allStudentsFromMySQL.forEach(student => {
            studentMap.set(student.aisId, {
                name: student.name,
                className: student.className
            });
        });

        // 4. Обрабатываем каждую запись посещаемости
        const absenceMap = new Map<number, {
            studentId: number;
            name: string;
            currentClass: string;
            totalAbsences: number;
            absences: {
                date: string;
                reason: string;
                className: string;
                classId: string;
            }[];
            reasons: Record<string, number>;
            _classHistory?: { className: string; date: string }[];
        }>();

        for (const record of attendances) {
            // Получаем название класса из карты
            const className = classMap.get(record.classId) || `Класс ${record.classId}`;

            // Парсим absentStudents
            let absentIds: number[] = [];
            if (typeof record.absentStudents === 'string') {
                try {
                    absentIds = JSON.parse(record.absentStudents);
                } catch {
                    console.warn(`⚠️ Failed to parse absentStudents for record ${record.id}`);
                    continue;
                }
            } else if (Array.isArray(record.absentStudents)) {
                absentIds = record.absentStudents;
            }

            if (absentIds.length === 0) continue;

            // Парсим absentReasons
            let absentReasons: Record<number, string> = {};
            if (typeof record.absentReasons === 'string') {
                try {
                    absentReasons = JSON.parse(record.absentReasons);
                } catch {
                    absentReasons = {};
                }
            } else if (typeof record.absentReasons === 'object') {
                absentReasons = record.absentReasons;
            }

            for (const studentId of absentIds) {
                const studentInfo = studentMap.get(studentId);

                if (!studentInfo) {
                    console.warn(`⚠️ Student with ID ${studentId} not found in MySQL`);
                    continue;
                }

                const reason = absentReasons[studentId] || "other";

                if (!absenceMap.has(studentId)) {
                    absenceMap.set(studentId, {
                        studentId: studentId,
                        name: studentInfo.name,
                        currentClass: studentInfo.className,
                        totalAbsences: 0,
                        absences: [],
                        reasons: {},
                        _classHistory: []
                    });
                }

                const entry = absenceMap.get(studentId)!;
                entry.totalAbsences++;
                entry.absences.push({
                    date: record.date.toISOString(),
                    reason: reason,
                    className: className,
                    classId: record.classId
                });

                entry.reasons[reason] = (entry.reasons[reason] || 0) + 1;

                // Отслеживаем историю классов
                if (entry._classHistory) {
                    const lastClass = entry._classHistory[entry._classHistory.length - 1];
                    if (!lastClass || lastClass.className !== className) {
                        entry._classHistory.push({
                            className: className,
                            date: record.date.toISOString()
                        });
                    }
                }
            }
        }

        // 5. Преобразуем в массив
        const truants = Array.from(absenceMap.values())
            .filter(s => s.totalAbsences > 0)
            .sort((a, b) => b.totalAbsences - a.totalAbsences)
            .map(student => {
                const gradeMatch = student.currentClass.match(/(\d+)/);
                const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;

                return {
                    id: student.studentId,
                    name: student.name,
                    className: student.currentClass,
                    grade: grade,
                    totalAbsences: student.totalAbsences,
                    absences: student.absences,
                    reasons: student.reasons,
                    _meta: {
                        classHistory: student._classHistory || [],
                        uniqueClasses: [...new Set(student.absences.map(a => a.className))]
                    }
                };
            });

        // 6. Статистика
        const reasonStats: Record<string, number> = {};
        truants.forEach(student => {
            Object.entries(student.reasons || {}).forEach(([reason, count]) => {
                reasonStats[reason] = (reasonStats[reason] || 0) + count;
            });
        });

        const classStats: Record<string, { total: number; students: number }> = {};
        truants.forEach(student => {
            if (!classStats[student.className]) {
                classStats[student.className] = { total: 0, students: 0 };
            }
            classStats[student.className].total += student.totalAbsences;
            classStats[student.className].students++;
        });

        console.log(`📊 Found ${truants.length} truants`);

        return NextResponse.json({
            success: true,
            truants: truants,
            stats: {
                totalTruants: truants.length,
                totalAbsences: truants.reduce((sum, s) => sum + s.totalAbsences, 0),
                period: {
                    start: start.toISOString(),
                    end: end.toISOString()
                },
                byReason: reasonStats,
                byClass: classStats
            },
            meta: {
                source: 'mysql',
                attendanceRecords: attendances.length,
                studentsInMySQL: allStudentsFromMySQL.length,
                studentsWithAbsences: truants.length
            }
        });

    } catch (error) {
        console.error("❌ Error fetching truants:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch truants data",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
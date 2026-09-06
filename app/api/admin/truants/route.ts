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
        let startDate = searchParams.get("startDate");
        let endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json({ error: "Missing date range" }, { status: 400 });
        }

        console.log(`📅 startDate: ${startDate}, endDate: ${endDate}`);

        // 🔥 ПРОСТОЕ СРАВНЕНИЕ СТРОК (без преобразования в Date)
        // Так как даты хранятся в формате YYYY-MM-DD в БД
        const start = startDate;
        const end = endDate;

        console.log(`📊 Сравниваем строки: start=${start}, end=${end}`);

        // 🔥 ПОЛУЧАЕМ ВСЕ ЗАПИСИ И ФИЛЬТРУЕМ ПО СТРОКАМ
        const allAttendances = await prisma.attendance.findMany({
            orderBy: {
                date: 'desc'
            }
        });

        console.log(`📋 Всего записей в БД: ${allAttendances.length}`);

        // 🔥 ФИЛЬТРУЕМ ПО ДАТЕ КАК СТРОКЕ
        const attendances = allAttendances.filter(record => {
            // Берем только дату из ISO строки (YYYY-MM-DD)
            const recordDateStr = record.date.toISOString().split('T')[0];
            // Сравниваем как строки
            return recordDateStr >= start && recordDateStr <= end;
        });

        console.log(`📋 Отфильтровано: ${attendances.length} записей`);

        // 🔥 ВЫВОДИМ ВСЕ ДАТЫ В БД
        const allDates = allAttendances.map(r => r.date.toISOString().split('T')[0]);
        const uniqueDates = [...new Set(allDates)];
        console.log(`📅 Даты в БД: ${uniqueDates.join(', ')}`);
        console.log(`📅 Выбранный диапазон: ${start} - ${end}`);

        // Если нет записей, возвращаем пустой результат
        if (attendances.length === 0) {
            return NextResponse.json({
                success: true,
                truants: [],
                stats: {
                    totalTruants: 0,
                    totalAbsences: 0,
                    period: {
                        start: startDate,
                        end: endDate
                    },
                    byReason: {}
                },
                meta: {
                    source: 'mysql',
                    attendanceRecords: 0,
                    studentsInMySQL: 0,
                    studentsWithAbsences: 0,
                    debug: {
                        allDatesInDB: uniqueDates,
                        selectedRange: `${start} - ${end}`
                    }
                }
            });
        }

        // 2. Получаем ВСЕ классы
        const allClasses = await prisma.class.findMany({
            select: {
                id: true,
                name: true
            }
        });

        const classMap = new Map<string, string>();
        allClasses.forEach(cls => {
            classMap.set(cls.id, cls.name);
        });

        // 3. Собираем ВСЕХ студентов из MySQL
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

        console.log(`👥 Студентов в MySQL: ${allStudentsFromMySQL.length}`);

        const studentMap = new Map<number, { name: string; className: string }>();
        allStudentsFromMySQL.forEach(student => {
            studentMap.set(student.aisId, {
                name: student.name,
                className: student.className
            });
        });

        // 4. Обрабатываем записи
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
        }>();

        for (const record of attendances) {
            const className = classMap.get(record.classId) || `Класс ${record.classId}`;

            let absentIds: number[] = [];
            if (typeof record.absentStudents === 'string') {
                try {
                    absentIds = JSON.parse(record.absentStudents);
                } catch {
                    continue;
                }
            } else if (Array.isArray(record.absentStudents)) {
                absentIds = record.absentStudents;
            }

            if (absentIds.length === 0) continue;

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
                if (!studentInfo) continue;

                const reason = absentReasons[studentId] || "other";

                if (!absenceMap.has(studentId)) {
                    absenceMap.set(studentId, {
                        studentId: studentId,
                        name: studentInfo.name,
                        currentClass: studentInfo.className,
                        totalAbsences: 0,
                        absences: [],
                        reasons: {}
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

        console.log(`📊 Найдено прогульщиков: ${truants.length}`);

        return NextResponse.json({
            success: true,
            truants: truants,
            stats: {
                totalTruants: truants.length,
                totalAbsences: truants.reduce((sum, s) => sum + s.totalAbsences, 0),
                period: {
                    start: startDate,
                    end: endDate
                },
                byReason: reasonStats
            },
            meta: {
                source: 'mysql',
                attendanceRecords: attendances.length,
                studentsInMySQL: allStudentsFromMySQL.length,
                studentsWithAbsences: truants.length,
                debug: {
                    allDatesInDB: uniqueDates,
                    selectedRange: `${start} - ${end}`
                }
            }
        });

    } catch (error) {
        console.error("❌ Error fetching truants:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch truants data",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}
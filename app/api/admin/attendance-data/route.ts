// app/api/attendance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentsGroupedByClass } from "@/lib/mysql_db";
import { withDbMetrics, startDbMetrics } from "@/lib/dev-metrics";

export const dynamic = 'force-dynamic';

// GET: Получить все данные о посещаемости для всех классов
export async function GET(req: NextRequest) {
    startDbMetrics();
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Проверка прав администратора
    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get("date");

        const today = dateParam ? new Date(dateParam) : new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Все классы и все записи посещаемости за день — по одному запросу на каждый источник
        const [classes, allAttendance, studentsByClass] = await Promise.all([
            prisma.class.findMany({ orderBy: { name: 'asc' } }),
            prisma.attendance.findMany({
                where: {
                    date: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            }),
            // 🔥 Один запрос ко всем ученикам вместо запроса на каждый класс (был N+1)
            getStudentsGroupedByClass(),
        ]);

        // Создаем карту посещаемости по classId
        const attendanceMap = new Map();
        allAttendance.forEach(record => {
            attendanceMap.set(record.classId, record);
        });

        // 🔥 ФОРМИРУЕМ ДАННЫЕ ТОЛЬКО ИЗ MYSQL
        const result = classes.map((cls) => {
            const gradeMatch = cls.name.match(/(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;

            // Ученики класса берутся из общей карты.
            // ⚠️ id ученика из базы АИС — строка, а записи посещаемости исторически хранят числа
            // (клиент отправлял числовые id). Поэтому все сравнения ниже — через строковое
            // представление, иначе имена и причины отсутствующих не находились.
            const students = (studentsByClass.get(cls.name) || []).map((student) => ({
                id: student.aisId,
                name: student.name,
                aisId: student.aisId
            }));

            const studentById = new Map<string, { id: string; name: string }>();
            students.forEach(s => studentById.set(String(s.id), { id: s.id, name: s.name }));

            const attendance = attendanceMap.get(cls.id);
            let presentStudents: number[] = [];
            let absentStudents: any[] = [];
            let isMarked = false;

            if (attendance) {
                isMarked = true;

                // Парсим presentStudents
                if (typeof attendance.presentStudents === 'string') {
                    try {
                        presentStudents = JSON.parse(attendance.presentStudents);
                    } catch {
                        presentStudents = [];
                    }
                } else if (Array.isArray(attendance.presentStudents)) {
                    presentStudents = attendance.presentStudents;
                }

                // Парсим absentStudents и absentReasons
                let absentIds: (string | number)[] = [];
                let absentReasons: Record<string, string> = {};

                if (typeof attendance.absentStudents === 'string') {
                    try {
                        absentIds = JSON.parse(attendance.absentStudents);
                    } catch {
                        absentIds = [];
                    }
                } else if (Array.isArray(attendance.absentStudents)) {
                    absentIds = attendance.absentStudents;
                }

                if (typeof attendance.absentReasons === 'string') {
                    try {
                        absentReasons = JSON.parse(attendance.absentReasons);
                    } catch {
                        absentReasons = {};
                    }
                } else if (typeof attendance.absentReasons === 'object') {
                    absentReasons = attendance.absentReasons;
                }

                // 🔥 НАХОДИМ СТУДЕНТОВ ТОЛЬКО В MYSQL ДАННЫХ
                absentStudents = absentIds.map((rawId) => {
                    const key = String(rawId);
                    const student = studentById.get(key);
                    // Причина может быть сохранена и под числовым, и под строковым ключом
                    const reason = absentReasons[key] ?? absentReasons[rawId as any] ?? "other";

                    return {
                        id: student ? student.id : rawId,
                        name: student?.name || `Студент ${rawId}`,
                        reason
                    };
                });
            }

            return {
                id: cls.id,
                name: cls.name,
                totalStudents: students.length,
                presentStudents: presentStudents,
                absentStudents: absentStudents,
                isMarked: isMarked,
                grade: grade,
                _meta: {
                    studentsCount: students.length,
                    source: 'mysql'
                }
            };
        });

        // Подсчет статистики
        const stats = {
            totalStudents: 0,
            totalPresent: 0,
            totalAbsent: 0,
            byReason: { sick: 0, family: 0, other: 0, vacation: 0, competition: 0 },
            byBuilding: {
                tiger: { total: 0, present: 0, absent: 0 },
                turtle: { total: 0, present: 0, absent: 0 },
                crocodile: { total: 0, present: 0, absent: 0 }
            }
        };

        for (const cls of result) {
            const building = cls.grade <= 3 ? "tiger" : cls.grade <= 6 ? "turtle" : "crocodile";

            stats.totalStudents += cls.totalStudents;
            stats.byBuilding[building as keyof typeof stats.byBuilding].total += cls.totalStudents;

            if (cls.isMarked) {
                stats.totalPresent += cls.presentStudents.length;
                stats.totalAbsent += cls.absentStudents.length;
                stats.byBuilding[building as keyof typeof stats.byBuilding].present += cls.presentStudents.length;
                stats.byBuilding[building as keyof typeof stats.byBuilding].absent += cls.absentStudents.length;

                for (const student of cls.absentStudents) {
                    if (stats.byReason[student.reason as keyof typeof stats.byReason] !== undefined) {
                        stats.byReason[student.reason as keyof typeof stats.byReason]++;
                    }
                }
            }
        }

        return withDbMetrics(NextResponse.json({
            classes: result,
            statistics: stats
        }));

    } catch (error) {
        console.error("❌ Error fetching attendance data:", error);
        return NextResponse.json(
            { error: "Failed to fetch attendance data" },
            { status: 500 }
        );
    }
}
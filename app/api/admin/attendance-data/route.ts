import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET: Получить все данные о посещаемости для всех классов
export async function GET(req: NextRequest) {
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

        // Получаем все классы с учениками
        const classes = await prisma.class.findMany({
            orderBy: { name: 'asc' }
        });

        // Получаем все записи посещаемости за сегодня одним запросом
        const allAttendance = await prisma.attendance.findMany({
            where: {
                date: {
                    gte: today,
                    lt: tomorrow
                }
            }
        });

        // Создаем карту посещаемости по classId
        const attendanceMap = new Map();
        allAttendance.forEach(record => {
            attendanceMap.set(record.classId, record);
        });

        // Форматируем данные
        const result = classes.map(cls => {
            const gradeMatch = cls.name.match(/(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;

            let students: any[] = [];
            if (typeof cls.students === 'string') {
                try {
                    students = JSON.parse(cls.students);
                } catch {
                    students = [];
                }
            } else if (Array.isArray(cls.students)) {
                students = cls.students;
            }

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
                let absentIds: number[] = [];
                let absentReasons: Record<number, string> = {};

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

                absentStudents = absentIds.map((id: number) => {
                    const student = students.find((s: any) => s.id === id);
                    const reason = absentReasons[id] || "other";
                    return {
                        id,
                        name: student?.name || "Неизвестно",
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
                grade: grade
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

        return NextResponse.json({
            classes: result,
            statistics: stats
        });

    } catch (error) {
        console.error("Error fetching attendance data:", error);
        return NextResponse.json(
            { error: "Failed to fetch attendance data" },
            { status: 500 }
        );
    }
}
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

        // Получаем все классы с учениками
        const classes = await prisma.class.findMany();

        // Получаем ТОЛЬКО посещаемости (attendance) за период
        const attendances = await prisma.attendance.findMany({
            where: {
                date: {
                    gte: start,
                    lte: end
                }
            }
        });

        // Собираем статистику по ученикам ТОЛЬКО из attendance
        const studentMap = new Map();

        // Обработка посещаемости
        for (const record of attendances) {
            const cls = classes.find(c => c.id === record.classId);
            if (!cls) continue;

            let students: any[] = [];
            if (typeof cls.students === 'string') {
                try {
                    students = JSON.parse(cls.students);
                } catch {
                    continue;
                }
            }

            let absentIds: number[] = [];
            if (typeof record.absentStudents === 'string') {
                try {
                    absentIds = JSON.parse(record.absentStudents);
                } catch {
                    continue;
                }
            }

            let absentReasons: Record<number, string> = {};
            if (typeof record.absentReasons === 'string') {
                try {
                    absentReasons = JSON.parse(record.absentReasons);
                } catch {
                    continue;
                }
            }

            for (const id of absentIds) {
                const student = students.find((s: any) => s.id === id);
                if (!student) continue;

                const reason = absentReasons[id] || "other";

                const key = `${cls.id}-${id}`;
                if (!studentMap.has(key)) {
                    studentMap.set(key, {
                        id: id,
                        name: student.name,
                        className: cls.name,
                        grade: cls.grade,
                        totalAbsences: 0,
                        absences: []
                    });
                }

                const entry = studentMap.get(key);
                entry.totalAbsences++;
                entry.absences.push({
                    date: record.date,
                    reason: reason,
                    type: "attendance"
                });
            }
        }

        // Преобразуем Map в массив и сортируем по количеству пропусков
        const truants = Array.from(studentMap.values())
            .filter(s => s.totalAbsences > 0)
            .sort((a, b) => b.totalAbsences - a.totalAbsences);

        return NextResponse.json({ truants });

    } catch (error) {
        console.error("Error fetching truants:", error);
        return NextResponse.json(
            { error: "Failed to fetch truants data" },
            { status: 500 }
        );
    }
}
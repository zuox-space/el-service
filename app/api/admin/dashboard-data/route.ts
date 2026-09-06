// app/api/admin/dashboard-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { query } from "@/lib/mysql_db";

export const dynamic = 'force-dynamic';

// GET: Получить все данные для дашборда администратора
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
        const tab = searchParams.get("tab") || "single";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 🔥 1. Получаем всех студентов из MySQL
        const allStudentsFromMySQL = await query<{
            aisId: string; // 👈 Меняем с number на string
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

        // Создаем карту студентов с ключом string
        const studentMap = new Map<string, { name: string; className: string }>();
        allStudentsFromMySQL.forEach(student => {
            studentMap.set(String(student.aisId), { // 👈 Преобразуем в строку
                name: student.name,
                className: student.className
            });
        });

        console.log(`👥 Загружено ${allStudentsFromMySQL.length} студентов из MySQL`);

        // 2. Получаем все классы
        const classes = await prisma.class.findMany({
            orderBy: { name: 'asc' }
        });

        const classMap = new Map();
        classes.forEach(cls => {
            classMap.set(cls.id, cls);
        });

        let passes: any[] = [];
        let selfExits: any[] = [];
        let departed: any[] = [];

        // 3. Получаем все пропуски за сегодня
        const allPasses = await prisma.pass.findMany({
            where: {
                date: {
                    gte: today,
                    lt: tomorrow
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // 4. ФОРМАТИРУЕМ ПРОПУСКИ
        for (const pass of allPasses) {
            const cls = classMap.get(pass.classId);
            const gradeMatch = cls?.name?.match(/(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;

            // Парсим students из JSON
            let students: any[] = [];
            if (typeof pass.students === 'string') {
                try {
                    students = JSON.parse(pass.students);
                } catch {
                    students = [];
                }
            } else if (Array.isArray(pass.students)) {
                students = pass.students;
            }

            let studentName = "Неизвестно";
            let studentClassName = cls?.name || "Неизвестный класс";

            if (students.length > 0) {
                const firstStudent = students[0];
                studentName = firstStudent.name || "Неизвестно";

                if (firstStudent.id) {
                    // 🔥 Используем строку для поиска в карте
                    const studentInfo = studentMap.get(String(firstStudent.id));
                    if (studentInfo) {
                        studentClassName = studentInfo.className;
                    }
                }
            }

            const formattedPass = {
                id: pass.id,
                studentName: studentName,
                exitTime: pass.exitTime,
                reason: pass.reason || "Не указана",
                date: pass.date,
                className: studentClassName,
                grade: grade,
                used: pass.used,
                usedAt: pass.usedAt,
                type: "single" as const,
                photoUrl: (pass as any).photoUrl || undefined,
            };

            if (pass.used) {
                departed.push(formattedPass);
            } else {
                passes.push(formattedPass);
            }
        }

        // 5. ФОРМАТИРУЕМ САМОВЫВОДЫ
        const allSelfExits = await prisma.selfExit.findMany({
            orderBy: { createdAt: "desc" }
        });

        for (const exit of allSelfExits) {
            const cls = classMap.get(exit.classId);
            const gradeMatch = cls?.name?.match(/(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;

            // 🔥 Используем строку для поиска в карте
            const studentInfo = studentMap.get(String(exit.studentId));
            const studentName = studentInfo?.name || exit.studentName || `Студент ${exit.studentId}`;
            const studentClassName = studentInfo?.className || cls?.name || "Неизвестный класс";

            selfExits.push({
                id: exit.id,
                studentName: studentName,
                exitTime: "самовывод",
                reason: exit.reason || "По заявлению",
                date: exit.startDate,
                startDate: exit.startDate,
                endDate: exit.endDate,
                className: studentClassName,
                grade: grade,
                type: "self-exit" as const,
                photoUrl: exit.photoUrl || null,
            });
        }

        console.log(`📊 Найдено пропусков: ${passes.length}, самовыводов: ${selfExits.length}, ушедших: ${departed.length}`);

        let result: any = {};

        switch (tab) {
            case "departed":
                result = { departed };
                break;
            case "self-exit":
                result = { selfExits };
                break;
            default:
                result = { passes };
                break;
        }

        result.stats = {
            totalPasses: passes.length,
            totalSelfExits: selfExits.length,
            totalDeparted: departed.length,
            totalClasses: classes.length,
            totalStudentsInMySQL: allStudentsFromMySQL.length
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("❌ Error fetching dashboard data:", error);
        return NextResponse.json(
            { error: "Failed to fetch dashboard data", details: String(error) },
            { status: 500 }
        );
    }
}
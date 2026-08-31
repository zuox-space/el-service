import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET: Получить все данные для дашборда администратора
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
        const tab = searchParams.get("tab") || "single";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Получаем все классы
        const classes = await prisma.class.findMany({
            orderBy: { name: 'asc' }
        });

        let passes: any[] = [];
        let selfExits: any[] = [];
        let departed: any[] = [];

        // Получаем все пропуски за сегодня для всех классов
        const allPasses = await prisma.pass.findMany({
            where: {
                date: {
                    gte: today,
                    lt: tomorrow
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Получаем все самовыводы (без фильтра по датам)
        const allSelfExits = await prisma.selfExit.findMany({
            orderBy: { createdAt: "desc" }
        });

        // Создаем карту классов для быстрого доступа
        const classMap = new Map();
        classes.forEach(cls => {
            classMap.set(cls.id, cls);
        });

        // Форматируем пропуски
        for (const pass of allPasses) {
            const cls = classMap.get(pass.classId);
            const gradeMatch = cls?.name?.match(/(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;

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

            if (students.length === 0 && cls) {
                if (typeof cls.students === 'string') {
                    try {
                        students = JSON.parse(cls.students);
                    } catch {
                        students = [];
                    }
                } else if (Array.isArray(cls.students)) {
                    students = cls.students;
                }
            }

            const formattedPass = {
                id: pass.id,
                studentName: students.map((s: any) => s.name).join(", ") || "Неизвестно",
                exitTime: pass.exitTime,
                reason: pass.reason,
                date: pass.date,
                className: cls?.name || "Неизвестный класс",
                grade: grade,
                used: pass.used,
                usedAt: pass.usedAt,
                type: "single" as const
            };

            if (pass.used) {
                departed.push(formattedPass);
            } else {
                passes.push(formattedPass);
            }
        }

        // 🔥 ФОРМАТИРУЕМ САМОВЫВОДЫ С PHOTOURL
        for (const exit of allSelfExits) {
            const cls = classMap.get(exit.classId);
            const gradeMatch = cls?.name?.match(/(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;

            selfExits.push({
                id: exit.id,
                studentName: exit.studentName || "Неизвестно",
                exitTime: "самовывод",
                reason: exit.reason || "По заявлению",
                date: exit.startDate,
                startDate: exit.startDate,
                endDate: exit.endDate,
                className: cls?.name || "Неизвестный класс",
                grade: grade,
                type: "self-exit" as const,
                photoUrl: exit.photoUrl ? `/api${exit.photoUrl}` : null // ✅ ИСПРАВЛЕНО
            });
        }

        // Добавляем отладочную информацию
        console.log(`🔍 Найдено пропусков: ${passes.length}, самовыводов: ${selfExits.length}, ушедших: ${departed.length}`);
        console.log(`📊 Пример самовывода с photoUrl:`, selfExits[0] || "Нет самовыводов");

        // Возвращаем данные в зависимости от запрошенной вкладки
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

        // Добавляем общую статистику
        result.stats = {
            totalPasses: passes.length,
            totalSelfExits: selfExits.length,
            totalDeparted: departed.length,
            totalClasses: classes.length
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        return NextResponse.json(
            { error: "Failed to fetch dashboard data", details: String(error) },
            { status: 500 }
        );
    }
}
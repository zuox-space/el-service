import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Типы намерений
type Intent =
    | "statistics"
    | "truants"
    | "student_info"
    | "class_info"
    | "passes"
    | "absences"
    | "unknown";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { message } = await req.json();

        // Определяем намерение
        const intent = detectIntent(message);

        // Обрабатываем запрос
        let response = "";
        let data = null;

        switch (intent) {
            case "statistics":
                const stats = await getStatistics();
                response = formatStatistics(stats);
                data = { type: "stats", values: stats };
                break;

            case "truants":
                const truants = await getTruants(message);
                response = formatTruants(truants);
                if (truants.length > 0) {
                    data = {
                        type: "table",
                        columns: ["#", "Ученик", "Класс", "Пропусков"],
                        rows: truants.map((s, i) => [i + 1, s.name, s.className, s.totalAbsences])
                    };
                }
                break;

            case "student_info":
                const student = await findStudent(message);
                if (student) {
                    response = formatStudentInfo(student);
                } else {
                    response = "👨‍🎓 Ученик не найден. Проверьте правильность написания фамилии.";
                }
                break;

            case "class_info":
                const classInfo = await getClassInfo(message);
                if (classInfo) {
                    response = formatClassInfo(classInfo);
                } else {
                    response = "📚 Класс не найден. Проверьте правильность названия (например, 7-А).";
                }
                break;

            case "passes":
                const passes = await getPasses(message);
                response = formatPasses(passes);
                if (passes.length > 0) {
                    data = {
                        type: "table",
                        columns: ["Ученик", "Время", "Причина", "Класс"],
                        rows: passes.map(p => [p.studentName, p.exitTime, p.reason, p.className])
                    };
                }
                break;

            case "absences":
                const absences = await getAbsences(message);
                response = formatAbsences(absences);
                if (absences.length > 0) {
                    data = {
                        type: "table",
                        columns: ["Ученик", "Причина", "Дата", "Класс"],
                        rows: absences.map(a => [a.name, a.reason, a.date, a.className])
                    };
                }
                break;

            default:
                response = "❓ Я не совсем понял ваш вопрос.\n\nВот что я умею:\n• 📊 Показать статистику\n• ⚠️ Найти прогульщиков\n• 👨‍🎓 Найти ученика\n• 📚 Информацию о классе\n• 📅 Пропуски за период\n\nПопробуйте переформулировать вопрос.";
        }

        return NextResponse.json({ response, data });

    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json(
            { response: "❌ Произошла ошибка. Попробуйте позже." },
            { status: 500 }
        );
    }
}

// Детектор намерений
function detectIntent(message: string): Intent {
    const lower = message.toLowerCase();

    if (lower.includes("статистик") || lower.includes("покажи") && (lower.includes("всего") || lower.includes("общ"))) {
        return "statistics";
    }

    if (lower.includes("прогул") || lower.includes("пропуск") && (lower.includes("кто") || lower.includes("больше"))) {
        return "truants";
    }

    if (lower.includes("ученик") || lower.includes("студент") || lower.includes("найди")) {
        return "student_info";
    }

    if (lower.includes("класс") && (lower.includes("покажи") || lower.includes("информаци"))) {
        return "class_info";
    }

    if (lower.includes("пропуск") && !lower.includes("прогул")) {
        return "passes";
    }

    if (lower.includes("отсутств") || lower.includes("больн")) {
        return "absences";
    }

    return "unknown";
}

// Функции для работы с БД
async function getStatistics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Получаем все классы для подсчета учеников
    const classes = await prisma.class.findMany();
    let totalStudents = 0;
    for (const cls of classes) {
        if (typeof cls.students === 'string') {
            try {
                const students = JSON.parse(cls.students);
                totalStudents += students.length;
            } catch { }
        }
    }

    const [totalClasses, todayPasses, todayAbsences] = await Promise.all([
        prisma.class.count(),
        prisma.pass.count({ where: { date: { gte: today, lt: tomorrow }, used: false } }),
        prisma.attendance.count({ where: { date: { gte: today, lt: tomorrow } } })
    ]);

    return {
        "Всего учеников": totalStudents,
        "Классов": totalClasses,
        "Пропусков сегодня": todayPasses,
        "Отсутствий сегодня": todayAbsences
    };
}

async function getTruants(message: string) {
    const limit = extractNumber(message) || 10;

    const classes = await prisma.class.findMany();
    const attendances = await prisma.attendance.findMany({
        where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    });

    const studentMap = new Map();

    for (const record of attendances) {
        const cls = classes.find(c => c.id === record.classId);
        if (!cls) continue;

        let students: any[] = [];
        if (typeof cls.students === 'string') {
            try { students = JSON.parse(cls.students); } catch { continue; }
        }

        let absentIds: number[] = [];
        if (typeof record.absentStudents === 'string') {
            try { absentIds = JSON.parse(record.absentStudents); } catch { continue; }
        }

        let absentReasons: Record<number, string> = {};
        if (typeof record.absentReasons === 'string') {
            try { absentReasons = JSON.parse(record.absentReasons); } catch { continue; }
        }

        for (const id of absentIds) {
            const student = students.find((s: any) => s.id === id);
            if (!student) continue;

            const reason = absentReasons[id] || "other";
            // Пропускаем уважительные причины
            if (reason === "sick" || reason === "competition") continue;

            const key = `${cls.id}-${id}`;
            if (!studentMap.has(key)) {
                studentMap.set(key, { name: student.name, className: cls.name, totalAbsences: 0 });
            }
            studentMap.get(key).totalAbsences++;
        }
    }

    return Array.from(studentMap.values())
        .filter(s => s.totalAbsences > 0)
        .sort((a, b) => b.totalAbsences - a.totalAbsences)
        .slice(0, limit);
}

async function findStudent(message: string) {
    const name = extractName(message);
    if (!name) return null;

    const classes = await prisma.class.findMany();
    for (const cls of classes) {
        let students: any[] = [];
        if (typeof cls.students === 'string') {
            try { students = JSON.parse(cls.students); } catch { continue; }
        }

        const found = students.find((s: any) =>
            s.name.toLowerCase().includes(name.toLowerCase())
        );
        if (found) {
            return { ...found, className: cls.name };
        }
    }
    return null;
}

async function getClassInfo(message: string) {
    const className = extractClassName(message);
    if (!className) return null;

    const cls = await prisma.class.findFirst({
        where: { name: { contains: className } }
    });
    if (!cls) return null;

    let students: any[] = [];
    if (typeof cls.students === 'string') {
        try { students = JSON.parse(cls.students); } catch { return null; }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await prisma.attendance.findFirst({
        where: { classId: cls.id, date: { gte: today, lt: tomorrow } }
    });

    return {
        name: cls.name,
        studentsCount: students.length,
        students: students.map((s: any) => s.name),
        marked: !!todayAttendance
    };
}

async function getPasses(message: string) {
    const days = extractDays(message) || 1;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 🔥 Убираем include: { class: true }
    const passes = await prisma.pass.findMany({
        where: {
            date: { gte: startDate },
            used: false
        }
    });

    // Получаем классы отдельно
    const classes = await prisma.class.findMany();
    const classMap = new Map();
    classes.forEach(cls => classMap.set(cls.id, cls));

    return passes.map(p => {
        let students: any[] = [];
        if (typeof p.students === 'string') {
            try { students = JSON.parse(p.students); } catch { students = []; }
        }
        const cls = classMap.get(p.classId);
        return {
            studentName: students.map((s: any) => s.name).join(", ") || "Неизвестно",
            exitTime: p.exitTime,
            reason: p.reason,
            className: cls?.name || "Неизвестный класс"
        };
    });
}

async function getAbsences(message: string) {
    const days = extractDays(message) || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const attendances = await prisma.attendance.findMany({
        where: { date: { gte: startDate } }
    });

    const classes = await prisma.class.findMany();
    const result: any[] = [];

    for (const record of attendances) {
        const cls = classes.find(c => c.id === record.classId);
        if (!cls) continue;

        let students: any[] = [];
        if (typeof cls.students === 'string') {
            try { students = JSON.parse(cls.students); } catch { continue; }
        }

        let absentIds: number[] = [];
        if (typeof record.absentStudents === 'string') {
            try { absentIds = JSON.parse(record.absentStudents); } catch { continue; }
        }

        let absentReasons: Record<number, string> = {};
        if (typeof record.absentReasons === 'string') {
            try { absentReasons = JSON.parse(record.absentReasons); } catch { continue; }
        }

        for (const id of absentIds) {
            const student = students.find((s: any) => s.id === id);
            if (student) {
                result.push({
                    name: student.name,
                    reason: absentReasons[id] || "Не указана",
                    date: record.date.toLocaleDateString("ru-RU"),
                    className: cls.name
                });
            }
        }
    }

    return result.slice(0, 20);
}

// Вспомогательные функции
function extractNumber(text: string): number | null {
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[0]) : null;
}

function extractName(text: string): string | null {
    const match = text.match(/найди\s+([А-Яа-я-]+)/i) || text.match(/ученик[а]?\s+([А-Яа-я-]+)/i);
    return match ? match[1] : null;
}

function extractClassName(text: string): string | null {
    const match = text.match(/\d+[-]?[А-Я]/i);
    return match ? match[0].toUpperCase() : null;
}

function extractDays(text: string): number | null {
    const match = text.match(/(\d+)\s*(день|дн|д|недел|нед|месяц|мес)/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    if (match[2].toLowerCase().startsWith("нед")) return num * 7;
    if (match[2].toLowerCase().startsWith("мес")) return num * 30;
    return num;
}

// Форматировщики ответов
function formatStatistics(stats: Record<string, number>): string {
    return `📊 **Общая статистика**\n\n` +
        Object.entries(stats)
            .map(([key, value]) => `• ${key}: **${value}**`)
            .join("\n");
}

function formatTruants(truants: any[]): string {
    if (truants.length === 0) {
        return "✅ За последние 30 дней нет учеников с пропусками без уважительной причины!";
    }
    return `⚠️ **Топ-${Math.min(truants.length, 10)} прогульщиков за 30 дней:**\n\n` +
        truants.slice(0, 10).map((s, i) =>
            `${i + 1}. **${s.name}** (${s.className}) — ${s.totalAbsences} пропусков`
        ).join("\n");
}

function formatStudentInfo(student: any): string {
    return `👨‍🎓 **Информация о ученике**\n\n` +
        `• Имя: **${student.name}**\n` +
        `• Класс: **${student.className}**\n` +
        `• ID: ${student.id}`;
}

function formatClassInfo(classInfo: any): string {
    return `📚 **Класс ${classInfo.name}**\n\n` +
        `• Всего учеников: **${classInfo.studentsCount}**\n` +
        `• Отметка сегодня: ${classInfo.marked ? "✅ проведена" : "❌ не проведена"}\n` +
        `• Ученики: ${classInfo.students.slice(0, 10).join(", ")}${classInfo.students.length > 10 ? "..." : ""}`;
}

function formatPasses(passes: any[]): string {
    if (passes.length === 0) {
        return "📭 Активных пропусков не найдено.";
    }
    return `🚪 **Активные пропуски (${passes.length} шт.):**\n\n` +
        passes.slice(0, 10).map(p =>
            `• **${p.studentName}** (${p.className}) — ${p.exitTime}, ${p.reason}`
        ).join("\n") +
        (passes.length > 10 ? `\n\n... и еще ${passes.length - 10} пропусков` : "");
}

function formatAbsences(absences: any[]): string {
    if (absences.length === 0) {
        return "📭 Отсутствий за указанный период не найдено.";
    }
    return `📋 **Последние отсутствия (${absences.length} шт.):**\n\n` +
        absences.slice(0, 10).map(a =>
            `• **${a.name}** (${a.className}) — ${a.reason} (${a.date})`
        ).join("\n") +
        (absences.length > 10 ? `\n\n... и еще ${absences.length - 10} записей` : "");
}
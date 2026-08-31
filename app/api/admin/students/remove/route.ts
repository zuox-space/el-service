import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.roles?.includes("ADMIN")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { studentId, studentName, classId } = await req.json();

        const classData = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!classData) {
            return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
        }

        // Парсим список учеников
        let students = typeof classData.students === 'string'
            ? JSON.parse(classData.students)
            : classData.students || [];

        // Удаляем ученика
        students = students.filter((s: any) => s.id !== studentId && s.name !== studentName);

        // Обновляем класс
        await prisma.class.update({
            where: { id: classId },
            data: { students: JSON.stringify(students) }
        });

        return NextResponse.json({
            success: true,
            message: `Ученик ${studentName} удален из класса`
        });

    } catch (error) {
        console.error("Error removing student:", error);
        return NextResponse.json(
            { error: "Failed to remove student" },
            { status: 500 }
        );
    }
}
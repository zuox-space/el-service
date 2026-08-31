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
        const { studentId, studentName, fromClassId, toClassId } = await req.json();

        // Находим исходный класс
        const fromClass = await prisma.class.findUnique({
            where: { id: fromClassId }
        });

        if (!fromClass) {
            return NextResponse.json({ error: "Исходный класс не найден" }, { status: 404 });
        }

        // Находим целевой класс
        const toClass = await prisma.class.findUnique({
            where: { id: toClassId }
        });

        if (!toClass) {
            return NextResponse.json({ error: "Целевой класс не найден" }, { status: 404 });
        }

        // Парсим списки учеников
        let fromStudents = typeof fromClass.students === 'string'
            ? JSON.parse(fromClass.students)
            : fromClass.students || [];

        let toStudents = typeof toClass.students === 'string'
            ? JSON.parse(toClass.students)
            : toClass.students || [];

        // Удаляем ученика из исходного класса
        fromStudents = fromStudents.filter((s: any) => s.id !== studentId && s.name !== studentName);

        // Добавляем ученика в целевой класс
        const existingStudent = toStudents.find((s: any) => s.id === studentId || s.name === studentName);
        if (!existingStudent) {
            toStudents.push({ id: studentId, name: studentName });
        }

        // Обновляем оба класса в транзакции
        await prisma.$transaction([
            prisma.class.update({
                where: { id: fromClassId },
                data: { students: JSON.stringify(fromStudents) }
            }),
            prisma.class.update({
                where: { id: toClassId },
                data: { students: JSON.stringify(toStudents) }
            })
        ]);

        return NextResponse.json({
            success: true,
            message: `Ученик ${studentName} переведен из ${fromClass.name} в ${toClass.name}`
        });

    } catch (error) {
        console.error("Error transferring student:", error);
        return NextResponse.json(
            { error: "Failed to transfer student" },
            { status: 500 }
        );
    }
}
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.roles?.includes("ADMIN")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "Файл не загружен" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const workbook = XLSX.read(bytes, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        console.log(`📄 Прочитано строк: ${data.length}`);

        // Получаем все классы
        const allClasses = await prisma.class.findMany();
        console.log(`📚 Найдено классов в БД: ${allClasses.length}`);

        const classMap = new Map<string, any>();
        allClasses.forEach(cls => {
            classMap.set(cls.name, cls);
        });

        // Группируем учеников по классам
        const studentsByClass: Record<string, string[]> = {};
        let importedCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];
        const notFoundClasses: string[] = [];
        let processedRows = 0;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;

            // Пропускаем заголовки
            if (i === 0 && row.some(cell =>
                String(cell).toLowerCase().includes('фио') ||
                String(cell).toLowerCase().includes('имя') ||
                String(cell).toLowerCase().includes('класс')
            )) {
                continue;
            }

            const studentName = String(row[0] || '').trim();
            const className = String(row[1] || '').trim();

            if (!studentName || !className) {
                errors.push(`Строка ${i + 1}: Пропущены данные`);
                skippedCount++;
                continue;
            }

            processedRows++;

            const classData = classMap.get(className);

            if (!classData) {
                if (!notFoundClasses.includes(className)) {
                    notFoundClasses.push(className);
                }
                errors.push(`Строка ${i + 1}: Класс "${className}" не найден`);
                skippedCount++;
                continue;
            }

            if (!studentsByClass[classData.id]) {
                studentsByClass[classData.id] = [];
            }

            // Проверяем дубликаты
            let existingNames: string[] = [];
            try {
                const studentsStr = classData.students || "[]";
                const parsed = JSON.parse(studentsStr);
                if (Array.isArray(parsed)) {
                    existingNames = parsed.map((s: any) => s.name || s);
                }
            } catch (e) {
                existingNames = [];
            }

            const isInGroup = studentsByClass[classData.id].includes(studentName);

            if (!existingNames.includes(studentName) && !isInGroup) {
                studentsByClass[classData.id].push(studentName);
                importedCount++;
            } else {
                skippedCount++;
            }
        }

        console.log(`📊 Обработано строк: ${processedRows}`);
        console.log(`📊 Итого к импорту: ${importedCount} учеников`);
        console.log(`📊 Количество классов в studentsByClass: ${Object.keys(studentsByClass).length}`);

        // 🔥 СОХРАНЯЕМ С ОТЛАДКОЙ
        const results = [];
        let savedCount = 0;

        for (const [classId, newStudents] of Object.entries(studentsByClass)) {
            console.log(`🔍 Проверка класса с ID: ${classId}, учеников: ${newStudents.length}`);

            if (newStudents.length === 0) {
                console.log(`⚠️ Класс ${classId} пропущен (0 учеников)`);
                continue;
            }

            // 🔥 ПРОВЕРЯЕМ, СУЩЕСТВУЕТ ЛИ КЛАСС В БД
            const classData = await prisma.class.findUnique({
                where: { id: classId }
            });

            if (!classData) {
                console.log(`❌ Класс с ID ${classId} НЕ НАЙДЕН в БД! Пропускаем.`);
                continue;
            }

            console.log(`💾 Обновление класса ${classData.name}: ${newStudents.length} учеников`);

            // Парсим существующих учеников
            let existingStudents: any[] = [];
            try {
                const studentsStr = classData.students || "[]";
                const parsed = JSON.parse(studentsStr);
                if (Array.isArray(parsed)) {
                    existingStudents = parsed;
                }
            } catch (e) {
                existingStudents = [];
            }

            const existingNames = existingStudents.map((s: any) => s.name || s);
            const maxId = existingStudents.reduce((max: number, s: any) => Math.max(max, s.id || 0), 0);

            // Объединяем
            const allNames = [...existingNames];
            for (const student of newStudents) {
                if (!allNames.includes(student)) {
                    allNames.push(student);
                }
            }

            const allStudents = allNames.map((name, index) => ({
                id: maxId + index + 1,
                name: name
            }));

            const studentsJson = JSON.stringify(allStudents);

            await prisma.class.update({
                where: { id: classId },
                data: { students: studentsJson }
            });

            results.push({
                classId,
                className: classData.name,
                added: newStudents.length,
                total: allStudents.length
            });

            savedCount++;
            console.log(`✅ ${classData.name}: +${newStudents.length} (всего ${allStudents.length})`);
        }

        console.log(`📊 ИТОГО: ${savedCount} классов обновлено, ${results.length} результатов`);

        return NextResponse.json({
            success: true,
            imported: importedCount,
            skipped: skippedCount,
            errors: errors.slice(0, 30),
            notFoundClasses: notFoundClasses,
            results: results,
            message: `Импортировано ${importedCount} учеников в ${results.length} классов, пропущено ${skippedCount}`
        });

    } catch (error) {
        console.error("❌ Ошибка импорта:", error);
        return NextResponse.json(
            { error: "Ошибка при импорте: " + String(error) },
            { status: 500 }
        );
    }
}
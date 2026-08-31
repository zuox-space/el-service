import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
    req: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        // Собираем путь к файлу из параметров запроса
        const filePath = path.join(process.cwd(), "uploads", ...params.path);

        // Проверяем существование файла
        await fs.access(filePath);

        // Читаем файл
        const fileBuffer = await fs.readFile(filePath);

        // Определяем MIME-тип по расширению
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Возвращаем файл
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000', // Кэшируем на год
            },
        });
    } catch (error) {
        return new NextResponse('File not found', { status: 404 });
    }
}
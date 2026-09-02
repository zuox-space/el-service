import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

export async function GET(
    req: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        // Проверяем, что path не пустой
        if (!params.path || params.path.length === 0) {
            return new NextResponse("Invalid path", { status: 400 });
        }

        // Формируем путь к файлу в корне сервера
        const filePath = path.join(os.homedir(), "uploads", ...params.path);

        // Логируем для отладки
        console.log("Requested file:", filePath);

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
            '.jfif': 'image/jpeg',
            '.pdf': 'application/pdf',
        };
        const mimeType = mimeTypes[ext] || 'application/octet-stream';

        // Возвращаем файл
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000',
            },
        });
    } catch (error) {
        console.error("File not found:", error);
        return new NextResponse("File not found", { status: 404 });
    }
}
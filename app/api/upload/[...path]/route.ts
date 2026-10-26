import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { requireAnySection } from "@/lib/access/server";

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join("/home", "kknayduk", "uploads"));

const MIME_TYPES: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".jfif": "image/jpeg",
    ".pdf": "application/pdf",
};

export async function GET(
    _req: NextRequest,
    { params }: { params: { path: string[] } },
) {
    // Заявления и фото — персональные данные: без сессии и раздела не отдаём.
    const guard = await requireAnySection(["myClass", "students", "dashboard"]);
    if (!guard.ok) return guard.response;

    if (!params.path || params.path.length === 0) {
        return new NextResponse("Invalid path", { status: 400 });
    }

    try {
        // Защита от ../: итоговый путь обязан остаться внутри UPLOAD_ROOT.
        const filePath = path.resolve(UPLOAD_ROOT, ...params.path);
        if (!filePath.startsWith(UPLOAD_ROOT + path.sep)) {
            return new NextResponse("Invalid path", { status: 400 });
        }

        const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()];
        if (!mimeType) {
            return new NextResponse("Unsupported file", { status: 415 });
        }

        const fileBuffer = await fs.readFile(filePath);

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": mimeType,
                "Content-Disposition": "inline",
                "Cache-Control": "private, max-age=3600",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return new NextResponse("File not found", { status: 404 });
    }
}

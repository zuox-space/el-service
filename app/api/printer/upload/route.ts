import { NextRequest, NextResponse } from "next/server";
import { getSessionAccess } from "@/lib/access/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
    "pdf",
    "png",
    "jpg",
    "jpeg",
    "doc",
    "docx",
    "txt",
    "gif",
    "webp",
]);

function extensionOf(name: string): string {
    return name.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Прокси загрузки в локальную службу droper1298.
 *
 * Браузер сотрудника не знает адрес принтерной службы: он остаётся в env
 * PRINTER_URL на сервере приложения. Доступ к прокси — только с сессией.
 */
export async function POST(request: NextRequest) {
    const access = await getSessionAccess();
    if (!access) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const printerUrl = (process.env.PRINTER_URL || "").trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(printerUrl)) {
        return NextResponse.json(
            { error: "Принтер не настроен: задайте PRINTER_URL" },
            { status: 503 },
        );
    }

    let incoming: FormData;
    try {
        incoming = await request.formData();
    } catch {
        return NextResponse.json({ error: "Не удалось прочитать файлы" }, { status: 400 });
    }

    const files = incoming
        .getAll("files")
        .filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length === 0) {
        return NextResponse.json({ error: "Файлы не выбраны" }, { status: 400 });
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json(
            { error: "Суммарный размер файлов больше 100 МБ" },
            { status: 413 },
        );
    }

    const unsupported = files
        .map(file => file.name)
        .filter(name => !ALLOWED_EXTENSIONS.has(extensionOf(name)));
    if (unsupported.length > 0) {
        return NextResponse.json(
            { error: `Неподдерживаемые файлы: ${unsupported.join(", ")}` },
            { status: 400 },
        );
    }

    const outgoing = new FormData();
    for (const file of files) {
        outgoing.append("files", file, file.name);
    }

    try {
        const response = await fetch(`${printerUrl}/api/upload`, {
            method: "POST",
            body: outgoing,
            cache: "no-store",
            signal: AbortSignal.timeout(120_000),
        });
        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== "object") {
            return NextResponse.json(
                { error: "Принтер вернул некорректный ответ" },
                { status: 502 },
            );
        }
        return NextResponse.json(payload, { status: response.status });
    } catch (error) {
        console.error("Printer upload failed:", error);
        return NextResponse.json(
            { error: "Принтер недоступен. Проверьте, что служба запущена" },
            { status: 502 },
        );
    }
}

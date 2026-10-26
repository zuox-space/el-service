export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";

import { requireSection } from "@/lib/access/server";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join("/home", "kknayduk", "uploads");

// Расширение берём из MIME, а не из имени файла: так нельзя загрузить
// HTML/SVG с активным содержимым под видом картинки.
const ALLOWED_FILE_TYPES = new Map<string, string>([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
    ["application/pdf", "pdf"],
]);

function hasAllowedSignature(buffer: Buffer, type: string): boolean {
    if (type === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (type === "image/gif") {
        const header = buffer.subarray(0, 6).toString("ascii");
        return header === "GIF87a" || header === "GIF89a";
    }
    if (type === "image/webp") {
        return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF"
            && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    }
    if (type === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    return false;
}



export async function POST(req: NextRequest) {

    const accessGuard = await requireSection("myClass");
    if (!accessGuard.ok) return accessGuard.response;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = consumeRateLimit(`upload:${accessGuard.access.userId}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Слишком много загрузок. Попробуйте через минуту." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const extension = ALLOWED_FILE_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        { error: "Можно загрузить только JPG, PNG, WEBP, GIF или PDF" },
        { status: 415 },
      );
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Файл должен быть не больше 10 МБ" },
        { status: 413 },
      );
    }

    const uploadDir = path.join(UPLOAD_ROOT, "self-exit");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!hasAllowedSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: "Содержимое файла не соответствует формату" },
        { status: 415 },
      );
    }

    const filename = `${Date.now()}_${randomUUID()}.${extension}`;
    const filePath = path.resolve(uploadDir, filename);
    const safeDir = path.resolve(uploadDir) + path.sep;

    if (!filePath.startsWith(safeDir)) {
      return NextResponse.json({ error: "Некорректный путь файла" }, { status: 400 });
    }

    await writeFile(filePath, buffer);

    return NextResponse.json({ photoUrl: `/api/upload/self-exit/${filename}` });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // ✅ ДЛЯ STANDALONE - СОХРАНЯЕМ В /home/kknayduk/uploads/
    const uploadDir = path.join("/home", "kknayduk", "uploads", "self-exit");
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const ext = file.name.split(".").pop();
    const filename = `${timestamp}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    await writeFile(filePath, buffer);

    // ✅ URL ДЛЯ СТАТИЧЕСКОГО ДОСТУПА
    const photoUrl = `/uploads/self-exit/${filename}`;
    console.log("📁 File saved to:", filePath);
    console.log("🔗 File URL:", photoUrl);

    return NextResponse.json({ photoUrl });
  } catch (error) {
    console.error("❌ Upload error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
// app/api/admin/sync/teachers/route.ts
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { spawn } from "node:child_process";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireSection } from "@/lib/access/server";

/**
 * Синхронизация сотрудников из админки.
 *
 * Запускает тот же скрипт, что и из консоли (`scripts/sync-teachers.mjs`):
 *  • mode = "dry-run" — только показать, что изменится;
 *  • mode = "apply" — применить изменения (создать/обновить/архивировать).
 *
 * Отчёт последнего запуска сохраняем в temp — страница показывает его при открытии.
 */

const REPORT_PATH = join(tmpdir(), "el-service-sync-report.json");
const SCRIPT = join(process.cwd(), "scripts", "sync-teachers.mjs");
const LAST_RUN_PATH = join(tmpdir(), "el-service-sync-last.json");
const LOG_PATH = join(tmpdir(), "el-service-sync.log");

interface SyncReport {
    startedAt?: string;
    finishedAt?: string;
    mode?: string;
    source?: string;
    scanned?: number;
    created?: number;
    updated?: number;
    archived?: number;
    restored?: number;
    skipped?: { invalid?: number; security?: number; manual?: number; emailTaken?: number };
    classes?: { created?: number; assigned?: number; reassigned?: number; released?: number; conflicts?: number };
    roles?: { added?: number; removed?: number };
    errors?: string[];
    warnings?: string[];
    details?: Array<{ kind: string; message: string; userId?: string; classId?: string }>;
}

async function readJson<T>(path: string): Promise<T | null> {
    try {
        return JSON.parse(await readFile(path, "utf8")) as T;
    } catch {
        return null;
    }
}

/** Источник можно переопределить только файлом из scripts/fixtures (для тестов). */
async function resolveSource(raw: unknown): Promise<string | null> {
    if (typeof raw !== "string") return null;

    // Принимаем только имя файла из scripts/fixtures — никаких путей снаружи
    const name = raw.trim();
    if (!/^[A-Za-z0-9._-]+\.json$/.test(name)) return null;

    const fixturesDir = join(process.cwd(), "scripts", "fixtures");
    const candidate = join(fixturesDir, name);

    if (relative(fixturesDir, candidate).startsWith("..")) return null;

    try {
        const info = await stat(candidate);
        return info.isFile() ? candidate : null;
    } catch {
        return null;
    }
}

function runScript(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        // Пишем stdout/stderr в файл, а не в pipe: в песочнице pipe может быть
        // недоступен, но диагностика не должна теряться.
        writeFileSync(LOG_PATH, "", "utf8");
        const logFd = openSync(LOG_PATH, "a");

        const child = spawn(process.execPath, args, {
            cwd: process.cwd(),
            stdio: ["ignore", logFd, logFd],
            env: process.env,
        });

        const closeLog = () => {
            try {
                closeSync(logFd);
            } catch {
                // уже закрыт
            }
        };

        const timer = setTimeout(() => {
            child.kill();
            closeLog();
            reject(new Error("Синхронизация заняла слишком много времени"));
        }, 110_000);

        child.on("error", error => {
            clearTimeout(timer);
            closeLog();
            reject(error);
        });

        child.on("exit", code => {
            clearTimeout(timer);
            closeLog();
            if (code === 0) resolve();
            else reject(new Error(`Скрипт синхронизации завершился с кодом ${code}`));
        });
    });
}

function logTail(maxLength = 4000): string {
    try {
        const text = readFileSync(LOG_PATH, "utf8");
        return text.length > maxLength ? `…${text.slice(-maxLength)}` : text;
    } catch {
        return "";
    }
}

export async function GET() {
    const guard = await requireSection("users");
    if (!guard.ok) return guard.response;

    const last = await readJson<SyncReport>(LAST_RUN_PATH);
    return NextResponse.json({ success: true, last });
}

export async function POST(request: NextRequest) {
    const guard = await requireSection("users");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const apply = body?.mode === "apply";

    const customSource = await resolveSource(body?.source);

    const args = [SCRIPT, "--report", REPORT_PATH, "--verbose"];
    if (apply) args.push("--apply");
    if (customSource) args.push("--source", customSource);

    try {
        await runScript(args);
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Не удалось выполнить синхронизацию",
                hint: "Хвост лога синхронизации",
                log: logTail(),
                logPath: LOG_PATH,
            },
            { status: 500 },
        );
    }

    const report = await readJson<SyncReport>(REPORT_PATH);
    if (!report) {
        return NextResponse.json({ error: "Скрипт не оставил отчёт" }, { status: 500 });
    }

    const summary = { ...report, finishedAt: report.finishedAt ?? new Date().toISOString(), mode: apply ? "apply" : "dry-run" };
    await writeLast(summary);
    await rm(REPORT_PATH, { force: true });

    return NextResponse.json({ success: true, report: summary });
}

async function writeLast(report: SyncReport): Promise<void> {
    try {
        await writeFile(LAST_RUN_PATH, JSON.stringify(report, null, 2), "utf8");
    } catch {
        // некритично: отчёт просто не сохранится между запросами
    }
}

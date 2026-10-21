// Портативные локальные БД для разработки.
//
// Зачем: на машине нет своего PostgreSQL/MySQL (единственный PostgreSQL — встроенная база
// КОМПАС-3D, её трогать нельзя), прав администратора тоже нет. Поэтому поднимаем переносимые
// бинарники в отдельной папке, без установки в систему и без служб.
//
// ⚠️ Важно для Windows: путь проекта содержит кириллицу («OneDrive\Документы»), на которой
// PostgreSQL падает. Поэтому каталоги данных адресуются через короткое 8.3-имя (shortPathOf),
// дочерние процессы запускаются из ASCII-каталога бинарников, а PGDATA вычищается из окружения
// (в системе она указывает на встроенную базу КОМПАС-3D).
//
// Запуск: node scripts/devdb.mjs <команда>
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, rmSync, cpSync } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';

export const PROJECT = process.cwd();
export const DEVDB = path.join(PROJECT, 'devdb');
export const DOWNLOADS = path.join(DEVDB, 'downloads');

/**
 * Каталог данных в ASCII-виде.
 *
 * ⚠️ Путь проекта содержит кириллицу («OneDrive\Документы»), а PostgreSQL на Windows на таком
 * пути падает с «invalid byte sequence for encoding "UTF8"». Поэтому используются каталоги,
 * адресованные через короткое 8.3-имя: C:\Users\kiryx\OneDrive\7496~1\DEEPSE~1\...
 *
 * Короткое имя определяется один раз командой `node scripts/devdb.mjs bootstrap`
 * (запускать с расширенными правами, если песочница запрещает запуск процессов) и
 * сохраняется в devdb/.ascii-root. Если проект перенесли — удалите этот файл и повторите.
 */
const ASCII_ROOT_FILE = path.join(DEVDB, '.ascii-root');

function resolveAsciiRoot() {
    const override = process.env.EL_LOCALDB_DIR;
    if (override) return override;
    if (/^[\x20-\x7E]*$/.test(PROJECT)) return PROJECT; // путь и так ASCII

    const fallback = path.join(DEVDB, 'data');
    try {
        const recorded = readFileSync(ASCII_ROOT_FILE, 'utf8').trim();
        if (recorded && /^[\x20-\x7E]+$/.test(recorded)) {
            if (existsSync(recorded) || existsSync(path.dirname(recorded))) return recorded;
        }
    } catch { /* файла нет — ниже подскажем, что делать */ }

    console.warn(
        '[warn] ASCII-путь для данных БД не настроен.\n' +
        '       PostgreSQL не работает на путях с кириллицей, поэтому выполните один раз:\n' +
        '         node scripts/devdb.mjs bootstrap\n' +
        '       (при необходимости — с правами, разрешающими запуск процессов)'
    );
    return fallback;
}

export const ASCII_ROOT = resolveAsciiRoot();
export const PG_DATA = path.join(ASCII_ROOT, 'pgdata');
export const MY_DATA = path.join(ASCII_ROOT, 'mysqldata');
export const LOGS = path.join(DEVDB, 'logs');
export { ASCII_ROOT_FILE };

export const PG_BIN_SRC = path.join(DEVDB, 'postgres', 'package', 'native', 'bin');
export const MY_BIN_SRC = path.join(DEVDB, 'mariadb', 'mariadb-11.4.5-winx64', 'bin');

// ⚠️ Бинарники тоже копируются в ASCII-путь: PostgreSQL получает свой каталог в аргументах
// bootstrap-процесса и падает на кириллице в пути (даже если каталог данных в ASCII).
export const PG_PREFIX = path.join(ASCII_ROOT, 'pg');
export const MY_PREFIX = path.join(ASCII_ROOT, 'mariadb');
export const PG_BIN = path.join(PG_PREFIX, 'bin');
export const MY_BIN = path.join(MY_PREFIX, 'bin');

/** Скопировать переносимые бинарники в ASCII-каталог, если их там ещё нет. */
export function syncBinaries() {
    const pairs = [
        { src: path.dirname(PG_BIN_SRC), dest: PG_PREFIX, marker: path.join(PG_BIN, 'initdb.exe') },
        { src: path.dirname(MY_BIN_SRC), dest: MY_PREFIX, marker: path.join(MY_BIN, 'mysqld.exe') },
    ];

    for (const { src, dest, marker } of pairs) {
        if (existsSync(marker)) continue;
        if (!existsSync(src)) {
            throw new Error(`Не найдены исходные бинарники: ${src}. Сначала выполните extract`);
        }
        console.log(`[copy] ${src} → ${dest}`);
        mkdirSync(path.dirname(dest), { recursive: true });
        cpSync(src, dest, { recursive: true, force: true });
    }
}

export const PG_PORT = Number(process.env.EL_PG_PORT || 55432);
export const MY_PORT = Number(process.env.EL_MY_PORT || 33306);

export const PG_USER = 'postgres';
export const PG_PASSWORD = 'postgres';
export const PG_DB = 'el_service';
export const MY_DB = 'school_ais';
export const MY_PASSWORD = 'devpass';

export const PG_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DB}`;

export function log(msg) {
    console.log(msg);
}

export function ensureDirs() {
    for (const d of [DEVDB, DOWNLOADS, path.join(DEVDB, 'data'), LOGS, ASCII_ROOT]) {
        mkdirSync(d, { recursive: true });
    }
}

/** Запустить процесс и дождаться окончания. */
export function run(exe, args, opts = {}) {
    const res = spawnSync(exe, args, {
        stdio: opts.stdio ?? 'inherit',
        cwd: opts.cwd ?? PROJECT,
        env: { ...cleanEnv(), ...(opts.env ?? {}) },
    });
    if (res.error) throw res.error;
    return res.status ?? 0;
}

/**
 * Окружение без переменных, которые мешают локальным БД.
 *
 * ⚠️ На этой машине в системе задана PGDATA, указывающая на встроенную базу КОМПАС-3D
 * («C:\Program Files\ASCON\...\LocalBase\data»). initdb передаёт её дочернему процессу,
 * и тот падает с «invalid byte sequence for encoding "UTF8"» из-за кириллицы в пути.
 * Поэтому свои запуски делаем с вычищенной PGDATA (и PGUSER/PGPORT заодно).
 */
export function cleanEnv() {
    const env = { ...process.env };
    delete env.PGDATA;
    delete env.PGUSER;
    delete env.PGPASSWORD;
    delete env.PGPORT;
    delete env.PGHOST;
    delete env.PGDATABASE;
    return env;
}

/** Окружение для клиентов Postgres. */
export function pgEnv() {
    return { PGPASSWORD: PG_PASSWORD, PGCLIENTENCODING: 'UTF8' };
}

/**
 * Запустить процесс в фоне, не привязываясь к текущей консоли.
 * Логи пишут сами БД (pg_ctl --log, mysqld --log-error), поэтому stdio не перенаправляем:
 * потоки должны быть готовы до spawn, а файловый поток на момент вызова ещё не открыт.
 */
export function runDetached(exe, args, { env, cwd } = {}) {
    ensureDirs();
    const child = spawn(exe, args, {
        detached: true,
        stdio: 'ignore',
        cwd: cwd ?? PROJECT,
        env: { ...cleanEnv(), ...(env ?? {}) },
    });
    child.unref();
    return child.pid;
}

/** Скачать файл по списку зеркал (PowerShell на этой машине качать не может — используем fetch). */
export async function download(fileName, urls) {
    ensureDirs();
    const dest = path.join(DOWNLOADS, fileName);
    if (existsSync(dest)) {
        const info = await stat(dest);
        if (info.size > 100 * 1024) {
            log(`[skip] ${fileName}: уже скачан (${(info.size / 1048576).toFixed(1)} МБ)`);
            return dest;
        }
    }

    for (const url of urls) {
        const started = Date.now();
        try {
            log(`[get ] ${fileName} ← ${url}`);
            const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(1800000) });
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
            await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
            const info = await stat(dest);
            log(`[ok  ] ${(info.size / 1048576).toFixed(1)} МБ за ${((Date.now() - started) / 1000).toFixed(1)} с`);
            return dest;
        } catch (e) {
            log(`[fail] ${e.message}`);
            try { rmSync(dest, { force: true }); } catch { /* ignore */ }
        }
    }
    throw new Error(`Не удалось скачать ${fileName}`);
}

/** Подождать, пока TCP-порт начнёт принимать соединения. */
export async function waitForPort(port, { timeoutMs = 60000, intervalMs = 700 } = {}) {
    const net = await import('node:net');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ok = await new Promise(resolve => {
            const socket = net.connect({ host: '127.0.0.1', port });
            socket.once('connect', () => { socket.destroy(); resolve(true); });
            socket.once('error', () => { socket.destroy(); resolve(false); });
            socket.setTimeout(2000, () => { socket.destroy(); resolve(false); });
        });
        if (ok) return true;
        await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
}

export function readPid(file) {
    try {
        return Number(readFileSync(file, 'utf8').trim()) || null;
    } catch {
        return null;
    }
}

export function writePid(file, pid) {
    writeFileSync(file, String(pid));
}

export function projectRelative(p) {
    return path.relative(PROJECT, p).replace(/\\/g, '/');
}

export async function listFiles(dir) {
    try {
        return await readdir(dir);
    } catch {
        return [];
    }
}

export { os };

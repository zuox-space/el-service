// Единая точка управления локальными моковыми БД.
// Подробности — в scripts/devdb-lib.mjs и в devdb/README.md.
//
// Команды:
//   node scripts/devdb.mjs download   — скачать переносимые бинарники Postgres и MariaDB
//   node scripts/devdb.mjs extract    — распаковать их в devdb/
//   node scripts/devdb.mjs init       — создать кластеры и базы, применить схему Prisma
//   node scripts/devdb.mjs start      — запустить обе базы в фоне
//   node scripts/devdb.mjs stop       — остановить обе базы
//   node scripts/devdb.mjs status     — показать состояние
//   node scripts/devdb.mjs reset      — удалить данные и создать заново (ОСТОРОЖНО)
//   node scripts/devdb.mjs env        — напечатать готовые строки для .env.local
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
    PROJECT, DEVDB, DOWNLOADS, PG_DATA, MY_DATA, LOGS,
    PG_BIN, MY_BIN, PG_BIN_SRC, MY_BIN_SRC, PG_PREFIX, MY_PREFIX, ASCII_ROOT_FILE,
    PG_PORT, MY_PORT, PG_USER, PG_DB, MY_DB, PG_URL,
    log, ensureDirs, syncBinaries, run, runDetached, download, waitForPort,
    pgEnv, readPid, writePid,
} from './devdb-lib.mjs';

const PG_ARCHIVE = {
    file: 'pg.tgz',
    urls: [
        'https://registry.npmmirror.com/@embedded-postgres/windows-x64/-/windows-x64-18.4.0-beta.17.tgz',
        'https://registry.npmjs.org/@embedded-postgres/windows-x64/-/windows-x64-18.4.0-beta.17.tgz',
    ],
};
const MY_ARCHIVE = {
    file: 'mariadb.zip',
    urls: [
        'https://archive.mariadb.org/mariadb-11.4.5/winx64-packages/mariadb-11.4.5-winx64.zip',
        'https://archive.mariadb.org/mariadb-10.11.10/winx64-packages/mariadb-10.11.10-winx64.zip',
    ],
};

const PG_PID_FILE = path.join(DEVDB, 'pg.pid');
const MY_PID_FILE = path.join(DEVDB, 'mariadb.pid');

async function cmdDownload() {
    ensureDirs();
    await download(PG_ARCHIVE.file, PG_ARCHIVE.urls);
    await download(MY_ARCHIVE.file, MY_ARCHIVE.urls);
}

async function cmdExtract() {
    ensureDirs();

    const pgDir = path.join(DEVDB, 'postgres');
    if (existsSync(path.join(PG_BIN, 'initdb.exe'))) {
        log('[skip] PostgreSQL уже распакован');
    } else {
        mkdirSync(pgDir, { recursive: true });
        log('=== Распаковка PostgreSQL ===');
        run('tar', ['-xzf', path.join(DOWNLOADS, PG_ARCHIVE.file), '-C', pgDir]);
    }

    const myDir = path.join(DEVDB, 'mariadb');
    if (existsSync(MY_BIN)) {
        log('[skip] MariaDB уже распакована');
    } else {
        mkdirSync(myDir, { recursive: true });
        log('=== Распаковка MariaDB (может занять минуту) ===');
        // Expand-Archive — встроенный в Windows, прав администратора не требует
        run('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-Command',
            `Expand-Archive -LiteralPath '${path.join(DOWNLOADS, MY_ARCHIVE.file)}' -DestinationPath '${myDir}' -Force`,
        ]);
    }
}

function initPostgres() {
    if (existsSync(path.join(PG_DATA, 'PG_VERSION'))) {
        log('[skip] Кластер PostgreSQL уже инициализирован');
        return;
    }
    log(`=== initdb → ${PG_DATA} ===`);
    mkdirSync(PG_DATA, { recursive: true });
    const pwFile = path.join(DEVDB, 'pgpw.tmp');
    writeFileSync(pwFile, 'postgres');
    try {
        // ⚠️ Рабочий каталог — папка с бинарниками (ASCII): postgres наследует CWD дочернего
        // процесса, а путь проекта содержит кириллицу, на которой bootstrap-бэкенд падает.
        const code = run(path.join(PG_BIN, 'initdb.exe'), [
            `--pgdata=${PG_DATA}`,
            `--username=${PG_USER}`,
            `--pwfile=${pwFile}`,
            '--encoding=UTF8',
            '--locale=C',
            '--auth-local=trust',
            '--auth-host=scram-sha-256',
        ], { cwd: PG_BIN });
        if (code !== 0) throw new Error(`initdb завершился с кодом ${code}`);
    } finally {
        rmSync(pwFile, { force: true });
    }
}

function initMariaDB() {
    if (existsSync(path.join(MY_DATA, 'mysql'))) {
        log('[skip] Каталог данных MariaDB уже инициализирован');
        return;
    }
    log(`=== mariadb-install-db → ${MY_DATA} ===`);
    mkdirSync(MY_DATA, { recursive: true });
    const installDb = existsSync(path.join(MY_BIN, 'mariadb-install-db.exe'))
        ? path.join(MY_BIN, 'mariadb-install-db.exe')
        : path.join(MY_BIN, 'mysql_install_db.exe');
    const code = run(installDb, [`--datadir=${MY_DATA}`], { cwd: MY_BIN });
    if (code !== 0) throw new Error(`mariadb-install-db завершился с кодом ${code}`);
}

async function startPostgres() {
    if (await waitForPort(PG_PORT, { timeoutMs: 1500 })) {
        log(`[skip] PostgreSQL уже слушает порт ${PG_PORT}`);
        return;
    }
    log(`=== Запуск PostgreSQL на порту ${PG_PORT} ===`);
    const logFile = path.join(LOGS, 'postgres.log');
    const pid = runDetached(path.join(PG_BIN, 'pg_ctl.exe'), [
        `--pgdata=${PG_DATA}`,
        `--log=${logFile}`,
        '--options=-p ' + PG_PORT,
        'start',
    ], { cwd: PG_BIN });
    log(`  pg_ctl запущен (pid ${pid}), лог: ${logFile}`);

    const ready = await waitForPort(PG_PORT, { timeoutMs: 60000 });
    if (!ready) {
        log('  ❌ PostgreSQL не поднялся, смотрите лог');
        process.exitCode = 1;
        return;
    }
    log(`  ✅ PostgreSQL готов: 127.0.0.1:${PG_PORT}`);
}

async function startMariaDB() {
    if (await waitForPort(MY_PORT, { timeoutMs: 1500 })) {
        log(`[skip] MariaDB уже слушает порт ${MY_PORT}`);
        return;
    }
    log(`=== Запуск MariaDB на порту ${MY_PORT} ===`);
    const logFile = path.join(LOGS, 'mariadb.log');
    // Явный каталог временных файлов: InnoDB иначе берёт системный TEMP и падает
    // с «Unable to create temporary file; errno: 0».
    const tmpDir = path.join(MY_DATA, '..', 'mysqltmp');
    mkdirSync(tmpDir, { recursive: true });
    const pid = runDetached(path.join(MY_BIN, 'mysqld.exe'), [
        `--basedir=${MY_PREFIX}`,
        `--datadir=${MY_DATA}`,
        `--tmpdir=${tmpDir}`,
        `--port=${MY_PORT}`,
        `--log-error=${logFile}`,
        '--bind-address=127.0.0.1',
        '--skip-name-resolve',
        '--character-set-server=utf8mb4',
        '--collation-server=utf8mb4_unicode_ci',
    ], { cwd: MY_BIN });
    writePid(MY_PID_FILE, pid);
    log(`  mysqld запущен (pid ${pid}), лог: ${logFile}`);

    const ready = await waitForPort(MY_PORT, { timeoutMs: 120000 });
    if (!ready) {
        log('  ❌ MariaDB не поднялась, смотрите лог');
        process.exitCode = 1;
        return;
    }
    log(`  ✅ MariaDB готова: 127.0.0.1:${MY_PORT}`);
}

async function cmdStart() {
    ensureDirs();
    if (!existsSync(path.join(PG_BIN_SRC, 'pg_ctl.exe'))) throw new Error('PostgreSQL не распакован: выполните extract');
    if (!existsSync(MY_BIN_SRC)) throw new Error('MariaDB не распакована: выполните extract');
    syncBinaries();
    await startPostgres();
    await startMariaDB();
}

function cmdStop() {
    if (existsSync(path.join(PG_DATA, 'PG_VERSION'))) {
        log('=== Остановка PostgreSQL ===');
        const code = run(path.join(PG_BIN, 'pg_ctl.exe'), [`--pgdata=${PG_DATA}`, '--mode=fast', 'stop'], { cwd: PG_BIN });
        log(code === 0 ? '  ✅ остановлен' : '  ⚠️ возможно, уже был остановлен');
    }

    const pid = readPid(MY_PID_FILE);
    if (pid) {
        log(`=== Остановка MariaDB (pid ${pid}) ===`);
        const shutdown = existsSync(path.join(MY_BIN, 'mariadb-admin.exe'))
            ? path.join(MY_BIN, 'mariadb-admin.exe')
            : path.join(MY_BIN, 'mysqladmin.exe');
        run(shutdown, ['--host=127.0.0.1', `--port=${MY_PORT}`, '--user=root', 'shutdown']);
        try { process.kill(pid); } catch { /* уже мёртв */ }
        rmSync(MY_PID_FILE, { force: true });
        log('  ✅ остановлена');
    } else {
        log('MariaDB: pid-файл не найден, похоже она не запущена через этот скрипт');
    }
}

/** Применить схему Prisma и создать базы. */
function createDatabases() {
    log('=== Создание баз ===');
    const prismaBin = path.join(PROJECT, 'node_modules', 'prisma', 'build', 'index.js');

    // Создаём базу через Prisma (psql не нужен, и его вывод с кириллицей ломает консоль)
    const adminUrl = `postgresql://${PG_USER}:postgres@127.0.0.1:${PG_PORT}/postgres`;
    const createScript = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: ${JSON.stringify(adminUrl)} } } });
prisma.$executeRawUnsafe('CREATE DATABASE "${PG_DB}"').then(
  () => { console.log('  база ${PG_DB} создана'); return prisma.$disconnect(); },
  (e) => {
    if (String(e.message).includes('already exists')) { console.log('  база ${PG_DB} уже существует'); return prisma.$disconnect(); }
    console.error('  ошибка создания базы:', e.message);
    process.exitCode = 1;
    return prisma.$disconnect();
  }
);
`;
    const createCode = run(process.execPath, ['-e', createScript]);
    if (createCode !== 0) throw new Error('не удалось создать базу приложения');

    log('=== Применение схемы Prisma (prisma db push) ===');
    const code = run(process.execPath, [prismaBin, 'db', 'push', '--skip-generate', '--accept-data-loss'], {
        env: { DATABASE_URL: PG_URL },
    });
    if (code !== 0) throw new Error(`prisma db push завершился с ошибкой (код ${code})`);
    log('  ✅ схема применена');
}

async function cmdInit() {
    ensureDirs();
    syncBinaries();
    initPostgres();
    initMariaDB();
    await startPostgres();
    await startMariaDB();

    // Дать MariaDB пару секунд на инициализацию служебных таблиц
    await new Promise(r => setTimeout(r, 3000));

    log('=== Создание базы АИС в MariaDB ===');
    const mysqlClient = existsSync(path.join(MY_BIN, 'mariadb.exe'))
        ? path.join(MY_BIN, 'mariadb.exe')
        : path.join(MY_BIN, 'mysql.exe');
    run(mysqlClient, [
        '--host=127.0.0.1', `--port=${MY_PORT}`, '--user=root', '--default-character-set=utf8mb4',
        '-e', `CREATE DATABASE IF NOT EXISTS ${MY_DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    ]);

    createDatabases();

    log('');
    log('✅ Локальные БД готовы:');
    log(`   PostgreSQL (данные приложения): 127.0.0.1:${PG_PORT}, база ${PG_DB}`);
    log(`   MariaDB   (данные АИС, ученики): 127.0.0.1:${MY_PORT}, база ${MY_DB}`);
    log('');
    log('Дальше: node scripts/devdb-seed.mjs — наполнить тестовыми данными');
}

/**
 * Записать ASCII-путь для данных БД в devdb/.ascii-root.
 * Нужен один раз (или после переноса проекта): Postgres не работает на пути с кириллицей.
 */
async function cmdBootstrap() {
    ensureDirs();

    if (/^[\x20-\x7E]*$/.test(PROJECT)) {
        log(`Путь проекта уже ASCII, отдельная настройка не нужна: ${PROJECT}`);
        return;
    }

    const dataRoot = path.join(DEVDB, 'data');
    mkdirSync(dataRoot, { recursive: true });

    const script = [
        "$ErrorActionPreference='Stop'",
        `$path = '${dataRoot.replace(/'/g, "''")}'`,
        '(New-Object -ComObject Scripting.FileSystemObject).GetFolder($path).ShortPath',
    ].join('\n');
    const encoded = Buffer.from(script, 'utf16le').toString('base64');

    const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
        encoding: 'utf8',
        timeout: 30000,
    });
    const ascii = (res.stdout || '').trim();

    if (!ascii || !/^[\x20-\x7E]+$/.test(ascii)) {
        log('❌ Не удалось определить ASCII-путь.');
        log('   Проверьте, что каталог существует: ' + dataRoot);
        log('   Ошибка: ' + (res.error?.message || res.stderr || 'пустой ответ'));
        log('   Альтернатива: задайте путь вручную через переменную EL_LOCALDB_DIR');
        process.exitCode = 1;
        return;
    }

    writeFileSync(ASCII_ROOT_FILE, ascii);
    log(`✅ ASCII-путь для данных БД записан в ${ASCII_ROOT_FILE}`);
    log(`   ${ascii}`);
    log('   Если проект перенесёте — удалите этот файл и выполните bootstrap снова.');
}

async function cmdStatus() {
    const pgUp = await waitForPort(PG_PORT, { timeoutMs: 1200 });
    const myUp = await waitForPort(MY_PORT, { timeoutMs: 1200 });
    log(`PostgreSQL (127.0.0.1:${PG_PORT}): ${pgUp ? '✅ работает' : '❌ остановлен'}  данные: ${PG_DATA}`);
    log(`MariaDB    (127.0.0.1:${MY_PORT}): ${myUp ? '✅ работает' : '❌ остановлена'}  данные: ${MY_DATA}`);
    log(`Бинарники: ${PG_BIN}`);
    log(`           ${MY_BIN}`);
    log(`Логи: ${LOGS}`);
}

function cmdEnv() {
    log('# Вставьте в el-service/.env.local для работы с локальными моковыми БД');
    log('# (в рабочем окружении эти значения другие — не коммитить)');
    log(`DATABASE_URL="${PG_URL}"`);
    log('NEXTAUTH_SECRET="local-dev-secret-change-me"');
    log('NEXTAUTH_URL="http://localhost:3000"');
    log('YANDEX_CLIENT_ID="local-dev"');
    log('YANDEX_CLIENT_SECRET="local-dev"');
    log('DB_HOST="127.0.0.1"');
    log('DB_USER="root"');
    log('DB_PASSWORD=""');
    log(`DB_NAME="${MY_DB}"`);
    log(`DB_PORT="${MY_PORT}"`);
}

async function cmdReset() {
    log('⚠️  Удаляю локальные данные БД (проект и его код не затрагиваются)');
    cmdStop();
    await new Promise(r => setTimeout(r, 2000));
    for (const dir of [PG_DATA, MY_DATA]) {
        if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true });
            log(`  удалено: ${dir}`);
        }
    }
    log('Готово. Запустите init заново.');
}

const commands = {
    bootstrap: cmdBootstrap,
    download: cmdDownload,
    extract: cmdExtract,
    init: cmdInit,
    start: async () => { await startPostgres(); await startMariaDB(); },
    stop: async () => cmdStop(),
    status: cmdStatus,
    reset: cmdReset,
    env: async () => cmdEnv(),
    dbs: async () => createDatabases(),
};

const cmd = process.argv[2];
if (!cmd || !commands[cmd]) {
    log('Команды: bootstrap | download | extract | init | start | stop | status | reset | env | dbs');
    process.exit(cmd ? 1 : 0);
}
await commands[cmd]();

#!/usr/bin/env node
// scripts/db-preflight.mjs
//
// Проверка базы перед синхронизацией сотрудников. Ничего не пишет.
//
//   DATABASE_URL="postgresql://..." node scripts/db-preflight.mjs
//   node scripts/db-preflight.mjs --database-url "postgresql://..." --source ./fixtures/teachers.json
//
// Показывает: применена ли миграция, есть ли дубли классов, сколько сотрудников
// совпадёт с источником, кого придётся создать, у кого класс за ручным/охраной.
// Работает через «сырой» SQL, поэтому подходит и для базы со старой схемой.

import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const argValue = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};

const databaseUrl = argValue("--database-url") ?? process.env.DATABASE_URL;
const source = argValue("--source") ?? "https://school1298.ru/portal/workers/workersPS-no.json";

if (!databaseUrl) {
    console.error("Нужен DATABASE_URL или --database-url");
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const report = { problems: [], warnings: [], recommendations: [] };

function line(title) {
    console.log(`\n${title}`);
}

async function main() {
    line("=== Проверка базы перед синхронизацией ===");

    const [db] = await prisma.$queryRawUnsafe(`SELECT current_database() AS name, version() AS version`);
    console.log(`База: ${db.name}`);
    console.log(`Сервер: ${String(db.version).split(" ").slice(0, 2).join(" ")}`);

    const columns = await prisma.$queryRawUnsafe(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN ('User', 'Class')
    `);
    const userColumns = new Set(columns.filter(row => row.table_name === "User").map(row => row.column_name));
    const classColumns = new Set(columns.filter(row => row.table_name === "Class").map(row => row.column_name));

    line("Миграция схемы");
    const has = (label, condition) => {
        console.log(`${condition ? "✅" : "❌"} ${label}`);
        if (!condition) report.problems.push(label);
        return condition;
    };

    const migrationReady = [
        has("User.externalId", userColumns.has("externalId")),
        has("User.syncEnabled", userColumns.has("syncEnabled")),
        has("User.archived", userColumns.has("archived")),
        has("User.archivedAt", userColumns.has("archivedAt")),
        has("Class.ownerId допускает NULL", await isNullable("Class", "ownerId")),
    ].every(Boolean);

    if (!migrationReady) {
        report.recommendations.push(
            "Выполнить часть 1 миграции: scripts/sql/teachers-sync-migration.sql (колонки и nullable ownerId)",
        );
    }

    line("Данные");
    const users = await count(`SELECT COUNT(*)::int AS value FROM "User"`);
    const classes = await count(`SELECT COUNT(*)::int AS value FROM "Class"`);
    const violations = await count(`SELECT COUNT(*)::int AS value FROM "Violation"`);
    console.log(`Пользователей: ${users}, классов: ${classes}, нарушений: ${violations}`);

    if (userColumns.has("archived")) {
        const archived = await count(`SELECT COUNT(*)::int AS value FROM "User" WHERE archived = true`);
        const syncEnabled = await count(`SELECT COUNT(*)::int AS value FROM "User" WHERE "syncEnabled" = true`);
        console.log(`В архиве: ${archived}, с включённой синхронизацией: ${syncEnabled}`);
    }

    const roleRows = await prisma.$queryRawUnsafe(`
        SELECT r.name, COUNT(ur.id)::int AS value
        FROM "Role" r LEFT JOIN "UserRole" ur ON ur."roleId" = r.id
        GROUP BY r.name ORDER BY r.name
    `);
    console.log(`Роли: ${roleRows.map(row => `${row.name} (${row.value})`).join(", ") || "нет"}`);

    line("Классы");
    const hyphen = await count(`SELECT COUNT(*)::int AS value FROM "Class" WHERE name LIKE '%-%'`);
    const dupClasses = await prisma.$queryRawUnsafe(`
        SELECT UPPER(REPLACE(REPLACE(name, '-', ''), ' ', '')) AS normalized,
               ARRAY_AGG(name) AS names
        FROM "Class"
        GROUP BY normalized
        HAVING COUNT(*) > 1
    `);

    console.log(`${hyphen === 0 ? "✅" : "⚠️"} классов с дефисом: ${hyphen}`);
    console.log(`${dupClasses.length === 0 ? "✅" : "❌"} классов-двойников после нормализации: ${dupClasses.length}`);
    for (const row of dupClasses.slice(0, 10)) console.log(`   ${row.normalized}: ${row.names.join(", ")}`);

    if (hyphen > 0 || dupClasses.length > 0) {
        report.recommendations.push("Запустить normalize-class-names.mjs (сначала без --apply, затем с ним)");
    }

    if (userColumns.has("syncEnabled")) {
        const owners = await prisma.$queryRawUnsafe(`
            SELECT c.name AS class_name, u.name AS owner_name, u."syncEnabled" AS sync_enabled,
                   EXISTS (
                       SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                       WHERE ur."userId" = u.id AND r.name = 'SECURITY'
                   ) AS is_security
            FROM "Class" c JOIN "User" u ON u.id = c."ownerId"
            ORDER BY c.name
        `);
        const manual = owners.filter(row => !row.sync_enabled && !row.is_security);
        const security = owners.filter(row => row.is_security);
        console.log(`Классов за ручными сотрудниками: ${manual.length}, за охраной: ${security.length}`);
        if (security.length > 0) {
            console.log(`   охрана: ${security.map(row => row.class_name).join(", ")}`);
        }
        if (manual.length > 0) {
            console.log(`   ручные: ${manual.slice(0, 8).map(row => `${row.class_name} (${row.owner_name})`).join(", ")}${manual.length > 8 ? "…" : ""}`);
            report.warnings.push(
                "Классы ручных сотрудников при синхронизации перейдут к учителям из источника; профили ручных не изменятся",
            );
        }
    }

    line("Сверка с источником");
    let sourceRows = [];
    try {
        const response = await fetch(source, { signal: AbortSignal.timeout(45_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        sourceRows = Array.isArray(payload) ? payload : payload?.value ?? [];
        console.log(`Записей в источнике: ${sourceRows.length}`);
    } catch (error) {
        console.log(`⚠️ Источник недоступен: ${error.message}`);
        report.warnings.push("Источник не загрузился — сверку пропустили. Проверьте сеть/сертификат (NODE_TLS_REJECT_UNAUTHORIZED=0)");
    }

    if (sourceRows.length > 0) {
        const dbUsers = await prisma.$queryRawUnsafe(`SELECT LOWER(email) AS email FROM "User"`);
        const dbEmails = new Set(dbUsers.map(row => row.email));
        const sourceEmails = new Set();

        let valid = 0;
        let newUsers = 0;
        let matched = 0;

        for (const row of sourceRows) {
            const email = String(row.email ?? "").trim().toLowerCase();
            if (!email || email === "нет" || !email.includes("@")) continue;

            valid++;
            if (sourceEmails.has(email)) continue;
            sourceEmails.add(email);

            if (dbEmails.has(email)) matched++;
            else newUsers++;
        }

        console.log(`С валидным email: ${valid}, совпало с базой: ${matched}, будет создано: ${newUsers}`);
        if (newUsers > 0) {
            report.recommendations.push(
                `Первый запуск делать с --adopt: ${newUsers} записей может создать дубли, если email в базе отличаются`,
            );
        }
        report.warnings.push(
            "Если вы ожидали больше совпадений — сверьте email в базе и источнике: старый импорт мог записать другие адреса",
        );
    }

    line("Что дальше");
    if (report.problems.length > 0) {
        console.log("Проблемы:");
        for (const item of report.problems) console.log(`  • ${item}`);
    } else {
        console.log("✅ Схема готова к синхронизации");
    }
    for (const item of [...new Set(report.recommendations)]) console.log(`  → ${item}`);
    for (const item of report.warnings) console.log(`  ⚠️ ${item}`);

    console.log("\nПроверка ничего не изменила в базе.");
}

async function count(sql) {
    const [row] = await prisma.$queryRawUnsafe(sql);
    return Number(row?.value ?? 0);
}

async function isNullable(table, column) {
    const [row] = await prisma.$queryRawUnsafe(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
        table,
        column,
    );
    return row?.is_nullable === "YES";
}

main()
    .then(() => prisma.$disconnect())
    .catch(async error => {
        console.error("❌ Проверка не удалась:", error.message);
        await prisma.$disconnect();
        process.exit(1);
    });

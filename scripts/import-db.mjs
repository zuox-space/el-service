#!/usr/bin/env node
// scripts/import-db.mjs
//
// Заливает JSON-дамп (export-db.mjs) в пустую базу. Схема должна уже быть:
//   npx prisma db push --skip-generate
//   node scripts/import-db.mjs --database-url "..." --in deploy/dumps/db.json
//
// Порядок таблиц учитывает внешние ключи, повторный запуск безопасен.

import { readFileSync } from "node:fs";
import pg from "pg";

const args = process.argv.slice(2);
const value = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};

const databaseUrl = value("--database-url") ?? process.env.DATABASE_URL;
const input = value("--in");

if (!databaseUrl || !input) {
    console.error("Нужны --database-url и --in");
    process.exit(1);
}

const dump = JSON.parse(readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

for (const [table, rows] of Object.entries(dump.tables)) {
    if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`${table}: 0`);
        continue;
    }

    const columns = Object.keys(rows[0]);
    const quoted = columns.map(column => `"${column}"`).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const sql = `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    for (const row of rows) {
        await client.query(sql, columns.map(column => row[column]));
    }
    console.log(`${table}: ${rows.length}`);
}

await client.end();
console.log("\nимпорт завершён");

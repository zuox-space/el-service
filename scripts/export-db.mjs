#!/usr/bin/env node
// scripts/export-db.mjs
//
// Логический дамп базы приложения в JSON (для переноса на другую базу).
// Схему создаёт prisma db push на целевой базе, данные заливает import-db.mjs.
//
//   node scripts/export-db.mjs --database-url "postgresql://..." --out deploy/dumps/db.json

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const value = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
};

const databaseUrl = value("--database-url") ?? process.env.DATABASE_URL;
const out = value("--out") ?? `deploy/dumps/db-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;

if (!databaseUrl) {
    console.error("Нужен --database-url или DATABASE_URL");
    process.exit(1);
}

const TABLES = [
    "Role",
    "User",
    "UserRole",
    "Class",
    "ClassShare",
    "Attendance",
    "Pass",
    "SelfExit",
    "Note",
    "News",
    "Violation",
    "SchoolRecord",
    "Authorization",
    "UnauthorizedLeave",
];

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const dump = { createdAt: new Date().toISOString(), tables: {} };

for (const table of TABLES) {
    const rows = (await client.query(`SELECT * FROM "${table}"`)).rows;
    dump.tables[table] = rows;
    console.log(`${table}: ${rows.length}`);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(dump, (key, val) => (val instanceof Date ? val.toISOString() : val), 2));
console.log(`\nдамп: ${out}`);

await client.end();

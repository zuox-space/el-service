#!/usr/bin/env node
// scripts/add-role.mjs
//
// Добавляет (или обновляет описание) роль в БД.
//
//   node scripts/add-role.mjs METHODIST "Методист: отчёты и аналитика"
//   node scripts/add-role.mjs --list
//
// Скрипт только создаёт роль. Чтобы у неё были доступы по умолчанию,
// нужно добавить её имя в defaultRoles нужных разделов в
// lib/access/registry.ts — скрипт печатает напоминание со списком файлов.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadDatabaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

    try {
        const env = readFileSync(".env.local", "utf8");
        const match = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(env);
        if (match) return match[1].trim();
    } catch {
        // .env.local может отсутствовать — тогда нужен DATABASE_URL в окружении
    }

    console.error("Не найден DATABASE_URL (ни в окружении, ни в .env.local)");
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: loadDatabaseUrl() } } });

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log("Использование:");
    console.log('  node scripts/add-role.mjs <NAME> ["Описание"]');
    console.log("  node scripts/add-role.mjs --list");
    console.log("");
    console.log("Пример: node scripts/add-role.mjs HEAD_TEACHER \"Завуч: дисциплина и отчёты\"");
    process.exit(0);
}

if (args[0] === "--list") {
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
    console.log(`Ролей в базе: ${roles.length}`);
    for (const role of roles) console.log(`  ${role.name} — ${role.description ?? "без описания"}`);
    await prisma.$disconnect();
    process.exit(0);
}

const name = args[0].trim().toUpperCase().replace(/\s+/g, "_");
const description = args[1]?.trim() || null;

if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
    console.error(`Некорректное имя роли: "${name}". Используйте латиницу в верхнем регистре, например METHODIST.`);
    process.exit(1);
}

const role = await prisma.role.upsert({
    where: { name },
    update: description ? { description } : {},
    create: { name, description },
});

console.log(`✅ Роль «${role.name}» ${role.description ? `— ${role.description}` : "создана"}`);
console.log("");
console.log("Что сделать дальше, чтобы у роли были доступы по умолчанию:");
console.log("  1. lib/access/registry.ts — добавьте имя роли в defaultRoles нужных разделов:");
console.log(`       defaultRoles: ["ADMIN", "${role.name}"]`);
console.log("  2. app/admin/users/page.tsx — подпись и цвет в ROLE_META:");
console.log(`       ${role.name}: { label: "Название роли", tone: "info" },`);
console.log("  3. Перезапустите приложение. Роли в сессии обновляются из БД");
console.log("     автоматически, повторный вход сотруднику не нужен.");
console.log("");
console.log("Выдать роль сотруднику: /admin/users → сотрудник → «Роли и права».");

await prisma.$disconnect();

#!/usr/bin/env node
// scripts/keys-role-access.mjs
//
// Разовое включение раздела «Ключи» в роли, у которых defaultSections уже
// настроены вручную. Если список роли пуст, раздел приходит из реестра
// (lib/access/registry.ts) и ничего делать не нужно.
//
//   node scripts/keys-role-access.mjs          # проверка
//   node scripts/keys-role-access.mjs --apply  # запись

import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

const roles = await prisma.role.findMany({ select: { id: true, name: true, defaultSections: true } });
let changed = 0;

for (const role of roles) {
    if (role.name === "ADMIN") continue;
    if (role.defaultSections.length === 0) {
        console.log(`${role.name}: пусто — «Ключи» придут из реестра`);
        continue;
    }
    if (role.defaultSections.includes("keys")) {
        console.log(`${role.name}: уже есть`);
        continue;
    }

    changed++;
    console.log(`${role.name}: + keys`);
    if (apply) {
        await prisma.role.update({
            where: { id: role.id },
            data: { defaultSections: [...role.defaultSections, "keys"] },
        });
    }
}

console.log(`\n${apply ? "обновлено" : "будет обновлено"}: ${changed}`);
if (!apply) console.log("Для записи: --apply");

await prisma.$disconnect();

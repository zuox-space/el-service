#!/usr/bin/env node
// scripts/normalize-class-names.mjs
//
// Одноразовая (но безопасная к повтору) нормализация имён классов.
//
// В АИС классы встречаются как «5-А», так и «5А». В базе приложения используем
// один вид — без дефиса. Скрипт:
//   • переименовывает классы к каноническому виду;
//   • сливает дубли классов, перенося посещаемость, пропуска, ВШУ, заметки, новости;
//   • приводит className в нарушениях, ВШУ, доверенностях и самовыходах к тому же виду.
//
// По умолчанию — проверка без записи. Для применения: --apply.

import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const databaseUrlArg = args.indexOf("--database-url");
const databaseUrl = databaseUrlArg >= 0 ? args[databaseUrlArg + 1] : undefined;

const prisma = new PrismaClient(databaseUrls(databaseUrl));

function databaseUrls(url) {
    return url ? { datasources: { db: { url } } } : undefined;
}

function normalize(value) {
    return String(value ?? "")
        .replace(/[\s\u00A0]+/g, "")
        .replace(/[-–—]/g, "")
        .toUpperCase();
}

function parse(value) {
    const name = normalize(value);
    const match = name.match(/^(\d{1,2})([A-ZА-ЯЁ])$/u);
    if (!match) return null;

    const grade = Number(match[1]);
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) return null;

    return { name, grade, letter: match[2] };
}

const report = {
    mode: APPLY ? "apply" : "dry-run",
    classes: { renamed: 0, merged: 0, skipped: 0 },
    rows: { violations: 0, schoolRecords: 0, authorizations: 0, unauthorizedLeaves: 0 },
    warnings: [],
};

async function main() {
    console.log(`=== Нормализация имён классов (${APPLY ? "ЗАПИСЬ" : "проверка"}) ===\n`);

    const classes = await prisma.class.findMany({ orderBy: { name: "asc" } });
    const byName = new Map();

    for (const cls of classes) {
        const parsed = parse(cls.name);
        if (!parsed) {
            report.classes.skipped++;
            report.warnings.push(`Класс «${cls.name}» не распознан — оставлен как есть`);
            continue;
        }

        if (parsed.name !== cls.name) report.classes.renamed++;

        const group = byName.get(parsed.name) ?? [];
        group.push({ cls, parsed });
        byName.set(parsed.name, group);
    }

    for (const [name, group] of byName) {
        const [first, ...rest] = group;
        const keeper = group.find(item => item.cls.ownerId) ?? first;
        const duplicates = rest.filter(item => item.cls.id !== keeper.cls.id);

        // Сначала сливаем дубли в keeper, и только потом переименовываем:
        // иначе «5-А → 5А» упрётся в уникальный индекс, пока «5А» ещё существует.
        for (const duplicate of duplicates) {
            report.classes.merged++;
            console.log(`  слияние: ${duplicate.cls.name} → ${keeper.cls.name} (${name})`);

            if (APPLY) {
                const from = duplicate.cls.id;
                const to = keeper.cls.id;

                await prisma.attendance.updateMany({ where: { classId: from }, data: { classId: to } });
                await prisma.pass.updateMany({ where: { classId: from }, data: { classId: to } });
                await prisma.selfExit.updateMany({ where: { classId: from }, data: { classId: to } });
                await prisma.note.updateMany({ where: { classId: from }, data: { classId: to } });
                await prisma.news.updateMany({ where: { classId: from }, data: { classId: to } });

                // Шаринги: после переноса возможны дубли пары класс+учитель
                const shares = await prisma.classShare.findMany({ where: { classId: from } });
                for (const share of shares) {
                    const exists = await prisma.classShare.findUnique({
                        where: { classId_teacherId: { classId: to, teacherId: share.teacherId } },
                    });
                    if (exists) {
                        await prisma.classShare.delete({ where: { id: share.id } });
                    } else {
                        await prisma.classShare.update({ where: { id: share.id }, data: { classId: to } });
                    }
                }

                await prisma.class.delete({ where: { id: from } });
            }
        }

        if (keeper.cls.name !== name) {
            console.log(`  переименование: ${keeper.cls.name} → ${name}`);
            if (APPLY) {
                await prisma.class.update({
                    where: { id: keeper.cls.id },
                    data: { name, grade: keeper.parsed.grade, letter: keeper.parsed.letter },
                });
            }
        }
    }
    // Строковые className в связанных таблицах
    const tables = [
        ["Violation", report.rows.violations, prisma.violation, "violations"],
        ["SchoolRecord", report.rows.schoolRecords, prisma.schoolRecord, "schoolRecords"],
        ["Authorization", report.rows.authorizations, prisma.authorization, "authorizations"],
        ["UnauthorizedLeave", report.rows.unauthorizedLeaves, prisma.unauthorizedLeave, "unauthorizedLeaves"],
    ];

    for (const [label, counterHolder, model, key] of tables) {
        const rows = await model.findMany({ select: { id: true, className: true } });
        const changes = new Map();

        for (const row of rows) {
            if (!row.className) continue;
            const normalized = normalize(row.className);
            if (normalized && normalized !== row.className) {
                changes.set(row.className, normalized);
            }
        }

        for (const [from, to] of changes) {
            const count = rows.filter(row => row.className === from).length;
            report.rows[key] += count;
            console.log(`  ${label}: ${from} → ${to} (${count})`);
            if (APPLY) {
                await model.updateMany({ where: { className: from }, data: { className: to } });
            }
        }
    }

    console.log("\n" + "=".repeat(50));
    console.log(`  классов переименовано: ${report.classes.renamed}`);
    console.log(`  классов слито:         ${report.classes.merged}`);
    console.log(`  нарушений:             ${report.rows.violations}`);
    console.log(`  ВШУ:                   ${report.rows.schoolRecords}`);
    console.log(`  доверенностей:         ${report.rows.authorizations}`);
    console.log(`  самовыходов:           ${report.rows.unauthorizedLeaves}`);
    if (report.warnings.length) {
        console.log(`  предупреждения: ${report.warnings.length}`);
        for (const warning of report.warnings) console.log(`    ! ${warning}`);
    }
    console.log("=".repeat(50));
    if (!APPLY) console.log("Это проверка. Для записи: --apply");
}

main()
    .then(() => prisma.$disconnect())
    .catch(async error => {
        console.error("Ошибка нормализации:", error);
        await prisma.$disconnect();
        process.exit(1);
    });

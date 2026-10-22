#!/usr/bin/env node
// scripts/sync-teachers.test.mjs
//
// Тесты синхронизации сотрудников. Работают на отдельной схеме PostgreSQL,
// чтобы не трогать рабочие данные:
//
//   $env:DATABASE_URL = "...el_service?schema=sync_test"
//   node scripts/sync-teachers.test.mjs
//
// Скрипт сам очищает таблицы между сценариями и проверяет результат.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const here = dirname(fileURLToPath(import.meta.url));
const SYNC = join(here, "sync-teachers.mjs");
const FIXTURES = join(here, "fixtures");

const databaseUrl =
    process.env.SYNC_TEST_DATABASE_URL ??
    (process.env.DATABASE_URL?.includes("schema=") ? process.env.DATABASE_URL : null);

if (!databaseUrl) {
    console.error("Нужен SYNC_TEST_DATABASE_URL (или DATABASE_URL со ?schema=...)");
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

let passed = 0;
let failed = 0;

function check(name, condition, details = "") {
    if (condition) {
        passed++;
        console.log(`  ✅ ${name}`);
    } else {
        failed++;
        console.log(`  ❌ ${name}${details ? ` — ${String(details).slice(0, 240)}` : ""}`);
    }
}

async function reset() {
    await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE "SectionAccess", "UserRole", "ClassShare", "Pass", "Attendance",
            "News", "Note", "SelfExit", "UnauthorizedLeave", "Violation",
            "SchoolRecord", "Authorization", "Class", "User", "Role"
        RESTART IDENTITY CASCADE;
    `);
}

function runSync(fixture, options = {}) {
    const args = [
        SYNC,
        "--source", join(FIXTURES, fixture),
        "--database-url", databaseUrl,
        "--report", join(here, "fixtures", ".report.json"),
    ];

    if (options.apply !== false) args.push("--apply");
    for (const extra of options.args ?? []) args.push(extra);

    // stdio: inherit — единственный режим, доступный в песочнице (pipe даёт EPERM)
    const result = spawnSync(process.execPath, args, { stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`sync завершился с кодом ${result.status}`);

    const report = JSON.parse(readFileSync(join(here, "fixtures", ".report.json"), "utf8"));
    return { report };
}

async function userByEmail(email) {
    return prisma.user.findUnique({
        where: { email },
        include: { userRoles: { include: { role: true } }, ownedClasses: true },
    });
}

function roleNames(user) {
    return user.userRoles.map(item => item.role.name).sort();
}

async function classByName(name) {
    return prisma.class.findFirst({ where: { name }, include: { owner: true } });
}

async function main() {
    console.log("=== Тесты синхронизации сотрудников ===\n");

    /* ------------------------------ 1. Первый импорт ----------------------------- */
    console.log("1) Первый импорт: сотрудники, классы, роли");
    await reset();
    const first = runSync("teachers-initial.json");

    check("создано 4 пользователя (без записи без email)", first.report.created === 4, JSON.stringify(first.report.created));
    check("запись без email пропущена", first.report.skipped.invalid >= 1);

    const ivanova = await userByEmail("m.ivanova@school1298.ru");
    check("Иванова создана", Boolean(ivanova));
    check("у Ивановой EMPLOYEE + CLASS_TEACHER", JSON.stringify(roleNames(ivanova)) === JSON.stringify(["CLASS_TEACHER", "EMPLOYEE"]), roleNames(ivanova));

    const petrov = await userByEmail("s.petrov@school1298.ru");
    check("у Петрова только EMPLOYEE", JSON.stringify(roleNames(petrov)) === JSON.stringify(["EMPLOYEE"]), roleNames(petrov));

    const smirnova = await userByEmail("o.smirnova@school1298.ru");
    check("email приведён к нижнему регистру", Boolean(smirnova), "o.smirnova@school1298.ru");
    check("ФИО обрезано по краям", smirnova?.name === "Смирнова Ольга Викторовна", smirnova?.name);

    const class5 = await classByName("5А");
    check("класс 5-А создан как 5А с владельцем", class5?.owner?.email === "m.ivanova@school1298.ru", class5?.name);
    check("класса с дефисом нет", (await classByName("5-А")) === null);

    const class9b = await classByName("9Б");
    const class9v = await classByName("9В");
    check("два класса Смирновой", Boolean(class9b && class9v));

    const badClassUser = await userByEmail("bad.class@school1298.ru");
    check("некорректный класс не даёт CLASS_TEACHER", JSON.stringify(roleNames(badClassUser)) === JSON.stringify(["EMPLOYEE"]), roleNames(badClassUser));
    check("про некорректный класс есть предупреждение", first.report.warnings.some(item => item.includes("12-Х")));

    /* ------------------------------- 2. Идемпотентность ------------------------------ */
    console.log("\n2) Повторный запуск ничего не меняет");
    const second = runSync("teachers-initial.json");
    check("повторно не создаёт пользователей", second.report.created === 0, second.report.created);
    check("повторно не создаёт классы", second.report.classes.created === 0, second.report.classes.created);
    check("нет архивированных", second.report.archived === 0, second.report.archived);

    /* ------------------------- 3. Изменения ФИО, почты, классов ------------------------ */
    console.log("\n3) Изменения из источника: ФИО, email, классы, новый сотрудник");
    const third = runSync("teachers-updated.json");

    const renamed = await userByEmail("m.s.ivanova@school1298.ru");
    check("email Ивановой обновлён", Boolean(renamed));
    check("ФИО Ивановой обновлено", renamed?.name === "Иванова Мария Сергеевна", renamed?.name);

    const oldClass = await classByName("5А");
    check("старый класс 5А освобождён", oldClass?.ownerId === null, oldClass?.ownerId);

    const newClass = await classByName("6А");
    check("новый класс 6А за Ивановой", newClass?.owner?.email === "m.s.ivanova@school1298.ru");

    const petrovNow = await userByEmail("s.petrov@school1298.ru");
    check("Петров стал классным руководителем", roleNames(petrovNow).includes("CLASS_TEACHER"), roleNames(petrovNow));
    check("у Петрова класс 2А", (await classByName("2А"))?.owner?.email === "s.petrov@school1298.ru");

    const novikov = await userByEmail("i.novikov@school1298.ru");
    check("новый сотрудник создан", Boolean(novikov));
    check("у нового сотрудника EMPLOYEE + CLASS_TEACHER", JSON.stringify(roleNames(novikov)) === JSON.stringify(["CLASS_TEACHER", "EMPLOYEE"]), roleNames(novikov));
    check("у нового сотрудника класс 7Г", (await classByName("7Г"))?.owner?.email === "i.novikov@school1298.ru");
    check("3А создан для записи с исправленным классом", Boolean(await classByName("3А")));

    /* ---------------------------------- 4. Увольнение --------------------------------- */
    console.log("\n4) Сотрудник исчез из источника — архив, а не удаление");
    const fourth = runSync("teachers-missing.json");

    const archived = await userByEmail("o.smirnova@school1298.ru");
    check("Смирнова архивирована", archived?.archived === true, archived?.archived);
    check("дата архива заполнена", Boolean(archived?.archivedAt));
    check("аккаунт не удалён", Boolean(archived));
    check("CLASS_TEACHER снята, EMPLOYEE осталась", JSON.stringify(roleNames(archived)) === JSON.stringify(["EMPLOYEE"]), roleNames(archived));
    check("классы 9Б/9В освобождены", (await classByName("9Б"))?.ownerId === null && (await classByName("9В"))?.ownerId === null);
    check("отчёт: архивировано 2 (Смирнова и Новиков)", fourth.report.archived === 2, fourth.report.archived);

    const novikovGone = await userByEmail("i.novikov@school1298.ru");
    check("Новиков тоже в архиве", novikovGone?.archived === true);

    /* ----------------------------------- 5. Возврат ---------------------------------- */
    console.log("\n5) Сотрудник вернулся — восстановление и классы");
    const fifth = runSync("teachers-return.json");
    const back = await userByEmail("o.smirnova@school1298.ru");
    check("Смирнова восстановлена", back?.archived === false, back?.archived);
    check("дата архива очищена", back?.archivedAt === null);
    check("роль классного руководителя вернулась", roleNames(back).includes("CLASS_TEACHER"), roleNames(back));
    check("класс 9Б снова за ней", (await classByName("9Б"))?.owner?.email === "o.smirnova@school1298.ru");
    check("класс 9В освобождён (его больше нет в источнике)", (await classByName("9В"))?.ownerId === null);
    check("в отчёте есть восстановление", fifth.report.restored >= 1, fifth.report.restored);

    /* ------------------------------ 6. Охрана и ручные ------------------------------ */
    console.log("\n6) Охрана и сотрудники, созданные вручную, не трогаются");
    await reset();

    const securityRole = await prisma.role.create({ data: { name: "SECURITY", description: "Охрана" } });
    const guard = await prisma.user.create({
        data: {
            email: "guard@school1298.ru",
            name: "Охранник Исходный",
            externalId: "901",
            syncEnabled: true,
        },
    });
    await prisma.userRole.create({ data: { userId: guard.id, roleId: securityRole.id, assignedBy: "manual" } });

    const manual = await prisma.user.create({
        data: {
            email: "manual@school1298.ru",
            name: "Ручной Сотрудник",
            syncEnabled: false,
        },
    });

    const special = runSync("teachers-special.json");
    const guardAfter = await userByEmail("guard@school1298.ru");
    check("ФИО охраны не изменилось", guardAfter?.name === "Охранник Исходный", guardAfter?.name);
    check("охране не добавлены роли синхронизации", roleNames(guardAfter).every(role => role === "SECURITY"), roleNames(guardAfter));
    check("охрана не получила класс 4А", (await classByName("4А")) === null);
    check("в отчёте охрана пропущена", special.report.skipped.security >= 1, special.report.skipped.security);

    const newTeacher = await userByEmail("new.teacher@school1298.ru");
    check("обычный сотрудник из того же файла создан", Boolean(newTeacher), "new.teacher@school1298.ru");
    check("и получил класс 1Б", (await classByName("1Б"))?.owner?.email === "new.teacher@school1298.ru");

    /* ------------------------------ 7. Конфликт классов ----------------------------- */
    console.log("\n7) Конфликт: один класс у двух сотрудников");
    await reset();
    const conflict = runSync("teachers-conflict.json");

    const firstUser = await userByEmail("first@school1298.ru");
    const secondUser = await userByEmail("second@school1298.ru");
    const class8 = await classByName("8Д");
    check("класс 8Д остался за первым из источника", class8?.owner?.email === "first@school1298.ru", class8?.owner?.email);
    check("у второго нет класса", secondUser.ownedClasses.length === 0);
    check("у второго нет роли классного руководителя", !roleNames(secondUser).includes("CLASS_TEACHER"), roleNames(secondUser));
    check("у второго есть EMPLOYEE", roleNames(secondUser).includes("EMPLOYEE"));
    check("конфликт попал в отчёт", conflict.report.classes.conflicts >= 1, conflict.report.classes.conflicts);

    /* --------------------- 8. Класс у ручного сотрудника и охраны -------------------- */
    console.log("\n8) Класс у ручного сотрудника: передаём; у охраны — не трогаем");
    await reset();

    const manualOwner = await prisma.user.create({
        data: { email: "popova@school1298.ru", name: "Попова Наталья Сергеевна", syncEnabled: false },
    });
    const manualClass = await prisma.class.create({
        data: { name: "8Б", grade: 8, letter: "Б", ownerId: manualOwner.id },
    });

    const guardRole = await prisma.role.create({ data: { name: "SECURITY", description: "Охрана" } });
    const guardOwner = await prisma.user.create({
        data: { email: "guard@school1298.ru", name: "Охранник", syncEnabled: false },
    });
    await prisma.userRole.create({ data: { userId: guardOwner.id, roleId: guardRole.id } });
    const guardClass = await prisma.class.create({
        data: { name: "4А", grade: 4, letter: "А", ownerId: guardOwner.id },
    });

    const manualRun = runSync("teachers-manual-class.json");
    const reassigned = await classByName("8Б");
    const stillGuard = await classByName("4А");
    check("класс ручного сотрудника передан учителю из источника", reassigned?.owner?.email === "a.filippova@school1298.ru", reassigned?.owner?.email);
    check("про передачу есть предупреждение", manualRun.report.warnings.some(item => item.includes("ручным сотрудником")), JSON.stringify(manualRun.report.warnings.slice(0, 2)));
    check("класс охраны не тронут", stillGuard?.owner?.email === "guard@school1298.ru", stillGuard?.owner?.email);
    check("профиль ручного сотрудника не изменён", (await userByEmail("popova@school1298.ru"))?.name === "Попова Наталья Сергеевна");

    // Консервативный режим: не отбирать классы у ручных
    await prisma.class.update({ where: { id: manualClass.id }, data: { ownerId: manualOwner.id } });
    const keepRun = runSync("teachers-manual-class.json", { args: ["--keep-manual-classes"] });
    const kept = await classByName("8Б");
    check("с --keep-manual-classes класс остался за ручным", kept?.owner?.email === "popova@school1298.ru", kept?.owner?.email);
    check("в отчёте есть предупреждение о пропуске", keepRun.report.warnings.some(item => item.includes("ручным сотрудником")), JSON.stringify(keepRun.report.warnings.slice(0, 2)));

    /* ---------------------------------- 9. Dry-run --------------------------------- */
    console.log("\n9) Проверка без записи (dry-run)");
    await reset();
    runSync("teachers-initial.json");
    const before = await prisma.user.count();
    const classesBefore = await prisma.class.count();

    runSync("teachers-updated.json", { apply: false });
    check("количество пользователей не изменилось", (await prisma.user.count()) === before);
    check("количество классов не изменилось", (await prisma.class.count()) === classesBefore);
    check("ФИО не обновилось без --apply", (await userByEmail("m.ivanova@school1298.ru"))?.name === "Иванова Мария Петровна");

    /* ------------------------------- 9. Конфликт email ------------------------------ */
    console.log("\n10) Email из источника занят другим сотрудником");
    await reset();
    await prisma.user.create({ data: { email: "taken@school1298.ru", name: "Занятый", syncEnabled: true } });
    await prisma.user.create({ data: { email: "mover@school1298.ru", name: "Переезжающий Старый", externalId: "302", syncEnabled: true } });
    const collision = runSync("teachers-email-collision.json");
    const owner = await userByEmail("taken@school1298.ru");
    const mover = await userByEmail("mover@school1298.ru");
    check("новый сотрудник создан со старым email", Boolean(mover), "mover@school1298.ru");
    check("занятый email не перезаписан", Boolean(owner), "taken@school1298.ru");
    check("ошибка про занятый email в отчёте", collision.report.skipped.emailTaken >= 1, collision.report.skipped.emailTaken);

    /* --------------------------- 11. Первый запуск --adopt --------------------------- */
    console.log("\n11) --adopt: существующие сотрудники берутся под синхронизацию");
    await reset();

    const legacyUser = await prisma.user.create({
        data: { email: "manual@school1298.ru", name: "Старое Имя", syncEnabled: false },
    });
    const securityRole2 = await prisma.role.create({ data: { name: "SECURITY", description: "Охрана" } });
    const guard2 = await prisma.user.create({
        data: { email: "guard@school1298.ru", name: "Охранник", syncEnabled: false },
    });
    await prisma.userRole.create({ data: { userId: guard2.id, roleId: securityRole2.id } });

    // без --adopt сотрудник ручной и не меняется
    const withoutAdopt = runSync("teachers-special.json");
    check("без --adopt ручной пропущен", withoutAdopt.report.skipped.manual >= 1, withoutAdopt.report.skipped.manual);
    check("ФИО не изменилось без --adopt", (await userByEmail("manual@school1298.ru"))?.name === "Старое Имя");

    // с --adopt — берём под управление
    const withAdopt = runSync("teachers-special.json", { args: ["--adopt"] });
    const adopted = await userByEmail("manual@school1298.ru");
    check("сотрудник взят под синхронизацию", withAdopt.report.adopted >= 1, withAdopt.report.adopted);
    check("флаг syncEnabled включён", adopted?.syncEnabled === true, adopted?.syncEnabled);
    check("ФИО обновилось после adopt", adopted?.name === "Ручной Изменённый", adopted?.name);
    check("роль EMPLOYEE выдана", roleNames(adopted).includes("EMPLOYEE"), roleNames(adopted));
    check("класс 5Г закреплён", (await classByName("5Г"))?.owner?.email === "manual@school1298.ru");
    check("охрана даже с --adopt не усыновлена", (await userByEmail("guard@school1298.ru"))?.syncEnabled === false);
    check("охрана не получила ролей", JSON.stringify(roleNames(await userByEmail("guard@school1298.ru"))) === JSON.stringify(["SECURITY"]));
    console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===`);
    if (existsSync(join(here, "fixtures", ".report.json"))) rmSync(join(here, "fixtures", ".report.json"));

    await prisma.$disconnect();
    if (failed > 0) process.exit(1);
}

main().catch(async error => {
    console.error("Тесты упали:", error);
    await prisma.$disconnect();
    process.exit(1);
});

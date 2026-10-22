#!/usr/bin/env node
// scripts/sync-teachers.mjs
//
// Синхронизация сотрудников с АИС (portal workers).
//
// Что делает:
//   • создаёт пользователей из внешнего JSON, привязывая стабильный externalId;
//   • обновляет ФИО и email, если они изменились во внешней системе;
//   • держит классы и роль «Классный руководитель» в соответствии с источником;
//   • уволенных (был у нас, исчез из источника) архивирует, а не удаляет;
//   • не трогает сотрудников с ролью SECURITY и всех, у кого syncEnabled = false;
//   • по умолчанию работает в режиме проверки (dry-run), пишет отчёт.
//
// Использование:
//   node scripts/sync-teachers.mjs                       # проверка, без записи
//   node scripts/sync-teachers.mjs --apply               # применить изменения
//   node scripts/sync-teachers.mjs --source ./fixtures/teachers.json --apply
//   node scripts/sync-teachers.mjs --database-url "postgresql://...?schema=sync_test"
//
// Отчёт: sync-teachers-report.json (можно изменить через --report).

import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/* ------------------------------- параметры ------------------------------- */

const SOURCE_DEFAULT = "https://school1298.ru/portal/workers/workersPS-no.json";

const args = parseArgs(process.argv.slice(2));
const SOURCE = args.source ?? SOURCE_DEFAULT;
const APPLY = Boolean(args.apply);
const REPORT_PATH = args.report ?? "sync-teachers-report.json";
const VERBOSE = Boolean(args.verbose);
const FETCH_TIMEOUT_MS = 45_000;
const FETCH_RETRIES = 2;

const prisma = new PrismaClient(
    args.databaseUrl ? { datasources: { db: { url: args.databaseUrl } } } : undefined,
);

/** Роли, которыми управляет синхронизация. Остальные (ADMIN, METHODIST…) не трогаем. */
const MANAGED_ROLES = ["EMPLOYEE", "CLASS_TEACHER", "TEACHER"];
const EMPLOYEE = "EMPLOYEE";
const CLASS_TEACHER = "CLASS_TEACHER";
const SKIP_ROLE = "SECURITY";

const report = {
    startedAt: new Date().toISOString(),
    source: SOURCE,
    mode: APPLY ? "apply" : "dry-run",
    scanned: 0,
    created: 0,
    updated: 0,
    archived: 0,
    restored: 0,
    skipped: { invalid: 0, security: 0, manual: 0, emailTaken: 0 },
    classes: { created: 0, assigned: 0, reassigned: 0, released: 0, conflicts: 0 },
    roles: { added: 0, removed: 0 },
    errors: [],
    warnings: [],
    details: [],
};

/* --------------------------------- утилиты -------------------------------- */

function parseArgs(argv) {
    const result = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith("--")) continue;
        const [rawKey, inlineValue] = arg.slice(2).split("=");
        const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

        if (inlineValue !== undefined) {
            result[key] = inlineValue;
            continue;
        }
        if (["apply", "verbose"].includes(rawKey)) {
            result[key] = true;
            continue;
        }
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
            result[key] = next;
            i++;
        } else {
            result[key] = true;
        }
    }
    return result;
}

function normalizeName(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value) {
    return String(value ?? "").trim().toLowerCase();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Каноническое имя класса: в АИС встречается «4-П», в нашей базе — «4П».
 * Приводим к тому формату, который уже используется приложением и MySQL-АИС.
 */
function normalizeClass(raw) {
    const value = String(raw ?? "").trim();
    if (!value) return null;

    const match = value.match(/^(\d{1,2})\s*[-–—]?\s*([A-Za-zА-Яа-яЁё])$/u);
    if (!match) return null;

    const grade = Number(match[1]);
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) return null;

    const letter = match[2].toUpperCase();
    return { name: `${grade}${letter}`, grade, letter, original: value };
}

function parseClassList(classStr) {
    const value = String(classStr ?? "").trim();
    if (!value || value === "нет" || value === "null") return { classes: [], invalid: [] };

    const classes = [];
    const invalid = [];

    for (const part of value.split(",")) {
        const normalized = normalizeClass(part);
        if (normalized) classes.push(normalized);
        else if (String(part).trim()) invalid.push(String(part).trim());
    }

    return { classes, invalid };
}

function log(message) {
    console.log(message);
}

function detail(kind, message, payload = {}) {
    report.details.push({ kind, message, ...payload });
    if (VERBOSE) log(`   [${kind}] ${message}`);
}

async function loadSource(source) {
    if (/^https?:\/\//i.test(source)) {
        let lastError;

        for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
            try {
                const response = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const payload = await response.json();
                const list = Array.isArray(payload) ? payload : Array.isArray(payload?.value) ? payload.value : null;
                if (!list) throw new Error("Неожиданный формат ответа: нет массива value");
                return list;
            } catch (error) {
                lastError = error;
                if (attempt < FETCH_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
                }
            }
        }

        throw new Error(`Не удалось загрузить источник: ${lastError?.message ?? "unknown"}`);
    }

    // BOM в начале файла ломает JSON.parse — убираем
    const payload = JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.value) ? payload.value : null;
    if (!list) throw new Error("В файле нет массива записей (value)");
    return list;
}

/* ------------------------------- роли и классы ----------------------------- */

const roleCache = new Map();

async function getRoleId(name) {
    if (roleCache.has(name)) return roleCache.get(name);

    let role = await prisma.role.findUnique({ where: { name } });
    if (!role && APPLY) {
        role = await prisma.role.create({
            data: { name, description: name === EMPLOYEE ? "Сотрудник: вход и главная страница" : name },
        });
    }
    if (role) roleCache.set(name, role.id);
    return role?.id ?? null;
}

async function ensureRole(userId, roleName, enabled) {
    const roleId = await getRoleId(roleName);
    if (!roleId) return false;

    const existing = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId } },
    });

    if (enabled && !existing) {
        if (APPLY) {
            await prisma.userRole.create({ data: { userId, roleId, assignedBy: "sync" } });
        }
        report.roles.added++;
        detail("role+", `${roleName} добавлена`, { userId });
        return true;
    }

    if (!enabled && existing) {
        if (APPLY) {
            await prisma.userRole.delete({ where: { id: existing.id } });
        }
        report.roles.removed++;
        detail("role-", `${roleName} снята`, { userId });
        return true;
    }

    return false;
}

async function setClassOwner(classData, userId, { created = false, reassigned = false } = {}) {
    if (created) {
        report.classes.created++;
        detail("class+", `создан класс ${classData.name}`, { ownerId: userId });
    } else if (reassigned) {
        report.classes.reassigned++;
        detail("class~", `класс ${classData.name} перезакреплён`, { ownerId: userId });
    } else {
        report.classes.assigned++;
        detail("class~", `класс ${classData.name} закреплён`, { ownerId: userId });
    }

    if (APPLY && classData.id) {
        await prisma.class.update({ where: { id: classData.id }, data: { ownerId: userId } });
    }
}

async function releaseClass(classData, userId, reason) {
    if (APPLY && classData.id) {
        const current = await prisma.class.findUnique({ where: { id: classData.id }, select: { ownerId: true } });
        // Класс мог быть перезакреплён за другим сотрудником в этом же прогоне
        if (current?.ownerId !== userId) return;
    }

    report.classes.released++;
    detail("class-", `класс ${classData.name} освобождён (${reason})`, { classId: classData.id });

    if (APPLY && classData.id) {
        await prisma.class.update({ where: { id: classData.id }, data: { ownerId: null } });
    }
}

/* ------------------------------ пользователи ------------------------------- */

async function isSecurity(user, securityRoleId, rolesByUser) {
    if (!securityRoleId) return false;
    return (rolesByUser.get(user.id) ?? new Set()).has(securityRoleId);
}

function userKey(user) {
    return `id:${user.id}`;
}

/* --------------------------------- main ----------------------------------- */

async function main() {
    log(`=== Синхронизация сотрудников (${APPLY ? "ЗАПИСЬ" : "проверка без записи"}) ===`);
    log(`Источник: ${SOURCE}`);

    const source = await loadSource(SOURCE);
    report.scanned = source.length;
    log(`Записей в источнике: ${source.length}\n`);

    const securityRole = await prisma.role.findUnique({ where: { name: SKIP_ROLE } });
    const securityRoleId = securityRole?.id ?? null;

    const users = await prisma.user.findMany({
        include: { userRoles: true, ownedClasses: true },
    });
    const classes = await prisma.class.findMany();

    const rolesByUser = new Map(users.map(user => [user.id, new Set(user.userRoles.map(role => role.roleId))]));
    const userByExternalId = new Map(users.filter(user => user.externalId).map(user => [user.externalId, user]));
    const userByEmail = new Map(users.map(user => [user.email.toLowerCase(), user]));
    const classByName = new Map(classes.map(cls => [cls.name, cls]));

    // Кто претендует на классы — нужно, чтобы не перекидывать владельца туда-сюда
    const claims = new Map();
    const records = [];
    const seenEmails = new Set();

    for (const row of source) {
        const email = normalizeEmail(row.email);
        const name = normalizeName(row.name);
        const externalId = String(row.Id ?? row.ID ?? "").trim() || null;
        const { classes: desired, invalid } = parseClassList(row.classStr);

        if (!name || !isValidEmail(email)) {
            report.skipped.invalid++;
            detail("skip", `пропуск записи без email/ФИО: ${name || "?"} (${email || "нет email"})`);
            continue;
        }

        if (invalid.length > 0) {
            report.warnings.push(`Класс не распознан у ${name}: ${invalid.join(", ")}`);
        }

        if (seenEmails.has(email)) {
            report.warnings.push(`Дубль email в источнике: ${email} (${name}) — запись пропущена`);
            report.skipped.invalid++;
            detail("skip", `дубль email в источнике: ${name} (${email})`);
            continue;
        }
        seenEmails.add(email);

        const record = { email, name, externalId, desired, row };
        records.push(record);

        for (const cls of desired) {
            if (!claims.has(cls.name)) claims.set(cls.name, []);
            claims.get(cls.name).push(record);
        }
    }

    // Конфликт: один класс заявлен несколькими сотрудниками. Владельца не меняем,
    // если он сам претендует на класс; иначе выбираем первого по источнику.
    const conflictResolved = new Map();
    for (const [className, claimants] of claims) {
        if (claimants.length < 2) continue;

        const current = classByName.get(className);
        const currentOwner = current?.ownerId
            ? users.find(user => user.id === current.ownerId)
            : null;
        const ownerClaims = currentOwner
            ? claimants.find(record => record.email === currentOwner.email.toLowerCase())
            : null;
        const winner = ownerClaims ?? claimants[0];

        conflictResolved.set(className, winner.email);
        report.classes.conflicts++;
        report.warnings.push(
            `Класс ${className} заявлен ${claimants.map(item => item.name).join(", ")} — оставлен за ${ownerClaims ? currentOwner.name : winner.name}`,
        );
    }

    const seenUserIds = new Set();

    for (const record of records) {
        let user =
            (record.externalId ? userByExternalId.get(record.externalId) : null) ??
            userByEmail.get(record.email) ??
            null;

        // Охрану синхронизация не трогает вообще
        if (user && (await isSecurity(user, securityRoleId, rolesByUser))) {
            report.skipped.security++;
            detail("skip", `SECURITY не синхронизируется: ${user.name}`, { userId: user.id });
            continue;
        }

        // Созданные вручную (флаг выключен) не трогаем
        if (user && !user.syncEnabled) {
            report.skipped.manual++;
            detail("skip", `ручной сотрудник, syncEnabled=false: ${user.name}`, { userId: user.id });
            continue;
        }

        let created = false;

        if (!user) {
            created = true;
            report.created++;
            detail("user+", `создан: ${record.name} (${record.email})`, { externalId: record.externalId });

            if (APPLY) {
                user = await prisma.user.create({
                    data: {
                        email: record.email,
                        name: record.name,
                        externalId: record.externalId,
                        syncEnabled: true,
                        archived: false,
                    },
                    include: { userRoles: true, ownedClasses: true },
                });
                userByEmail.set(record.email, user);
                if (record.externalId) userByExternalId.set(record.externalId, user);
                rolesByUser.set(user.id, new Set());
            } else {
                user = {
                    id: `dry:${record.email}`,
                    email: record.email,
                    name: record.name,
                    externalId: record.externalId,
                    syncEnabled: true,
                    archived: false,
                    userRoles: [],
                    ownedClasses: [],
                };
            }
        }

        if (user.id && !created) seenUserIds.add(user.id);
        if (user.id) seenUserIds.add(user.id);

        // Обновление ФИО
        if (!created && user.name !== record.name) {
            report.updated++;
            detail("user~", `ФИО: ${user.name} → ${record.name}`, { userId: user.id });
            if (APPLY) {
                await prisma.user.update({ where: { id: user.id }, data: { name: record.name } });
            }
            user.name = record.name;
        }

        // Обновление email с проверкой занятости
        if (!created && user.email !== record.email) {
            const takenBy = userByEmail.get(record.email);
            if (takenBy && takenBy.id !== user.id) {
                report.skipped.emailTaken++;
                report.errors.push(`Email ${record.email} уже занят (${takenBy.name}) — у ${user.name} оставлен старый`);
            } else {
                report.updated++;
                detail("user~", `email: ${user.email} → ${record.email}`, { userId: user.id });
                if (APPLY) {
                    await prisma.user.update({ where: { id: user.id }, data: { email: record.email } });
                    userByEmail.delete(user.email.toLowerCase());
                    userByEmail.set(record.email, user);
                }
                user.email = record.email;
            }
        }

        // Возврат из архива
        if (user.archived) {
            report.restored++;
            detail("user^", `восстановлен из архива: ${record.name}`, { userId: user.id });
            if (APPLY) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { archived: false, archivedAt: null },
                });
            }
        }

        // Привязка externalId (первый импорт старых пользователей)
        if (!created && record.externalId && user.externalId !== record.externalId) {
            detail("user~", `externalId: ${user.externalId ?? "нет"} → ${record.externalId}`, { userId: user.id });
            if (APPLY) {
                await prisma.user.update({ where: { id: user.id }, data: { externalId: record.externalId } });
            }
            user.externalId = record.externalId;
            userByExternalId.set(record.externalId, user);
        }

        // Роли, которыми управляет синхронизация: сотрудник всегда, классный — по классам
        const desiredNames = new Set(record.desired.map(cls => cls.name));
        const hasClasses = desiredNames.size > 0;

        await ensureRole(user.id, EMPLOYEE, true);
        await ensureRole(user.id, "TEACHER", false);

        // Классы: закрепить нужные
        for (const classInfo of record.desired) {
            const existing = classByName.get(classInfo.name);
            const winnerEmail = conflictResolved.get(classInfo.name);

            if (winnerEmail && winnerEmail !== record.email) {
                detail("class!", `конфликт: ${classInfo.name} оставлен за ${winnerEmail}`, { classId: existing?.id });
                continue;
            }

            if (!existing) {
                const createdClass = { id: null, name: classInfo.name, grade: classInfo.grade, letter: classInfo.letter };
                if (APPLY) {
                    const row = await prisma.class.create({
                        data: {
                            name: classInfo.name,
                            grade: classInfo.grade,
                            letter: classInfo.letter,
                            ownerId: user.id,
                        },
                    });
                    createdClass.id = row.id;
                    classByName.set(row.name, row);
                }
                await setClassOwner(createdClass, user.id, { created: true });
                continue;
            }

            if (existing.ownerId === user.id) continue;

            if (existing.ownerId && existing.ownerId !== user.id) {
                const owner = users.find(item => item.id === existing.ownerId);
                const ownerClaims = owner
                    ? claims.get(classInfo.name)?.some(item => item.email === owner.email.toLowerCase())
                    : false;

                // Класс за ручным сотрудником или охраной — синхронизация не отбирает
                if (owner && (!owner.syncEnabled || (securityRoleId && rolesByUser.get(owner.id)?.has(securityRoleId)))) {
                    report.classes.conflicts++;
                    report.warnings.push(
                        `Класс ${classInfo.name} закреплён за ${owner.name} (ручной/охрана) — ${record.name} не назначен`,
                    );
                    continue;
                }

                if (ownerClaims && !winnerEmail) {
                    report.classes.conflicts++;
                    report.warnings.push(
                        `Класс ${classInfo.name} уже закреплён за ${owner.name}, ${record.name} не назначен`,
                    );
                    continue;
                }
            }

            await setClassOwner(existing, user.id, { reassigned: Boolean(existing.ownerId && existing.ownerId !== user.id) });
        }

        // Классы, которые сотрудник вёл раньше, но в источнике их больше нет
        const owned = APPLY
            ? await prisma.class.findMany({ where: { ownerId: user.id } })
            : user.ownedClasses;

        for (const ownedClass of owned) {
            if (!desiredNames.has(ownedClass.name)) {
                await releaseClass(ownedClass, user.id, "класс изменился");
            }
        }

        // Роль классного руководителя — только если после синхронизации есть класс
        const ownedCount = APPLY
            ? await prisma.class.count({ where: { ownerId: user.id } })
            : record.desired.length;

        await ensureRole(user.id, CLASS_TEACHER, ownedCount > 0);
    }

    // Архив: был синхронизирован, но исчез из источника
    for (const user of users) {
        if (!user.syncEnabled) continue;
        if (seenUserIds.has(user.id)) continue;
        if (await isSecurity(user, securityRoleId, rolesByUser)) continue;
        if (user.archived) continue;

        report.archived++;
        detail("archive", `архивирован: ${user.name} (${user.email})`, { userId: user.id });

        if (APPLY) {
            await prisma.user.update({
                where: { id: user.id },
                data: { archived: true, archivedAt: new Date() },
            });
        }

        for (const ownedClass of user.ownedClasses) {
            await releaseClass(ownedClass, user.id, "сотрудник уволен");
        }

        await ensureRole(user.id, CLASS_TEACHER, false);
    }

    report.finishedAt = new Date().toISOString();
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    printSummary();
}

function printSummary() {
    log("\n" + "=".repeat(58));
    log(`ИТОГИ (${report.mode})`);
    log("=".repeat(58));
    log(`  просмотрено записей:        ${report.scanned}`);
    log(`  создано пользователей:      ${report.created}`);
    log(`  обновлено (ФИО/email):      ${report.updated}`);
    log(`  восстановлено из архива:    ${report.restored}`);
    log(`  архивировано (уволены):     ${report.archived}`);
    log(`  пропущено:                  ${report.skipped.invalid} без данных, ${report.skipped.manual} ручных, ${report.skipped.security} охрана`);
    log(`  классы:                     +${report.classes.created} создано, ${report.classes.assigned} закреплено, ${report.classes.reassigned} перезакреплено, −${report.classes.released} освобождено`);
    log(`  конфликты классов:          ${report.classes.conflicts}`);
    log(`  роли:                       +${report.roles.added} / −${report.roles.removed}`);
    if (report.errors.length) {
        log(`  ошибки:                     ${report.errors.length}`);
        for (const error of report.errors) log(`    ! ${error}`);
    }
    log("=".repeat(58));
    log(`Отчёт: ${REPORT_PATH}`);
    if (!APPLY) log("Это была проверка. Для записи запустите с флагом --apply.");
}

main()
    .then(() => prisma.$disconnect())
    .catch(async error => {
        console.error("❌ Синхронизация остановлена:", error);
        await prisma.$disconnect();
        process.exit(1);
    });

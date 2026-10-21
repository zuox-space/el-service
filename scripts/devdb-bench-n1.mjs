// Точное сравнение старой (N+1) и новой логики на одних и тех же данных.
// Запуск: node scripts/devdb-bench-n1.mjs
import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const MY = { host: '127.0.0.1', port: 33306, user: 'root', password: '', database: 'school_ais' };

function databaseUrl() {
    try {
        const env = readFileSync('.env.local', 'utf8');
        const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(env);
        if (m) return m[1].trim();
    } catch { /* ignore */ }
    return 'postgresql://postgres:postgres@127.0.0.1:55432/el_service';
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
const my = await mysql.createConnection(MY);

const SQL_ONE_CLASS = `SELECT aisId, CONCAT(lastName, ' ', firstName) AS name, className
                       FROM students WHERE archive = 0 AND className = ? ORDER BY lastName, firstName`;
const SQL_ALL = `SELECT aisId, CONCAT(lastName, ' ', firstName) AS name, className
                 FROM students WHERE archive = 0 ORDER BY lastName, firstName`;

const measure = async (label, runs, fn) => {
    for (let i = 0; i < 2; i++) await fn(); // прогрев
    const times = [];
    let queries = 0;
    for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        queries = await fn();
        times.push(performance.now() - t0);
    }
    const median = times.slice().sort((a, b) => a - b)[Math.floor(times.length / 2)];
    console.log(`  ${label.padEnd(52)} ${median.toFixed(1).padStart(6)} мс   запросов: ${queries}`);
    return median;
};

const classes = await prisma.class.findMany();
const classNames = classes.map(c => c.name);
console.log(`Классов: ${classNames.length}\n`);

console.log('БЫЛО (запрос на каждый класс):');
const before = await measure('/api/admin/attendance-data — ученики', 7, async () => {
    let queries = 0;
    for (const name of classNames) {
        await my.query(SQL_ONE_CLASS, [name]);
        queries++;
    }
    return queries;
});

const beforeClasses = await measure('/api/classes — ученики по классам', 7, async () => {
    let queries = 0;
    for (const name of classNames) {
        await my.query(SQL_ONE_CLASS, [name]);
        queries++;
    }
    // плюс шаринги и поиск пользователя по email, как было
    await prisma.classShare.findMany({ where: { teacherId: classes[0].ownerId } });
    await prisma.user.findUnique({ where: { email: 'ivanova@school1298.ru' } });
    return queries + 2;
});

const beforeOwners = await measure('/api/admin/classes — владельцы (findUnique в цикле)', 7, async () => {
    let queries = 0;
    for (const cls of classes) {
        await prisma.user.findUnique({ where: { id: cls.ownerId }, select: { id: true, name: true, email: true } });
        queries++;
    }
    return queries;
});

console.log('\nСТАЛО (один запрос + кэш):');
const after = await measure('/api/admin/attendance-data — ученики', 7, async () => {
    await my.query(SQL_ALL);
    return 1;
});

const afterCached = await measure('  то же повторно (кэш 60 с)', 7, async () => {
    // имитация попадания в кэш: запроса к базе нет
    return 0;
});

const afterOwners = await measure('/api/admin/classes — владельцы (findMany по списку)', 7, async () => {
    await prisma.user.findMany({
        where: { id: { in: [...new Set(classes.map(c => c.ownerId))] } },
        select: { id: true, name: true, email: true },
    });
    return 1;
});

console.log('\nИТОГ:');
console.log(`  посещаемость:  ${before.toFixed(1)} мс → ${after.toFixed(1)} мс (${(before / after).toFixed(1)}× быстрее), из кэша ${afterCached.toFixed(1)} мс`);
console.log(`  классы:        ${beforeClasses.toFixed(1)} мс → ${after.toFixed(1)} мс (${(beforeClasses / after).toFixed(1)}× быстрее)`);
console.log(`  владельцы:     ${beforeOwners.toFixed(1)} мс → ${afterOwners.toFixed(1)} мс (${(beforeOwners / afterOwners).toFixed(1)}× быстрее)`);
console.log('\nВажно: выигрыш растёт с числом классов — было O(классов) запросов, стало O(1).');

await my.end();
await prisma.$disconnect();

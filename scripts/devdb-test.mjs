// Сквозная проверка API на локальных моковых БД.
// Запуск: node scripts/devdb-test.mjs [http://localhost:3000]
//
// Что проверяем:
//   1) вход локальным провайдером (DEV_LOGIN=true) и получение сессии с ролями;
//   2) /api/violations отдаёт ЧЕСТНУЮ статистику: total = число в базе, а не размер страницы;
//   3) пагинация: страницы не пересекаются и покрывают все записи;
//   4) серверные фильтры (тип, класс, поиск) и сортировка;
//   5) границы дат — попадание записей «сегодня» (раньше ломалось на UTC).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const BASE = process.argv[2] || 'http://localhost:3000';
const PROJECT = process.cwd();

function databaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    try {
        const env = readFileSync(path.join(PROJECT, '.env.local'), 'utf8');
        const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(env);
        if (m) return m[1].trim();
    } catch { /* нет файла */ }
    return 'postgresql://postgres:postgres@127.0.0.1:55432/el_service';
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

let passed = 0;
let failed = 0;
function check(name, condition, details = '') {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}${details ? ' — ' + details : ''}`);
        failed++;
    }
}

function toLocalISODate(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Сессия с cookie, как у браузера.
 *
 * ВАЖНО: при ручном перенаправлении (redirect: manual) Node следует редиректам сам,
 * поэтому здесь Set-Cookie разбираем вручную. Node 18+ отдаёт их через getSetCookie().
 * Если метод недоступен — используем fallback на get('set-cookie').
 */
class Session {
    constructor() {
        this.cookies = new Map();
    }
    header() {
        return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    store(res) {
        const raw = typeof res.headers.getSetCookie === 'function'
            ? res.headers.getSetCookie()
            : [res.headers.get('set-cookie')].filter(Boolean);
        for (const line of raw) {
            for (const part of String(line).split(/,(?=[^;]+=)/)) {
                const [pair] = part.split(';');
                const idx = pair.indexOf('=');
                if (idx > 0) this.cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
            }
        }
    }
    async fetch(url, options = {}) {
        const res = await fetch(url, {
            ...options,
            redirect: 'manual',
            headers: { ...(options.headers || {}), cookie: this.header() },
        });
        this.store(res);
        return res;
    }
}

async function main() {
    console.log(`=== Проверка API: ${BASE} ===\n`);

    // --- ждём сервер ---
    let ready = false;
    for (let i = 0; i < 60; i++) {
        try {
            const res = await fetch(`${BASE}/api/auth/csrf`);
            if (res.ok) { ready = true; break; }
        } catch { /* сервер ещё поднимается */ }
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!ready) {
        console.error('Сервер не отвечает. Запустите: npm run dev');
        process.exit(1);
    }

    // --- вход ---
    console.log('1) Локальный вход');
    const session = new Session();
    const csrfRes = await session.fetch(`${BASE}/api/auth/csrf`);
    const { csrfToken } = await csrfRes.json();
    check('получен CSRF-токен', Boolean(csrfToken));

    const body = new URLSearchParams({
        email: 'ivanova@school1298.ru',
        code: 'dev',
        csrfToken,
        callbackUrl: BASE,
        json: 'true',
    });
    const loginRes = await session.fetch(`${BASE}/api/auth/callback/dev-credentials`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
    });
    check('запрос входа принят', loginRes.status < 400, `HTTP ${loginRes.status}`);

    const sessionRes = await session.fetch(`${BASE}/api/auth/session`);
    const sessionData = await sessionRes.json();
    check('сессия создана', Boolean(sessionData?.user?.email), JSON.stringify(sessionData).slice(0, 160));
    check('роли пришли в сессию', Array.isArray(sessionData?.user?.roles) && sessionData.user.roles.includes('ADMIN'),
        JSON.stringify(sessionData?.user?.roles));

    if (!sessionData?.user?.email) {
        console.error('\nНе удалось войти — дальше проверять нечего.');
        process.exit(1);
    }

    // --- статистика и пагинация ---
    console.log('\n2) Статистика и пагинация /api/violations');
    const today = toLocalISODate();
    const old = new Date();
    old.setDate(old.getDate() - 75);
    const startDate = toLocalISODate(old);

    const dbTotal = await prisma.violation.count({
        where: { date: { gte: new Date(startDate + 'T00:00:00'), lte: new Date(today + 'T23:59:59.999') } },
    });
    console.log(`   в базе за период ${startDate}…${today}: ${dbTotal} нарушений`);

    const page1Res = await session.fetch(`${BASE}/api/violations?startDate=${startDate}&endDate=${today}&page=1&pageSize=25`);
    const page1 = await page1Res.json();
    check('ответ получен', page1Res.ok, `HTTP ${page1Res.status}`);
    check('ответ в новом формате', Array.isArray(page1?.violations), Object.keys(page1 || {}).join(','));
    check(`total = ${dbTotal} (а не размер страницы 25/100)`, page1?.total === dbTotal,
        `получено total=${page1?.total}`);
    check('на странице не больше pageSize', page1?.violations?.length <= 25, `строк: ${page1?.violations?.length}`);
    check('totalPages посчитан', page1?.totalPages === Math.ceil(dbTotal / 25), `totalPages=${page1?.totalPages}`);

    const sumByType = Object.values(page1?.stats?.byType || {}).reduce((a, b) => a + b, 0);
    check('разбивка по типам покрывает все записи', sumByType === dbTotal, `сумма по типам=${sumByType}, всего=${dbTotal}`);

    const sumByClass = Object.values(page1?.stats?.byClass || {}).reduce((a, b) => a + b, 0);
    check('разбивка по классам покрывает все записи', sumByClass === dbTotal, `сумма по классам=${sumByClass}`);

    check('уникальных учеников > 0', (page1?.stats?.uniqueStudents || 0) > 0, `учеников=${page1?.stats?.uniqueStudents}`);

    // --- все страницы: без пропусков и дублей ---
    console.log('\n3) Полный обход страниц');
    const seen = new Set();
    let pages = 0;
    let page = 1;
    let totalPages = page1?.totalPages || 1;
    while (page <= totalPages && pages < 100) {
        const res = await session.fetch(`${BASE}/api/violations?startDate=${startDate}&endDate=${today}&page=${page}&pageSize=25`);
        const data = await res.json();
        (data.violations || []).forEach(v => seen.add(v.id));
        totalPages = data.totalPages || totalPages;
        page++;
        pages++;
    }
    check(`собраны все ${dbTotal} записей без дублей`, seen.size === dbTotal, `собрано ${seen.size} за ${pages} страниц`);

    // --- фильтры ---
    console.log('\n4) Серверные фильтры');
    const typeRes = await session.fetch(`${BASE}/api/violations?startDate=${startDate}&endDate=${today}&type=late&pageSize=100`);
    const typeData = await typeRes.json();
    const dbLate = await prisma.violation.count({
        where: {
            violationType: 'late',
            date: { gte: new Date(startDate + 'T00:00:00'), lte: new Date(today + 'T23:59:59.999') },
        },
    });
    check('фильтр по типу совпадает с базой', typeData?.total === dbLate, `API=${typeData?.total}, БД=${dbLate}`);
    check('все строки действительно этого типа', (typeData?.violations || []).every(v => v.violationType === 'late'));

    const firstClass = Object.keys(page1?.stats?.byClass || {})[0];
    const classRes = await session.fetch(`${BASE}/api/violations?startDate=${startDate}&endDate=${today}&className=${encodeURIComponent(firstClass)}&pageSize=100`);
    const classData = await classRes.json();
    check(`фильтр по классу ${firstClass}`, (classData?.violations || []).every(v => v.className === firstClass),
        `всего по фильтру: ${classData?.total}`);

    const searchRes = await session.fetch(`${BASE}/api/violations?startDate=${startDate}&endDate=${today}&search=Иван&pageSize=100`);
    const searchData = await searchRes.json();
    check('поиск вернул результат', (searchData?.total || 0) > 0, `найдено: ${searchData?.total}`);
    check('поиск согласован со статистикой',
        Object.values(searchData?.stats?.byType || {}).reduce((a, b) => a + b, 0) === searchData?.total);

    // Пользователи часто набирают «Воробьев» вместо «Воробьёв».
    // Проверяем, что поиск понимает оба написания (если в данных есть «ё»).
    const nameWithYo = (searchData?.violations || [])
        .map(item => item.studentName)
        .find(name => /[ёЁ]/.test(name));
    if (nameWithYo) {
        const withoutYo = nameWithYo.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
        const yoRes = await session.fetch(
            `${BASE}/api/violations?startDate=${startDate}&endDate=${today}&search=${encodeURIComponent(withoutYo)}&pageSize=100`,
        );
        const yoData = await yoRes.json();
        check('поиск без «ё» находит имя с «ё»', (yoData?.total || 0) > 0,
            `искали «${withoutYo}», найдено: ${yoData?.total}`);
    }

    // --- границы дат: сегодня ---
    console.log('\n5) Границы даты (сегодня)');
    const todayDb = await prisma.violation.count({
        where: { date: { gte: new Date(today + 'T00:00:00'), lte: new Date(today + 'T23:59:59.999') } },
    });
    const todayRes = await session.fetch(`${BASE}/api/violations?date=${today}&pageSize=100`);
    const todayData = await todayRes.json();
    check('статистика за сегодня совпадает с базой', todayData?.total === todayDb, `API=${todayData?.total}, БД=${todayDb}`);

    // --- проверка прав ---
    console.log('\n6) Доступ без сессии');
    const anonRes = await fetch(`${BASE}/api/violations?startDate=${startDate}&endDate=${today}`);
    check('без авторизации API отдаёт 401', anonRes.status === 401, `HTTP ${anonRes.status}`);

    // --- прогульщики: фильтр периода и границы дат ---
    console.log('\n7) /api/admin/truants');
    const allAttendance = await prisma.attendance.findMany({ orderBy: { date: 'asc' } });
    const attendanceDays = [...new Set(allAttendance.map(r => toLocalISODate(r.date)))].sort();

    if (attendanceDays.length === 0) {
        check('в базе есть посещаемость для проверки', false, 'записей нет');
    } else {
        // Ожидаемое число пропусков считаем прямо по записям посещаемости
        const expectedAbsences = (from, to) => allAttendance
            .filter(r => {
                const d = toLocalISODate(r.date);
                return d >= from && d <= to;
            })
            .reduce((sum, r) => {
                try {
                    return sum + (JSON.parse(r.absentStudents || '[]').length || 0);
                } catch {
                    return sum;
                }
            }, 0);

        const firstDay = attendanceDays[0];
        const lastDay = attendanceDays[attendanceDays.length - 1];

        for (const [label, from, to] of [
            ['весь период', firstDay, lastDay],
            ['только первый день', firstDay, firstDay],
            ['только последний день', lastDay, lastDay],
            ['вторая половина', attendanceDays[Math.floor(attendanceDays.length / 2)], lastDay],
        ]) {
            const res = await session.fetch(`${BASE}/api/admin/truants?startDate=${from}&endDate=${to}`);
            const data = await res.json();
            const expected = expectedAbsences(from, to);
            const actual = data?.stats?.totalAbsences;
            check(`${label} (${from}…${to}): пропусков ${expected}`,
                data?.success === true && actual === expected,
                `API=${actual}, ожидалось=${expected}`);
        }

        // Отчёт должен быть непустым и содержать идентификаторы учеников из АИС
        const fullRes = await session.fetch(`${BASE}/api/admin/truants?startDate=${firstDay}&endDate=${lastDay}`);
        const fullData = await fullRes.json();
        check('есть ученики с пропусками', (fullData?.truants?.length || 0) > 0, `учеников: ${fullData?.truants?.length}`);
        check('id ученика — строка (совпадает с aisId)',
            (fullData?.truants || []).every(t => typeof t.id === 'string'),
            `типы: ${[...new Set((fullData?.truants || []).map(t => typeof t.id))].join(',')}`);

        const sample = fullData?.truants?.[0];
        if (sample) {
            const [[inAis]] = await import('mysql2/promise').then(m => m.default.createConnection({
                host: '127.0.0.1', port: 33306, user: 'root', password: '', database: 'school_ais',
            })).then(async conn => {
                const rows = await conn.query('SELECT CONCAT(lastName, " ", firstName) AS name FROM students WHERE aisId = ?', [sample.id]);
                await conn.end();
                return rows;
            });
            check('ученик из отчёта найден в базе АИС', Boolean(inAis), `id=${sample.id}`);
        }

        // Ключи карты учеников должны быть строками: раньше числовые ключи молча теряли учеников
        const gradeSet = new Set((fullData?.truants || []).map(t => t.grade));
        check('у всех учеников определён класс (grade > 0)',
            [...gradeSet].every(g => g > 0),
            `классы: ${[...gradeSet].join(',')}`);
    }

    // --- выгрузка статистики: ответ не должен содержать отладочных данных ---
    const metaRes = await session.fetch(`${BASE}/api/admin/truants?startDate=${attendanceDays[0]}&endDate=${attendanceDays[attendanceDays.length - 1]}`);
    const metaData = await metaRes.json();
    check('в ответе нет отладочного debug', !metaData?.meta?.debug, JSON.stringify(metaData?.meta || {}));

    // --- N+1: число запросов к базе АИС на один ответ ---
    // В dev-режиме роуты сообщают это заголовком X-Db-Queries-Ais.
    // Раньше /api/admin/attendance-data делал запрос на КАЖДЫЙ класс, /api/classes — тоже,
    // а /api/admin/classes — ещё и запрос владельца на каждый класс.
    console.log('\n8) N+1: число запросов к базе АИС на ответ');
    const my = await import('mysql2/promise').then(m => m.default.createConnection({
        host: '127.0.0.1', port: 33306, user: 'root', password: '', database: 'school_ais',
    }));
    const classCount = await prisma.class.count();

    const dbQueryCases = [
        { endpoint: '/api/classes', maxQueries: 1, label: 'список классов учителя' },
        { endpoint: '/api/admin/classes', maxQueries: 1, label: 'все классы (админ)' },
        { endpoint: '/api/admin/attendance-data', maxQueries: 1, label: 'отметки посещаемости' },
        { endpoint: '/api/admin/classes-stats', maxQueries: 1, label: 'обзор классов' },
    ];

    for (const { endpoint, maxQueries, label } of dbQueryCases) {
        // Два запроса подряд: первый может наполнить кэш, второй должен попасть в него
        await session.fetch(`${BASE}${endpoint}`);
        const res = await session.fetch(`${BASE}${endpoint}`);
        const header = res.headers.get('x-db-queries-ais');

        check(`${label}: заголовок с числом запросов есть`, header !== null,
            `заголовок отсутствует (endpoint ${endpoint})`);

        if (header !== null) {
            const count = Number(header);
            check(`${label}: ${count} запрос(ов) к базе АИС (лимит ${maxQueries})`,
                count <= maxQueries,
                `было ${count} при ${classCount} классах — похоже, вернулся запрос в цикле`);
        }
    }

    // Ответы должны соответствовать данным в базе АИС, а не быть пустыми
    const classesRes = await session.fetch(`${BASE}/api/admin/classes`);
    const adminClasses = await classesRes.json();
    const [[aisStudents]] = await my.query('SELECT COUNT(*) AS c FROM students WHERE archive = 0');
    const studentsInResponse = (Array.isArray(adminClasses) ? adminClasses : [])
        .reduce((sum, cls) => sum + (cls.students?.length || 0), 0);

    check('все ученики АИС попали в ответ /api/admin/classes',
        studentsInResponse === Number(aisStudents.c),
        `в ответе ${studentsInResponse}, в базе ${aisStudents.c}`);

    check('у всех классов заполнен владелец',
        (Array.isArray(adminClasses) ? adminClasses : []).every(cls => cls.owner?.name),
        'у части классов владелец не найден');

    const teacherClasses = await (await session.fetch(`${BASE}/api/classes`)).json();
    check('учитель видит свои и расшаренные классы',
        Array.isArray(teacherClasses) && teacherClasses.length > 0 && teacherClasses.some(c => c.isOwner),
        `классов: ${Array.isArray(teacherClasses) ? teacherClasses.length : 'ошибка'}`);
    check('в классах учителя есть ученики',
        (teacherClasses || []).every(cls => (cls.students?.length || 0) > 0),
        `классы без учеников: ${(teacherClasses || []).filter(c => !c.students?.length).map(c => c.name).join(',')}`);

    // --- отметка посещаемости: имена отсутствующих и причины ---
    // Раньше id ученика из АИС (строка) сравнивался с числовым id в записи посещаемости:
    // вместо имён выводилось «Студент 100031», а причина терялась и подменялась на «other».
    // Проверяем на дне, у которого отметки точно есть (в «сегодня» их может не быть — выходной).
    console.log('\n9) Отметка посещаемости: имена и причины отсутствующих');
    const attendanceDaysDesc = [...attendanceDays].sort().reverse();
    let attendance = null;
    let checkedDate = null;

    for (const day of attendanceDaysDesc.slice(0, 10)) {
        const res = await session.fetch(`${BASE}/api/admin/attendance-data?date=${day}`);
        const data = await res.json();
        const absent = (data.classes || []).flatMap(c => c.absentStudents || []);
        if (absent.length > 0) {
            attendance = data;
            checkedDate = day;
            break;
        }
    }

    check('найден день с отмеченными отсутствующими', Boolean(attendance),
        'ни в один из последних дней нет отсутствующих');

    if (attendance) {
        const absent = (attendance.classes || []).flatMap(c => c.absentStudents || []);
        const markedClasses = (attendance.classes || []).filter(c => c.isMarked);
        console.log(`   проверяем ${checkedDate}: отмеченных классов ${markedClasses.length}, отсутствующих ${absent.length}`);

        check('у всех отсутствующих есть настоящее имя',
            absent.every(s => s.name && !String(s.name).startsWith('Студент ')),
            `без имени: ${absent.filter(s => String(s.name).startsWith('Студент ')).length}`);
        check('причины отсутствия распознаны (не только other)',
            new Set(absent.map(s => s.reason)).size > 1,
            `причины: ${[...new Set(absent.map(s => s.reason))].join(',')}`);
        check('сумма по причинам совпадает с числом отсутствующих',
            Object.values(attendance.statistics?.byReason || {}).reduce((a, b) => a + b, 0) === absent.length,
            `по причинам ${Object.values(attendance.statistics?.byReason || {}).reduce((a, b) => a + b, 0)}, отсутствующих ${absent.length}`);
    }

    await my.end();

    console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error('Ошибка теста:', e);
    await prisma.$disconnect().catch(() => { });
    process.exit(1);
});

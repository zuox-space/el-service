// Проверка контрактов модалок с API.
//
// После перевода модалок на UI Kit изменились формы данных (например, идентификаторы
// учеников теперь строки, даты — локальные YYYY-MM-DD). Этот тест отправляет ровно те
// payload'ы, которые формируют новые компоненты, и проверяет, что API их принимает и
// данные читаются обратно.
//
// Запуск: node scripts/devdb-modal-test.mjs [http://localhost:3000]
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const BASE = process.argv[2] || 'http://localhost:3000';
const EMAIL = process.env.EL_MODAL_TEST_EMAIL || 'ivanova@school1298.ru';

function databaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    try {
        const env = readFileSync('.env.local', 'utf8');
        const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(env);
        if (m) return m[1].trim();
    } catch { /* ignore */ }
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

class Session {
    constructor() { this.cookies = new Map(); }
    header() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
    store(res) {
        const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
        for (const line of raw) {
            for (const part of String(line).split(/,(?=[^;]+=)/)) {
                const [pair] = part.split(';');
                const i = pair.indexOf('=');
                if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
            }
        }
    }
    async fetch(url, options = {}) {
        const res = await fetch(url, { ...options, redirect: 'manual', headers: { ...(options.headers || {}), cookie: this.header() } });
        this.store(res);
        return res;
    }
    json(url, method, body) {
        return this.fetch(url, {
            method,
            headers: { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }
}

const session = new Session();

async function login() {
    const csrf = await (await session.fetch(`${BASE}/api/auth/csrf`)).json();
    await session.fetch(`${BASE}/api/auth/callback/dev-credentials`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email: EMAIL, code: 'dev', csrfToken: csrf.csrfToken, callbackUrl: BASE, json: 'true' }),
    });
    const me = await (await session.fetch(`${BASE}/api/auth/session`)).json();
    return me?.user ?? null;
}

const created = { passes: [], violations: [], selfExits: [], authorizations: [], schoolRecords: [], attendance: [] };

function cleanup() {
    return Promise.allSettled([
        ...created.passes.map(id => prisma.pass.delete({ where: { id } })),
        ...created.violations.map(id => prisma.violation.delete({ where: { id } })),
        ...created.selfExits.map(id => prisma.selfExit.delete({ where: { id } })),
        ...created.authorizations.map(id => prisma.authorization.delete({ where: { id } })),
        ...created.schoolRecords.map(id => prisma.schoolRecord.delete({ where: { id } })),
        // Отметку посещаемости удаляем по классу и дню: она могла уже существовать
        ...created.attendance.map(item => prisma.attendance.deleteMany({
            where: { classId: item.classId, date: { gte: item.from, lt: item.to } },
        })),
    ]);
}

async function main() {
    console.log(`=== Контракты модалок → API: ${BASE} ===\n`);

    const user = await login();
    check('вход выполнен', Boolean(user?.email), JSON.stringify(user));
    if (!user?.email) process.exit(1);

    const classes = await (await session.fetch(`${BASE}/api/classes`)).json();
    const cls = (classes || []).find(c => c.isOwner && (c.students || []).length > 0) || (classes || [])[0];
    check('получен класс с учениками', Boolean(cls) && (cls.students || []).length > 0, JSON.stringify(cls?.name));

    const students = cls.students || [];
    const [first, second] = students;
    const today = toLocalISODate();

    /* ---------------------------- Пропуск ---------------------------- */
    console.log('\n1) PassModal → POST /api/passes');
    {
        const payload = {
            date: today,
            classId: cls.id,
            students: [{ id: first.id, name: first.name }],
            exitTime: '13:00',
            reason: 'Заявление родителей',
        };
        const res = await session.json(`${BASE}/api/passes`, 'POST', payload);
        const data = await res.json().catch(() => ({}));
        check('пропуск создан', res.ok && Boolean(data.id), `HTTP ${res.status}`);
        if (data.id) created.passes.push(data.id);

        const list = await (await session.fetch(`${BASE}/api/passes?classId=${cls.id}&date=${today}`)).json();
        const saved = Array.isArray(list) ? list.find(p => p.id === data.id) : null;
        check('пропуск читается обратно с учеником', Boolean(saved) && Array.isArray(saved.students) && saved.students.length === 1,
            JSON.stringify(saved?.students));
    }

    /* -------------------------- Посещаемость ------------------------- */
    console.log('\n2) AttendanceModal → POST /api/attendance');
    {
        const absent = String(second.id);
        const payload = {
            date: today,
            classId: cls.id,
            presentStudents: students.map(s => String(s.id)).filter(id => id !== absent),
            absentStudents: [absent],
            absentReasons: { [absent]: 'sick' },
        };
        // Запоминаем день, чтобы убрать отметку после проверки и не засорять данные
        const from = new Date(`${today}T00:00:00`);
        const to = new Date(from);
        to.setDate(to.getDate() + 1);
        created.attendance.push({ classId: cls.id, from, to });

        const res = await session.json(`${BASE}/api/attendance`, 'POST', payload);
        const data = await res.json().catch(() => ({}));
        check('отметка сохранена', res.ok, `HTTP ${res.status}`);

        const readBack = await (await session.fetch(`${BASE}/api/attendance?classId=${cls.id}&date=${today}`)).json();
        check('отсутствующий сохранился как строка',
            Array.isArray(readBack?.absentStudents) && readBack.absentStudents.map(String).includes(absent),
            JSON.stringify(readBack?.absentStudents));
        check('причина отсутствия сохранилась', readBack?.absentReasons?.[absent] === 'sick',
            JSON.stringify(readBack?.absentReasons));

        const admin = await (await session.fetch(`${BASE}/api/admin/attendance-data?date=${today}`)).json();
        const row = (admin.classes || []).find(c => c.id === cls.id);
        const absentRow = (row?.absentStudents || []).find(s => String(s.id) === absent);
        check('в отчёте отсутствующий с именем и причиной',
            Boolean(absentRow) && absentRow.name === second.name && absentRow.reason === 'sick',
            JSON.stringify(absentRow));
    }

    /* --------------------------- Нарушение --------------------------- */
    console.log('\n3) ViolationModal → POST /api/violations');
    {
        const payload = {
            studentId: String(first.id),
            studentName: first.name,
            className: cls.name,
            violationType: 'late',
            comment: 'Тест контракта модалки',
        };
        const res = await session.json(`${BASE}/api/violations`, 'POST', payload);
        const data = await res.json().catch(() => ({}));
        check('нарушение создано', res.ok && Boolean(data.id), `HTTP ${res.status} ${JSON.stringify(data).slice(0, 120)}`);
        if (data.id) created.violations.push(data.id);

        const list = await (await session.fetch(`${BASE}/api/violations?studentId=${first.id}&date=${today}&pageSize=50`)).json();
        const rows = Array.isArray(list) ? list : (list.violations || []);
        check('нарушение видно в списке за день', rows.some(v => v.id === data.id), `строк: ${rows.length}`);
    }

    /* --------------------------- Самовыход --------------------------- */
    console.log('\n4) SelfExitModal → POST /api/self-exit');
    {
        const payload = {
            studentId: first.id,
            studentName: first.name,
            startDate: today,
            endDate: today,
            photoUrl: '',
            reason: 'Тест контракта модалки',
            classId: cls.id,
        };
        const res = await session.json(`${BASE}/api/self-exit`, 'POST', payload);
        const data = await res.json().catch(() => ({}));
        check('самовыход создан', res.ok && Boolean(data.id), `HTTP ${res.status} ${JSON.stringify(data).slice(0, 120)}`);
        if (data.id) created.selfExits.push(data.id);
    }

    /* -------------------------- Доверенность ------------------------- */
    console.log('\n5) AuthorizationModal → POST /api/authorizations');
    {
        const payload = {
            studentId: first.id,
            studentName: first.name,
            className: cls.name,
            trustedName: 'Иванова Мария Петровна',
            relation: 'Мама',
            phone: null,
            comment: 'Тест контракта модалки',
        };
        const res = await session.json(`${BASE}/api/authorizations`, 'POST', payload);
        const data = await res.json().catch(() => ({}));
        check('доверенность создана', res.ok && Boolean(data.id), `HTTP ${res.status} ${JSON.stringify(data).slice(0, 120)}`);
        if (data.id) created.authorizations.push(data.id);
    }

    /* ------------------------------ ВШУ ------------------------------ */
    console.log('\n6) SchoolRecordModal → POST /api/school-records и PUT /api/school-records');
    {
        // на всякий случай снимаем прошлую активную запись, чтобы не получить 400 «уже на учёте»
        await prisma.schoolRecord.deleteMany({ where: { studentId: String(first.id) } });

        const payload = {
            studentId: first.id,
            studentName: first.name,
            className: cls.name,
            reason: 'Тест контракта модалки',
            registeredAt: today,
            plannedReleaseAt: today,
        };
        const res = await session.json(`${BASE}/api/school-records`, 'POST', payload);
        const data = await res.json().catch(() => ({}));
        check('постановка на учёт', res.ok && Boolean(data.id), `HTTP ${res.status} ${JSON.stringify(data).slice(0, 120)}`);
        if (data.id) created.schoolRecords.push(data.id);

        const release = await session.json(`${BASE}/api/school-records`, 'PUT', {
            id: data.id,
            releaseReason: 'Тест контракта модалки',
            releasedAt: today,
        });
        const released = await release.json().catch(() => ({}));
        check('снятие с учёта', release.ok && released.isActive === false, `HTTP ${release.status}`);
    }

    await cleanup();

    console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error('Ошибка теста:', e);
    await cleanup().catch(() => { });
    await prisma.$disconnect().catch(() => { });
    process.exit(1);
});

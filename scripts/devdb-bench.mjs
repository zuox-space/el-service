// Замер стоимости запросов: сколько SQL-вызовов и времени уходит на каждую страницу.
// Запуск: node scripts/devdb-bench.mjs [http://localhost:3000]
const BASE = process.argv[2] || 'http://localhost:3000';
const email = process.env.EL_BENCH_EMAIL || 'ivanova@school1298.ru';

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
}

const session = new Session();
const csrf = await (await session.fetch(`${BASE}/api/auth/csrf`)).json();
await session.fetch(`${BASE}/api/auth/callback/dev-credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, code: 'dev', csrfToken: csrf.csrfToken, callbackUrl: BASE, json: 'true' }),
});

const endpoints = process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['/api/classes', '/api/admin/classes', '/api/admin/attendance-data', '/api/admin/classes-stats', '/api/admin/truants?startDate=2026-08-07&endDate=2026-10-16'];

console.log('endpoint                                          | попытка 1 | попытка 2 | попытка 3 | размер');
console.log('--------------------------------------------------|-----------|-----------|-----------|--------');

for (const endpoint of endpoints) {
    const times = [];
    let size = 0;

    // Первый запрос может компилировать маршрут — прогреваем отдельно
    await session.fetch(`${BASE}${endpoint}`);

    for (let i = 0; i < 3; i++) {
        const started = Date.now();
        const res = await session.fetch(`${BASE}${endpoint}`);
        const text = await res.text();
        times.push(Date.now() - started);
        size = text.length;
    }

    const name = endpoint.length > 48 ? endpoint.slice(0, 48) : endpoint.padEnd(48);
    console.log(`${name} | ${String(times[0]).padStart(8)} мс | ${String(times[1]).padStart(8)} мс | ${String(times[2]).padStart(8)} мс | ${(size / 1024).toFixed(1)} КБ`);
}

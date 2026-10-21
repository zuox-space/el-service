// Быстрая проверка произвольного API от имени вошедшего сотрудника.
//
// Запуск: node scripts/devdb-api.mjs "/api/classes" [email]
//
// Удобно для отладки: логинится локальным провайдером (DEV_LOGIN=true) и печатает
// краткую сводку ответа, не вываливая весь JSON в консоль.
const BASE = process.env.EL_BASE_URL || 'http://localhost:3000';
const endpoint = process.argv[2] || '/api/auth/session';
const email = process.argv[3] || 'ivanova@school1298.ru';

class Session {
    constructor() { this.cookies = new Map(); }
    header() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
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

function summarize(value, depth = 0) {
    if (Array.isArray(value)) {
        console.log(`${'  '.repeat(depth)}массив, элементов: ${value.length}`);
        if (value.length) summarize(value[0], depth + 1);
        return;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        console.log(`${'  '.repeat(depth)}объект, поля: ${keys.join(', ')}`);
        for (const key of keys.slice(0, 6)) {
            const v = value[key];
            if (Array.isArray(v)) {
                console.log(`${'  '.repeat(depth + 1)}${key}: массив (${v.length})`);
                if (v.length && typeof v[0] === 'object') summarize(v[0], depth + 2);
            } else if (v && typeof v === 'object') {
                console.log(`${'  '.repeat(depth + 1)}${key}:`);
                summarize(v, depth + 2);
            } else {
                console.log(`${'  '.repeat(depth + 1)}${key}: ${JSON.stringify(v)}`);
            }
        }
        return;
    }
    console.log(`${'  '.repeat(depth)}${JSON.stringify(value)}`);
}

const session = new Session();
const csrfRes = await session.fetch(`${BASE}/api/auth/csrf`);
const { csrfToken } = await csrfRes.json();

const loginRes = await session.fetch(`${BASE}/api/auth/callback/dev-credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, code: 'dev', csrfToken, callbackUrl: BASE, json: 'true' }),
});
console.log(`Вход (${email}): HTTP ${loginRes.status}`);

const res = await session.fetch(`${BASE}${endpoint}`);
console.log(`\nGET ${endpoint} → HTTP ${res.status}\n`);

const text = await res.text();
try {
    summarize(JSON.parse(text));
} catch {
    console.log(text.slice(0, 500));
}

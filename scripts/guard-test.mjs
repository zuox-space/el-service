#!/usr/bin/env node
// scripts/guard-test.mjs
//
// Проверка отдельного контура охраны:
//   GUARD_LOGIN=... GUARD_PASSWORD=... node scripts/guard-test.mjs http://localhost:3000
//
// Логин/пароль берутся из env — те же, что у планшета.

const BASE = process.argv[2] || "http://localhost:3000";
const LOGIN = process.env.GUARD_LOGIN;
const PASSWORD = process.env.GUARD_PASSWORD;

if (!LOGIN || !PASSWORD) {
    console.error("Нужны GUARD_LOGIN и GUARD_PASSWORD в окружении");
    process.exit(1);
}

let passed = 0;
let failed = 0;

function check(name, condition, extra = "") {
    if (condition) {
        passed++;
        console.log(`  ✅ ${name}`);
    } else {
        failed++;
        console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
    }
}

class Session {
    constructor() {
        this.cookies = new Map();
    }
    header() {
        return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
    }
    store(response) {
        const raw = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
        for (const line of raw) {
            for (const part of String(line).split(/,(?=[^;]+=)/)) {
                const [pair] = part.split(";");
                const index = pair.indexOf("=");
                if (index > 0) this.cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
            }
        }
    }
    async request(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            redirect: "manual",
            headers: { ...(options.headers || {}), cookie: this.header() },
        });
        this.store(response);
        return response;
    }
    async json(url, options) {
        const response = await this.request(url, options);
        return { status: response.status, data: await response.json().catch(() => ({})) };
    }
    async login(email) {
        this.cookies.clear();
        const csrf = await (await this.request(`${BASE}/api/auth/csrf`)).json();
        await this.request(`${BASE}/api/auth/callback/dev-credentials`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                email,
                code: "dev",
                csrfToken: csrf.csrfToken,
                callbackUrl: BASE,
                json: "true",
            }),
        });
    }
}

const guard = new Session();
const admin = new Session();
const employee = new Session();
await admin.login("sokolova@school1298.ru");
await employee.login("petrov@school1298.ru");

console.log("\n1) Защита страницы");
let response = await guard.request(`${BASE}/guard`);
check("без cookie /guard редиректит", response.status === 307 && String(response.headers.get("location")).includes("/guard/login"), response.status);
response = await guard.request(`${BASE}/api/guard/state`);
check("без cookie API → 401", response.status === 401, response.status);

console.log("\n2) Вход");
let result = await guard.json(`${BASE}/api/guard/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: `${PASSWORD}-wrong` }),
});
check("неверный пароль → 401", result.status === 401, result.status);

result = await guard.json(`${BASE}/api/guard/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD }),
});
check("вход охраны", result.status === 200, result.status);
response = await guard.request(`${BASE}/guard`);
check("/guard с cookie", response.status === 200, response.status);

const state = await guard.json(`${BASE}/api/guard/state`);
check("state охраны", state.status === 200 && Boolean(state.data.keys), state.status);
check("в state есть пропуска", Array.isArray(state.data.passes));
check("в state есть самовыходы", Array.isArray(state.data.selfExits));

console.log("\n3) Ключи через охрану");
const building = await admin.json(`${BASE}/api/keys/buildings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `Guard проверка ${Date.now()}` }),
});
const buildingId = building.data.id;
const key = await admin.json(`${BASE}/api/keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ buildingId, roomNumber: "GT1", roomName: "Тест охраны", floor: 1 }),
});
const keyId = key.data.id;

const issue = await employee.json(`${BASE}/api/keys/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "ISSUE", keyIds: [keyId] }),
});
check("сотрудник создал заявку", issue.status === 201, issue.status);

const pending = await guard.json(`${BASE}/api/guard/state`);
check(
    "охрана видит заявку",
    pending.data.keys.requests.some(item => item.id === issue.data.requestId && item.status === "PENDING"),
);

const confirm = await guard.json(`${BASE}/api/guard/requests/${issue.data.requestId}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "confirm" }),
});
check("охрана подтвердила выдачу", confirm.status === 200, confirm.status);

const employeeState = await employee.json(`${BASE}/api/keys/state`);
check("ключ у сотрудника", employeeState.data.state.keys.find(item => item.id === keyId)?.status === "ISSUED");

const history = await guard.json(`${BASE}/api/guard/history?limit=20`);
check("история охраны доступна", history.status === 200 && Array.isArray(history.data.items), history.status);

console.log("\n4) Уборка");
const returnRequest = await employee.json(`${BASE}/api/keys/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "RETURN", keyIds: [keyId] }),
});
const guardState = await guard.json(`${BASE}/api/guard/state`);
const pendingReturn = guardState.data.keys.requests.find(
    item => item.id === returnRequest.data.requestId,
);
await guard.json(`${BASE}/api/guard/requests/${pendingReturn.id}/decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "confirm" }),
});
await admin.json(`${BASE}/api/keys/${keyId}`, { method: "DELETE" });
await admin.json(`${BASE}/api/keys/buildings/${buildingId}`, { method: "DELETE" });
check("уборка выполнена", true);

const logout = await guard.json(`${BASE}/api/guard/logout`, { method: "POST" });
check("выход охраны", logout.status === 200, logout.status);
response = await guard.request(`${BASE}/api/guard/state`);
check("после выхода API → 401", response.status === 401, response.status);

console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===`);
process.exitCode = failed === 0 ? 0 : 1;

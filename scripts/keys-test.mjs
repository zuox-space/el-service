#!/usr/bin/env node
// scripts/keys-test.mjs
//
// E2E-проверка ключницы на запущенном приложении:
//   node scripts/keys-test.mjs http://localhost:3000
//
// Создаёт временное здание и ключи, проходит выдать/сдать/передать,
// проверяет права и ограниченный доступ, затем убирает за собой.

const BASE = process.argv[2] || "http://localhost:3000";
const suffix = Date.now().toString(36);
const buildingName = `Тест ключей ${suffix}`;

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
    async json(url, options) {
        const response = await this.request(url, options);
        const data = await response.json().catch(() => ({}));
        return { status: response.status, data };
    }
    jsonPost(url, body) {
        return this.json(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
    }
}

const admin = new Session();
const employee = new Session();
const colleague = new Session();
const guard = new Session();

await admin.login("sokolova@school1298.ru");
await employee.login("petrov@school1298.ru");
await colleague.login("ivanova@school1298.ru");
await guard.login("security@school1298.ru");

console.log("\n1) Администрирование ключей");
const building = await admin.jsonPost(`${BASE}/api/keys/buildings`, {
    name: buildingName,
    address: "ул. Тестовая",
});
check("здание создано", building.status === 201, building.status);
const buildingId = building.data.id;

const keyIds = [];
for (const room of ["T1", "T2"]) {
    const created = await admin.jsonPost(`${BASE}/api/keys`, {
        buildingId,
        roomNumber: room,
        roomName: `Кабинет ${room}`,
        floor: 1,
    });
    check(`ключ ${room} создан`, created.status === 201, created.status);
    keyIds.push(created.data.id);
}

const forbidden = await employee.jsonPost(`${BASE}/api/keys`, {
    buildingId,
    roomNumber: "T3",
});
check("сотрудник не может создать ключ", forbidden.status === 403 || forbidden.status === 401, forbidden.status);

console.log("\n2) Выдача и сдача");
const issue = await employee.jsonPost(`${BASE}/api/keys/requests`, {
    type: "ISSUE",
    keyIds: [keyIds[0]],
});
check("заявка на выдачу создана", issue.status === 201, issue.status);

const guardState = (await guard.json(`${BASE}/api/keys/state`)).data.state;
check("охрана видит заявку", guardState.requests.some(item => item.id === issue.data.requestId && item.status === "PENDING"));
check("охрана может подтверждать", guardState.canConfirm === true);

const confirmIssue = await guard.jsonPost(`${BASE}/api/keys/requests/${issue.data.requestId}/decision`, {
    action: "confirm",
});
check("выдача подтверждена", confirmIssue.status === 200, confirmIssue.status);

let employeeState = (await employee.json(`${BASE}/api/keys/state`)).data.state;
check("ключ у сотрудника", employeeState.keys.find(key => key.id === keyIds[0])?.status === "ISSUED");

const guardRequest = await guard.jsonPost(`${BASE}/api/keys/requests`, {
    type: "ISSUE",
    keyIds: [keyIds[1]],
});
check("охрана не создаёт заявки", guardRequest.status === 400, guardRequest.status);

const returnRequest = await employee.jsonPost(`${BASE}/api/keys/requests`, {
    type: "RETURN",
    keyIds: [keyIds[0]],
});
await guard.jsonPost(`${BASE}/api/keys/requests/${returnRequest.data.requestId}/decision`, { action: "confirm" });
employeeState = (await employee.json(`${BASE}/api/keys/state`)).data.state;
check("ключ сдан", employeeState.keys.find(key => key.id === keyIds[0])?.status === "FREE");

console.log("\n3) Передача");
await employee.jsonPost(`${BASE}/api/keys/requests`, { type: "ISSUE", keyIds: [keyIds[0]] });
let state = (await guard.json(`${BASE}/api/keys/state`)).data.state;
const pendingIssue = state.requests.find(item => item.type === "ISSUE" && item.status === "PENDING" && item.keys.some(k => k.id === keyIds[0]));
await guard.jsonPost(`${BASE}/api/keys/requests/${pendingIssue.id}/decision`, { action: "confirm" });

const colleagueState = (await colleague.json(`${BASE}/api/keys/state`)).data.state;
const transfer = await employee.jsonPost(`${BASE}/api/keys/requests`, {
    type: "TRANSFER",
    keyIds: [keyIds[0]],
    targetUserId: colleagueState.me.id,
});
check("заявка на передачу создана", transfer.status === 201, transfer.status);

const confirmTransfer = await colleague.jsonPost(`${BASE}/api/keys/requests/${transfer.data.requestId}/decision`, {
    action: "confirm",
});
check("получатель подтвердил", confirmTransfer.status === 200, confirmTransfer.status);
const afterTransfer = (await colleague.json(`${BASE}/api/keys/state`)).data.state;
check("ключ у получателя", afterTransfer.keys.find(key => key.id === keyIds[0])?.holderId === colleagueState.me.id);

const returnAfterTransfer = await colleague.jsonPost(`${BASE}/api/keys/requests`, {
    type: "RETURN",
    keyIds: [keyIds[0]],
});
await guard.jsonPost(`${BASE}/api/keys/requests/${returnAfterTransfer.data.requestId}/decision`, { action: "confirm" });

console.log("\n4) Ограниченный доступ");
const permissions = await admin.json(`${BASE}/api/keys/${keyIds[1]}/permissions`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessScope: "RESTRICTED", userIds: [colleagueState.me.id] }),
});
check("права обновлены", permissions.status === 200, permissions.status);

const colleagueKeys = (await colleague.json(`${BASE}/api/keys/state`)).data.state.keys;
const employeeKeys = (await employee.json(`${BASE}/api/keys/state`)).data.state.keys;
check("получатель права видит ключ", colleagueKeys.some(key => key.id === keyIds[1]));
check("остальные не видят ключ", !employeeKeys.some(key => key.id === keyIds[1]));

console.log("\n5) Страницы и SSE");
for (const [session, path] of [
    [employee, "/keys"],
    [employee, "/"],
    [guard, "/keys"],
    [admin, "/admin/keys"],
]) {
    const response = await session.request(`${BASE}${path}`);
    check(`${path} отвечает 200`, response.status === 200, response.status);
}
const sse = await employee.request(`${BASE}/api/keys/events`);
check("SSE открывается", sse.status === 200 && String(sse.headers.get("content-type")).includes("text/event-stream"));
await sse.body?.cancel().catch(() => {});

console.log("\n6) Уборка");
await admin.json(`${BASE}/api/keys/${keyIds[1]}/permissions`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessScope: "ALL", userIds: [] }),
});
for (const keyId of keyIds) {
    const deleted = await admin.json(`${BASE}/api/keys/${keyId}`, { method: "DELETE" });
    check("ключ удалён", deleted.status === 200, deleted.status);
}
const deletedBuilding = await admin.json(`${BASE}/api/keys/buildings/${buildingId}`, { method: "DELETE" });
check("здание удалено", deletedBuilding.status === 200, deletedBuilding.status);

console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===`);
process.exitCode = failed === 0 ? 0 : 1;

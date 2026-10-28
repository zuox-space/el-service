// scripts/seating-test.mjs
// Проверка электронной рассадки: доступ классного руководителя, чтение,
// сохранение пары учеников и очистка места.
const BASE = process.argv[2] || "http://localhost:3000";
const EMAIL = process.argv[3] || "petrov@school1298.ru";

let passed = 0;
let failed = 0;

function check(name, condition, details = "") {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}${details ? ` — ${details}` : ""}`);
        failed++;
    }
}

const jar = new Map();
function store(res) {
    const raw = typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : [res.headers.get("set-cookie")].filter(Boolean);
    for (const line of raw) {
        for (const part of String(line).split(/,(?=[^;]+=)/)) {
            const [pair] = part.split(";");
            const index = pair.indexOf("=");
            if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
        }
    }
}
async function request(path, options = {}) {
    const response = await fetch(BASE + path, {
        ...options,
        redirect: "manual",
        headers: {
            ...(options.headers || {}),
            cookie: [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; "),
        },
    });
    store(response);
    return response;
}

async function main() {
    console.log(`\n=== Рассадка: ${BASE} / ${EMAIL} ===\n`);

    const csrf = await (await request("/api/auth/csrf")).json();
    const login = await request("/api/auth/callback/dev-credentials", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            email: EMAIL,
            code: "dev",
            csrfToken: csrf.csrfToken,
            callbackUrl: BASE,
            json: "true",
        }),
    });
    check("вход выполнен", login.status < 400, `HTTP ${login.status}`);

    const classesResponse = await request("/api/seating/classes");
    const classes = await classesResponse.json();
    check("классы доступны", classesResponse.ok && Array.isArray(classes.classes) && classes.classes.length > 0);
    const classId = classes.classes?.[0]?.id;
    if (!classId) {
        console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===\n`);
        process.exit(1);
    }

    const getResponse = await request(`/api/seating?classId=${classId}`);
    const seating = await getResponse.json();
    check("рассадка читается", getResponse.ok && Array.isArray(seating.seats), `HTTP ${getResponse.status}`);
    check("ученики класса пришли", Array.isArray(seating.students) && seating.students.length > 0);

    const [first, second] = seating.students ?? [];
    if (first) {
        const save = await request("/api/seating", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ classId, row: 15, desk: 1, left: first.id, right: second?.id ?? null }),
        });
        const saved = await save.json();
        check("пара сохраняется", save.ok && saved.seats?.length >= 1, `HTTP ${save.status}`);

        const after = await (await request(`/api/seating?classId=${classId}`)).json();
        check("сохранённый ученик на месте", after.seats?.some(seat => seat.row === 15 && seat.desk === 1 && seat.studentId === first.id));

        const cleanup = await request("/api/seating", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ classId, row: 15, desk: 1, left: null, right: null }),
        });
        check("место очищается", cleanup.ok, `HTTP ${cleanup.status}`);
    }

    console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error("Проверка рассадки не запустилась:", error);
    process.exit(1);
});

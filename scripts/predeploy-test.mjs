// scripts/predeploy-test.mjs
//
// Быстрые проверки deploy-границ, которые не зависят от бизнес-данных:
// security-заголовки, серверная защита /admin, закрытые API и загрузка файлов.
//
// Запуск: node scripts/predeploy-test.mjs http://localhost:3000
const BASE = process.argv[2] || "http://localhost:3000";

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

async function main() {
    console.log(`\n=== Pre-deploy проверки: ${BASE} ===\n`);

    const login = await fetch(`${BASE}/login`, { redirect: "manual" });
    const headers = login.headers;
    check("X-Content-Type-Options", headers.get("x-content-type-options") === "nosniff");
    check("X-Frame-Options", headers.get("x-frame-options") === "DENY");
    check("Referrer-Policy", headers.get("referrer-policy") === "strict-origin-when-cross-origin");
    check("Permissions-Policy", Boolean(headers.get("permissions-policy")));
    check("X-Powered-By скрыт", !headers.get("x-powered-by"));

    const admin = await fetch(`${BASE}/admin`, { redirect: "manual" });
    const adminBody = await admin.text();
    check(
        "неавторизованный /admin отправляет на вход",
        adminBody.includes("/login?callbackUrl=/admin"),
        `HTTP ${admin.status}`,
    );

    const users = await fetch(`${BASE}/api/admin/users`, { redirect: "manual" });
    check("закрыт /api/admin/users", [401, 403].includes(users.status), `HTTP ${users.status}`);

    const portal = await fetch(`${BASE}/api/portal`, { redirect: "manual" });
    check("закрыт /api/portal", [401, 403].includes(portal.status), `HTTP ${portal.status}`);

    const upload = await fetch(`${BASE}/api/upload`, {
        method: "POST",
        redirect: "manual",
        body: new FormData(),
    });
    check("upload API удалён", upload.status === 404, `HTTP ${upload.status}`);

    const uploadRead = await fetch(`${BASE}/api/upload/self-exit/does-not-exist.jpg`, {
        redirect: "manual",
    });
    check("просмотр uploads удалён", uploadRead.status === 404, `HTTP ${uploadRead.status}`);

    console.log(`\n=== Итог: успешно ${passed}, провалено ${failed} ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error("Pre-deploy проверка не запустилась:", error);
    process.exit(1);
});

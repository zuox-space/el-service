#!/bin/sh
# Точка входа контейнера: дождаться базы, при необходимости накатить схему,
# затем запустить приложение.
set -eu

echo "[entrypoint] запуск el-service"

if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
    echo "[entrypoint] ждём базу данных..."
    node - <<'NODE'
const { Client } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("[entrypoint] DATABASE_URL не задан");
    process.exit(1);
}

let host = "?";
try {
    host = new URL(url).hostname;
} catch {
    console.error("[entrypoint] DATABASE_URL не похож на URL");
    process.exit(1);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    for (let attempt = 1; attempt <= 30; attempt++) {
        // Новый клиент на каждую попытку: после ошибки соединения клиент непригоден
        const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
        try {
            await client.connect();
            await client.query("SELECT 1");
            await client.end();
            console.log(`[entrypoint] база доступна (${host})`);
            return;
        } catch (error) {
            await client.end().catch(() => {});
            const code = error.code || error.message;
            console.log(`[entrypoint] попытка ${attempt}/30: ${code} (host ${host})`);
            if (code === "EAI_AGAIN" || code === "ENOTFOUND") {
                console.log(`[entrypoint] имя "${host}" не резолвится — проверьте Internal Connection URL базы в Dokploy`);
            }
            await sleep(2000);
        }
    }

    console.error("[entrypoint] база недоступна, выходим");
    process.exit(1);
})();
NODE
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "[entrypoint] применяем схему (prisma db push)"
    ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss
fi

if [ "${RUN_NORMALIZE:-false}" = "true" ]; then
    echo "[entrypoint] нормализуем имена классов"
    node scripts/normalize-class-names.mjs --apply
fi

echo "[entrypoint] старт приложения на порту ${PORT:-3000}"
exec "$@"

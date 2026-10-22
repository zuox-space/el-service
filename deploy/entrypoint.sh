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
    console.error("DATABASE_URL не задан");
    process.exit(1);
}

const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });

(async () => {
    for (let attempt = 1; attempt <= 30; attempt++) {
        try {
            await client.connect();
            await client.query("SELECT 1");
            await client.end();
            console.log("[entrypoint] база доступна");
            return;
        } catch (error) {
            console.log(`[entrypoint] попытка ${attempt}/30: ${error.code || error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    console.error("[entrypoint] база недоступна, выходим");
    process.exit(1);
})();
NODE
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "[entrypoint] применяем схему (prisma db push)"
    npx prisma db push --skip-generate --accept-data-loss
fi

if [ "${RUN_NORMALIZE:-false}" = "true" ]; then
    echo "[entrypoint] нормализуем имена классов"
    node scripts/normalize-class-names.mjs --apply
fi

echo "[entrypoint] старт приложения на порту ${PORT:-3000}"
exec "$@"

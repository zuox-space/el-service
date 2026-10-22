#!/usr/bin/env bash
# Один клик: собрать образ, применить схему, поднять приложение.
# Запуск из корня репозитория:  bash deploy/up.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f deploy/env.production ]; then
    echo "Нет deploy/env.production — создаю из примера."
    cp deploy/env.production.example deploy/env.production
    echo "Заполните его и запустите снова: nano deploy/env.production"
    exit 1
fi

echo "== сборка образа =="
docker compose build

echo "== миграция схемы =="
docker compose --profile setup run --rm migrate

echo "== запуск приложения =="
docker compose up -d app

echo "== ожидание healthcheck =="
for i in $(seq 1 60); do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo starting)
    echo "  $i/60: $status"
    if [ "$status" = "healthy" ]; then
        echo "Готово: приложение поднято."
        exit 0
    fi
    sleep 2
done

echo "Приложение не стало healthy за 2 минуты. Логи:"
docker compose logs --tail=80 app
exit 1

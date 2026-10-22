# Docker: один клик

## Что внутри

- `Dockerfile` — multi-stage: зависимости → сборка Next.js → рантайм.
  В образ входят скрипты `sync-teachers`, `normalize-class-names` и Prisma CLI.
- `docker-compose.yml` — сервис `app`, плюс разовые задачи `migrate` и `normalize`
  под профилем `setup`.
- `deploy/entrypoint.sh` — ждёт базу, при `RUN_MIGRATIONS=true` накатывает схему,
  затем запускает `pnpm start`.
- `deploy/env.production.example` — шаблон окружения.
- `deploy/up.sh` (Linux/macOS/Git Bash) и `deploy/up.ps1` (Windows) — один клик.

## Запуск

```bash
cp deploy/env.production.example deploy/env.production
nano deploy/env.production          # заполнить, секреты не коммитим

bash deploy/up.sh
```

Windows PowerShell:

```powershell
Copy-Item deploy\env.production.example deploy\env.production
notepad deploy\env.production
.\deploy\up.ps1
```

`up` собирает образ, применяет схему и поднимает контейнер на `APP_PORT`
(по умолчанию 3000). Healthcheck — `GET /login`.

## Ручные команды

```bash
docker compose build
docker compose --profile setup run --rm migrate     # prisma db push
docker compose --profile setup run --rm normalize   # нормализация классов
docker compose up -d app
docker compose logs -f app
```

Синхронизация сотрудников (первый запуск с --adopt):

```bash
docker compose run --rm --no-deps app node scripts/sync-teachers.mjs --adopt
docker compose run --rm --no-deps app node scripts/sync-teachers.mjs --adopt --apply
```

Импорт дампа в новую базу:

```bash
# 1. схема
docker compose --profile setup run --rm migrate
# 2. данные (файл дампа положить в deploy/dumps и смонтировать)
docker run --rm -v "$PWD/deploy/dumps:/dumps" --env-file deploy/env.production \
  el-service:latest node scripts/import-db.mjs --in /dumps/db.json
```

## Обновление версии

```bash
git pull
docker compose build
docker compose up -d app
```

Схема применяется автоматически при `RUN_MIGRATIONS=true`. После стабильного
деплоя поставьте `RUN_MIGRATIONS=false` и миграции запускайте отдельным шагом.

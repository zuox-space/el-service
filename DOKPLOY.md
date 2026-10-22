# Деплой в Dokploy

Dokploy собирает приложение прямо из GitHub по `Dockerfile`. Ниже — что настроить
в панели и в каком порядке.

## 1. Приложение

- **Тип**: Application → Build type: **Dockerfile**.
- **Репозиторий**: `zuox-space/el-service`.
- **Ветка**: `pre-deploy` (после проверки — `main`).
- **Dockerfile path**: `Dockerfile` (в корне).
- **Порт контейнера**: `3000`.
- **Health check**: `GET /login`, ожидаемый код 200.

Образ сам ждёт базу, при `RUN_MIGRATIONS=true` применяет схему и запускает
`pnpm start` на порту из `PORT` (Dokploy передаёт 3000).

## 2. Переменные окружения

В Dokploy → Environment задайте (не коммитим в git):

```ini
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public
NEXTAUTH_URL=https://ваш-домен
NEXTAUTH_SECRET=длинная-случайная-строка

YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...

DB_HOST=...
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...

PORT=3000
WAIT_FOR_DB=true
RUN_MIGRATIONS=true
```

Первый деплой:

- `RUN_MIGRATIONS=true` — схема создастся/обновится автоматически;
- `RUN_NORMALIZE=true` — один раз, если в базе классы вида «5-А»;
- после успешного деплоя поставьте `RUN_MIGRATIONS=false` и `RUN_NORMALIZE=false`,
  чтобы рестарты не трогали схему.

Пароли со спецсимволами в `DATABASE_URL` кодируйте URL-encode (`@` → `%40` и т.п.).

## 3. База и данные

Dokploy не создаёт базу. На сервере PostgreSQL:

```sql
CREATE DATABASE el_pass_prod OWNER nextapp;
```

Схему применит контейнер при `RUN_MIGRATIONS=true` (или вручную):

```bash
docker compose --profile setup run --rm migrate   # локально
# либо в Dokploy: Terminal → ./node_modules/.bin/prisma db push --accept-data-loss
```

Импорт существующих данных (дамп JSON с машины, где есть доступ к базе):

```bash
node scripts/import-db.mjs \
  --database-url "postgresql://USER:PASSWORD@HOST:5432/DBNAME" \
  --in deploy/dumps/el_pass_copy_after.json
```

## 4. Первая синхронизация сотрудников

В Dokploy → Terminal приложения:

```bash
node scripts/sync-teachers.mjs --adopt          # проверка, ничего не пишет
node scripts/sync-teachers.mjs --adopt --apply  # запись
```

Повторный прогон должен дать нули. Дальше — кнопка «Проверить» на `/admin/sync`.

## 5. Домен и HTTPS

- Добавьте домен в Dokploy, включите Let's Encrypt.
- `NEXTAUTH_URL` должен точно совпадать с доменом (`https://...`), иначе вход
  через Яндекс будет возвращать на неправильный адрес.

## 6. Обновление версии

1. Смержить `pre-deploy` в `main`.
2. В Dokploy — Redeploy (или push в отслеживаемую ветку).
3. Проверить `/login`, `/admin`, `/admin/classes`, `/admin/sync`.

## 7. Откат

- В Dokploy выберите предыдущий деплой → Redeploy.
- База: `pg_restore` из дампа, снятого перед релизом.

## 8. Что важно не забыть

- `DEV_LOGIN` **не** задавать.
- `NEXTAUTH_SECRET` менять только осознанно — это сбросит сессии.
- Образ содержит `scripts/`, поэтому синхронизация и нормализация доступны
  из терминала контейнера.
- Healthcheck обращается к `/login`; если приложение не поднялось, Dokploy
  покажет это в логах деплоя.

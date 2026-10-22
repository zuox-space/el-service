# Деплой приложения: от А до Я

Инструкция для выкладки текущей ветки на сервер школы. Порядок важен: сначала
бэкап и миграция, потом данные, только потом приложение.

> ⚠️ Пароль `new_admin` и другие доступы, которые передавались в переписке,
> перед боем смените. Секреты в репозиторий не коммитим.

---

## 0. Что должно быть готово

- Сервер: Linux или Windows, Node.js **20+** (проверено на 24), `pnpm`.
- Доступ к PostgreSQL приложения и к MySQL АИС (список учеников).
- Домен и HTTPS: `NEXTAUTH_URL` должен совпадать с адресом, по которому заходят люди.
- 30–60 минут и окно, когда можно перезапустить приложение.

Проверить версии:

```bash
node -v
pnpm -v
```

---

## 1. Бэкап (без него дальше не идти)

```bash
pg_dump "$DATABASE_URL" -Fc -f backup_$(date +%F_%H%M).dump
ls -lh backup_*.dump
```

Если база большая — проверьте, что дамп читается:

```bash
pg_restore --list backup_*.dump | head
```

Сохраните также текущий коммит, чтобы знать, куда откатываться:

```bash
git rev-parse HEAD > release_before.txt
```

---

## 2. Код и сборка

```bash
git fetch
git checkout el-service-teachers-sync     # или main, если ветка смержена
git pull

pnpm install --frozen-lockfile
pnpm db:generate                          # prisma generate
pnpm build
```

Ожидаемо: `✓ Compiled successfully`, все страницы сгенерированы. В конце может
быть ошибка symlink в `.next/standalone` на OneDrive/Windows — на Linux её нет.

Если сборка падает — дальше не идти, разбираться с ошибкой.

---

## 3. Переменные окружения

Файл `.env` (или переменные сервиса) — **не** `.env.local`:

```ini
# Приложение
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME"
NEXTAUTH_URL="https://school.example.ru"
NEXTAUTH_SECRET="длинная случайная строка"

# Вход через Яндекс
YANDEX_CLIENT_ID="..."
YANDEX_CLIENT_SECRET="..."

# АИС: список учеников (MySQL)
DB_HOST="..."
DB_PORT="3306"
DB_USER="..."
DB_PASSWORD="..."
DB_NAME="..."

# В проде должно отсутствовать:
# DEV_LOGIN="true"
```

Проверка, что секрет есть и не пустой:

```bash
node -e "console.log(Boolean(process.env.NEXTAUTH_SECRET))"
```

`NEXTAUTH_SECRET` менять при деплое не обязательно, но если меняли — все сессии
сбросятся, люди войдут заново.

---

## 4. Миграция схемы

База должна совпадать с `prisma/schema.prisma` целиком, а не только полями
синхронизации. Проверить разницу:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Если diff не пустой — применить. Два варианта:

**А. Через Prisma (проще, если нет дублей классов):**

```bash
pnpm db:push
```

**Б. SQL-ом (если нужен контроль):** выполнить вывод diff-а, либо
`scripts/sql/teachers-sync-migration.sql` в два этапа (сначала колонки, потом
уникальные индексы — после нормализации классов, см. шаг 5).

Что должно появиться:

- `User`: `externalId`, `syncEnabled`, `archived`, `archivedAt`, `accessOverride`;
- `Role.defaultSections`, `Violation.resolved*`, таблица `SectionAccess`;
- `Class.ownerId` — nullable; уникальные индексы `Class.name`, `User.externalId`.

Проверка:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='User' AND column_name IN ('externalId','syncEnabled','archived','archivedAt');

SELECT COUNT(*) FROM "Class" GROUP BY name HAVING COUNT(*) > 1;  -- пусто
```

---

## 5. Нормализация классов «5-А → 5А»

Сначала проверка, потом запись:

```bash
node scripts/normalize-class-names.mjs
node scripts/normalize-class-names.mjs --apply
```

Скрипт переименовывает классы, сливает дубли (посещаемость, пропуска, ВШУ,
заметки, новости, шаринги) и чистит `className` в нарушениях, ВШУ, доверенностях.

После — добить уникальные индексы, если применяли SQL-вариант:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "User_externalId_key" ON "User"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Class_name_key" ON "Class"("name");
```

Проверка:

```sql
SELECT COUNT(*) FROM "Class" WHERE name LIKE '%-%';           -- 0
SELECT COUNT(*) FROM "Violation" WHERE "className" LIKE '%-%'; -- 0
```

---

## 6. Первая синхронизация сотрудников

Сначала **проверка**:

```bash
node scripts/sync-teachers.mjs --adopt
```

Смотрим отчёт:

- `взято под синхронизацию` — сколько существующих сотрудников подключится;
- `создано пользователей` — если неожиданно много, email в базе не совпадают
  с источником: остановиться и сверить;
- `пропущено ручных` — кого не сопоставили;
- `конфликты классов` — один класс заявлен двумя учителями.

Если всё ожидаемо — запись:

```bash
node scripts/sync-teachers.mjs --adopt --apply
```

Повторный прогон должен дать нули:

```bash
node scripts/sync-teachers.mjs --adopt
# создано 0, обновлено 0, взято 0, архив 0, классы 0, роли +0/−0
```

---

## 7. Запуск приложения

### Вариант pm2

```bash
pm2 start pnpm --name el-service -- start
pm2 save
```

или, если деплой через standalone-сборку:

```bash
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
node .next/standalone/server.js
```

### Вариант systemd

```ini
[Unit]
Description=el-service
After=network.target

[Service]
WorkingDirectory=/srv/el-service
EnvironmentFile=/srv/el-service/.env
ExecStart=/usr/bin/pnpm start
Restart=always
User=el-service

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now el-service
journalctl -u el-service -f
```

### Вариант Docker

```bash
docker build -t el-service .
docker run -d --name el-service --env-file .env -p 3000:3000 el-service
```

Проверка, что процесс поднялся:

```bash
curl -I https://school.example.ru/login
```

---

## 8. Проверка после деплоя

Пройдите по списку, каждый пункт — в браузере:

1. `/login` — вход работает (Яндекс и/или локальный, если включён).
2. `/` — портал: «Мой класс» у классного руководителя, «Админ панель» у админа.
3. `/admin/classes` — 118 классов, у каждого есть классный руководитель.
4. Класс открывается: ученики на месте (если пусто — проблема с MySQL АИС, шаг 3).
5. `/admin/violations` — нарушения видны, фильтр по классу работает.
6. `/my-class` у учителя — свой класс, посещаемость, нарушения.
7. `/admin/sync` — «Проверить» показывает 0 изменений; «Синхронизировать» не нажимаем без нужды.
8. Архивированный сотрудник не входит (если есть такой для проверки).
9. `/admin/users` — роли и флаги синхронизации отображаются.

Если что-то не так — смотрите `pm2 logs` / `journalctl` / `docker logs`.

---

## 9. Регулярная синхронизация

Cron (ежедневно в 06:00):

```cron
0 6 * * * cd /srv/el-service && /usr/bin/node scripts/sync-teachers.mjs --apply --report /var/log/teachers-sync.json
```

Отчёт храните: по нему видно, кого архивировали и какие классы передали.
Альтернатива — кнопка на `/admin/sync`.

---

## 10. Откат

Если после деплоя что-то сломалось:

1. Остановить приложение и cron-синхронизацию.
2. Вернуть базу:

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" backup_*.dump
```

3. Вернуть код:

```bash
git checkout $(cat release_before.txt)
pnpm install --frozen-lockfile
pnpm build
pm2 restart el-service
```

Поля синхронизации старой версии не мешают — откат кода безопасен.

---

## 11. Почему «не видно данных»

Чаще всего приложение смотрит не на ту базу. Проверьте по порядку:

1. **Какой процесс и какой у него `DATABASE_URL`.**

   ```bash
   pm2 env 0 | grep DATABASE_URL
   # или
   systemctl show el-service -p Environment
   ```

2. **Локальный запуск ≠ прод.** На `localhost:3000` в этом проекте `.env.local`
   указывает на локальную мок-базу: там 8 сотрудников, 12 классов, 236 нарушений.
   Данные копии (`el_pass_copy`, 292/118/1669) видны только если процесс запущен
   с её `DATABASE_URL`.

3. **Приложение не перезапущено после смены `.env`.** Next читает переменные при
   старте процесса — нужен рестарт.

4. **MySQL АИС недоступен.** Тогда пользователи и нарушения есть, а списки классов
   пустые: в логах `ECONNREFUSED`/`ETIMEDOUT` к `DB_HOST:DB_PORT`. Проверьте доступ
   с сервера: `nc -vz $DB_HOST $DB_PORT` (или `Test-NetConnection` на Windows).

5. **База не мигрирована.** В логах `The column ... does not exist` — вернитесь к шагу 4.

6. **Старый service worker / кэш PWA.** Обновите страницу с `Ctrl+F5`; после
   крупного деплоя помогает очистка данных сайта.

7. **Сессия от старого `NEXTAUTH_SECRET`.** Разлогиньтесь и войдите заново.

---

## 12. Чек-лист одной страницей

- [ ] Дамп базы сделан и проверен
- [ ] Зафиксирован коммит для отката
- [ ] `pnpm install && pnpm build` без ошибок
- [ ] `.env`: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, Яндекс, MySQL АИС
- [ ] `DEV_LOGIN` отсутствует
- [ ] Схема совпадает с `schema.prisma` (diff пустой)
- [ ] Классы нормализованы, дублей и дефисов нет
- [ ] `sync-teachers --adopt` проверен, затем применён
- [ ] Повторный прогон — нули
- [ ] Приложение перезапущено
- [ ] Все 9 пунктов проверки после деплоя пройдены
- [ ] Cron синхронизации настроен, отчёт пишется
- [ ] Пароли, светившиеся в переписке, сменены

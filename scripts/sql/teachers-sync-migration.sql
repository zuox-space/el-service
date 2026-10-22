-- Миграция для синхронизации сотрудников на существующей базе.
--
-- Порядок применения:
--   1) этот файл, ЧАСТЬ 1 (колонки + nullable owner);
--   2) scripts/normalize-class-names.mjs --apply (слияние «5-А» и «5А»);
--   3) этот файл, ЧАСТЬ 2 (уникальные индексы).
--
-- Части разделены, потому что уникальный индекс на Class.name не создастся,
-- пока в таблице есть классы-двойники.

-- ============================== ЧАСТЬ 1 ==============================

-- Поля синхронизации и архива
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "syncEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "archived"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Класс может остаться без классного руководителя (уволен / сменился)
ALTER TABLE "Class" ALTER COLUMN "ownerId" DROP NOT NULL;

-- ============================== ЧАСТЬ 2 ==============================
-- Выполнять после normalize-class-names.mjs --apply

CREATE UNIQUE INDEX IF NOT EXISTS "User_externalId_key" ON "User"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Class_name_key" ON "Class"("name");

-- Проверки после миграции:
-- SELECT COUNT(*) FROM "Class" c LEFT JOIN "User" u ON u.id = c."ownerId" WHERE c."ownerId" IS NOT NULL AND u.id IS NULL;
-- SELECT "name", COUNT(*) FROM "Class" GROUP BY "name" HAVING COUNT(*) > 1;

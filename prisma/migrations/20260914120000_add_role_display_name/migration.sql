-- Отображаемое название роли отдельно от технического тега.
-- Существующие роли продолжают работать: при пустом displayName интерфейс
-- берёт подпись из lib/roles.ts.
ALTER TABLE "Role" ADD COLUMN "displayName" TEXT;

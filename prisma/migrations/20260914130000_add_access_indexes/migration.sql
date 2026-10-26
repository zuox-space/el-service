-- Индексы для частых проверок доступа и статистики.
-- Без них при 200–300 параллельных запросах Class.ownerId,
-- ClassShare.teacherId и UserRole.roleId читались полным сканом.
CREATE INDEX "Class_ownerId_idx" ON "Class"("ownerId");
CREATE INDEX "ClassShare_teacherId_idx" ON "ClassShare"("teacherId");
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
CREATE INDEX "Violation_resolvedBy_idx" ON "Violation"("resolvedBy");

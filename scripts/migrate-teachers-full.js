// scripts/migrate-teachers-full.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TEACHERS_URL = 'https://school1298.ru/portal/workers/workersPS-no.json';

// ============ ЗАГРУЗКА ДАННЫХ ============

async function fetchTeachers() {
  try {
    console.log('📡 Загрузка данных учителей...');
    const response = await fetch(TEACHERS_URL);
    const data = await response.json();

    if (!data.value || !Array.isArray(data.value)) {
      throw new Error('Неверный формат данных');
    }

    return data.value;
  } catch (error) {
    console.error('❌ Ошибка загрузки:', error.message);
    return [];
  }
}

// ============ ПАРСИНГ КЛАССОВ ============

function parseClasses(classStr) {
  if (!classStr || classStr === 'нет' || classStr === null) return [];

  const classes = classStr.split(',').map(c => c.trim());

  return classes.map(className => {
    // 🔥 ИСПРАВЛЕНО: поддержка русских букв (А-Я, Ё, а-я, ё)
    const match = className.match(/^(\d+)-([А-ЯЁа-яёA-Za-z])$/);
    if (match) {
      return {
        name: className,
        grade: parseInt(match[1]),
        letter: match[2].toUpperCase()
      };
    }

    // Если не подходит под формат — возвращаем с пустыми данными
    console.warn(`   ⚠️ Не удалось распарсить класс: "${className}"`);
    return {
      name: className,
      grade: 0,
      letter: ''
    };
  });
}

// ============ РОЛИ ============

async function getRoleId(roleName) {
  let role = await prisma.role.findFirst({
    where: { name: roleName }
  });

  if (!role) {
    role = await prisma.role.create({
      data: { name: roleName, description: roleName }
    });
    console.log(`✅ Создана роль: ${roleName}`);
  }

  return role.id;
}

// ============ НОРМАЛИЗАЦИЯ EMAIL СУЩЕСТВУЮЩИХ ПОЛЬЗОВАТЕЛЕЙ ============

async function normalizeExistingUsers() {
  console.log('🔍 Проверка существующих пользователей...\n');

  const users = await prisma.user.findMany();
  let updated = 0;
  let skipped = 0;
  let deleted = 0;

  for (const user of users) {
    const normalizedEmail = user.email.toLowerCase().trim();

    if (user.email !== normalizedEmail) {
      // Проверяем, нет ли уже пользователя с таким email
      const existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      });

      if (existingUser) {
        // Есть дубликат — удаляем текущего, переносим данные
        console.log(`   🗑️ Дубликат: ${user.email} → ${normalizedEmail}`);
        console.log(`      Переносим данные на существующего пользователя`);

        await prisma.$transaction(async (tx) => {
          // 1. Обновляем классы
          await tx.class.updateMany({
            where: { ownerId: user.id },
            data: { ownerId: existingUser.id }
          });

          // 2. Обновляем ClassShare
          await tx.classShare.updateMany({
            where: { teacherId: user.id },
            data: { teacherId: existingUser.id }
          });

          // 3. Обновляем Attendance
          await tx.attendance.updateMany({
            where: { teacherId: user.id },
            data: { teacherId: existingUser.id }
          });

          // 4. Обновляем Pass
          await tx.pass.updateMany({
            where: { teacherId: user.id },
            data: { teacherId: existingUser.id }
          });

          // 5. Удаляем старые роли
          await tx.userRole.deleteMany({
            where: { userId: user.id }
          });

          // 6. Удаляем пользователя
          await tx.user.delete({
            where: { id: user.id }
          });
        });

        deleted++;
      } else {
        // Просто обновляем email
        await prisma.user.update({
          where: { id: user.id },
          data: { email: normalizedEmail }
        });
        console.log(`   ✅ Email обновлён: ${user.email} → ${normalizedEmail}`);
        updated++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n📊 Нормализация: обновлено ${updated}, удалено ${deleted}, пропущено ${skipped}\n`);
}

// ============ ОСНОВНАЯ МИГРАЦИЯ ============

async function migrateTeachers() {
  console.log('🚀 Начинаем миграцию учителей...\n');

  // 1. Нормализуем существующих пользователей
  await normalizeExistingUsers();

  console.log('='.repeat(60) + '\n');

  // 2. Загружаем учителей из JSON
  const teachers = await fetchTeachers();

  if (teachers.length === 0) {
    console.log('❌ Нет данных для миграции');
    return;
  }

  console.log(`📋 Найдено ${teachers.length} записей\n`);

  // 3. Получаем ID ролей
  const teacherRoleId = await getRoleId('TEACHER');
  const classTeacherRoleId = await getRoleId('CLASS_TEACHER');

  // Счётчики
  let created = 0;
  let invalid = 0;
  let classesCreated = 0;
  let classesUpdated = 0;
  let classTeachersAssigned = 0;

  // 4. Обрабатываем каждого учителя
  for (const teacher of teachers) {
    const email = teacher.email ? teacher.email.toLowerCase().trim() : '';
    const name = teacher.name;
    const classStr = teacher.classStr;

    // Валидация
    if (!email || email === 'нет' || email === 'null' || !email.includes('@')) {
      invalid++;
      continue;
    }

    if (!name || name === 'нет') {
      invalid++;
      continue;
    }

    try {
      // ============================================
      // ШАГ 1: НАЙТИ ИЛИ СОЗДАТЬ ПОЛЬЗОВАТЕЛЯ
      // ============================================
      let user = await prisma.user.findUnique({
        where: { email: email }
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email: email,
            name: name,
          }
        });
        created++;
        console.log(`\n✅ Добавлен пользователь: ${name} (${email})`);
      } else {
        console.log(`\n👤 Пользователь уже существует: ${name} (${email})`);
      }

      // ============================================
      // ШАГ 2: НАЗНАЧИТЬ РОЛЬ TEACHER (ВСЕГДА)
      // ============================================
      const existingTeacherRole = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: teacherRoleId }
      });

      if (!existingTeacherRole) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: teacherRoleId,
            assignedBy: 'migration'
          }
        });
        console.log(`   📌 Назначена роль TEACHER`);
      }

      // ============================================
      // ШАГ 3: ОБРАБОТКА КЛАССОВ (ВСЕГДА, ВНЕ if/else!)
      // ============================================
      if (classStr && classStr !== 'нет' && classStr !== null) {
        const classes = parseClasses(classStr);

        if (classes.length > 0) {
          console.log(`   📚 Классы: ${classStr}`);

          for (const classInfo of classes) {
            // Ищем класс с учётом регистра (на всякий случай)
            let classData = await prisma.class.findFirst({
              where: {
                OR: [
                  { name: classInfo.name },
                  { name: classInfo.name.toLowerCase() },
                  { name: classInfo.name.toUpperCase() },
                ]
              }
            });

            if (!classData) {
              // ============ КЛАССА НЕТ — СОЗДАЁМ ============
              classData = await prisma.class.create({
                data: {
                  name: classInfo.name,
                  grade: classInfo.grade,
                  letter: classInfo.letter,
                  ownerId: user.id,
                }
              });
              classesCreated++;
              console.log(`      ✅ Создан класс: ${classInfo.name}`);
            } else {
              // ============ КЛАСС ЕСТЬ — ОБНОВЛЯЕМ ============
              const needsUpdate =
                classData.ownerId !== user.id ||
                classData.grade !== classInfo.grade ||
                classData.letter !== classInfo.letter ||
                classData.name !== classInfo.name;

              if (needsUpdate) {
                await prisma.class.update({
                  where: { id: classData.id },
                  data: {
                    ownerId: user.id,
                    grade: classInfo.grade,
                    letter: classInfo.letter,
                    name: classInfo.name,
                  }
                });
                classesUpdated++;
                console.log(`      🔄 Обновлён класс: ${classInfo.name} (новый владелец)`);
              } else {
                console.log(`      ✓ Класс ${classInfo.name} без изменений`);
              }
            }

            // ============================================
            // ШАГ 4: НАЗНАЧИТЬ РОЛЬ CLASS_TEACHER
            // ============================================
            const existingClassTeacherRole = await prisma.userRole.findFirst({
              where: { userId: user.id, roleId: classTeacherRoleId }
            });

            if (!existingClassTeacherRole) {
              await prisma.userRole.create({
                data: {
                  userId: user.id,
                  roleId: classTeacherRoleId,
                  assignedBy: 'migration'
                }
              });
              console.log(`      📌 Назначена роль CLASS_TEACHER`);
              classTeachersAssigned++;
            }
          }
        } else {
          console.log(`   ⚠️ Не удалось распарсить классы: "${classStr}"`);
        }
      }

    } catch (error) {
      console.error(`❌ Ошибка при обработке ${name} (${email}):`, error.message);
    }
  }

  // 5. Итоги
  console.log('\n' + '='.repeat(60));
  console.log('📊 ИТОГИ МИГРАЦИИ:');
  console.log('='.repeat(60));
  console.log(`   👥 Пользователей создано:           ${created}`);
  console.log(`   📚 Классов создано:                 ${classesCreated}`);
  console.log(`   🔄 Классов обновлено:               ${classesUpdated}`);
  console.log(`   🎓 Назначено классных руководителей: ${classTeachersAssigned}`);
  console.log(`   ⏭️ Пропущено (нет данных):          ${invalid}`);
  console.log(`   📋 Всего обработано:                ${teachers.length}`);
  console.log('='.repeat(60) + '\n');

  await prisma.$disconnect();
}

// ============ ЗАПУСК ============

migrateTeachers().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});
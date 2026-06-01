const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TEACHERS_URL = 'https://school1298.ru/portal/workers/workersPS-no.json';

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

// Парсинг строки с классами (например: "5-А,5-Б,6-В" или "5-А")
function parseClasses(classStr) {
  if (!classStr || classStr === 'нет' || classStr === null) return [];
  
  // Разделяем по запятой и обрезаем пробелы
  const classes = classStr.split(',').map(c => c.trim());
  
  return classes.map(className => {
    // Извлекаем номер класса и букву
    const match = className.match(/(\d+)-(\w+)/);
    if (match) {
      return {
        name: className,
        grade: parseInt(match[1]),
        letter: match[2]
      };
    }
    return {
      name: className,
      grade: 0,
      letter: ''
    };
  });
}

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

async function migrateTeachers() {
  console.log('🚀 Начинаем миграцию учителей...\n');
  
  const teachers = await fetchTeachers();
  
  if (teachers.length === 0) {
    console.log('❌ Нет данных для миграции');
    return;
  }
  
  console.log(`📋 Найдено ${teachers.length} записей`);
  
  // Получаем ID ролей
  const teacherRoleId = await getRoleId('TEACHER');
  const classTeacherRoleId = await getRoleId('CLASS_TEACHER');
  
  let created = 0;
  let skipped = 0;
  let invalid = 0;
  let classesCreated = 0;
  let classTeachersAssigned = 0;
  
  for (const teacher of teachers) {
    const email = teacher.email;
    const name = teacher.name;
    const classStr = teacher.classStr;
    
    // Проверяем валидность email
    if (!email || email === 'нет' || email === 'null' || !email.includes('@')) {
      invalid++;
      continue;
    }
    
    if (!name || name === 'нет') {
      invalid++;
      continue;
    }
    
    try {
      // Находим или создаём пользователя
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
      
      // Назначаем роль TEACHER (если ещё нет)
      const existingTeacherRole = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: teacherRoleId }
      });
      if (!existingTeacherRole) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: teacherRoleId, assignedBy: 'migration' }
        });
        console.log(`   📌 Назначена роль TEACHER`);
      }
      
      // Обрабатываем классы, если есть
      if (classStr && classStr !== 'нет' && classStr !== null) {
        const classes = parseClasses(classStr);
        
        if (classes.length > 0) {
          console.log(`   📚 Классы: ${classStr}`);
          
          for (const classInfo of classes) {
            // Находим или создаём класс
            let classData = await prisma.class.findFirst({
              where: { name: classInfo.name }
            });
            
            if (!classData) {
              classData = await prisma.class.create({
                data: {
                  name: classInfo.name,
                  grade: classInfo.grade,
                  letter: classInfo.letter,
                  ownerId: user.id,
                  students: JSON.stringify([]),
                }
              });
              classesCreated++;
              console.log(`      ✅ Создан класс: ${classInfo.name}`);
            } else {
              // Обновляем ownerId, если класс уже существует
              if (classData.ownerId !== user.id) {
                await prisma.class.update({
                  where: { id: classData.id },
                  data: { ownerId: user.id }
                });
                console.log(`      🔄 Обновлён класс: ${classInfo.name} (назначен классный руководитель)`);
              }
            }
            
            // Назначаем роль CLASS_TEACHER
            const existingClassTeacherRole = await prisma.userRole.findFirst({
              where: { userId: user.id, roleId: classTeacherRoleId }
            });
            if (!existingClassTeacherRole) {
              await prisma.userRole.create({
                data: { userId: user.id, roleId: classTeacherRoleId, assignedBy: 'migration' }
              });
              console.log(`      📌 Назначена роль CLASS_TEACHER`);
              classTeachersAssigned++;
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Ошибка при обработке ${name} (${email}):`, error.message);
    }
  }
  
  console.log('\n📊 Итог миграции:');
  console.log(`   👥 Пользователей создано: ${created}`);
  console.log(`   📚 Классов создано: ${classesCreated}`);
  console.log(`   🎓 Назначено классных руководителей: ${classTeachersAssigned}`);
  console.log(`   ⏭️ Пропущено (нет данных): ${invalid}`);
  console.log(`   📋 Всего обработано: ${teachers.length}`);
  
  await prisma.$disconnect();
}

// Запуск
migrateTeachers().catch(console.error);
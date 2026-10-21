// Наполнение локальных моковых БД реалистичными школьными данными.
//
// Запуск: node scripts/devdb-seed.mjs [--fresh]
//   --fresh  — сначала очистить таблицы (данные моковых БД, проект не затрагивается)
//
// Специально генерируется больше 100 нарушений: именно на этом сценарии ломался
// прежний лимит в /api/violations (статистика считалась по первым 100 записям).
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import path from 'node:path';
import {
    PROJECT, ASCII_ROOT, PG_PORT, MY_PORT, PG_USER, PG_PASSWORD, PG_DB, MY_DB,
    log, ensureDirs,
} from './devdb-lib.mjs';

// DATABASE_URL берём из .env.local, чтобы сид и приложение смотрели в одну базу
function databaseUrl() {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    try {
        const env = readFileSync(path.join(PROJECT, '.env.local'), 'utf8');
        const m = /^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m.exec(env);
        if (m) return m[1].trim();
    } catch { /* файла нет */ }
    return `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DB}`;
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });

// ---------- утилиты ----------
let seed = 20261016;
/** Простой детерминированный генератор — данные воспроизводимы между запусками. */
function rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const rint = (min, max) => min + Math.floor(rnd() * (max - min + 1));

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    return c;
}
function atTime(day, hours, minutes) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}
function isWeekend(d) {
    const wd = d.getDay();
    return wd === 0 || wd === 6;
}

// ---------- справочники ----------
const LAST_NAMES_M = ['Иванов', 'Петров', 'Смирнов', 'Кузнецов', 'Соколов', 'Попов', 'Лебедев', 'Козлов', 'Новиков', 'Морозов', 'Волков', 'Егоров', 'Павлов', 'Семёнов', 'Голубев', 'Виноградов', 'Богданов', 'Воробьёв', 'Фёдоров', 'Михайлов'];
const LAST_NAMES_F = ['Иванова', 'Петрова', 'Смирнова', 'Кузнецова', 'Соколова', 'Попова', 'Лебедева', 'Козлова', 'Новикова', 'Морозова', 'Волкова', 'Егорова', 'Павлова', 'Семёнова', 'Голубева', 'Виноградова', 'Богданова', 'Воробьёва', 'Фёдорова', 'Михайлова'];
const FIRST_NAMES_M = ['Александр', 'Дмитрий', 'Максим', 'Артём', 'Иван', 'Михаил', 'Никита', 'Егор', 'Матвей', 'Андрей', 'Кирилл', 'Тимофей', 'Роман', 'Фёдор', 'Степан'];
const FIRST_NAMES_F = ['Анна', 'Мария', 'София', 'Дарья', 'Полина', 'Виктория', 'Елизавета', 'Ксения', 'Алиса', 'Валерия', 'Милана', 'Вера', 'Таисия', 'Ульяна', 'Ева'];
const MIDDLE_M = ['Александрович', 'Дмитриевич', 'Сергеевич', 'Андреевич', 'Михайлович', 'Иванович', 'Петрович', 'Николаевич'];
const MIDDLE_F = ['Александровна', 'Дмитриевна', 'Сергеевна', 'Андреевна', 'Михайловна', 'Ивановна', 'Петровна', 'Николаевна'];

const TEACHERS = [
    { email: 'ivanova@school1298.ru', name: 'Иванова Мария Петровна', roles: ['ADMIN', 'CLASS_TEACHER'] },
    { email: 'petrov@school1298.ru', name: 'Петров Сергей Александрович', roles: ['CLASS_TEACHER'] },
    { email: 'smirnova@school1298.ru', name: 'Смирнова Ольга Викторовна', roles: ['CLASS_TEACHER'] },
    { email: 'kuznetsov@school1298.ru', name: 'Кузнецов Дмитрий Игоревич', roles: ['CLASS_TEACHER', 'TEACHER'] },
    { email: 'sokolova@school1298.ru', name: 'Соколова Елена Андреевна', roles: ['ADMIN'] },            // соцпедагог
    { email: 'security@school1298.ru', name: 'Морозов Игорь Васильевич', roles: ['SECURITY'] },        // охрана
    { email: 'popova@school1298.ru', name: 'Попова Наталья Сергеевна', roles: ['CLASS_TEACHER'] },
    { email: 'volkov@school1298.ru', name: 'Волков Артём Олегович', roles: ['TEACHER'] },
];

const ROLES = [
    { name: 'ADMIN', description: 'Администратор: статистика, ВШУ, персонал' },
    { name: 'CLASS_TEACHER', description: 'Классный руководитель' },
    { name: 'TEACHER', description: 'Учитель-предметник' },
    { name: 'EMPLOYEE', description: 'Сотрудник: вход и главная страница' },
    { name: 'SECURITY', description: 'Охрана: просмотр выданных пропусков' },
];

const CLASS_PLAN = [
    { name: '1А', grade: 1, letter: 'А' }, { name: '1Б', grade: 1, letter: 'Б' },
    { name: '2А', grade: 2, letter: 'А' }, { name: '2Б', grade: 2, letter: 'Б' },
    { name: '3А', grade: 3, letter: 'А' }, { name: '4А', grade: 4, letter: 'А' },
    { name: '5А', grade: 5, letter: 'А' }, { name: '6А', grade: 6, letter: 'А' },
    { name: '7А', grade: 7, letter: 'А' }, { name: '8Б', grade: 8, letter: 'Б' },
    { name: '9А', grade: 9, letter: 'А' }, { name: '10А', grade: 10, letter: 'А' },
];

const VIOLATION_TYPES = ['uniform', 'late', 'property', 'phone', 'behavior', 'disrespect', 'smoking', 'other'];
const VIOLATION_COMMENTS = {
    uniform: ['Пришёл без сменной обуви', 'Нет школьной формы', 'Спортивная одежда на уроке'],
    late: ['Опоздал на 15 минут', 'Опоздание на первый урок', 'Опоздал после перемены'],
    property: ['Испортил парту', 'Порвал шторы в кабинете', 'Сломал стул'],
    phone: ['Играл в телефон на уроке', 'Снимал видео на уроке', 'Телефон зазвонил на контрольной'],
    behavior: ['Мешал вести урок', 'Кричал в столовой', 'Бегал по коридору во время урока'],
    disrespect: ['Нагрубил учителю', 'Не выполнил замечание дежурного', 'Пререкался с учителем'],
    smoking: ['Курение за школой', 'Курение в туалете'],
    other: ['Не принёс учебники', 'Отказался дежурить', 'Ушёл с урока без разрешения'],
};
const ABSENT_REASONS = ['sick', 'family', 'other', 'vacation', 'competition'];
const EXIT_REASONS = ['Заявление родителей', 'Плохое самочувствие', 'Запись к врачу', 'Соревнования', 'Семейные обстоятельства'];

// ---------- генерация ----------
async function main() {
    const fresh = process.argv.includes('--fresh');
    ensureDirs();
    seed = 20261016;

    log('=== Подключение ===');
    log('  PostgreSQL:', databaseUrl().replace(/:[^:@/]+@/, ':***@'));

    const my = await mysql.createConnection({
        host: '127.0.0.1',
        port: MY_PORT,
        user: 'root',
        password: '',
        multipleStatements: true,
    });

    // --- Схема базы АИС (внешняя система со списком учеников) ---
    log('=== Схема базы АИС (MariaDB) ===');
    await my.query(`CREATE DATABASE IF NOT EXISTS \`${MY_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await my.query(`USE \`${MY_DB}\``);
    await my.query(`
        CREATE TABLE IF NOT EXISTS students (
            aisId      VARCHAR(32) NOT NULL,
            lastName   VARCHAR(100) NOT NULL,
            firstName  VARCHAR(100) NOT NULL,
            middleName VARCHAR(100) NULL,
            className  VARCHAR(20)  NOT NULL,
            birthDate  DATE NULL,
            archive    TINYINT(1) NOT NULL DEFAULT 0,
            PRIMARY KEY (aisId),
            KEY idx_class (className),
            KEY idx_archive (archive)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    if (fresh) {
        log('=== Очистка (--fresh) ===');
        await prisma.violation.deleteMany();
        await prisma.pass.deleteMany();
        await prisma.attendance.deleteMany();
        await prisma.selfExit.deleteMany();
        await prisma.authorization.deleteMany();
        await prisma.schoolRecord.deleteMany();
        await prisma.note.deleteMany();
        await prisma.news.deleteMany();
        await prisma.classShare.deleteMany();
        await prisma.class.deleteMany();
        await prisma.userRole.deleteMany();
        await prisma.user.deleteMany();
        await prisma.role.deleteMany();
        await my.query('DELETE FROM students');
    }

    // --- Роли и пользователи ---
    log('=== Пользователи и роли ===');
    const roleByName = new Map();
    for (const role of ROLES) {
        const created = await prisma.role.upsert({
            where: { name: role.name },
            update: { description: role.description },
            create: role,
        });
        roleByName.set(role.name, created);
    }

    const userByName = new Map();
    for (const t of TEACHERS) {
        const user = await prisma.user.upsert({
            where: { email: t.email },
            update: { name: t.name },
            create: { email: t.email, name: t.name },
        });
        userByName.set(t.name, user);

        for (const roleName of t.roles) {
            const role = roleByName.get(roleName);
            if (!role) continue;
            await prisma.userRole.upsert({
                where: { userId_roleId: { userId: user.id, roleId: role.id } },
                update: {},
                create: { userId: user.id, roleId: role.id },
            });
        }
    }
    log(`  создано пользователей: ${userByName.size}`);

    // --- Классы ---
    log('=== Классы ===');
    const classTeachers = TEACHERS.filter(t => t.roles.includes('CLASS_TEACHER'));
    const classes = [];
    for (let i = 0; i < CLASS_PLAN.length; i++) {
        const plan = CLASS_PLAN[i];
        const owner = userByName.get(classTeachers[i % classTeachers.length].name);

        let cls = await prisma.class.findFirst({ where: { name: plan.name } });
        if (!cls) {
            cls = await prisma.class.create({
                data: { name: plan.name, grade: plan.grade, letter: plan.letter, ownerId: owner.id },
            });
        }
        classes.push(cls);
    }
    log(`  создано классов: ${classes.length}`);

    // Один класс делим с другим учителем — проверяем шеринг
    const share = await prisma.classShare.findFirst({ where: { classId: classes[0].id } });
    if (!share) {
        await prisma.classShare.create({
            data: { classId: classes[0].id, teacherId: userByName.get(TEACHERS[1].name).id },
        });
    }

    // --- Ученики в базе АИС ---
    log('=== Ученики (MariaDB) ===');
    const students = [];
    let aisCounter = 100001;
    for (const cls of classes) {
        const grade = cls.grade;
        const count = grade <= 4 ? rint(22, 27) : rint(18, 24);
        for (let i = 0; i < count; i++) {
            const male = rnd() < 0.5;
            const lastName = male ? pick(LAST_NAMES_M) : pick(LAST_NAMES_F);
            const firstName = male ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
            const middleName = male ? pick(MIDDLE_M) : pick(MIDDLE_F);
            const aisId = String(aisCounter++);
            const birthYear = new Date().getFullYear() - grade - 6;

            students.push({
                aisId,
                lastName,
                firstName,
                middleName,
                className: cls.name,
                fullName: `${lastName} ${firstName} ${middleName}`,
            });

            await my.query(
                'INSERT INTO students (aisId, lastName, firstName, middleName, className, birthDate, archive) VALUES (?, ?, ?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE className = VALUES(className), lastName = VALUES(lastName), firstName = VALUES(firstName)',
                [aisId, lastName, firstName, middleName, cls.name, `${birthYear}-0${rint(1, 9)}-1${rint(0, 9)}`],
            );
        }
    }
    log(`  создано учеников: ${students.length}`);

    const studentsByClass = new Map();
    for (const s of students) {
        if (!studentsByClass.has(s.className)) studentsByClass.set(s.className, []);
        studentsByClass.get(s.className).push(s);
    }

    // --- Данные за ~10 недель учебных дней ---
    const today = startOfDay(new Date());
    const schoolDays = [];
    for (let i = 70; i >= 0; i--) {
        const day = addDays(today, -i);
        // Сегодня добавляем всегда (даже в выходной): на текущем дне удобно проверять
        // отметку посещаемости и отчёты «за сегодня».
        if (i === 0 || !isWeekend(day)) schoolDays.push(day);
    }
    log(`=== Посещаемость, пропуска, нарушения: ${schoolDays.length} учебных дней ===`);

    const attendanceRows = [];
    const violationRows = [];
    const passRows = [];
    const selfExitRows = [];
    const authorizationRows = [];

    for (const day of schoolDays) {
        for (const cls of classes) {
            const classStudents = studentsByClass.get(cls.name) || [];
            if (classStudents.length === 0) continue;

            // Пропускаем часть дней, чтобы были классы без отметки (реалистично)
            if (rnd() < 0.12) continue;

            const present = [];
            const absent = [];
            const reasons = {};
            for (const s of classStudents) {
                if (rnd() < 0.09) {
                    absent.push(Number(s.aisId));
                    reasons[Number(s.aisId)] = pick(ABSENT_REASONS);
                } else {
                    present.push(Number(s.aisId));
                }
            }

            attendanceRows.push({
                date: atTime(day, 8, 30),
                classId: cls.id,
                teacherId: cls.ownerId,
                presentStudents: JSON.stringify(present),
                absentStudents: JSON.stringify(absent),
                absentReasons: JSON.stringify(reasons),
            });
        }
    }

    // Нарушения: в среднем 3–6 в день на школу → за 50 учебных дней заметно больше 100
    for (const day of schoolDays) {
        const perDay = rint(2, 7);
        for (let i = 0; i < perDay; i++) {
            const cls = pick(classes);
            const classStudents = studentsByClass.get(cls.name) || [];
            if (classStudents.length === 0) continue;
            const student = pick(classStudents);
            const type = pick(VIOLATION_TYPES);
            const teacher = pick(classTeachers);

            violationRows.push({
                studentId: student.aisId,
                studentName: student.fullName,
                className: cls.name,
                violationType: type,
                comment: pick(VIOLATION_COMMENTS[type]),
                teacherId: userByName.get(teacher.name).id,
                teacherName: teacher.name,
                date: atTime(day, rint(8, 15), rint(0, 59)),
                createdAt: atTime(day, 16, 0),
                updatedAt: atTime(day, 16, 0),
            });
        }
    }

    // Разовые пропуска: 1–4 в день
    for (const day of schoolDays) {
        const count = rint(1, 4);
        for (let i = 0; i < count; i++) {
            const cls = pick(classes);
            const classStudents = studentsByClass.get(cls.name) || [];
            if (classStudents.length === 0) continue;
            const student = pick(classStudents);
            const used = rnd() < 0.75;

            passRows.push({
                date: atTime(day, 0, 0),
                classId: cls.id,
                teacherId: cls.ownerId,
                students: JSON.stringify([{ id: student.aisId, name: student.fullName }]),
                exitTime: `${rint(9, 16)}:${pick(['00', '10', '15', '30', '45'])}`,
                reason: pick(EXIT_REASONS),
                used,
                usedAt: used ? atTime(day, 12, 30) : null,
                createdAt: atTime(day, 8, 0),
            });
        }
    }

    // Самовыходы и доверенности — по младшим классам (как в интерфейсе)
    const juniorClasses = classes.filter(c => c.grade <= 4);
    for (const cls of juniorClasses) {
        const classStudents = studentsByClass.get(cls.name) || [];
        for (const student of classStudents) {
            // примерно у 15% учеников есть самовыход
            if (rnd() < 0.15) {
                const start = addDays(today, -rint(1, 30));
                const end = addDays(today, rint(5, 120));
                selfExitRows.push({
                    studentId: student.aisId,
                    studentName: student.fullName,
                    startDate: atTime(start, 0, 0),
                    endDate: atTime(end, 0, 0),
                    photoUrl: '',
                    reason: 'Заявление родителей',
                    classId: cls.id,
                    teacherId: cls.ownerId,
                });
            }

            // примерно у 20% учеников есть доверенность
            if (rnd() < 0.2) {
                const revoked = rnd() < 0.25;
                const owner = TEACHERS.find(t => userByName.get(t.name)?.id === cls.ownerId);
                authorizationRows.push({
                    studentId: student.aisId,
                    studentName: student.fullName,
                    className: cls.name,
                    trustedName: `${pick(LAST_NAMES_F)} ${pick(FIRST_NAMES_F)} ${pick(MIDDLE_F)}`,
                    relation: pick(['мать', 'отец', 'бабушка', 'дедушка', 'тётя', 'старший брат']),
                    phone: `+7 9${rint(10, 99)} ${rint(100, 999)}-${rint(10, 99)}-${rint(10, 99)}`,
                    comment: rnd() < 0.3 ? 'Забирает по вторникам и четвергам' : null,
                    teacherId: cls.ownerId,
                    teacherName: owner?.name || 'Классный руководитель',
                    isActive: !revoked,
                    revokedAt: revoked ? addDays(today, -rint(1, 20)) : null,
                });
            }
        }
    }

    // ВШУ — несколько учеников на учёте
    const schoolRecordRows = [];
    const recordReasons = [
        'Систематические пропуски уроков без уважительной причины',
        'Нарушение дисциплины на уроках',
        'Порча школьного имущества',
        'Конфликт с одноклассниками',
    ];
    const socialTeacher = userByName.get('Соколова Елена Андреевна');
    for (let i = 0; i < 14; i++) {
        const cls = pick(classes);
        const classStudents = studentsByClass.get(cls.name) || [];
        if (classStudents.length === 0) continue;
        const student = pick(classStudents);
        const registered = addDays(today, -rint(10, 200));
        const active = rnd() < 0.6;
        const planned = addDays(registered, rint(60, 180));

        schoolRecordRows.push({
            studentId: student.aisId,
            studentName: student.fullName,
            className: cls.name,
            registeredAt: atTime(registered, 0, 0),
            registeredBy: socialTeacher.id,
            registeredByName: socialTeacher.name,
            reason: pick(recordReasons),
            plannedReleaseAt: atTime(planned, 0, 0),
            releasedAt: active ? null : atTime(addDays(planned, rint(-10, 40)), 0, 0),
            releasedBy: active ? null : socialTeacher.id,
            releasedByName: active ? null : socialTeacher.name,
            releaseReason: active ? null : pick(['Исправление поведения', 'Перевод в другой класс', 'Окончание учебного года']),
            isActive: active,
        });
    }

    // --- Запись в базы ---
    log('=== Запись данных ===');
    await prisma.attendance.createMany({ data: attendanceRows });
    log(`  посещаемость: ${attendanceRows.length}`);

    // createMany не поддерживает строковые id по умолчанию? поддерживает — cuid генерирует Prisma
    await prisma.violation.createMany({ data: violationRows });
    log(`  нарушения: ${violationRows.length}`);

    await prisma.pass.createMany({ data: passRows });
    log(`  пропуска: ${passRows.length}`);

    if (selfExitRows.length) {
        await prisma.selfExit.createMany({ data: selfExitRows });
        log(`  самовыходы: ${selfExitRows.length}`);
    }

    for (const auth of authorizationRows) {
        await prisma.authorization.create({ data: auth });
    }
    log(`  доверенности: ${authorizationRows.length}`);

    await prisma.schoolRecord.createMany({ data: schoolRecordRows });
    log(`  ВШУ: ${schoolRecordRows.length}`);

    // Заметки и новости для первого класса на сегодня
    await prisma.note.createMany({
        data: [
            { content: 'Проверить дневники у 5 учеников', completed: false, date: today, classId: classes[0].id, teacherId: classes[0].ownerId },
            { content: 'Собрать заявления на экскурсию', completed: true, date: today, classId: classes[0].id, teacherId: classes[0].ownerId },
        ],
    });
    await prisma.news.createMany({
        data: [
            { title: 'Родительское собрание', content: 'В четверг в 18:00, кабинет 204', date: today, classId: classes[0].id, teacherId: classes[0].ownerId },
        ],
    });

    // --- Итоги ---
    const counts = {
        пользователей: await prisma.user.count(),
        классов: await prisma.class.count(),
        посещаемость: await prisma.attendance.count(),
        нарушения: await prisma.violation.count(),
        пропуска: await prisma.pass.count(),
        самовыходы: await prisma.selfExit.count(),
        доверенности: await prisma.authorization.count(),
        ВШУ: await prisma.schoolRecord.count(),
    };
    const [studentCount] = await my.query('SELECT COUNT(*) AS c FROM students');

    log('');
    log('✅ Моковые данные готовы');
    for (const [k, v] of Object.entries(counts)) log(`   ${k}: ${v}`);
    log(`   учеников в АИС: ${studentCount[0].c}`);
    log('');
    log('Проверка лимита 100: нарушений', counts['нарушения'], '— статистика должна совпадать с числом строк, а не с 100.');

    await my.end();
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error('Ошибка сида:', e);
    await prisma.$disconnect().catch(() => { });
    process.exit(1);
});

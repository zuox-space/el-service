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
        // Ключи ссылаются на пользователей и здания — чистим до пользователей.
        await prisma.keyActivity.deleteMany();
        await prisma.keyRequest.deleteMany();
        await prisma.keyFavorite.deleteMany();
        await prisma.keyPermission.deleteMany();
        await prisma.keyItem.deleteMany();
        await prisma.keyBuilding.deleteMany();
        await prisma.unauthorizedLeave.deleteMany();
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

    // Для планшета охраны сегодня должно быть что показывать:
    // несколько активных и уже ушедших пропусков.
    const todayClasses = classes.filter(cls => (studentsByClass.get(cls.name) || []).length > 0);
    for (let i = 0; i < 10; i++) {
        const cls = todayClasses[i % todayClasses.length];
        const classStudents = studentsByClass.get(cls.name) || [];
        const student = classStudents[i % classStudents.length];
        const used = i % 2 === 0;
        passRows.push({
            date: atTime(today, 0, 0),
            classId: cls.id,
            teacherId: cls.ownerId,
            students: JSON.stringify([{ id: student.aisId, name: student.fullName }]),
            exitTime: `${9 + (i % 6)}:${['10', '20', '30', '40', '50', '00'][i % 6]}`,
            reason: pick(EXIT_REASONS),
            used,
            usedAt: used ? atTime(today, 12, 10 + i) : null,
            createdAt: atTime(today, 7, 50),
        });
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

    // Уходы без разрешения — для раздела «Прогульщики»
    const unauthorizedRows = [];
    for (let i = 0; i < 14; i++) {
        const cls = pick(classes.filter(c => c.grade >= 5));
        const classStudents = studentsByClass.get(cls.name) || [];
        if (classStudents.length === 0) continue;
        const student = pick(classStudents);
        const day = pick(schoolDays.slice(-21));
        const returned = rnd() < 0.45;
        unauthorizedRows.push({
            studentId: student.aisId,
            studentName: student.fullName,
            className: cls.name,
            leaveTime: atTime(day, rint(9, 14), rint(0, 59)),
            returnTime: returned ? atTime(day, rint(14, 16), rint(0, 59)) : null,
            reason: pick(['Ушёл с урока', 'Не вернулся после перемены', 'Ушёл через запасной выход', 'Пропустил урок']),
            status: returned ? 'returned' : 'active',
            teacherId: cls.ownerId,
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

    if (unauthorizedRows.length) {
        await prisma.unauthorizedLeave.createMany({ data: unauthorizedRows });
        log(`  уходы без разрешения: ${unauthorizedRows.length}`);
    }

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

    // --- Ключница: здания, ключи, доступы, заявки и журнал ---
    log('=== Ключница ===');
    const mainBuilding = await prisma.keyBuilding.create({
        data: { name: 'Основной корпус', address: 'ул. Школьная, 12' },
    });
    const juniorBuilding = await prisma.keyBuilding.create({
        data: { name: 'Начальная школа', address: 'ул. Школьная, 12, корпус Б' },
    });

    // Классы 1–4 — начальная школа, 5–11 — основной корпус.
    await prisma.class.updateMany({
        where: { id: { in: classes.filter(cls => cls.grade >= 5).map(cls => cls.id) } },
        data: { buildingId: mainBuilding.id },
    });
    await prisma.class.updateMany({
        where: { id: { in: classes.filter(cls => cls.grade <= 4).map(cls => cls.id) } },
        data: { buildingId: juniorBuilding.id },
    });

    const byName = (name) => userByName.get(name);
    const petrov = byName('Петров Сергей Александрович');
    const smirnova = byName('Смирнова Ольга Викторовна');
    const kuznetsov = byName('Кузнецов Дмитрий Игоревич');
    const sokolova = byName('Соколова Елена Андреевна');
    const popova = byName('Попова Наталья Сергеевна');
    const volkov = byName('Волков Артём Олегович');
    const security = byName('Морозов Игорь Васильевич');

    const keyPlan = [
        { building: mainBuilding, room: '101', name: 'Кабинет математики', floor: 1, holder: null },
        { building: mainBuilding, room: '102', name: 'Кабинет русского языка', floor: 1, holder: petrov },
        { building: mainBuilding, room: '103', name: 'Кабинет физики', floor: 2, holder: volkov },
        { building: mainBuilding, room: '104', name: 'Кабинет химии', floor: 2, holder: null, restricted: [petrov, smirnova] },
        { building: mainBuilding, room: '105', name: 'Кабинет истории', floor: 3, holder: null },
        { building: mainBuilding, room: '106', name: 'Кабинет информатики', floor: 3, holder: sokolova },
        { building: mainBuilding, room: '107', name: 'Спортивный зал', floor: 1, holder: kuznetsov },
        { building: juniorBuilding, room: '201', name: 'Кабинет 1А', floor: 1, holder: null },
        { building: juniorBuilding, room: '202', name: 'Кабинет логопеда', floor: 2, holder: popova },
        { building: juniorBuilding, room: '203', name: 'Актовый зал', floor: 1, holder: null, restricted: [popova, kuznetsov] },
    ];

    const keys = new Map();
    for (const plan of keyPlan) {
        const key = await prisma.keyItem.create({
            data: {
                buildingId: plan.building.id,
                roomNumber: plan.room,
                roomName: plan.name,
                floor: plan.floor,
                status: plan.holder ? 'ISSUED' : 'FREE',
                holderId: plan.holder?.id ?? null,
                issuedAt: plan.holder ? atTime(addDays(today, -rint(1, 5)), 8, 30) : null,
                accessScope: plan.restricted ? 'RESTRICTED' : 'ALL',
            },
        });
        keys.set(plan.room, key);
        for (const user of plan.restricted ?? []) {
            await prisma.keyPermission.create({ data: { keyId: key.id, userId: user.id } });
        }
    }

    await prisma.keyFavorite.createMany({
        data: [
            { userId: petrov.id, keyId: keys.get('101').id },
            { userId: petrov.id, keyId: keys.get('105').id },
            { userId: smirnova.id, keyId: keys.get('104').id },
        ],
    });

    async function addKeyRequest({ type, status, room, requester, target = null, decider = null, minutesAgo, details }) {
        const key = keys.get(room);
        const createdAt = new Date(Date.now() - minutesAgo * 60_000);
        const decidedAt = decider ? new Date(createdAt.getTime() + 8 * 60_000) : null;
        const request = await prisma.keyRequest.create({
            data: {
                type,
                status,
                requestedById: requester.id,
                targetUserId: target?.id ?? null,
                decidedById: decider?.id ?? null,
                createdAt,
                updatedAt: decidedAt ?? createdAt,
            },
        });
        await prisma.keyRequestItem.create({ data: { requestId: request.id, keyId: key.id } });
        await prisma.keyActivity.create({
            data: {
                keyId: key.id,
                requestId: request.id,
                actorId: requester.id,
                action: `${type}_REQUEST`,
                details,
                createdAt,
            },
        });
        if (decider) {
            await prisma.keyActivity.create({
                data: {
                    keyId: key.id,
                    requestId: request.id,
                    actorId: decider.id,
                    action: `${type}_${status}`,
                    details: status === 'CONFIRMED' ? `Подтверждено: ${details}` : `Отменено: ${details}`,
                    createdAt: decidedAt,
                },
            });
        }
        return request;
    }

    await addKeyRequest({
        type: 'ISSUE', status: 'CONFIRMED', room: '106', requester: sokolova,
        decider: security, minutesAgo: 60 * 26, details: 'Ключ от кабинета информатики',
    });
    await addKeyRequest({
        type: 'TRANSFER', status: 'CONFIRMED', room: '103', requester: smirnova,
        target: volkov, decider: volkov, minutesAgo: 60 * 50, details: 'Передача ключа физики',
    });
    await addKeyRequest({
        type: 'ISSUE', status: 'PENDING', room: '105', requester: kuznetsov,
        minutesAgo: 24, details: 'Ключ от кабинета истории',
    });
    await addKeyRequest({
        type: 'RETURN', status: 'PENDING', room: '102', requester: petrov,
        minutesAgo: 12, details: 'Возврат ключа русского языка',
    });
    await addKeyRequest({
        type: 'TRANSFER', status: 'PENDING', room: '107', requester: kuznetsov,
        target: volkov, minutesAgo: 38, details: 'Передача ключа спортзала',
    });
    await addKeyRequest({
        type: 'ISSUE', status: 'CANCELLED', room: '104', requester: kuznetsov,
        decider: security, minutesAgo: 60 * 72, details: 'Заявка на кабинет химии',
    });

    log(`  зданий: 2, ключей: ${keys.size}, заявок: 6`);
    const counts = {
        пользователей: await prisma.user.count(),
        классов: await prisma.class.count(),
        посещаемость: await prisma.attendance.count(),
        нарушения: await prisma.violation.count(),
        пропуска: await prisma.pass.count(),
        самовыходы: await prisma.selfExit.count(),
        доверенности: await prisma.authorization.count(),
        ВШУ: await prisma.schoolRecord.count(),
        уходы: await prisma.unauthorizedLeave.count(),
        ключей: await prisma.keyItem.count(),
        заявок_ключей: await prisma.keyRequest.count(),
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

import { PrismaClient as PrismaClientPostgres } from '@prisma/client'
import { PrismaClient as PrismaClientSQLite } from '@prisma/client'

// Создаем подключение к SQLite с явным указанием пути
const sqlite = new PrismaClientSQLite({
    datasources: {
        db: {
            url: 'file:./prisma/dev.db' // или 'file:./dev.db' в зависимости от расположения
        }
    }
})

// Подключение к PostgreSQL из .env
const postgres = new PrismaClientPostgres()

async function migrateData() {
    console.log('Начинаем миграцию данных...')

    try {
        // Проверяем подключения
        console.log('Проверка подключения к SQLite...')
        await sqlite.$connect()
        console.log('✅ SQLite подключен')

        console.log('Проверка подключения к PostgreSQL...')
        await postgres.$connect()
        console.log('✅ PostgreSQL подключен')

        // 1. Мигрируем пользователей
        console.log('Миграция пользователей...')
        const users = await sqlite.user.findMany()
        console.log(`Найдено ${users.length} пользователей`)
        for (const user of users) {
            await postgres.user.create({ data: user })
        }
        console.log('✅ Пользователи перенесены')

        // 2. Мигрируем роли
        console.log('Миграция ролей...')
        const roles = await sqlite.role.findMany()
        console.log(`Найдено ${roles.length} ролей`)
        for (const role of roles) {
            await postgres.role.create({ data: role })
        }
        console.log('✅ Роли перенесены')

        // 3. Мигрируем классы
        console.log('Миграция классов...')
        const classes = await sqlite.class.findMany()
        console.log(`Найдено ${classes.length} классов`)
        for (const cls of classes) {
            await postgres.class.create({ data: cls })
        }
        console.log('✅ Классы перенесены')

        // 4. Мигрируем UserRole
        console.log('Миграция UserRole...')
        const userRoles = await sqlite.userRole.findMany()
        console.log(`Найдено ${userRoles.length} записей`)
        for (const item of userRoles) {
            await postgres.userRole.create({ data: item })
        }
        console.log('✅ UserRole перенесены')

        // 5. Мигрируем ClassShare
        console.log('Миграция ClassShare...')
        const classShares = await sqlite.classShare.findMany()
        console.log(`Найдено ${classShares.length} записей`)
        for (const item of classShares) {
            await postgres.classShare.create({ data: item })
        }
        console.log('✅ ClassShare перенесены')

        // 6. Мигрируем Pass
        console.log('Миграция Pass...')
        const passes = await sqlite.pass.findMany()
        console.log(`Найдено ${passes.length} записей`)
        for (const item of passes) {
            await postgres.pass.create({ data: item })
        }
        console.log('✅ Pass перенесены')

        // 7. Мигрируем Attendance
        console.log('Миграция Attendance...')
        const attendances = await sqlite.attendance.findMany()
        console.log(`Найдено ${attendances.length} записей`)
        for (const item of attendances) {
            await postgres.attendance.create({ data: item })
        }
        console.log('✅ Attendance перенесены')

        // 8. Мигрируем News
        console.log('Миграция News...')
        const news = await sqlite.news.findMany()
        console.log(`Найдено ${news.length} записей`)
        for (const item of news) {
            await postgres.news.create({ data: item })
        }
        console.log('✅ News перенесены')

        // 9. Мигрируем Note
        console.log('Миграция Note...')
        const notes = await sqlite.note.findMany()
        console.log(`Найдено ${notes.length} записей`)
        for (const item of notes) {
            await postgres.note.create({ data: item })
        }
        console.log('✅ Note перенесены')

        // 10. Мигрируем SelfExit
        console.log('Миграция SelfExit...')
        const selfExits = await sqlite.selfExit.findMany()
        console.log(`Найдено ${selfExits.length} записей`)
        for (const item of selfExits) {
            await postgres.selfExit.create({ data: item })
        }
        console.log('✅ SelfExit перенесены')

        // 11. Мигрируем UnauthorizedLeave
        console.log('Миграция UnauthorizedLeave...')
        const unauthorizedLeaves = await sqlite.unauthorizedLeave.findMany()
        console.log(`Найдено ${unauthorizedLeaves.length} записей`)
        for (const item of unauthorizedLeaves) {
            await postgres.unauthorizedLeave.create({ data: item })
        }
        console.log('✅ UnauthorizedLeave перенесены')

        console.log('🎉 Миграция данных завершена успешно!')
        console.log(`Всего перенесено записей: ${users.length + roles.length + classes.length + userRoles.length + classShares.length + passes.length + attendances.length + news.length + notes.length + selfExits.length + unauthorizedLeaves.length}`)

    } catch (error) {
        console.error('❌ Ошибка при миграции:', error)
        if (error instanceof Error) {
            console.error('Сообщение ошибки:', error.message)
            console.error('Стек:', error.stack)
        }
    } finally {
        await sqlite.$disconnect()
        await postgres.$disconnect()
        console.log('Соединения закрыты')
    }
}

// Запускаем миграцию
migrateData()
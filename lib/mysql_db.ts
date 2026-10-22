// lib/db.ts
import { Student } from '@/types';
import { normalizeClassName } from "./class-name";
import mysql from 'mysql2/promise';

// ============================================================================
// Слой доступа к базе АИС (внешняя система школы со списком учеников).
//
// ⚠️ Правило: SQL-запрос по ученикам должен жить ТОЛЬКО здесь.
// Раньше один и тот же запрос был скопирован в 9 файлах, и это привело к N+1:
// страницы запрашивали учеников по одному классу в цикле (запрос на каждый класс).
// ============================================================================

/** Сколько запросов к MySQL выполнил этот модуль (для тестов и диагностики). */
let mysqlQueryCounter = 0;

/** Счётчик выполненных запросов — используется в тестах, чтобы N+1 не вернулся. */
export function getMysqlQueryCount(): number {
    return mysqlQueryCounter;
}

/** Сбросить счётчик (перед замером). */
export function resetMysqlQueryCount(): void {
    mysqlQueryCounter = 0;
}

// ---------------------------------------------------------------------------
// Кэш справочника учеников.
//
// Почему кэш: список учеников меняется редко (по нему работает вся школа), но читается
// на каждом открытии страниц админки и главной страницы учителя. TTL небольшой, чтобы
// правки в АИС подхватывались быстро; устаревшие данные отдаются сразу и обновляются
// в фоне (stale-while-revalidate), поэтому никто не ждёт устаревший кэш.
// ---------------------------------------------------------------------------
const STUDENT_CACHE_TTL_MS = 60_000;

let studentsCache: { data: Student[]; fetchedAt: number } | null = null;
let studentsCacheRefresh: Promise<Student[]> | null = null;

/** Полностью сбросить кэш учеников (нужно после изменения данных в АИС или в тестах). */
export function clearStudentsCache(): void {
    studentsCache = null;
    studentsCacheRefresh = null;
}

// Типы для конфигурации
interface DBConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
    waitForConnections: boolean;
    connectionLimit: number;
    queueLimit: number;
    connectTimeout: number;
    acquireTimeout: number;
    timeout: number;
}

// Пул соединений
let pool: mysql.Pool | null = null;

// Получение пула соединений
export function getPool(): mysql.Pool {
    if (!pool) {
        const config: DBConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || '',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || '',
            port: parseInt(process.env.DB_PORT || '3306'),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            connectTimeout: 10000,
            acquireTimeout: 10000,
            timeout: 10000,
        };

        // Проверяем наличие обязательных параметров.
        // ⚠️ Пустой пароль — это допустимое значение (локальная база или пользователь без пароля).
        // Раньше проверка `!config.password` считала его отсутствующей настройкой и валила
        // весь доступ к списку учеников: ошибка глушилась, и интерфейс показывал «нет учеников».
        if (!config.user || !config.database) {
            throw new Error('Missing database configuration. Check .env.local file (DB_USER, DB_NAME)');
        }

        pool = mysql.createPool(config);
    }
    return pool;
}

// Обобщенная функция для выполнения запросов
export async function query<T = any>(
    sql: string,
    params: any[] = []
): Promise<T[]> {
    const pool = getPool();
    mysqlQueryCounter++;
    try {
        const [rows] = await pool.execute(sql, params);
        return rows as T[];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

// ---------------------------------------------------------------------------
// Ученики: единственные точки выборки
// ---------------------------------------------------------------------------

/**
 * Все ученики школы одним запросом.
 * Именно эту функцию должны использовать все страницы — она кэшируется.
 */
export async function getAllStudents(options: { force?: boolean } = {}): Promise<Student[]> {
    const now = Date.now();
    const cached = studentsCache;
    const isFresh = cached && now - cached.fetchedAt < STUDENT_CACHE_TTL_MS;

    if (cached && isFresh && !options.force) {
        return cached.data;
    }

    // Устаревшие данные отдаём сразу, а обновление уходит в фон: пользователь не ждёт
    if (cached && !options.force) {
        if (!studentsCacheRefresh) {
            studentsCacheRefresh = fetchAllStudents()
                .then(data => {
                    studentsCache = { data, fetchedAt: Date.now() };
                    return data;
                })
                .finally(() => {
                    studentsCacheRefresh = null;
                });
        }
        return cached.data;
    }

    const data = await fetchAllStudents();
    studentsCache = { data, fetchedAt: Date.now() };
    return data;
}

/** Непосредственная выборка всех учеников из базы АИС. */
async function fetchAllStudents(): Promise<Student[]> {
    const sql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className 
        FROM students 
        WHERE archive = 0
        ORDER BY lastName, firstName
    `;
    return query<Student>(sql);
}

/**
 * Ученики, сгруппированные по названию класса.
 *
 * Заменяет шаблон «запрос в цикле по каждому классу»: один запрос на всю школу,
 * дальше группировка в памяти. Возвращает Map, готовую к `get(className) ?? []`.
 */
export async function getStudentsGroupedByClass(options: { force?: boolean } = {}): Promise<Map<string, Student[]>> {
    const all = await getAllStudents(options);

    const byClass = new Map<string, Student[]>();
    for (const student of all) {
        if (!student.className) continue;
        // В АИС бывает «5-А», у нас канонический «5А» — ключ всегда без дефиса
        const key = normalizeClassName(student.className);
        const normalized = { ...student, className: key };
        const list = byClass.get(key);
        if (list) {
            list.push(normalized);
        } else {
            byClass.set(key, [normalized]);
        }

    }
    return byClass;
}

// Получение всех студентов
export async function getStudents(): Promise<Student[]> {
    const sql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className 
        FROM students 
        WHERE archive = 0
        ORDER BY lastName, firstName
    `;
    return query<Student>(sql);
}

// Получение студентов по названию класса
export async function getStudentsByClass(className: string): Promise<Student[]> {
    const sql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className 
        FROM students 
        WHERE archive = 0 
        AND className = ?
        ORDER BY lastName, firstName
    `;
    return query<Student>(sql, [className]);
}

// Получение студентов по части названия класса (поиск)
export async function getStudentsByClassLike(className: string): Promise<Student[]> {
    const sql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className 
        FROM students 
        WHERE archive = 0 
        AND className LIKE ?
        ORDER BY lastName, firstName
    `;
    return query<Student>(sql, [`%${className}%`]);
}

// Получение списка всех классов (уникальные)
export async function getDistinctClasses(): Promise<string[]> {
    const sql = `
        SELECT DISTINCT className 
        FROM students 
        WHERE archive = 0 
        AND className IS NOT NULL 
        AND className != ''
        ORDER BY className
    `;
    const results = await query<{ className: string }>(sql);
    return results.map(row => row.className);
}

// Получение студентов по ID
export async function getStudentById(id: number): Promise<Student | null> {
    const sql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className,
            firstName,
            lastName
        FROM students 
        WHERE aisId = ? AND archive = 0
    `;
    const results = await query<Student>(sql, [id]);
    return results[0] || null;
}

// Поиск студентов
export async function searchStudents(
    searchTerm: string,
    limit: number = 50
): Promise<Student[]> {
    const sql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className 
        FROM students 
        WHERE archive = 0 
        AND (firstName LIKE ? OR lastName LIKE ? OR className LIKE ?)
        ORDER BY lastName, firstName
        LIMIT ?
    `;
    const pattern = `%${searchTerm}%`;
    return query<Student>(sql, [pattern, pattern, pattern, limit]);
}

// Получение студентов с пагинацией
export async function getStudentsPaginated(
    page: number = 1,
    limit: number = 20
): Promise<{ students: Student[]; total: number }> {
    const offset = (page - 1) * limit;

    // Получаем общее количество
    const countSql = `
        SELECT COUNT(*) as total 
        FROM students 
        WHERE archive = 0
    `;
    const countResult = await query<{ total: number }>(countSql);
    const total = countResult[0]?.total || 0;

    // Получаем данные
    const dataSql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className 
        FROM students 
        WHERE archive = 0
        ORDER BY lastName, firstName
        LIMIT ? OFFSET ?
    `;
    const students = await query<Student>(dataSql, [limit, offset]);

    return { students, total };
}

// Получение студентов с пагинацией по классу
export async function getStudentsByClassPaginated(
    className: string,
    page: number = 1,
    limit: number = 20
): Promise<{ students: Student[]; total: number }> {
    const offset = (page - 1) * limit;

    // Получаем общее количество студентов в классе
    const countSql = `
        SELECT COUNT(*) as total 
        FROM students 
        WHERE archive = 0 AND className = ?
    `;
    const countResult = await query<{ total: number }>(countSql, [className]);
    const total = countResult[0]?.total || 0;

    // Получаем данные
    const dataSql = `
        SELECT 
            aisId,
            CONCAT(lastName, ' ', firstName) AS name,
            className 
        FROM students 
        WHERE archive = 0 AND className = ?
        ORDER BY lastName, firstName
        LIMIT ? OFFSET ?
    `;
    const students = await query<Student>(dataSql, [className, limit, offset]);

    return { students, total };
}

// Проверка подключения
export async function testConnection(): Promise<boolean> {
    try {
        const pool = getPool();
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        return true;
    } catch (error) {
        console.error('Connection test failed:', error);
        return false;
    }
}

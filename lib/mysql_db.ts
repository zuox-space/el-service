// lib/db.ts
import mysql from 'mysql2/promise';
import { Student, StudentFull } from '../types/student';

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

        // Проверяем наличие обязательных параметров
        if (!config.user || !config.password || !config.database) {
            throw new Error('Missing database configuration. Check .env.local file');
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
    try {
        const [rows] = await pool.execute(sql, params);
        return rows as T[];
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
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
export async function getStudentById(id: number): Promise<StudentFull | null> {
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
    const results = await query<StudentFull>(sql, [id]);
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
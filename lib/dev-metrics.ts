// lib/dev-metrics.ts
//
// Диагностика для режима разработки.
//
// Зачем: N+1 (запрос на каждый класс) легко вернуть случайно при следующей правке, и снаружи
// это незаметно — страница просто отвечает чуть медленнее. Поэтому в dev-режиме каждый ответ
// сообщает, сколько запросов к базам он сделал. Тест `npm run devdb:test` это проверяет и падает,
// если число выросло.
//
// В production заголовки не добавляются: процесс собирается с NODE_ENV=production,
// значение вычисляется один раз при загрузке модуля.
import { NextResponse } from "next/server";
import { getMysqlQueryCount, resetMysqlQueryCount } from "@/lib/mysql_db";

export const isDev = process.env.NODE_ENV !== 'production';

/** Заголовок с числом запросов к базе АИС (MySQL) за текущий запрос. */
export const MYSQL_QUERIES_HEADER = 'X-Db-Queries-Ais';

/**
 * Начать измерение: обнулить счётчики в начале обработки запроса.
 *
 * Счётчик живёт на уровне модуля, то есть копится между запросами одного процесса.
 * Поэтому в начале каждого запроса его нужно сбрасывать, иначе в заголовок попадёт сумма
 * по всем запросам, которые этот процесс уже обслужил.
 */
export function startDbMetrics(): void {
    if (!isDev) return;
    try {
        resetMysqlQueryCount();
    } catch {
        // диагностика не должна ломать обработку запроса
    }
}

/**
 * Добавить к ответу диагностический заголовок с числом запросов к MySQL.
 * В production возвращает ответ без изменений.
 */
export function withDbMetrics(response: NextResponse): NextResponse {
    if (!isDev) return response;
    try {
        response.headers.set(MYSQL_QUERIES_HEADER, String(getMysqlQueryCount()));
    } catch {
        // диагностика не должна ломать ответ
    }
    return response;
}

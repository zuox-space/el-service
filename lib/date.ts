/**
 * Работа с датами в локальном часовом поясе.
 *
 * В проекте исторически смешивались два подхода: локальная дата
 * (`new Date(y, m, d)`) и UTC (`new Date().toISOString().split('T')[0]`).
 * Второй даёт «съезд на день»: в Москве после 21:00 UTC уже следующие сутки,
 * поэтому фильтры и подписи отчётов показывали не тот день.
 *
 * Здесь один набор функций для «даты без времени». Использовать их везде,
 * где речь о календарной дате (день), а не о моменте времени.
 */

/** Сегодняшняя дата в формате YYYY-MM-DD по локальному времени. */
export function toLocalISODate(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Приводит дату к началу суток в локальном времени.
 * Принимает Date или строку; строка вида YYYY-MM-DD разбирается как локальная дата,
 * а не как UTC-полночь (именно из-за этого раньше терялся день).
 */
export function parseLocalDate(value: Date | string): Date {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
        return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date(NaN);
    }
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/** Границы суток [00:00:00.000, 23:59:59.999] для календарной даты. */
export function getDayRange(value: Date | string): { start: Date; end: Date } {
    const start = parseLocalDate(value);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
    return { start, end };
}

/** Корректное прибавление месяцев: 31 января + 1 месяц = 28/29 февраля, а не 2–3 марта. */
export function addMonths(value: Date | string, months: number): Date {
    const base = parseLocalDate(value);
    const year = base.getFullYear();
    const month = base.getMonth();
    const day = base.getDate();

    // Последний день целевого месяца
    const lastDayOfTarget = new Date(year, month + months + 1, 0).getDate();
    return new Date(year, month + months, Math.min(day, lastDayOfTarget));
}

/**
 * Разбор значения, пришедшего с сервера или из input[type=date].
 *
 * Отличается от parseLocalDate тем, что сохраняет время, если оно есть:
 * для «2026-03-01T07:30:00.000Z» вернёт момент времени, а для «2026-03-01» — локальную полночь.
 * Нужна там, где показывается конкретное событие (нарушение, пропуск, отсутствие),
 * а не календарный день.
 */
export function parseAnyDate(value: Date | string): Date {
    if (value instanceof Date) return value;

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
        return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }

    return new Date(value);
}

/** Короткая дата для интерфейса: 5 мар. 2026 */
export function formatDateRu(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const date = parseAnyDate(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU', options ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Короткая дата без года: 5 мар. */
export function formatDateShortRu(value: Date | string): string {
    return formatDateRu(value, { day: 'numeric', month: 'short' });
}

/** Сколько суток осталось до даты (отрицательное значение — дата уже прошла). */
export function daysUntil(value: Date | string): number {
    const today = parseLocalDate(new Date());
    const target = parseLocalDate(parseAnyDate(value));
    return Math.round((target.getTime() - today.getTime()) / 86400000);
}

/**
 * Начало текущего учебного года — 1 сентября.
 *
 * Учебный год начинается в сентябре: в январе–августе он относится к прошлому
 * календарному году. Именно от этой даты по умолчанию считаются периоды
 * в статистике и частота отметок посещаемости.
 */
export function getAcademicYearStart(today: Date = new Date()): Date {
    const year = today.getFullYear();
    const month = today.getMonth(); // 0 — январь, 8 — сентябрь
    return new Date(month >= 8 ? year : year - 1, 8, 1);
}

/**
 * Количество учебных дней (понедельник–пятница) между датами включительно.
 * Каникулы и праздники не учитываются: это оценка «сколько дней класс должен
 * был отметиться», а точный календарь школа пока не ведёт.
 */
export function countSchoolDays(from: Date | string, to: Date | string = new Date()): number {
    const start = parseLocalDate(from);
    const end = parseLocalDate(to);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

    let days = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        const weekday = cursor.getDay();
        if (weekday !== 0 && weekday !== 6) days += 1;
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

/** Даты в виде YYYY-MM-DD без времени — для сравнения и подсчёта уникальных дней. */
export function uniqueDates(values: Array<Date | string>): Set<string> {
    const result = new Set<string>();
    for (const value of values) {
        const date = parseAnyDate(value);
        if (!Number.isNaN(date.getTime())) result.add(toLocalISODate(date));
    }
    return result;
}


/**
 * Дата и время события в московском времени.
 * Школа живёт по Москве, поэтому события показываем в её поясе независимо от того,
 * из какого региона сотрудник открыл приложение.
 */
export function formatDateTimeMoscow(value: Date | string): string {
    const date = parseAnyDate(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Экранирование значений для HTML/Excel-выгрузок. */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Значения, начинающиеся с = + - @, Excel воспринимает как формулы — обезвреживаем. */
export function safeCell(value: unknown): string {
    return escapeHtml(value).replace(/^([=+\-@])/, "'$1");
}

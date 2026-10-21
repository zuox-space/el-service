/**
 * Склейка классов. Заменяет условные конкатенации вида
 * `className={"a " + (x ? "b" : "")}` — с ним проще читать и невозможно
 * получить лишние пробелы или «undefined» в разметке.
 *
 * Сознательно без tailwind-merge: порядок классов в проекте не переопределяется
 * извне компонентов, а лишняя зависимость ради этого не нужна.
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
    let result = '';
    for (const value of values) {
        if (!value) continue;
        const chunk = String(value).trim();
        if (!chunk) continue;
        result = result ? `${result} ${chunk}` : chunk;
    }
    return result;
}

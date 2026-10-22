// lib/class-name.ts
//
// В АИС классы встречаются в двух видах: «5-А» и «5А». В приложении и в базе
// используем один канонический вид — без дефиса и пробелов, заглавными: «5А».
// Все сравнения классов идут через эти функции, чтобы «5-А» и «5А» были одним
// классом, а не двумя разными.

/** Приводит имя класса к каноническому виду: «5-А», «5 а», « 5А » → «5А». */
export function normalizeClassName(value: string | null | undefined): string {
    return String(value ?? "")
        .replace(/[\s\u00A0]+/g, "")
        .replace(/[-–—]/g, "")
        .toUpperCase();
}

/** Совпадают ли два имени класса (с учётом дефисов и регистра). */
export function isSameClass(a: string | null | undefined, b: string | null | undefined): boolean {
    const left = normalizeClassName(a);
    return left !== "" && left === normalizeClassName(b);
}

/** Разбирает каноническое имя на параллель и букву: «5А» → { grade: 5, letter: "А" }. */
export function parseClassName(value: string | null | undefined): { name: string; grade: number; letter: string } | null {
    const name = normalizeClassName(value);
    const match = name.match(/^(\d{1,2})([A-ZА-ЯЁ])$/u);
    if (!match) return null;

    const grade = Number(match[1]);
    if (!Number.isInteger(grade) || grade < 1 || grade > 11) return null;

    return { name, grade, letter: match[2] };
}

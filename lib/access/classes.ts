// lib/access/classes.ts
import { prisma } from "@/lib/prisma";
import { normalizeClassName } from "@/lib/class-name";
import type { AccessInfo } from "./server";

/**
 * Доступ к конкретному классу.
 *
 * Правило: администратор и «школьные» разделы (нарушения, портфолио, ВШУ)
 * видят все классы. Обычный учитель — только свои и расшаренные.
 * Это серверная проверка, её нельзя обойти подменой classId в запросе.
 */
export function hasSchoolWideClassAccess(access: AccessInfo): boolean {
    if (access.isAdmin) return true;
    return access.sections.some(section =>
        ["violations", "students", "schoolRecords", "dashboard"].includes(section),
    );
}

export async function canAccessClass(
    access: AccessInfo,
    classIdOrName: string | null | undefined,
): Promise<boolean> {
    if (!classIdOrName) return false;
    if (hasSchoolWideClassAccess(access)) return true;

    const byId = await prisma.class.findFirst({
        where: { id: classIdOrName },
        select: { id: true },
    });

    const classRow =
        byId ??
        (await prisma.class.findFirst({
            where: { name: normalizeClassName(classIdOrName) },
            select: { id: true },
        }));

    if (!classRow) return false;

    const allowed = await prisma.class.findFirst({
        where: {
            id: classRow.id,
            OR: [
                { ownerId: access.userId },
                { sharedWith: { some: { teacherId: access.userId } } },
            ],
        },
        select: { id: true },
    });

    return Boolean(allowed);
}

/** Список классов, доступных учителю; null — доступны все (админ/школьный раздел). */
export async function accessibleClassIds(access: AccessInfo): Promise<Set<string> | null> {
    if (hasSchoolWideClassAccess(access)) return null;

    const classes = await prisma.class.findMany({
        where: {
            OR: [
                { ownerId: access.userId },
                { sharedWith: { some: { teacherId: access.userId } } },
            ],
        },
        select: { id: true, name: true },
    });

    return new Set(classes.flatMap(item => [item.id, item.name]));
}

/** Названия доступных классов; null — доступны все. */
export async function accessibleClassNames(access: AccessInfo): Promise<Set<string> | null> {
    if (hasSchoolWideClassAccess(access)) return null;

    const classes = await prisma.class.findMany({
        where: {
            OR: [
                { ownerId: access.userId },
                { sharedWith: { some: { teacherId: access.userId } } },
            ],
        },
        select: { name: true },
    });

    return new Set(classes.map(item => item.name));
}
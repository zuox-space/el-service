import { prisma } from "@/lib/prisma";
import { accessibleClassIds, canAccessClass } from "@/lib/access/classes";
import type { AccessInfo } from "@/lib/access/server";

export const SEAT_ROWS = 15;
export const SEAT_SIDES = ["left", "right"] as const;
export type SeatSide = (typeof SEAT_SIDES)[number];

/**
 * Кто видит рассадку:
 *  • ADMIN — все классы;
 *  • сотрудник с разделом «Электронная рассадка», но без «Мой класс» —
 *    все классы (доступ выдан явно);
 *  • классный руководитель — только свои и расшаренные классы.
 */
export function hasWideSeatingAccess(access: AccessInfo): boolean {
    return access.isAdmin || (access.sections.includes("seating") && !access.sections.includes("myClass"));
}

export async function canAccessSeatingClass(access: AccessInfo, classId: string): Promise<boolean> {
    if (hasWideSeatingAccess(access)) {
        return Boolean(await prisma.class.findUnique({ where: { id: classId }, select: { id: true } }));
    }
    return canAccessClass(access, classId);
}

/**
 * Редактировать схему может только классный руководитель-владелец класса.
 * Расшаренный доступ и раздел seating дают просмотр, но не изменение.
 */
export async function canEditSeatingClass(access: AccessInfo, classId: string): Promise<boolean> {
    if (access.isAdmin) return true;
    const classRow = await prisma.class.findUnique({
        where: { id: classId },
        select: { ownerId: true },
    });
    return classRow?.ownerId === access.userId;
}

export async function listSeatingClasses(access: AccessInfo) {
    const classes = hasWideSeatingAccess(access)
        ? await prisma.class.findMany({
            select: { id: true, name: true, grade: true, letter: true, ownerId: true },
            orderBy: [{ grade: "asc" }, { letter: "asc" }],
        })
        : await (async () => {
            const allowed = await accessibleClassIds(access);
            return prisma.class.findMany({
                where: allowed ? { id: { in: [...allowed] } } : undefined,
                select: { id: true, name: true, grade: true, letter: true, ownerId: true },
                orderBy: [{ grade: "asc" }, { letter: "asc" }],
            });
        })();

    return classes.map(item => ({
        id: item.id,
        name: item.name,
        grade: item.grade,
        letter: item.letter,
        isOwner: item.ownerId === access.userId,
    }));
}

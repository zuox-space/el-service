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

export async function listSeatingClasses(access: AccessInfo) {
    if (hasWideSeatingAccess(access)) {
        return prisma.class.findMany({
            select: { id: true, name: true, grade: true, letter: true },
            orderBy: [{ grade: "asc" }, { letter: "asc" }],
        });
    }

    const allowed = await accessibleClassIds(access);

    return prisma.class.findMany({
        where: allowed ? { id: { in: [...allowed] } } : undefined,
        select: { id: true, name: true, grade: true, letter: true },
        orderBy: [{ grade: "asc" }, { letter: "asc" }],
    });
}

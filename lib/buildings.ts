// lib/buildings.ts
import { prisma } from "@/lib/prisma";

/** Названия классов, которые учатся в здании. */
export async function classNamesForBuilding(buildingId: string): Promise<string[]> {
    const building = await prisma.keyBuilding.findUnique({
        where: { id: buildingId },
        select: { classes: { select: { name: true } } },
    });
    return building?.classes.map(item => item.name) ?? [];
}

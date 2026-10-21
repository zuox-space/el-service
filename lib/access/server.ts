// lib/access/server.ts
//
// Серверное определение доступов. Логика одна:
//   • ADMIN видит всё;
//   • если у сотрудника включена индивидуальная настройка (accessOverride),
//     действует ровно список выданных разделов;
//   • иначе — объединение доступов по ролям: сначала берём `defaultSections`
//     роли из БД (их настраивает администратор в интерфейсе), а если там пусто —
//     значения по умолчанию из реестра (lib/access/registry.ts).
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
    ALL_SECTION_IDS,
    sectionsForRole,
    type AccessSectionId,
} from "./registry";

export interface AccessInfo {
    userId: string;
    email: string;
    isAdmin: boolean;
    roles: string[];
    override: boolean;
    sections: AccessSectionId[];
}

interface RoleLike {
    name: string;
    defaultSections: string[];
}

/** Доступы конкретного пользователя по его id. */
export async function getAccessForUser(userId: string): Promise<AccessInfo | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            userRoles: { include: { role: true } },
            sectionAccess: true,
        },
    });

    if (!user) return null;

    return buildAccess({
        id: user.id,
        email: user.email,
        roles: user.userRoles.map(item => ({
            name: item.role.name,
            defaultSections: item.role.defaultSections,
        })),
        override: user.accessOverride,
        rows: user.sectionAccess.filter(row => row.allowed).map(row => row.section),
    });
}

/** Доступы текущей сессии. */
export async function getSessionAccess(): Promise<AccessInfo | null> {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return null;

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            userRoles: { include: { role: true } },
            sectionAccess: true,
        },
    });

    if (!user) {
        return {
            userId: session.user.id ?? "",
            email,
            isAdmin: false,
            roles: [],
            override: true,
            sections: [],
        };
    }

    return buildAccess({
        id: user.id,
        email: user.email,
        roles: user.userRoles.map(item => ({
            name: item.role.name,
            defaultSections: item.role.defaultSections,
        })),
        override: user.accessOverride,
        rows: user.sectionAccess.filter(row => row.allowed).map(row => row.section),
    });
}

function buildAccess(input: {
    id: string;
    email: string;
    roles: RoleLike[];
    override: boolean;
    rows: string[];
}): AccessInfo {
    const isAdmin = input.roles.some(role => role.name === "ADMIN");

    const sections: AccessSectionId[] = isAdmin
        ? ALL_SECTION_IDS
        : input.override
            ? (input.rows as AccessSectionId[])
            : sectionsForRoleList(input.roles);

    return {
        userId: input.id,
        email: input.email,
        isAdmin,
        roles: input.roles.map(role => role.name),
        override: input.override,
        sections,
    };
}

/** Объединение доступов всех ролей сотрудника. */
export function sectionsForRoleList(roles: RoleLike[]): AccessSectionId[] {
    const result = new Set<AccessSectionId>();

    for (const role of roles) {
        // Индивидуально настроенные доступы роли важнее значений из реестра
        const fromDb = (role.defaultSections ?? []).filter((section): section is AccessSectionId =>
            (ALL_SECTION_IDS as string[]).includes(section),
        );
        const defaults = fromDb.length > 0 ? fromDb : sectionsForRole(role.name);

        for (const section of defaults) result.add(section);
    }

    return [...result];
}

export type SectionGuardResult = { ok: true; access: AccessInfo } | { ok: false; response: NextResponse };

/**
 * Проверка доступа в API-роуте.
 *
 *   const guard = await requireSection("violations");
 *   if (!guard.ok) return guard.response;
 */
export async function requireSection(section: AccessSectionId): Promise<SectionGuardResult> {
    return requireAnySection([section]);
}

/** Раздел считается доступным, если выдан любой из перечисленных. */
export async function requireAnySection(sections: AccessSectionId[]): Promise<SectionGuardResult> {
    const access = await getSessionAccess();

    if (!access) {
        return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const allowed = sections.some(section => access.sections.includes(section));

    if (!allowed) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Нет доступа к разделу", sections },
                { status: 403 },
            ),
        };
    }

    return { ok: true, access };
}

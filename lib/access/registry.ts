// lib/access/registry.ts
//
// ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ ПО ДОСТУПАМ.
//
// Раздел = единица доступа: страница (href) + API, которые её обслуживают.
// Чтобы добавить доступ к новой функции, достаточно:
//   1) добавить объект в ACCESS_SECTIONS;
//   2) в её API-роутах вызвать requireSection("<id>");
//   3) в навигации (nav-config) у пункта указать section: "<id>".
// После этого раздел сам появится в матрице доступов у сотрудника и в фильтрации меню.

export type AccessSectionId =
    | "myClass"
    | "dashboard"
    | "students"
    | "classes"
    | "classesOverview"
    | "violations"
    | "violationsStats"
    | "uniform"
    | "schoolRecords"
    | "truants"
    | "absent"
    | "keys"
    | "keysAdmin"
    | "buildingsAdmin"
    | "users";

export interface AccessGroup {
    id: string;
    title: string;
}

export interface AccessSection {
    id: AccessSectionId;
    label: string;
    /** Что именно открывает доступ — эту подпись администратор читает в матрице */
    description: string;
    group: string;
    /** Корневой путь страницы (для навигации и проверки маршрута) */
    href?: string;
    /** Дополнительные адреса, которые тоже относятся к разделу */
    extraPaths?: string[];
    /** Только администратор: выдать нельзя никому */
    adminOnly?: boolean;
    /** Роли, которым доступ даётся по умолчанию, пока нет индивидуальной настройки */
    defaultRoles?: string[];
}

export const ACCESS_GROUPS: AccessGroup[] = [
    { id: "workspace", title: "Классное руководство" },
    { id: "dashboard", title: "Оперативно" },
    { id: "students", title: "Ученики и классы" },
    { id: "discipline", title: "Дисциплина" },
    { id: "analytics", title: "Аналитика" },
    { id: "keys", title: "Ключи" },
    { id: "admin", title: "Администрирование" },
];

export const ACCESS_SECTIONS: AccessSection[] = [
    {
        id: "myClass",
        label: "Мой класс",
        description: "Пропуска, отметка посещаемости, нарушения, самовыходы и доверенности своего класса",
        group: "workspace",
        href: "/my-class",
        defaultRoles: ["CLASS_TEACHER", "TEACHER", "ADMIN", "METHODIST", "HEAD_TEACHER"],
    },
    {
        id: "dashboard",
        label: "Контроль выхода",
        description: "Кто вышел из школы сейчас, кто уже ушёл, отмена выхода",
        group: "dashboard",
        href: "/admin",
        defaultRoles: ["ADMIN", "SECURITY"],
    },
    {
        id: "students",
        label: "Портфолио ученика",
        description: "Поиск ученика, его пропуска, нарушения, отсутствия и ВШУ",
        group: "students",
        href: "/admin/students",
        defaultRoles: ["ADMIN"],
    },
    {
        id: "classes",
        label: "Классы",
        description: "Список классов, классные руководители, состав класса и частота отметок",
        group: "students",
        href: "/admin/classes",
        defaultRoles: ["ADMIN"],
    },
    {
        id: "classesOverview",
        label: "1–4 классы: самовыходы и доверенности",
        description: "Сводка по младшим классам: у кого есть разрешения уходить домой",
        group: "students",
        href: "/admin/classes-overview",
        defaultRoles: ["ADMIN"],
    },
    {
        id: "violations",
        label: "Нарушения",
        description: "Список нарушений с фильтрами, создание и удаление записей",
        group: "discipline",
        href: "/admin/violations",
        // Классный руководитель работает с нарушениями через «Мой класс»:
        // там он видит только свои классы и не получает полный доступ админки.
        defaultRoles: ["ADMIN", "HEAD_TEACHER", "METHODIST"],
    },
    {
        id: "schoolRecords",
        label: "ВШУ",
        description: "Внутришкольный учёт: постановка, сроки снятия, история",
        group: "discipline",
        href: "/admin/school-records",
        defaultRoles: ["ADMIN"],
    },
    {
        id: "truants",
        label: "Прогульщики",
        description: "Кто и сколько уроков пропустил за период, причины",
        group: "discipline",
        href: "/admin/truants",
        defaultRoles: ["ADMIN", "HEAD_TEACHER"],
    },
    {
        id: "violationsStats",
        label: "Статистика нарушений",
        description: "Дашборд: причины, классы, динамика по месяцам",
        group: "analytics",
        href: "/admin/violations/stats",
        defaultRoles: ["ADMIN", "HEAD_TEACHER", "METHODIST"],
    },
    {
        id: "uniform",
        label: "Форма одежды",
        description: "Замечания по форме: классы, месяцы, повторные нарушения",
        group: "analytics",
        href: "/admin/uniform",
        defaultRoles: ["ADMIN", "HEAD_TEACHER"],
    },
    {
        id: "absent",
        label: "Отсутствия",
        description: "Кто отсутствует по классам, причины, кто не отметился",
        group: "analytics",
        href: "/admin/absent",
        defaultRoles: ["ADMIN", "HEAD_TEACHER", "METHODIST"],
    },
    {
        id: "keys",
        label: "Ключи",
        description: "Взять, сдать или передать ключ, мои ключи и заявки",
        group: "keys",
        href: "/keys",
        defaultRoles: ["EMPLOYEE", "TEACHER", "CLASS_TEACHER", "METHODIST", "HEAD_TEACHER", "SECURITY", "ADMIN"],
    },
    {
        id: "keysAdmin",
        label: "Администрирование ключами",
        description: "Ключи, заявки, журнал операций и права на ключи",
        group: "admin",
        href: "/admin/keys",
        defaultRoles: ["ADMIN"],
    },
    {
        id: "buildingsAdmin",
        label: "Здания и классы",
        description: "Создание зданий, адреса и привязка классов к зданиям",
        group: "admin",
        href: "/admin/buildings",
        defaultRoles: ["ADMIN"],
    },
    {
        id: "users",
        label: "Сотрудники и доступы",
        description: "Добавление сотрудников, роли и выдача доступов к разделам",
        group: "admin",
        href: "/admin/users",
        extraPaths: ["/admin/roles", "/admin/sync"],
        adminOnly: true,
    },
];

/** Все идентификаторы разделов — для проверки входных данных и роли ADMIN. */
export const ALL_SECTION_IDS: AccessSectionId[] = ACCESS_SECTIONS.map(section => section.id);

/**
 * Административный раздел — всё, кроме личного кабинета класса и ключей.
 * Именно по этому признаку показывается кнопка «Админ панель» и её содержимое.
 */
export function isAdminSection(section: AccessSection): boolean {
    return Boolean(section.href) && section.id !== "myClass" && section.id !== "keys";
}

/** Разделы, доступные по ролям, если индивидуальная настройка не включена. */
export function sectionsForRoles(roles: string[]): AccessSectionId[] {
    if (roles.includes("ADMIN")) return ALL_SECTION_IDS;

    const result = new Set<AccessSectionId>();
    for (const section of ACCESS_SECTIONS) {
        if (section.adminOnly) continue;
        if (section.defaultRoles?.some(role => roles.includes(role))) result.add(section.id);
    }
    return [...result];
}

/** Разделы, которые роль даёт по умолчанию (значения из реестра). */
export function sectionsForRole(roleName: string): AccessSectionId[] {
    return ACCESS_SECTIONS
        .filter(section => !section.adminOnly && section.defaultRoles?.includes(roleName))
        .map(section => section.id);
}

export function isSectionId(value: string): value is AccessSectionId {
    return (ALL_SECTION_IDS as string[]).includes(value);
}

/** Раздел по адресу страницы. Проверяем от длинных путей к коротким. */
export function sectionForPath(pathname: string): AccessSection | null {
    const withHref = ACCESS_SECTIONS.filter(section => section.href).sort(
        (a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0),
    );

    for (const section of withHref) {
        const href = section.href as string;
        if (href === "/") continue;
        if (pathname === href || pathname.startsWith(`${href}/`)) return section;

        for (const extra of section.extraPaths ?? []) {
            if (pathname === extra || pathname.startsWith(`${extra}/`)) return section;
        }
    }

    return null;
}

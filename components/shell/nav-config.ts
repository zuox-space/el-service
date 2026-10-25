import type { AccessSectionId } from "@/lib/access/registry";
import {
    AlertTriangle,
    RefreshCw,
    Shirt,
    ShieldCheck,
    BarChart3,
    ChartPie,
    ClipboardList,
    Building2,
    History,
    Home,
    KeyRound,
    LayoutDashboard,
    ListOrdered,
    MoreHorizontal,
    ShieldAlert,
    UserX,
    Users,
    type LucideIcon,
} from "lucide-react";

/* ============================================================================
   Навигация администратора — единый источник правды.

   Один файл описывает и нижний таб-бар на мобильном, и сайдбар на десктопе,
   и экран «Ещё». Добавить раздел = добавить строку здесь; расхождений между
   мобильной и десктопной навигацией не возникает по конструкции.

   IA (5 групп): Панель · Ученики · Нарушения · Аналитика · Ещё.
   Названия самих разделов сохранены прежними — меняются только подписи групп.
   ============================================================================ */

export type NavSectionId = "dashboard" | "students" | "violations" | "classes" | "analytics" | "more";

export interface NavLink {
    id: string;
    label: string;
    /** Короткая подпись для мобильного таб-бара */
    shortLabel?: string;
    href: string;
    icon: LucideIcon;
    /** Если задано — пункт виден только перечисленным ролям */
    roles?: string[];
    /** Требует точного совпадения пути (для корня раздела) */
    exact?: boolean;
    /** Раздел доступа из lib/access/registry.ts — по нему фильтруется меню */
    section?: AccessSectionId;
}

export interface NavGroup {
    title: string;
    items: NavLink[];
}

/** Пункты нижнего таб-бара на мобильном: 3 ключевых раздела + «Ещё». */
export const TAB_BAR_LINKS: NavLink[] = [
    {
        id: "dashboard",
        label: "Контроль выхода",
        shortLabel: "Контроль",
        href: "/admin",
        icon: LayoutDashboard,
        exact: true,
        section: "dashboard",
    },
    { id: "violations", label: "Нарушения", shortLabel: "Нарушения", href: "/admin/violations", icon: AlertTriangle, section: "violations" },
    { id: "classes", label: "Классы", shortLabel: "Классы", href: "/admin/classes", icon: ClipboardList, section: "classes" },
];

export const MORE_LINK: NavLink = {
    id: "more",
    label: "Ещё",
    href: "#more",
    icon: MoreHorizontal,
};

/** Полное дерево разделов: сайдбар на десктопе и экран «Ещё» на мобильном. */
export const NAV_GROUPS: NavGroup[] = [
    {
        // Самый частый переход — держим наверху, чтобы не искать внизу сайдбара
        title: "Навигация",
        items: [{ id: "home", label: "На главную", href: "/", icon: Home }],
    },
    {
        title: "Оперативно",
        items: [
            { id: "dashboard", label: "Контроль выхода", href: "/admin", icon: LayoutDashboard, exact: true, section: "dashboard" },
            { id: "keys", label: "Ключи", href: "/keys", icon: KeyRound, section: "keys" },
        ],
    },
    {
        title: "Ученики и классы",
        items: [
            { id: "students", label: "Портфолио ученика", href: "/admin/students", icon: Users, section: "students" },
            { id: "classes", label: "Классы", href: "/admin/classes", icon: ClipboardList, section: "classes" },
            { id: "classes-overview", label: "1-4 СВ и Дов.", href: "/admin/classes-overview", icon: ListOrdered, section: "classesOverview" },
        ],
    },
    {
        title: "Дисциплина",
        items: [
            { id: "violations", label: "Нарушения", href: "/admin/violations", icon: AlertTriangle, exact: true, section: "violations" },
            { id: "school-records", label: "ВШУ", href: "/admin/school-records", icon: ShieldAlert, section: "schoolRecords" },
            { id: "truants", label: "Прогульщики", href: "/admin/truants", icon: UserX, section: "truants" },
        ],
    },
    {
        title: "Аналитика",
        items: [
            {
                id: "violations-stats",
                label: "Статистика нарушений",
                href: "/admin/violations/stats",
                icon: ChartPie,
                exact: true,
                section: "violationsStats",
            },
            { id: "uniform", label: "Форма одежды", href: "/admin/uniform", icon: Shirt, exact: true, section: "uniform" },
            { id: "absent", label: "Отсутствия", href: "/admin/absent", icon: BarChart3, section: "absent" },
        ],
    },
    {
        title: "Администрирование",
        items: [
            { id: "keys-admin", label: "Ключи", href: "/admin/keys", icon: KeyRound, section: "keysAdmin" },
            { id: "keys-buildings", label: "Здания", href: "/admin/keys/buildings", icon: Building2, section: "keysAdmin" },
            { id: "keys-history", label: "История ключей", href: "/admin/keys/history", icon: History, section: "keysAdmin" },
            { id: "users", label: "Персонал", href: "/admin/users", icon: Users, section: "users" },
            { id: "roles", label: "Роли и доступы", href: "/admin/roles", icon: ShieldCheck, section: "users" },
            { id: "sync", label: "Синхронизация", href: "/admin/sync", icon: RefreshCw, section: "users" },
        ],
    },

];

/**
 * Заголовки экранов для шапки каркаса.
 * Только для экранов, которые уже переведены на каркас: остальные показывают
 * собственный заголовок, и дублировать его не нужно.
 */
export const SHELL_HEADER_ROUTES: Record<string, string> = {
    "/admin": "Контроль выхода",
};

/** Экраны, у которых уже есть свой заголовок (переходный период). */
export function hasOwnHeader(pathname: string): boolean {
    return !(pathname in SHELL_HEADER_ROUTES);
}

/** Активный раздел по адресу — для подсветки таб-бара и сайдбара. */
export function sectionForPath(pathname: string): NavSectionId {
    if (pathname === "/admin") return "dashboard";
    if (pathname.startsWith("/admin/students")) return "students";
    // classes-overview — это аналитика, поэтому проверяем раньше обычных классов
    if (pathname.startsWith("/admin/classes-overview")) return "analytics";
    if (pathname.startsWith("/admin/classes")) return "classes";
    if (pathname.startsWith("/admin/violations") || pathname.startsWith("/admin/school-records")) return "violations";
    if (
        pathname.startsWith("/admin/absent") ||
        pathname.startsWith("/admin/truants") ||
        pathname.startsWith("/admin/classes-overview")
    ) {
        return "analytics";
    }
    return "more";
}

/** Активен ли пункт: точное совпадение или вложенный путь. */
export function isLinkActive(pathname: string, link: NavLink): boolean {
    if (link.exact) return pathname === link.href;
    return pathname === link.href || pathname.startsWith(link.href + "/");
}

/** Фильтрация по ролям: пункт без `roles` доступен всем. */
export function filterByRoles(groups: NavGroup[], roles: string[]): NavGroup[] {
    return groups
        .map(group => ({
            ...group,
            items: group.items.filter(item => !item.roles || item.roles.some(role => roles.includes(role))),
        }))
        .filter(group => group.items.length > 0);
}

export function filterLinksByRoles(links: NavLink[], roles: string[]): NavLink[] {
    return links.filter(link => !link.roles || link.roles.some(role => roles.includes(role)));
}

/** Фильтр по доступам сотрудника: пункт без section показывается всегда. */
export function filterLinksByAccess(links: NavLink[], can: (section: AccessSectionId) => boolean): NavLink[] {
    return links.filter(link => !link.section || can(link.section));
}

export function filterByAccess(
    groups: NavGroup[],
    can: (section: AccessSectionId) => boolean,
): NavGroup[] {
    return groups
        .map(group => ({ ...group, items: filterLinksByAccess(group.items, can) }))
        .filter(group => group.items.length > 0);
}

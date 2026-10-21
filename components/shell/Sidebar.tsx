"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/kit";
import { NAV_GROUPS, filterByAccess, filterByRoles, isLinkActive } from "./nav-config";
import { useAccess } from "@/components/access/AccessProvider";
import { ProfileMenu } from "./ProfileMenu";

/**
 * Sidebar — навигация на планшете и десктопе.
 *
 * 768–1023px: свёрнут в полосу 72px (иконки + подсказка при наведении).
 * ≥1024px: развёрнут в 240px с подписями и заголовками групп.
 * Ширину можно переключить вручную; состояние живёт локально в компоненте,
 * чтобы не заводить глобальное состояние ради одной кнопки.
 */
export function Sidebar({
    pathname,
    roles,
    userName,
    onLogout,
    collapsed,
    onToggleCollapsed,
}: {
    pathname: string;
    roles: string[];
    userName?: string | null;
    onLogout: () => void;
    /** null — режим по умолчанию (72px на планшете, 240px на десктопе) */
    collapsed: boolean | null;
    onToggleCollapsed: () => void;
}) {
    const { can, loading: accessLoading } = useAccess();
    // Пока доступы грузятся, показываем пункты по ролям — иначе меню пустое
    const groups = accessLoading
        ? filterByRoles(NAV_GROUPS, roles)
        : filterByAccess(filterByRoles(NAV_GROUPS, roles), can);

    const widthClass = collapsed === null ? "md:w-[72px] lg:w-[240px]" : collapsed ? "w-[72px]" : "w-[240px]";
    const labelClass = collapsed === null ? "hidden lg:inline" : collapsed ? "hidden" : "inline";
    const blockClass = collapsed === null ? "hidden lg:block" : collapsed ? "hidden" : "block";
    const flexClass = collapsed === null ? "hidden lg:flex" : collapsed ? "hidden" : "flex";
    const alignClass = collapsed === null ? "md:justify-center lg:justify-start" : collapsed ? "justify-center" : "justify-start";

    return (
        <aside
            className={cn(
                "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface shadow-raised md:flex",
                "transition-[width] duration-150",
                widthClass,
            )}
        >
            {/* В свёрнутом виде 72px не вмещают логотип и кнопку в строку:
                раскладываем их столбиком, иначе кнопка сжималась и обрезалась. */}
            <div
                className={cn(
                    "flex items-center gap-2 border-b border-border px-3",
                    collapsed ? "flex-col gap-1 py-2" : "h-14",
                )}
            >
                <span
                    className={cn(
                        "flex shrink-0 items-center justify-center rounded-control bg-accent-solid text-xs font-semibold text-accent-fg",
                        collapsed ? "h-7 w-7" : "h-8 w-8",
                    )}
                    aria-hidden
                >
                    ЭП
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold text-fg", labelClass)}>
                    Электронный пропуск
                </span>
                <IconButton
                    icon={collapsed ? PanelLeftOpen : PanelLeftClose}
                    label={collapsed ? "Развернуть меню" : "Свернуть меню"}
                    size={40}
                    className={cn("shrink-0", collapsed === null && "hidden lg:flex")}
                    onClick={onToggleCollapsed}
                />
            </div>

            <nav aria-label="Разделы администратора" className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
                {groups.map(group => (
                    <div key={group.title} className="mb-4">
                        <p className={cn("mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle", blockClass)}>
                            {group.title}
                        </p>

                        <ul role="list" className="space-y-0.5">
                            {group.items.map(item => {
                                const active = isLinkActive(pathname, item);
                                const Icon = item.icon;

                                return (
                                    <li key={item.id}>
                                        <Link
                                            href={item.href}
                                            aria-current={active ? "page" : undefined}
                                            title={item.label}
                                            className={cn(
                                                "relative flex h-11 items-center gap-3 rounded-control px-2.5 text-sm",
                                                "transition-colors active:bg-surface-3",
                                                active
                                                    ? "bg-accent-soft font-medium text-accent-text"
                                                    : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                                                alignClass,
                                            )}
                                        >
                                            {active && (
                                                <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
                                            )}
                                            <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
                                            <span className={cn("truncate", labelClass)}>{item.label}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="border-t border-border p-2">
                {/* Профиль открывает настройки: тема и выход — там, одинаково на всех ширинах */}
                <div className={cn("flex items-center gap-2 px-1 py-1", alignClass)}>
                    <ProfileMenu
                        userName={userName}
                        isAdmin={roles.includes("ADMIN")}
                        onLogout={onLogout}
                        variant="compact"
                    />
                    <span className={cn("truncate text-xs text-fg-muted", labelClass)}>{userName ?? "Настройки"}</span>
                </div>
            </div>
        </aside>
    );
}

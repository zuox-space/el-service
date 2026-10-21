"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { MORE_LINK, TAB_BAR_LINKS, isLinkActive } from "./nav-config";

/**
 * TabBar — постоянная навигация на мобильном (до 768px).
 *
 * Ключевые разделы + «Ещё»; количество колонок считается по TAB_BAR_LINKS. Активный — акцентный цвет
 * и индикатор сверху; подпись всегда видна (иконка без подписи непонятна).
 * Высота 56px + safe-area, чтобы не перекрывалась системная полоса iOS.
 *
 * Путь передаётся пропсом из AppShell (usePathname) — так серверная и клиентская
 * разметка совпадают, и нет чтения window во время рендера.
 */
export function TabBar({ pathname, onMoreClick }: { pathname: string; onMoreClick: () => void }) {
    return (
        <nav
            aria-label="Основная навигация"
            className="surface-card fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe shadow-raised md:hidden"
        >
            {/* grid обязателен: колонки задаются инлайном по числу пунктов */}
            <ul
                role="list"
                className="grid"
                style={{ gridTemplateColumns: `repeat(${TAB_BAR_LINKS.length + 1}, minmax(0, 1fr))` }}
            >
                {TAB_BAR_LINKS.map(link => {
                    const active = isLinkActive(pathname, link);
                    const Icon = link.icon;

                    return (
                        <li key={link.id}>
                            <Link
                                href={link.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "relative flex h-14 flex-col items-center justify-center gap-0.5",
                                    "transition-colors active:bg-surface-2",
                                    active ? "text-accent-text" : "text-fg-muted",
                                )}
                            >
                                {active && (
                                    <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-accent" />
                                )}
                                <Icon size={22} strokeWidth={1.75} aria-hidden />
                                <span className="text-[11px] font-medium leading-none">{link.shortLabel ?? link.label}</span>
                            </Link>
                        </li>
                    );
                })}

                <li>
                    <button
                        type="button"
                        onClick={onMoreClick}
                        aria-haspopup="dialog"
                        className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-fg-muted transition-colors active:bg-surface-2"
                    >
                        <MORE_LINK.icon size={22} strokeWidth={1.75} aria-hidden />
                        <span className="text-[11px] font-medium leading-none">{MORE_LINK.label}</span>
                    </button>
                </li>
            </ul>
        </nav>
    );
}

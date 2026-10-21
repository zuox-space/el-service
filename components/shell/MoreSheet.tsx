"use client";

import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { BottomSheet } from "@/components/ui/kit";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, filterByRoles, isLinkActive } from "./nav-config";

/**
 * MoreSheet — полноэкранный список второстепенных разделов («Ещё»).
 *
 * На мобильном это единственное место, где видно полный список: таб-бар
 * занимает 5 пунктов, а групп разделов больше. Элементы сгруппированы по
 * задаче, с крупными тап-таргетами (56px), а не сеткой мелких иконок.
 */
export function MoreSheet({
    open,
    onClose,
    pathname,
    roles,
    userName,
    onLogout,
}: {
    open: boolean;
    onClose: () => void;
    pathname: string;
    roles: string[];
    userName?: string | null;
    onLogout: () => void;
}) {
    const groups = filterByRoles(NAV_GROUPS, roles);

    return (
        <BottomSheet
            open={open}
            onClose={onClose}
            fullScreen
            title="Ещё"
            description={userName ?? undefined}
            footer={
                <button
                    type="button"
                    onClick={onLogout}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-control border border-danger/40 bg-surface-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft active:bg-danger-soft"
                >
                    <LogOut size={18} strokeWidth={1.75} aria-hidden />
                    Выйти из аккаунта
                </button>
            }
        >
            <div className="space-y-5">
                {/* Оформление: тема переключается и здесь, чтобы не зависеть от шапки */}
                <section>
                    <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                        Оформление
                    </h3>
                    <div className="surface-card flex items-center justify-between rounded-card border border-border bg-surface px-4 py-2 shadow-card">
                        <span className="text-sm text-fg">Тема</span>
                        <ThemeToggle />
                    </div>
                </section>

                {groups.map(group => (
                    <section key={group.title}>
                        <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                            {group.title}
                        </h3>

                        <ul role="list" className="surface-card divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
                            {group.items.map(item => {
                                const active = isLinkActive(pathname, item);
                                const Icon = item.icon;

                                return (
                                    <li key={item.id}>
                                        <Link
                                            href={item.href}
                                            onClick={onClose}
                                            aria-current={active ? "page" : undefined}
                                            className={cn(
                                                "flex min-h-14 items-center gap-3 px-4 py-3 transition-colors active:bg-surface-3",
                                                active ? "bg-accent-soft" : "hover:bg-surface-2",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
                                                    active ? "bg-accent/15 text-accent-text" : "bg-surface-2 text-fg-muted",
                                                )}
                                                aria-hidden
                                            >
                                                <Icon size={20} strokeWidth={1.75} />
                                            </span>

                                            <span
                                                className={cn(
                                                    "min-w-0 flex-1 truncate text-sm",
                                                    active ? "font-medium text-accent-text" : "text-fg",
                                                )}
                                            >
                                                {item.label}
                                            </span>

                                            <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </BottomSheet>
    );
}

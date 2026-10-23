"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/cn";
import { ProfileMenu } from "./ProfileMenu";
import { SHELL_HEADER_ROUTES, hasOwnHeader } from "./nav-config";
import { HeaderActionsContext } from "./header-actions";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";
import { MoreSheet } from "./MoreSheet";

/**
 * AppShell — единый каркас приложения.
 *
 * Что даёт:
 *  • постоянную навигацию: sidebar на планшете/десктопе, таб-бар на мобильном;
 *  • шапку с заголовком экрана и быстрыми действиями;
 *  • корректные отступы под фиксированную навигацию и safe-area iOS;
 *  • один skip-link и один <main> — база для доступности.
 *
 * Переходный режим: у части экранов (violations, truants, …) пока свой заголовок,
 * поэтому шапка каркаса для них не дублируется. Список таких экранов — в nav-config.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "/admin";
    const { data: session } = useSession();
    const [moreOpen, setMoreOpen] = useState(false);

    // Ширина сайдбара живёт здесь, а не внутри Sidebar: от неё зависит отступ
    // контента и шапки. Иначе при ручном сворачивании шапка оставалась сдвинутой
    // на 240px и «обрезалась» слева.
    const [collapsed, setCollapsed] = useState<boolean | null>(null);

    // Действия, которые страница кладёт в шапку (например, «Обновить» на панели)
    const [headerActions, setHeaderActions] = useState<ReactNode>(null);

    const roles = (session?.user?.roles as string[]) || [];
    const userName = session?.user?.name ?? null;

    const title = SHELL_HEADER_ROUTES[pathname];
    const showHeader = Boolean(title) && !hasOwnHeader(pathname);

    // null — режим по умолчанию (72px на планшете, 240px на десктопе).
    // Ручное разворачивание задаёт 240px на любой ширине — отступ должен совпадать.
    const contentPadding =
        collapsed === null
            ? "md:pl-[72px] lg:pl-[240px]"
            : collapsed
                ? "md:pl-[72px]"
                : "md:pl-[240px]";

    const handleLogout = () => {
        // signOut из next-auth сам добавляет CSRF и чистит cookie —
        // прежний fetch("/api/auth/signout") без токена не срабатывал
        void signOut({ callbackUrl: "/login" });
    };

    return (
        <div className="min-h-dvh bg-bg">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-fg focus:shadow-overlay"
            >
                Перейти к содержимому
            </a>

            <HeaderActionsContext.Provider value={setHeaderActions}>
                <Sidebar
                    pathname={pathname}
                    roles={roles}
                    userName={userName}
                    onLogout={handleLogout}
                    collapsed={collapsed}
                    onToggleCollapsed={() => setCollapsed(previous => !(previous ?? true))}
                />

                <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-150", contentPadding)}>
                    {showHeader && (
                        <header className="sticky top-0 z-20 border-b border-border bg-bg/95 shadow-card backdrop-blur-sm">
                            <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-2 px-4">
                                {pathname !== "/admin" && (
                                    <Link
                                        href="/admin"
                                        aria-label="Назад"
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg md:hidden"
                                    >
                                        <ChevronLeft size={20} aria-hidden />
                                    </Link>
                                )}
                                <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-fg">{title}</h1>
                                <div className="flex shrink-0 items-center gap-1">
                                    {headerActions}
                                    <div className="min-w-0 text-right">
                                        <p className="max-w-[104px] truncate text-xs font-semibold text-fg sm:max-w-[180px]">
                                            {userName ?? "Сотрудник"}
                                        </p>
                                        {session?.user?.email && (
                                            <p className="hidden max-w-[180px] truncate text-[11px] text-fg-subtle sm:block">
                                                {session.user.email}
                                            </p>
                                        )}
                                    </div>
                                    <ProfileMenu
                                        userName={userName}
                                        userEmail={session?.user?.email ?? null}
                                        onLogout={handleLogout}
                                    />
                                </div>
                            </div>
                        </header>
                    )}

                    <main id="main" className="flex-1 pb-16 md:pb-0">
                        {children}
                    </main>
                </div>

                <TabBar pathname={pathname} onMoreClick={() => setMoreOpen(true)} />

                <MoreSheet
                    open={moreOpen}
                    onClose={() => setMoreOpen(false)}
                    pathname={pathname}
                    roles={roles}
                    userName={userName}
                    onLogout={handleLogout}
                />
            </HeaderActionsContext.Provider>
        </div>
    );
}

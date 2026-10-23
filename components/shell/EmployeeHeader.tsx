"use client";

// components/shell/EmployeeHeader.tsx
import Link from "next/link";
import { ArrowLeft, School } from "lucide-react";
import { ProfileMenu } from "./ProfileMenu";

/**
 * Шапка сотрудника для неадминистративных страниц (портал, «Мой класс»,
 * «Мои фиксации»).
 *
 * Слева: на главной — логотип приложения, на внутренней странице — стрелка назад
 * и название раздела. Справа — сотрудник: имя/почта на широком экране и аватар
 * с меню настроек на мобильном.
 */
export function EmployeeHeader({
    title,
    backHref = "/",
    home = false,
    userName,
    userEmail,
    roles = [],
    onLogout,
}: {
    title?: string;
    backHref?: string;
    home?: boolean;
    userName?: string | null;
    userEmail?: string | null;
    roles?: string[];
    onLogout: () => void;
}) {
    return (
        <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-sm">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1.5 px-3">
                {home ? (
                    <Link
                        href="/"
                        className="flex min-w-0 items-center gap-2 rounded-control px-1 py-1 transition-colors hover:bg-surface-hover"
                        aria-label="Электронный пропуск — на главную"
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-accent-solid text-accent-fg">
                            <School size={18} aria-hidden />
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold text-fg">
                            Электронный пропуск
                        </span>
                    </Link>
                ) : (
                    <>
                        <Link
                            href={backHref}
                            aria-label="Назад"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                        >
                            <ArrowLeft size={20} aria-hidden />
                        </Link>
                        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-fg">
                            {title ?? "Сервис"}
                        </h1>
                    </>
                )}

                <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
                    <div className="min-w-0 text-right">
                        <p className="max-w-[104px] truncate text-xs font-semibold text-fg sm:max-w-[180px]">
                            {userName ?? "Сотрудник"}
                        </p>
                        {userEmail && (
                            <p className="hidden max-w-[180px] truncate text-[11px] text-fg-subtle sm:block">
                                {userEmail}
                            </p>
                        )}
                    </div>
                    <ProfileMenu
                        userName={userName}
                        userEmail={userEmail}
                        roles={roles}
                        onLogout={onLogout}
                        variant="compact"
                    />
                </div>
            </div>
        </header>
    );
}

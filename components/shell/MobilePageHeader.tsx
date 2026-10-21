"use client";

// components/shell/MobilePageHeader.tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProfileMenu } from "./ProfileMenu";

/**
 * Мобильный хэдер внутренних страниц.
 *
 * Сверху — профиль как на главной: аватар, имя и почта. Ниже — стрелка назад
 * и название раздела. Так один и тот же хэдер используется на всех страницах
 * вне админки (там свой каркас), и сотрудник всегда видит, где он и куда вернуться.
 */
export function MobilePageHeader({
    title,
    backHref = "/",
    userName,
    userEmail,
    roles = [],
    onLogout,
}: {
    title: string;
    backHref?: string;
    userName?: string | null;
    userEmail?: string | null;
    roles?: string[];
    onLogout: () => void;
}) {
    return (
        <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm md:hidden">
            <div className="px-3 pt-2">
                <ProfileMenu
                    userName={userName}
                    userEmail={userEmail}
                    roles={roles}
                    onLogout={onLogout}
                    variant="full"
                />
            </div>

            <div className="flex items-center gap-1 px-1 pb-2 pt-1">
                <Link
                    href={backHref}
                    aria-label="Назад"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                >
                    <ArrowLeft size={20} aria-hidden />
                </Link>
                <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-fg">{title}</h1>
            </div>
        </header>
    );
}

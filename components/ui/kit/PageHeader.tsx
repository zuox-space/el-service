"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";

/**
 * PageHeader — верхняя часть экрана: заголовок, хлебные крошки, действия.
 *
 * На мобильном экране слева появляется «назад» при вложенности, справа — до двух
 * быстрых действий, поэтому заголовок получает flex-1 и не «съедается».
 * Компонент липкий (sticky) — но сама страница не должна иметь overflow:hidden,
 * иначе sticky перестаёт работать (частая причина «не нажимается» в PWA).
 */
export interface Breadcrumb {
    label: string;
    href?: string;
}

export interface PageHeaderProps {
    title: string;
    subtitle?: React.ReactNode;
    /** Назад: функция или ссылка. Показывается только если передан */
    onBack?: () => void;
    breadcrumbs?: Breadcrumb[];
    actions?: React.ReactNode;
    /** Segmented tabs раздела — сразу под заголовком */
    tabs?: React.ReactNode;
    sticky?: boolean;
    className?: string;
}

export function PageHeader({
    title,
    subtitle,
    onBack,
    breadcrumbs,
    actions,
    tabs,
    sticky = true,
    className,
}: PageHeaderProps) {
    return (
        <header
            className={cn(
                "z-10 border-b border-border bg-bg/95 shadow-card backdrop-blur-sm",
                sticky && "sticky top-0",
                className,
            )}
        >
            <div className="mx-auto w-full max-w-[1440px] px-4">
                <div className="flex min-h-14 items-center gap-2 py-2">
                    {onBack && (
                        <IconButton
                            icon={ChevronLeft}
                            label="Назад"
                            variant="ghost"
                            onClick={onBack}
                            className="-ml-2 shrink-0"
                        />
                    )}

                    <div className="min-w-0 flex-1">
                        {breadcrumbs && breadcrumbs.length > 0 && (
                            <nav aria-label="Хлебные крошки" className="mb-0.5 hidden items-center gap-1 text-xs text-fg-subtle sm:flex">
                                {breadcrumbs.map((crumb, index) => (
                                    <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                                        {index > 0 && <ChevronRight size={12} aria-hidden />}
                                        {crumb.href ? (
                                            <a href={crumb.href} className="hover:text-fg-muted hover:underline">
                                                {crumb.label}
                                            </a>
                                        ) : (
                                            <span className="text-fg-muted">{crumb.label}</span>
                                        )}
                                    </span>
                                ))}
                            </nav>
                        )}
                        <h1 className="truncate text-lg font-semibold text-fg">{title}</h1>
                        {subtitle && <div className="truncate text-xs text-fg-muted">{subtitle}</div>}
                    </div>

                    {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
                </div>

                {tabs && <div className="pb-2">{tabs}</div>}
            </div>
        </header>
    );
}

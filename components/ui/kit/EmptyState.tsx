"use client";

import { AlertCircle, Inbox, SearchX, ShieldOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

/**
 * EmptyState — пустое или проблемное состояние.
 *
 * Важное различие, которого не было в старом интерфейсе:
 *  • empty      — данных действительно нет («сегодня никто не выходил»);
 *  • no-results — ничего не найдено по фильтру/поиску (не путать с «нет данных»);
 *  • error      — запрос не выполнился, можно повторить;
 *  • forbidden  — нет прав (вместо белого экрана).
 */
export type EmptyStateVariant = "empty" | "no-results" | "error" | "forbidden";

export interface EmptyStateProps {
    variant?: EmptyStateVariant;
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void; loading?: boolean };
    secondaryAction?: { label: string; onClick: () => void };
    className?: string;
    compact?: boolean;
}

const variantConfig: Record<EmptyStateVariant, { icon: LucideIcon; tone: string }> = {
    empty: { icon: Inbox, tone: "text-fg-subtle" },
    "no-results": { icon: SearchX, tone: "text-fg-subtle" },
    error: { icon: AlertCircle, tone: "text-danger" },
    forbidden: { icon: ShieldOff, tone: "text-warning" },
};

export function EmptyState({
    variant = "empty",
    icon,
    title,
    description,
    action,
    secondaryAction,
    className,
    compact = false,
}: EmptyStateProps) {
    const config = variantConfig[variant];
    const Icon = icon ?? config.icon;

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface/60 text-center",
                compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    "flex items-center justify-center rounded-full bg-surface-2",
                    compact ? "h-10 w-10" : "h-12 w-12",
                )}
            >
                <Icon size={compact ? 18 : 22} strokeWidth={1.75} className={config.tone} />
            </span>

            <div className="max-w-sm">
                <p className="text-base font-medium text-fg">{title}</p>
                {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
            </div>

            {(action || secondaryAction) && (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                    {action && (
                        <Button size="sm" onClick={action.onClick} loading={action.loading}>
                            {action.label}
                        </Button>
                    )}
                    {secondaryAction && (
                        <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
                            {secondaryAction.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

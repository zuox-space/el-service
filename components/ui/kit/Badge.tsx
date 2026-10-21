"use client";

import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Badge — статус объекта. Семантика через tone, а не через произвольный цвет,
 * чтобы статусы читались одинаково во всём приложении.
 */
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
    tone?: BadgeTone;
    size?: "sm" | "md";
    /** Точка-индикатор слева — для компактных статусов без текста префикса */
    dot?: boolean;
    icon?: LucideIcon;
    className?: string;
    children: React.ReactNode;
}

const toneStyles: Record<BadgeTone, string> = {
    neutral: "bg-surface-2 text-fg-muted border-border",
    accent: "bg-accent-soft text-accent border-accent/25",
    success: "bg-success-soft text-success border-success/25",
    warning: "bg-warning-soft text-warning border-warning/25",
    danger: "bg-danger-soft text-danger border-danger/25",
    info: "bg-info-soft text-info border-info/25",
};

const dotStyles: Record<BadgeTone, string> = {
    neutral: "bg-fg-subtle",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
};

export function Badge({ tone = "neutral", size = "sm", dot = false, icon: Icon, className, children }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-control border font-medium whitespace-nowrap",
                size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
                toneStyles[tone],
                className,
            )}
        >
            {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[tone])} aria-hidden />}
            {Icon && <Icon size={12} strokeWidth={1.75} aria-hidden />}
            {children}
        </span>
    );
}

/**
 * Chip — фильтр или метка, которая нажимается.
 * Минимальная высота 32px (визуально компактно), но с отдельной зоной нажатия
 * не меньше 44px по вертикали через padding у контейнера списка чипов.
 * Для одиночного важного действия используйте Button.
 */
export interface ChipProps {
    selected?: boolean;
    onClick?: () => void;
    onRemove?: () => void;
    icon?: LucideIcon;
    count?: number;
    disabled?: boolean;
    className?: string;
    children: React.ReactNode;
}

export function Chip({
    selected = false,
    onClick,
    onRemove,
    icon: Icon,
    count,
    disabled = false,
    className,
    children,
}: ChipProps) {
    const interactive = Boolean(onClick);

    const content = (
        <>
            {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
            <span className="whitespace-nowrap">{children}</span>
            {typeof count === "number" && (
                <span className={cn("tabular-nums", selected ? "text-accent" : "text-fg-subtle")}>{count}</span>
            )}
            {onRemove && (
                <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Убрать ${typeof children === "string" ? children : "фильтр"}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemove();
                        }
                    }}
                    className="-mr-1 ml-0.5 flex h-6 w-6 items-center justify-center rounded-control hover:bg-surface-3"
                >
                    <X size={12} aria-hidden />
                </span>
            )}
        </>
    );

    const classes = cn(
        "inline-flex h-9 items-center gap-1.5 rounded-control border px-2.5 text-sm transition-colors",
        "active:scale-[0.99]",
        selected
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg",
        disabled && "pointer-events-none opacity-50",
        className,
    );

    if (!interactive) {
        return <span className={classes}>{content}</span>;
    }

    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={classes}>
            {content}
        </button>
    );
}

"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

/**
 * ListItem — строка списка. Единая плотность и сетка для всех разделов.
 *
 * Реализация намеренно без `div onClick`: строка — это настоящий <button> или <a>,
 * поэтому работает клавиатура, скринридер и тап в PWA.
 *
 * Если нужен дополнительный экшен справа, строка разбивается на две зоны:
 * сама строка (кнопка) и кнопка экшена — вложенные интерактивные элементы
 * недопустимы, поэтому overlay-хаков здесь нет.
 */
export interface ListItemProps {
    leading?: LucideIcon | React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** Дополнительная строка/метаданные под подзаголовком */
    meta?: React.ReactNode;
    trailing?: "chevron" | "badge" | "none" | "action";
    trailingContent?: React.ReactNode;
    /** Для trailing="action": иконка, подпись и обработчик */
    actionIcon?: LucideIcon;
    actionLabel?: string;
    onActionClick?: () => void;
    actionTone?: "default" | "danger";
    href?: string;
    onClick?: () => void;
    selected?: boolean;
    disabled?: boolean;
    loading?: boolean;
    density?: "comfortable" | "compact";
    className?: string;
}

const leadingBox = "flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-muted";

/**
 * Отличить иконку-компонент от произвольного ReactNode.
 *
 * Иконки Lucide — это не функции, а объекты forwardRef (у них есть $$typeof и render),
 * поэтому проверки `typeof value === "function"` недостаточно: без этой проверки
 * компонент попадал в разметку как объект, и страница падала с
 * «Objects are not valid as a React child».
 */
function isIconComponent(value: unknown): value is LucideIcon {
    if (typeof value === "function") return true;
    return typeof value === "object" && value !== null && "$$typeof" in value && "render" in value;
}

export function ListItem({
    leading,
    title,
    subtitle,
    meta,
    trailing = "none",
    trailingContent,
    actionIcon: ActionIcon,
    actionLabel,
    onActionClick,
    actionTone = "default",
    href,
    onClick,
    selected = false,
    disabled = false,
    loading = false,
    density = "comfortable",
    className,
}: ListItemProps) {
    if (loading) {
        return (
            <div className={cn("flex items-center gap-3 px-4 py-3", className)} aria-busy>
                <Skeleton width={36} height={36} radius="control" />
                <div className="flex flex-1 flex-col gap-2">
                    <Skeleton height={12} width="55%" />
                    <Skeleton height={10} width="35%" />
                </div>
            </div>
        );
    }

    const padding = density === "compact" ? "px-3 py-2" : "px-4 py-3";
    const interactive = Boolean(href || onClick) && !disabled;

    const rowClasses = cn(
        "flex w-full items-center gap-3 text-left transition-colors duration-150",
        padding,
        density === "compact" ? "min-h-11" : "min-h-14",
        selected ? "bg-accent-soft" : "bg-transparent",
        interactive && !selected && "hover:bg-surface-2 active:bg-surface-3",
        disabled && "cursor-not-allowed opacity-50",
    );

    const renderLeading = () => {
        if (!leading) return null;
        if (isIconComponent(leading)) {
            const Icon = leading;
            return (
                <span className={leadingBox} aria-hidden>
                    <Icon size={20} strokeWidth={1.75} />
                </span>
            );
        }
        return <span className="shrink-0" aria-hidden>{leading}</span>;
    };

    const renderTrailing = () => {
        if (trailing === "none") return null;
        if (trailing === "badge") return <span className="shrink-0">{trailingContent}</span>;
        if (trailing === "chevron") {
            return <ChevronRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />;
        }
        return null;
    };

    const content = (
        <>
            {renderLeading()}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-fg">{title}</span>
                {subtitle && <span className="truncate text-xs text-fg-muted">{subtitle}</span>}
                {meta && <span className="mt-0.5 truncate text-xs text-fg-subtle">{meta}</span>}
            </span>
            {renderTrailing()}
        </>
    );

    // Строка с дополнительным экшеном: две отдельные зоны вместо вложенных кнопок
    if (trailing === "action" && ActionIcon) {
        const rowBody = interactive ? (
            href ? (
                <a href={href} className={cn(rowClasses, "flex-1")}>{content}</a>
            ) : (
                <button type="button" onClick={onClick} className={cn(rowClasses, "flex-1")}>{content}</button>
            )
        ) : (
            <div className={cn(rowClasses, "flex-1")}>{content}</div>
        );

        return (
            <div className={cn("flex items-center", selected && "bg-accent-soft", className)}>
                {rowBody}
                <button
                    type="button"
                    aria-label={actionLabel ?? "Действие"}
                    onClick={onActionClick}
                    disabled={disabled}
                    className={cn(
                        "mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-control",
                        "transition-colors active:scale-[0.98]",
                        actionTone === "danger"
                            ? "text-danger hover:bg-danger-soft"
                            : "text-fg-muted hover:bg-surface-3 hover:text-fg",
                        disabled && "cursor-not-allowed opacity-50",
                    )}
                >
                    <ActionIcon size={20} strokeWidth={1.75} aria-hidden />
                </button>
            </div>
        );
    }

    const classes = cn(rowClasses, className);

    if (href && !disabled) {
        return (
            <a href={href} className={classes} aria-current={selected ? "true" : undefined}>
                {content}
            </a>
        );
    }

    if (onClick && !disabled) {
        return (
            <button type="button" onClick={onClick} className={classes} aria-pressed={selected || undefined}>
                {content}
            </button>
        );
    }

    return <div className={classes}>{content}</div>;
}

/** List — контейнер с разделителями. Ровно один шаг сетки между строками. */
export function List({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <ul role="list" className={cn("divide-y divide-border overflow-hidden rounded-card border border-border bg-surface", className)}>
            {children}
        </ul>
    );
}

/** ListItemEmpty — строка-заглушка внутри списка (список есть, данных нет). */
export function ListItemEmpty({ children }: { children: React.ReactNode }) {
    return <li className="px-4 py-8 text-center text-sm text-fg-muted">{children}</li>;
}

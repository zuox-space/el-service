"use client";

import { cn } from "@/lib/cn";

/**
 * Card — базовая поверхность контента.
 * Заменяет повторяющееся `bg-surface border border-border shadow-card rounded-xl border border-border`:
 * фон, граница, радиус и отступы берутся из токенов и работают в обеих темах.
 */
export interface CardProps {
    as?: "div" | "section" | "article" | "li";
    padding?: "none" | "sm" | "md";
    /** Заголовок и действие справа — уже с нужной типографикой и разделителем */
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    footer?: React.ReactNode;
    /** Кликабельная карточка: добавляет hover/active и role="button" */
    interactive?: boolean;
    onClick?: () => void;
    className?: string;
    bodyClassName?: string;
    children?: React.ReactNode;
}

const paddings = {
    none: "",
    sm: "p-3",
    md: "p-4",
};

export function Card({
    as: Tag = "div",
    padding = "md",
    title,
    description,
    action,
    footer,
    interactive = false,
    onClick,
    className,
    bodyClassName,
    children,
}: CardProps) {
    const clickable = interactive || Boolean(onClick);

    return (
        <Tag
            className={cn(
                // overflow-hidden: дочерние строки списка с hover-фоном не выходят
                // за скругление карточки (padding="none" + List внутри)
                "surface-card overflow-hidden rounded-card border border-border bg-surface shadow-card",
                clickable && "surface-lift cursor-pointer transition-colors hover:border-border-strong active:bg-surface-2",
                className,
            )}
            onClick={onClick}
            {...(clickable
                ? {
                    role: "button",
                    tabIndex: 0,
                    onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onClick?.();
                        }
                    },
                }
                : {})}
        >
            {(title || action) && (
                <div
                    className={cn(
                        "flex items-start justify-between gap-3 border-b border-border px-4 py-3",
                        padding === "none" && "px-4",
                    )}
                >
                    <div className="min-w-0">
                        {title && <h3 className="truncate text-base font-semibold text-fg">{title}</h3>}
                        {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            )}

            <div className={cn(paddings[padding], bodyClassName)}>{children}</div>

            {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
        </Tag>
    );
}

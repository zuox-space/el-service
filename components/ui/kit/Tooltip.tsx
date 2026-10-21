"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Tooltip — подсказка для иконочных кнопок на десктопе.
 *
 * Сознательное ограничение: на тач-устройствах тултип не показывается
 * (там нет наведения, а долгое нажатие конфликтует с контекстным меню),
 * поэтому у иконочных кнопок обязателен aria-label — см. IconButton.
 */
export interface TooltipProps {
    content: string;
    side?: "top" | "bottom" | "left" | "right";
    children: React.ReactNode;
    className?: string;
}

const sideStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({ content, side = "top", children, className }: TooltipProps) {
    const id = useId();
    const [open, setOpen] = useState(false);

    return (
        <span
            className={cn("relative inline-flex", className)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
        >
            <span aria-describedby={open ? id : undefined} className="inline-flex">
                {children}
            </span>

            {open && (
                <span
                    role="tooltip"
                    id={id}
                    className={cn(
                        "pointer-events-none absolute z-50 hidden whitespace-nowrap rounded-control",
                        "border border-border bg-surface-3 px-2 py-1 text-xs text-fg shadow-raised",
                        "md:block",
                        sideStyles[side],
                    )}
                >
                    {content}
                </span>
            )}
        </span>
    );
}

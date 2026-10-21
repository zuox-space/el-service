"use client";

import { cn } from "@/lib/cn";

/** Divider — тонкая линия-разделитель. `label` превращает её в подпись секции. */
export interface DividerProps {
    orientation?: "horizontal" | "vertical";
    /** Отступ слева/справа для вложенных списков (16px) */
    inset?: boolean;
    label?: string;
    className?: string;
}

export function Divider({ orientation = "horizontal", inset = false, label, className }: DividerProps) {
    if (orientation === "vertical") {
        return <span aria-hidden className={cn("inline-block w-px self-stretch bg-border", className)} />;
    }

    if (label) {
        return (
            <div className={cn("flex items-center gap-3 py-2", className)}>
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
                <span className="h-px flex-1 bg-border" />
            </div>
        );
    }

    return <hr className={cn("h-px w-full border-0 bg-border", inset && "mx-4 w-auto", className)} />;
}

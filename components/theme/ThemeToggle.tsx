"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Skeleton } from "@/components/ui/kit/Skeleton";
import { cn } from "@/lib/cn";

/**
 * Переключатель темы.
 *
 * Иконка рендерится только после монтирования: тема применяется инлайновым
 * скриптом до гидрации, и до этого момента мы не знаем, какая она — без этой
 * проверки был бы «прыжок» иконки и предупреждение о несовпадении разметки.
 *
 * size="sm" — компактный вариант для шапки (32px), size="md" — 48px тап-таргет.
 */
export function ThemeToggle({ size = "md", className }: { size?: "sm" | "md"; className?: string }) {
    const { theme, mounted, toggleTheme } = useTheme();

    if (!mounted) {
        return <Skeleton width={size === "sm" ? 32 : 48} height={size === "sm" ? 32 : 48} radius="control" />;
    }

    const nextLabel = theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={nextLabel}
            title={nextLabel}
            className={cn(
                "flex items-center justify-center rounded-control border border-border bg-surface-2 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg active:bg-surface-3",
                size === "sm" ? "h-8 w-8" : "h-12 w-12",
                className,
            )}
        >
            {theme === "dark" ? (
                <Sun size={size === "sm" ? 16 : 20} strokeWidth={1.75} aria-hidden />
            ) : (
                <Moon size={size === "sm" ? 16 : 20} strokeWidth={1.75} aria-hidden />
            )}
        </button>
    );
}

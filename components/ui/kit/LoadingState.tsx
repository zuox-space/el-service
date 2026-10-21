"use client";

// components/ui/kit/LoadingState.tsx
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Единые состояния загрузки.
 *
 * Раньше каждый экран рисовал свой лоадер: где-то тёмный градиент, где-то синий
 * спиннер, где-то белая карточка. При переходе между страницами это давало
 * «мерцание» чужого стиля. Теперь все загрузки — из одного компонента на токенах,
 * поэтому цвет совпадает и в тёмной, и в светлой теме.
 */

/** Загрузка на весь экран: первая отрисовка страницы. */
export function PageLoading({ label = "Загрузка…", className }: { label?: string; className?: string }) {
    return (
        <div className={cn("flex min-h-[60vh] items-center justify-center px-4", className)}>
            <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
                <Loader2 className="h-7 w-7 animate-spin text-accent" aria-hidden />
                <p className="text-sm text-fg-muted">{label}</p>
            </div>
        </div>
    );
}

/** Загрузка внутри блока: список, панель, вкладка. */
export function InlineLoading({ label = "Загрузка…" }: { label?: string }) {
    return (
        <div className="rounded-card border border-border bg-surface p-8 text-center" role="status" aria-live="polite">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-accent" aria-hidden />
            <p className="text-sm text-fg-muted">{label}</p>
        </div>
    );
}

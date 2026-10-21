"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

/* ============================================================================
   Toast — уведомления вместо alert().
   alert блокирует поток, на мобильном перекрывает экран и не даёт отменить
   действие; тост не блокирует, живёт 4 секунды и складывается в стек.
   ============================================================================ */

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastOptions {
    title: string;
    description?: string;
    tone?: ToastTone;
    /** ms; 0 — не закрывать автоматически */
    duration?: number;
    action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
    id: number;
}

interface ToastContextValue {
    show: (options: ToastOptions) => number;
    dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneConfig: Record<ToastTone, { icon: typeof Info; className: string; bar: string }> = {
    info: { icon: Info, className: "text-info", bar: "bg-info" },
    success: { icon: CheckCircle2, className: "text-success", bar: "bg-success" },
    warning: { icon: AlertTriangle, className: "text-warning", bar: "bg-warning" },
    danger: { icon: XCircle, className: "text-danger", bar: "bg-danger" },
};

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const timers = useRef(new Map<number, number>());

    const dismiss = useCallback((id: number) => {
        setItems(prev => prev.filter(item => item.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            window.clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);

    const show = useCallback(
        (options: ToastOptions) => {
            const id = ++toastCounter;
            const duration = options.duration ?? 4000;

            setItems(prev => [...prev.slice(-2), { ...options, id }]);

            if (duration > 0) {
                const timer = window.setTimeout(() => dismiss(id), duration);
                timers.current.set(id, timer);
            }
            return id;
        },
        [dismiss],
    );

    useEffect(() => {
        const current = timers.current;
        return () => {
            current.forEach(timer => window.clearTimeout(timer));
            current.clear();
        };
    }, []);

    const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

    return (
        <ToastContext.Provider value={value}>
            {children}

            {/* aria-live: скринридер объявит уведомление, не перебивая работу */}
            <div
                aria-live="polite"
                aria-atomic="false"
                className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-3 pb-safe sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:items-end sm:p-0"
            >
                {items.map(item => {
                    const tone = item.tone ?? "info";
                    const config = toneConfig[tone];
                    const Icon = config.icon;

                    return (
                        <div
                            key={item.id}
                            role="status"
                            className={cn(
                                "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden",
                                "rounded-card border border-border bg-surface p-3 shadow-overlay",
                                "animate-[toastIn_180ms_ease-out]",
                            )}
                        >
                            <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", config.bar)} />
                            <Icon size={18} strokeWidth={1.75} className={cn("mt-0.5 shrink-0", config.className)} aria-hidden />

                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-fg">{item.title}</p>
                                {item.description && <p className="mt-0.5 text-xs text-fg-muted">{item.description}</p>}
                                {item.action && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            item.action?.onClick();
                                            dismiss(item.id);
                                        }}
                                        className="mt-2 text-xs font-medium text-accent hover:underline"
                                    >
                                        {item.action.label}
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                aria-label="Закрыть уведомление"
                                onClick={() => dismiss(item.id)}
                                className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-fg-subtle hover:bg-surface-2 hover:text-fg"
                            >
                                <X size={16} aria-hidden />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

/** Хук для показа уведомлений. Требует <ToastProvider> выше по дереву. */
export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast должен использоваться внутри <ToastProvider>");
    return ctx;
}

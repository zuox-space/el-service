"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Tabs — переключение представлений внутри раздела. Два варианта:
 *
 *  • segmented  — 2–4 равноправных вкладки. Всегда помещаются, без скролла.
 *                 Используется как основная навигация раздела (Пропуска / Отсутствия / …).
 *  • scrollable — вкладок много (например, фильтры или длинный список).
 *                 Горизонтальный скролл со снапом, мягкими масками по краям
 *                 и перетаскиванием мышью. Стрелок нет: в PWA они бесполезны
 *                 (маленькая цель, перекрывают контент), а маски показывают,
 *                 что список продолжается.
 *
 * Требования доступности: role="tablist"/"tab"/"tabpanel", aria-selected,
 * навигация стрелками ←/→ и Home/End, видимый фокус.
 */
export interface TabItem {
    id: string;
    label: string;
    icon?: LucideIcon;
    count?: number;
    disabled?: boolean;
}

export interface TabsProps {
    items: TabItem[];
    value: string;
    onChange: (id: string) => void;
    variant?: "segmented" | "scrollable";
    /** Занимать всю ширину (segmented по умолчанию) */
    fullWidth?: boolean;
    ariaLabel?: string;
    /** sm — компактные вкладки: меньше отступы, влезают три штуки на телефоне */
    size?: "sm" | "md";
    className?: string;
}

export function Tabs({
    items,
    value,
    onChange,
    variant = "segmented",
    fullWidth = true,
    ariaLabel = "Разделы",
    size = "md",
    className,
}: TabsProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ left: false, right: false });

    /* --- маски и прокрутка в выбранную вкладку (только scrollable) --- */
    const updateEdges = useCallback(() => {
        const el = listRef.current;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        setEdges({
            left: el.scrollLeft > 4,
            right: max > 4 && el.scrollLeft < max - 4,
        });
    }, []);

    useEffect(() => {
        if (variant !== "scrollable") return;
        updateEdges();
        const el = listRef.current;
        if (!el) return;

        const scrollActiveIntoView = () => {
            const active = el.querySelector<HTMLElement>('[data-active="true"]');
            if (!active) return;
            const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
            el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        };
        scrollActiveIntoView();

        const onResize = () => updateEdges();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [value, items.length, variant, updateEdges]);

    /* --- перетаскивание мышью: на тач-устройствах работает нативный скролл --- */
    const dragState = useRef({ active: false, startX: 0, startScroll: 0, moved: false, pointerId: -1 });

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (variant !== "scrollable") return;
        if (event.pointerType === "touch") return; // не мешаем инерционному скроллу
        const el = listRef.current;
        if (!el) return;
        dragState.current = {
            active: true,
            startX: event.clientX,
            startScroll: el.scrollLeft,
            moved: false,
            pointerId: event.pointerId,
        };
        // Захват указателя здесь НЕ берём: с ним pointerup приходит контейнеру,
        // и click достаётся ему же — вкладка переставала переключаться.
        // Захватываем только когда началось именно перетаскивание.
    };

    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const el = listRef.current;
        const state = dragState.current;
        if (!el || !state.active) return;

        const delta = event.clientX - state.startX;

        if (!state.moved && Math.abs(delta) > 6) {
            state.moved = true;
            try {
                el.setPointerCapture(event.pointerId);
            } catch {
                // браузер может отказать — прокрутка всё равно работает
            }
        }

        if (state.moved) el.scrollLeft = state.startScroll - delta;
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        const el = listRef.current;
        const state = dragState.current;
        if (el && state.pointerId >= 0 && el.hasPointerCapture(state.pointerId)) {
            el.releasePointerCapture(state.pointerId);
        }
        state.active = false;
        state.pointerId = -1;
        // сбрасываем флаг после текущего клика, чтобы перетаскивание не «нажимало» вкладку
        window.setTimeout(() => {
            dragState.current.moved = false;
        }, 0);
    };

    const suppressClickAfterDrag = (event: React.MouseEvent) => {
        if (dragState.current.moved) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    /**
     * Клик по вкладке обрабатываем на контейнере, а не на кнопке.
     *
     * Причина: при перетаскивании ленты указатель захватывается контейнером, и
     * click достаётся ему, а не кнопке — вкладка «не нажималась». Поиск ближайшего
     * role="tab" работает и при обычном клике, и после drag (там moved === true,
     * поэтому событие просто игнорируется).
     */
    const onContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (dragState.current.moved) return;

        const target = event.target as HTMLElement | null;
        const tab = target?.closest<HTMLElement>('[role="tab"]');
        if (!tab || tab.hasAttribute("disabled")) return;

        const id = tab.dataset.tabId;
        if (id && id !== value) onChange(id);
    };

    /* --- клавиатура --- */
    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const enabled = items.filter(item => !item.disabled);
        const currentIndex = enabled.findIndex(item => item.id === value);
        if (currentIndex === -1) return;

        let nextIndex: number | null = null;
        if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % enabled.length;
        if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = enabled.length - 1;

        if (nextIndex !== null) {
            event.preventDefault();
            onChange(enabled[nextIndex].id);
        }
    };

    const isScrollable = variant === "scrollable";

    /* Маска по краям: показывает, что лента продолжается. Заменяет стрелки. */
    const maskImage = edges.left || edges.right
        ? `linear-gradient(to right, transparent 0, #000 ${edges.left ? 24 : 0}px, #000 calc(100% - ${edges.right ? 24 : 0}px), transparent 100%)`
        : undefined;

    return (
        <div
            ref={listRef}
            role="tablist"
            aria-label={ariaLabel}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onScroll={isScrollable ? updateEdges : undefined}
            onClickCapture={isScrollable ? suppressClickAfterDrag : undefined}
            onClick={onContainerClick}
            className={cn(
                "flex items-center gap-1",
                isScrollable
                    ? "scroll-row scroll-snap-x w-full cursor-grab select-none px-1 py-1 active:cursor-grabbing"
                    : size === "sm"
                        ? "w-full rounded-control border border-border bg-surface-2 p-0.5"
                        : "w-full rounded-control border border-border bg-surface-2 p-1",
                className,
            )}
            style={{ maskImage, WebkitMaskImage: maskImage }}
        >
            {items.map((item) => {
                const active = item.id === value;
                const Icon = item.icon;

                return (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-controls={`panel-${item.id}`}
                        id={`tab-${item.id}`}
                        data-tab-id={item.id}
                        data-active={active}
                        tabIndex={active ? 0 : -1}
                        disabled={item.disabled}
                        className={cn(
                            "scroll-snap-item relative flex shrink-0 items-center justify-center gap-2",
                            "whitespace-nowrap font-medium transition-colors duration-150",
                            size === "sm" ? "text-xs" : "text-sm",
                            "disabled:cursor-not-allowed disabled:opacity-40",
                            isScrollable
                                ? size === "sm"
                                    ? "h-9 rounded-control px-2.5"
                                    : "h-10 rounded-control px-3"
                                : size === "sm"
                                    ? "h-9 flex-1 rounded-[5px]"
                                    : "h-10 flex-1 rounded-[5px]",
                            !fullWidth && !isScrollable && "flex-none",
                            active
                                ? isScrollable
                                    ? "bg-accent-soft text-accent-text"
                                    : "bg-surface text-fg shadow-card"
                                : "text-fg-muted hover:text-fg",
                        )}
                    >
                        {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
                        <span>{item.label}</span>
                        {typeof item.count === "number" && (
                            <span
                                className={cn(
                                    "ml-0.5 rounded-control px-1 tabular-nums",
                                    size === "sm" ? "text-[10px]" : "text-xs",
                                    active ? "bg-accent/15 text-accent-text" : "bg-surface-3 text-fg-subtle",
                                )}
                            >
                                {item.count}
                            </span>
                        )}
                        {/* Индикатор активной вкладки для scrollable-варианта */}
                        {isScrollable && active && (
                            <span
                                aria-hidden
                                className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-accent"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

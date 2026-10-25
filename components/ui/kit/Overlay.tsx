"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useIsMobile } from "@/lib/useIsMobile";
import { Button, IconButton } from "./Button";

/* ============================================================================
   Оверлеи: Modal (центр) и BottomSheet (низ).

   Почему отдельный компонент, а не «как раньше»:
   • разметка уходит в <body> через portal — фиксированный слой перестаёт зависеть
     от родительских transform/backdrop-filter/overflow-hidden (главная причина,
     почему в PWA тапы попадали «не туда»);
   • фиксированные header (заголовок + закрыть) и footer (действия),
     скроллится только тело;
   • Esc, ловушка фокуса, возврат фокуса на элемент-инициатор, блокировка скролла body;
   • подтверждение закрытия, если есть несохранённые данные.
   ============================================================================ */

const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
].join(",");

interface OverlayProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    footer?: React.ReactNode;
    size?: "sm" | "md" | "lg";
    /** Спрашивать подтверждение при закрытии, если isDirty */
    confirmOnClose?: boolean;
    isDirty?: boolean;
    /** auto — sheet на мобильном, модалка на десктопе;
     *  side — панель справа на десктопе, шторка на мобильном (для длинных форм и списков) */
    variant?: "auto" | "modal" | "sheet" | "side";
    /** Шторка на всю высоту (экран «Ещё»): без скругления и отступа сверху */
    fullScreen?: boolean;
    className?: string;
    children: React.ReactNode;
}

const sizeClasses = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" } as const;

export function Overlay({
    open,
    onClose,
    title,
    description,
    footer,
    size = "md",
    confirmOnClose = false,
    isDirty = false,
    variant = "auto",
    fullScreen = false,
    className,
    children,
}: OverlayProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [mounted, setMounted] = useState(false);
    const isMobile = useIsMobile();

    const asSide = variant === "side" && !isMobile;
    // side на мобильном обязан стать шторкой снизу, а не центрированной модалкой
    const asSheet = !asSide && (variant === "sheet" || variant === "side" || (variant === "auto" && isMobile));

    useEffect(() => setMounted(true), []);

    const requestClose = useCallback(() => {
        if (confirmOnClose && isDirty) {
            setConfirming(true);
            return;
        }
        onClose();
    }, [confirmOnClose, isDirty, onClose]);

    /* блокировка прокрутки страницы + компенсация ширины скроллбара */
    useEffect(() => {
        if (!open) return;

        const { body } = document;
        const previousOverflow = body.style.overflow;
        const previousPadding = body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        body.style.overflow = "hidden";
        if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

        return () => {
            body.style.overflow = previousOverflow;
            body.style.paddingRight = previousPadding;
        };
    }, [open]);

    /* Esc, ловушка фокуса, возврат фокуса */
    useEffect(() => {
        if (!open) return;

        restoreFocusRef.current = document.activeElement as HTMLElement | null;
        setConfirming(false);

        const focusTimer = window.setTimeout(() => {
            const panel = panelRef.current;
            if (!panel) return;
            const first = panel.querySelector<HTMLElement>('[data-autofocus="true"]') ?? panel.querySelector<HTMLElement>(FOCUSABLE);
            (first ?? panel).focus({ preventScroll: true });
        }, 0);

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                requestClose();
                return;
            }

            if (event.key !== "Tab") return;

            const panel = panelRef.current;
            if (!panel) return;
            const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                el => el.offsetParent !== null,
            );
            if (focusables.length === 0) {
                event.preventDefault();
                panel.focus();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || active === panel)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown, true);

        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener("keydown", onKeyDown, true);
            restoreFocusRef.current?.focus?.({ preventScroll: true });
        };
    }, [open, requestClose]);

    if (!mounted || !open) return null;

    const body = (
        <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>

            {confirming && (
                <div className="border-t border-warning/30 bg-warning-soft px-4 py-3">
                    <p className="text-sm text-fg">Закрыть без сохранения? Введённые данные будут потеряны.</p>
                    <div className="mt-2 grid gap-2 sm:flex sm:justify-end">
                        <Button size="sm" variant="danger" className="w-full sm:w-auto" onClick={onClose}>
                            Закрыть
                        </Button>
                        <Button size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setConfirming(false)}>
                            Продолжить
                        </Button>
                    </div>
                </div>
            )}

            {footer && <div className="shrink-0 border-t border-border bg-surface px-4 py-3">{footer}</div>}
        </>
    );

    const header = (
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
                <h2 id="overlay-title" className="truncate text-base font-semibold text-fg">
                    {title}
                </h2>
                {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
            </div>
            <IconButton icon={X} label="Закрыть" variant="ghost" size={40} onClick={requestClose} className="-mr-2" />
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-50 flex" role="presentation">
            {/* Подложка: клик закрывает, но только если нет несохранённых данных —
                решение принимает requestClose */}
            <div
                className="absolute inset-0 bg-backdrop animate-[fadeIn_150ms_ease-out]"
                onClick={requestClose}
                aria-hidden
            />

            {asSide ? (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="overlay-title"
                    tabIndex={-1}
                    className={cn(
                        "relative ml-auto flex h-[100dvh] w-full flex-col overflow-hidden",
                        "border-l border-border bg-surface shadow-overlay",
                        size === "lg" ? "sm:max-w-[720px]" : size === "sm" ? "sm:max-w-[400px]" : "sm:max-w-[460px]",
                        "animate-[slideInRight_200ms_cubic-bezier(.2,.8,.2,1)]",
                        className,
                    )}
                >
                    {header}
                    {body}
                </div>
            ) : asSheet ? (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="overlay-title"
                    tabIndex={-1}
                    className={cn(
                        "relative flex w-full flex-col overflow-hidden bg-surface shadow-overlay",
                        fullScreen
                            ? "h-[100dvh] max-h-[100dvh] rounded-none"
                            : "mt-auto max-h-[92vh] rounded-t-overlay border-t border-border",
                        "animate-[sheetUp_220ms_cubic-bezier(.2,.8,.2,1)]",
                        className,
                    )}
                >
                    {!fullScreen && (
                        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong" aria-hidden />
                    )}
                    {header}
                    {body}
                </div>
            ) : (
                <div className="relative m-auto flex max-h-[88vh] w-full flex-col px-4">
                    <div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="overlay-title"
                        tabIndex={-1}
                        className={cn(
                            "mx-auto flex max-h-[88vh] w-full flex-col overflow-hidden",
                            "rounded-overlay border border-border bg-surface shadow-overlay",
                            "animate-[modalIn_180ms_ease-out]",
                            sizeClasses[size],
                            className,
                        )}
                    >
                        {header}
                        {body}
                    </div>
                </div>
            )}
        </div>,
        document.body,
    );
}

/* --------------------------- Публичные обёртки --------------------------- */

export interface ModalProps extends Omit<OverlayProps, "variant"> {
    /** На мобильном тоже центрировать (по умолчанию — sheet) */
    forceModal?: boolean;
}

export function Modal({ forceModal = false, ...props }: ModalProps) {
    // На десктопе все модалки — правой панелью; на телефоне Overlay сам
    // превращает side в нижнюю шторку.
    return <Overlay {...props} variant={forceModal ? "modal" : "side"} />;
}

export function BottomSheet(props: Omit<OverlayProps, "variant">) {
    return <Overlay {...props} variant="sheet" />;
}

/**
 * Sheet — панель справа на десктопе и шторка снизу на мобильном.
 * Удобнее модалки, когда содержимое длинное (список ролей, форма сотрудника):
 * панель не перекрывает середину экрана и не «прыгает» по центру.
 */
export function Sheet(props: Omit<OverlayProps, "variant">) {
    return <Overlay {...props} variant="side" />;
}

/**
 * ModalFooter — стандартные действия модалки.
 *
 * Один primary-экшен: «Отмена» — ghost, действие — primary/danger.
 * На мобильном кнопки в столбик (главная сверху над отменой), на десктопе — в ряд
 * справа, чтобы привычное расположение сохранялось.
 * Требует `type="button"` внутри формы: отправка не должна срабатывать по Enter дважды.
 */
export interface ModalFooterProps {
    onCancel: () => void;
    submitLabel: string;
    onSubmit: () => void;
    loading?: boolean;
    disabled?: boolean;
    tone?: "primary" | "danger";
    cancelLabel?: string;
}

export function ModalFooter({
    onCancel,
    submitLabel,
    onSubmit,
    loading = false,
    disabled = false,
    tone = "primary",
    cancelLabel = "Отмена",
}: ModalFooterProps) {
    return (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onCancel} disabled={loading}>
                {cancelLabel}
            </Button>
            <Button variant={tone} onClick={onSubmit} loading={loading} disabled={disabled}>
                {submitLabel}
            </Button>
        </div>
    );
}

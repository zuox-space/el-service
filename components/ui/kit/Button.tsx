"use client";

import { forwardRef } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Button — единственный способ сделать кнопку в приложении.
 *
 * Правила, заложенные в компонент:
 *  • на экране один primary-экшен (остальные — secondary/ghost/danger);
 *  • размер по умолчанию md = 48px по высоте — тап-таргет для пальца;
 *  • всегда есть :active и focus-visible, поэтому в PWA нажатие видно;
 *  • загрузка блокирует повторные нажатия и не «прыгает» по ширине.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    fullWidth?: boolean;
    leftIcon?: LucideIcon;
    rightIcon?: LucideIcon;
}

const base =
    "relative inline-flex items-center justify-center gap-2 font-medium select-none " +
    "transition-colors duration-150 ease-out " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "active:scale-[0.99] rounded-control whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
    // primary: зелёная заливка (градиент из --gradient-accent), белый текст, без свечения
    primary:
        "surface-accent bg-accent-solid text-accent-fg hover:bg-accent-solid-hover active:bg-accent-solid-hover",
    secondary:
        "bg-surface-2 text-fg border border-border shadow-card hover:bg-surface-3 hover:border-border-strong active:bg-surface-3",
    ghost:
        "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg active:bg-surface-3",
    danger:
        "bg-surface-2 text-danger border border-danger/40 shadow-card hover:bg-danger-soft active:bg-danger-soft",
};

/* sm — только для плотных десктопных панелей; на мобильных используйте md/lg */
const sizes: Record<ButtonSize, string> = {
    sm: "h-10 px-3 text-sm",
    md: "h-12 px-4 text-sm",
    lg: "h-14 px-5 text-base",
};

const iconSizes: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant = "primary",
        size = "md",
        loading = false,
        fullWidth = false,
        leftIcon: LeftIcon,
        rightIcon: RightIcon,
        className,
        children,
        disabled,
        type = "button",
        ...rest
    },
    ref,
) {
    const iconSize = iconSizes[size];

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
            {...rest}
        >
            {loading ? (
                <Loader2 size={iconSize} className="animate-spin" aria-hidden />
            ) : (
                LeftIcon && <LeftIcon size={iconSize} aria-hidden />
            )}
            <span className={cn(loading && "opacity-0 absolute inset-0")}>{children}</span>
            {RightIcon && !loading && <RightIcon size={iconSize} aria-hidden />}
        </button>
    );
});

/**
 * IconButton — кнопка только с иконкой.
 * `label` обязателен: он уходит в aria-label и title, поэтому «немых» кнопок нет.
 */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    icon: LucideIcon;
    label: string;
    variant?: ButtonVariant;
    /** 40 — только десктоп; 48 — значение по умолчанию для пальца */
    size?: 40 | 48;
    loading?: boolean;
    /** Показывать всплывающую подсказку при наведении (десктоп) */
    withTooltip?: boolean;
}

const iconVariants: Record<ButtonVariant, string> = {
    primary: "bg-accent-solid text-accent-fg hover:bg-accent-solid-hover",
    secondary:
        "bg-surface-2 text-fg border border-border hover:bg-surface-3 hover:border-border-strong",
    ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
    danger: "bg-transparent text-danger hover:bg-danger-soft",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    {
        icon: Icon,
        label,
        variant = "ghost",
        size = 48,
        loading = false,
        withTooltip = false,
        className,
        disabled,
        type = "button",
        ...rest
    },
    ref,
) {
    const dimension = size === 48 ? "h-12 w-12" : "h-10 w-10";

    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-label={label}
            title={withTooltip ? label : undefined}
            aria-busy={loading || undefined}
            className={cn(
                "group relative inline-flex items-center justify-center rounded-control",
                "transition-colors duration-150 ease-out active:scale-[0.98]",
                "disabled:pointer-events-none disabled:opacity-50",
                dimension,
                iconVariants[variant],
                className,
            )}
            {...rest}
        >
            {loading ? (
                <Loader2 size={20} className="animate-spin" aria-hidden />
            ) : (
                <Icon size={20} strokeWidth={1.75} aria-hidden />
            )}
        </button>
    );
});

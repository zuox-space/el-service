"use client";

import { forwardRef, useId, useState } from "react";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ============================================================================
   Поля ввода.
   Общие правила для всех контролов:
   • высота 48px — тап-таргет;
   • шрифт 16px — iOS не зумит страницу при фокусе (font-size < 16px — причина);
   • видимый focus-visible из базового слоя, ошибка — через aria-invalid + текст;
   • label всегда связан с контролом через id.
   ============================================================================ */

interface FieldShellProps {
    id: string;
    label?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
    labelAddon?: React.ReactNode;
}

function FieldShell({ id, label, hint, error, required, children, className, labelAddon }: FieldShellProps) {
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

    return (
        <div className={cn("flex w-full flex-col gap-1.5", className)} data-describedby={describedBy}>
            {(label || labelAddon) && (
                <div className="flex items-center justify-between gap-2">
                    {label && (
                        <label htmlFor={id} className="text-sm font-medium text-fg">
                            {label}
                            {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
                        </label>
                    )}
                    {labelAddon}
                </div>
            )}
            {children}
            {error ? (
                <p id={`${id}-error`} className="text-xs text-danger" role="alert">
                    {error}
                </p>
            ) : hint ? (
                <p id={`${id}-hint`} className="text-xs text-fg-subtle">
                    {hint}
                </p>
            ) : null}
        </div>
    );
}

const controlBase =
    "w-full rounded-control border bg-surface-2 text-base text-fg placeholder:text-fg-subtle " +
    "transition-colors duration-150 outline-none " +
    // Кольцо фокуса задаётся в globals.css (зелёное, из токена): утилита ring
    // брала цвет по умолчанию из currentColor и в тёмной теме давала белую обводку
    "hover:border-border-strong focus:border-accent " +
    "disabled:cursor-not-allowed disabled:opacity-50";

/* ------------------------------- Input ---------------------------------- */

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
    label?: string;
    hint?: string;
    error?: string;
    leftIcon?: LucideIcon;
    /** Кнопка/иконка справа (например, показать пароль) */
    rightSlot?: React.ReactNode;
    clearable?: boolean;
    onClear?: () => void;
    wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
    {
        label,
        hint,
        error,
        leftIcon: LeftIcon,
        rightSlot,
        clearable = false,
        onClear,
        wrapperClassName,
        className,
        id,
        required,
        value,
        ...rest
    },
    ref,
) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
        <FieldShell
            id={inputId}
            label={label}
            hint={hint}
            error={error}
            required={required}
            className={wrapperClassName}
        >
            <div className="relative">
                {LeftIcon && (
                    <LeftIcon
                        size={18}
                        strokeWidth={1.75}
                        aria-hidden
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
                    />
                )}

                <input
                    ref={ref}
                    id={inputId}
                    value={value}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className={cn(
                        controlBase,
                        "h-12 px-3",
                        LeftIcon && "pl-10",
                        Boolean(rightSlot || (clearable && hasValue)) && "pr-11",
                        error && "border-danger focus:border-danger focus:ring-danger/25",
                        className,
                    )}
                    {...rest}
                />

                {clearable && hasValue ? (
                    <button
                        type="button"
                        aria-label="Очистить поле"
                        onClick={onClear}
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-fg-subtle hover:bg-surface-3 hover:text-fg"
                    >
                        <X size={16} aria-hidden />
                    </button>
                ) : rightSlot ? (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{rightSlot}</div>
                ) : null}
            </div>
        </FieldShell>
    );
});

/* ------------------------------- Select --------------------------------- */

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
    label?: string;
    hint?: string;
    error?: string;
    options: SelectOption[];
    placeholder?: string;
    onChange?: (value: string) => void;
    wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { label, hint, error, options, placeholder, onChange, wrapperClassName, className, id, required, value, ...rest },
    ref,
) {
    const autoId = useId();
    const selectId = id ?? autoId;
    const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

    return (
        <FieldShell
            id={selectId}
            label={label}
            hint={hint}
            error={error}
            required={required}
            className={wrapperClassName}
        >
            <div className="relative">
                <select
                    ref={ref}
                    id={selectId}
                    value={value}
                    required={required}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    onChange={(e) => onChange?.(e.target.value)}
                    className={cn(
                        controlBase,
                        "h-12 cursor-pointer appearance-none pl-3 pr-10",
                        error && "border-danger focus:border-danger focus:ring-danger/25",
                        className,
                    )}
                    {...rest}
                >
                    {placeholder && <option value="">{placeholder}</option>}
                    {options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
                />
            </div>
        </FieldShell>
    );
});

/* ------------------------------ Checkbox -------------------------------- */

export interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    error?: string;
    className?: string;
    /**
     * Компактный вид: только чекбокс без подписи — для плотных строк списков,
     * где подпись дублирует соседний текст (доступность сохраняется через label).
     */
    compact?: boolean;
}

export function Checkbox({
    checked,
    onChange,
    label,
    description,
    disabled,
    error,
    className,
    compact = false,
}: CheckboxProps) {
    const id = useId();

    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <label
                htmlFor={id}
                className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-control",
                    compact ? "min-h-0 gap-0 px-0 py-0" : "min-h-12 px-1 py-2 hover:bg-surface-2",
                    disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
            >
                <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => onChange(e.target.checked)}
                        aria-invalid={error ? true : undefined}
                        className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                    <span
                        aria-hidden
                        className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors",
                            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                            checked
                                ? "border-accent-solid bg-accent-solid text-accent-fg"
                                : "border-border-strong bg-surface-2",
                            error && !checked && "border-danger",
                        )}
                    >
                        {checked && <Check size={14} strokeWidth={3} />}
                    </span>
                </span>

                <span className={compact ? "sr-only" : "flex min-w-0 flex-col"}>
                    <span className="text-sm text-fg">{label}</span>
                    {description && <span className="text-xs text-fg-subtle">{description}</span>}
                </span>
            </label>
            {error && (
                <p className="pl-9 text-xs text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

/* ------------------------------- Radio ---------------------------------- */

export interface RadioOption {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
}

export interface RadioGroupProps {
    name?: string;
    value: string;
    onChange: (value: string) => void;
    options: RadioOption[];
    label?: string;
    /** vertical — по умолчанию (удобно для пальца), horizontal — для плотных панелей */
    orientation?: "vertical" | "horizontal";
    error?: string;
    className?: string;
}

export function RadioGroup({
    name,
    value,
    onChange,
    options,
    label,
    orientation = "vertical",
    error,
    className,
}: RadioGroupProps) {
    const groupId = useId();
    const groupName = name ?? groupId;

    return (
        <fieldset className={cn("flex flex-col gap-1.5", className)} aria-invalid={error ? true : undefined}>
            {label && <legend className="mb-1 text-sm font-medium text-fg">{label}</legend>}
            <div className={cn("flex gap-1", orientation === "vertical" ? "flex-col" : "flex-wrap gap-4")}>
                {options.map((option) => {
                    const optionId = `${groupName}-${option.value}`;
                    const selected = value === option.value;

                    return (
                        <label
                            key={option.value}
                            htmlFor={optionId}
                            className={cn(
                                "flex min-h-12 cursor-pointer items-start gap-3 rounded-control px-1 py-2 hover:bg-surface-2",
                                option.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                            )}
                        >
                            <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                                <input
                                    id={optionId}
                                    type="radio"
                                    name={groupName}
                                    value={option.value}
                                    checked={selected}
                                    disabled={option.disabled}
                                    onChange={() => onChange(option.value)}
                                    className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                />
                                <span
                                    aria-hidden
                                    className={cn(
                                        "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                                        "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                                        selected ? "border-accent-solid bg-surface" : "border-border-strong bg-surface-2",
                                    )}
                                >
                                    {selected && <span className="h-2.5 w-2.5 rounded-full bg-accent-solid" />}
                                </span>
                            </span>
                            <span className="flex min-w-0 flex-col">
                                <span className="text-sm text-fg">{option.label}</span>
                                {option.description && (
                                    <span className="text-xs text-fg-subtle">{option.description}</span>
                                )}
                            </span>
                        </label>
                    );
                })}
            </div>
            {error && (
                <p className="text-xs text-danger" role="alert">
                    {error}
                </p>
            )}
        </fieldset>
    );
}

/* ------------------------------- Switch --------------------------------- */

export interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    disabled?: boolean;
    className?: string;
}

export function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
    const id = useId();

    return (
        <div className={cn("flex items-center justify-between gap-4", className)}>
            <label htmlFor={id} className={cn("min-w-0 cursor-pointer", disabled && "cursor-not-allowed opacity-50")}>
                <span className="block text-sm text-fg">{label}</span>
                {description && <span className="block text-xs text-fg-subtle">{description}</span>}
            </label>

            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={cn(
                    "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-150",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    checked ? "border-accent-solid bg-accent-solid" : "border-border-strong bg-surface-3",
                )}
            >
                <span
                    aria-hidden
                    className={cn(
                        "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-accent-fg shadow-sm transition-all duration-150",
                        checked ? "left-6" : "left-1",
                    )}
                />
            </button>
        </div>
    );
}

/* ------------------------------- Textarea -------------------------------- */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    hint?: string;
    error?: string;
    wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
    { label, hint, error, wrapperClassName, className, id, required, rows = 3, ...rest },
    ref,
) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

    return (
        <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
            <textarea
                ref={ref}
                id={fieldId}
                rows={rows}
                required={required}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className={cn(
                    controlBase,
                    "min-h-24 resize-y px-3 py-2.5 leading-relaxed",
                    error && "border-danger focus:border-danger focus:ring-danger/25",
                    className,
                )}
                {...rest}
            />
        </FieldShell>
    );
});

/* --------------------------- Поиск с очисткой ---------------------------- */

/** SearchInput — частный случай Input: иконка поиска и кнопка очистки. */
export function SearchInput({
    value,
    onChange,
    placeholder = "Поиск",
    label,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
}) {
    const [inputId] = useState(() => `search-${Math.random().toString(36).slice(2, 8)}`);

    return (
        <FieldShell id={inputId} label={label} className={className}>
            <div className="relative">
                <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-fg-subtle"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                </svg>
                <input
                    id={inputId}
                    type="search"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn(controlBase, "h-12 pl-10 pr-11", className)}
                />
                {value && (
                    <button
                        type="button"
                        aria-label="Очистить поиск"
                        onClick={() => onChange("")}
                        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-fg-subtle hover:bg-surface-3 hover:text-fg"
                    >
                        <X size={16} aria-hidden />
                    </button>
                )}
            </div>
        </FieldShell>
    );
}

/* ----------------------------- Ошибка формы ------------------------------ */

/**
 * FormError — ошибка отправки формы внутри модалки.
 *
 * Отдельный компонент вместо alert: текст остаётся на экране рядом с кнопкой,
 * его можно прочитать и исправить причину, не теряя введённые данные.
 */
export function FormError({ message }: { message?: string | null }) {
    if (!message) return null;

    return (
        <div
            role="alert"
            className="flex items-start gap-2 rounded-control border border-danger/40 bg-danger-soft px-3 py-2"
        >
            <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-danger" />
            <p className="text-sm text-fg">{message}</p>
        </div>
    );
}

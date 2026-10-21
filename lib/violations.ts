// lib/violations.ts
//
// Справочник типов нарушений.
//
// Иконки — Lucide (20px, strokeWidth 1.75), а не эмодзи: эмодзи выглядят по-разному
// на iOS/Android/Windows, не масштабируются с текстом и ломают единый стиль.
import {
    AlertTriangle,
    Ban,
    Cigarette,
    Clock,
    FileText,
    Hammer,
    Shirt,
    Smartphone,
    type LucideIcon,
} from "lucide-react";

export interface ViolationType {
    id: string;
    label: string;
    shortLabel: string;
    /** Иконка типа нарушения */
    Icon: LucideIcon;
    /** Цвет иконки — семантический статус */
    color: string;
    /** Мягкая подложка под иконку */
    bgColor: string;
    /** Цвет для диаграмм (CSS-переменная темы) */
    chartColor: string;
}

export const VIOLATION_TYPES: ViolationType[] = [
    {
        id: "uniform",
        label: "Нарушение формы одежды",
        shortLabel: "Форма",
        Icon: Shirt,
        color: "text-warning",
        bgColor: "bg-warning-soft",
        chartColor: "var(--color-chart-2)",
    },
    {
        id: "late",
        label: "Опоздание",
        shortLabel: "Опоздание",
        Icon: Clock,
        color: "text-warning",
        bgColor: "bg-warning-soft",
        chartColor: "var(--color-chart-1)",
    },
    {
        id: "property",
        label: "Порча имущества",
        shortLabel: "Имущество",
        Icon: Hammer,
        color: "text-danger",
        bgColor: "bg-danger-soft",
        chartColor: "var(--color-chart-7)",
    },
    {
        id: "phone",
        label: "Использование телефона",
        shortLabel: "Телефон",
        Icon: Smartphone,
        color: "text-info",
        bgColor: "bg-info-soft",
        chartColor: "var(--color-chart-6)",
    },
    {
        id: "behavior",
        label: "Нарушение поведения",
        shortLabel: "Поведение",
        Icon: AlertTriangle,
        color: "text-warning",
        bgColor: "bg-warning-soft",
        chartColor: "var(--color-chart-5)",
    },
    {
        id: "disrespect",
        label: "Неуважение к персоналу",
        shortLabel: "Неуважение",
        Icon: Ban,
        color: "text-danger",
        bgColor: "bg-danger-soft",
        chartColor: "var(--color-chart-8)",
    },
    {
        id: "smoking",
        label: "Курение",
        shortLabel: "Курение",
        Icon: Cigarette,
        color: "text-fg-muted",
        bgColor: "bg-surface-2",
        chartColor: "var(--color-chart-3)",
    },
    {
        id: "other",
        label: "Другое нарушение",
        shortLabel: "Другое",
        Icon: FileText,
        color: "text-fg-muted",
        bgColor: "bg-surface-2",
        chartColor: "var(--color-chart-4)",
    },
];

export function getViolationType(typeId: string): ViolationType {
    return VIOLATION_TYPES.find(t => t.id === typeId) || VIOLATION_TYPES[VIOLATION_TYPES.length - 1];
}

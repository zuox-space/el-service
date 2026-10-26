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
    /** Формулировка для сообщения родителю — в именительном падеже */
    parentLabel: string;
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
        parentLabel: "несоблюдение школьной формы",
        Icon: Shirt,
        color: "text-warning",
        bgColor: "bg-warning-soft",
        chartColor: "var(--color-chart-2)",
    },
    {
        id: "late",
        label: "Опоздание",
        shortLabel: "Опоздание",
        parentLabel: "опоздание",
        Icon: Clock,
        color: "text-warning",
        bgColor: "bg-warning-soft",
        chartColor: "var(--color-chart-1)",
    },
    {
        id: "property",
        label: "Порча имущества",
        shortLabel: "Имущество",
        parentLabel: "порча имущества",
        Icon: Hammer,
        color: "text-danger",
        bgColor: "bg-danger-soft",
        chartColor: "var(--color-chart-7)",
    },
    {
        id: "phone",
        label: "Использование телефона",
        shortLabel: "Телефон",
        parentLabel: "использование телефона",
        Icon: Smartphone,
        color: "text-info",
        bgColor: "bg-info-soft",
        chartColor: "var(--color-chart-6)",
    },
    {
        id: "behavior",
        label: "Нарушение поведения",
        shortLabel: "Поведение",
        parentLabel: "нарушение поведения",
        Icon: AlertTriangle,
        color: "text-warning",
        bgColor: "bg-warning-soft",
        chartColor: "var(--color-chart-5)",
    },
    {
        id: "disrespect",
        label: "Неуважение к персоналу",
        shortLabel: "Неуважение",
        parentLabel: "неуважение к персоналу",
        Icon: Ban,
        color: "text-danger",
        bgColor: "bg-danger-soft",
        chartColor: "var(--color-chart-8)",
    },
    {
        id: "smoking",
        label: "Курение",
        shortLabel: "Курение",
        parentLabel: "курение",
        Icon: Cigarette,
        color: "text-fg-muted",
        bgColor: "bg-surface-2",
        chartColor: "var(--color-chart-3)",
    },
    {
        id: "other",
        label: "Другое нарушение",
        shortLabel: "Другое",
        parentLabel: "иное нарушение",
        Icon: FileText,
        color: "text-fg-muted",
        bgColor: "bg-surface-2",
        chartColor: "var(--color-chart-4)",
    },
];

export function getViolationType(typeId: string): ViolationType {
    return VIOLATION_TYPES.find(t => t.id === typeId) || VIOLATION_TYPES[VIOLATION_TYPES.length - 1];
}

/**
 * Подпись того, кто отметил отработку.
 *
 * Если нарушение закрыл классный руководитель со своего экрана, это важно
 * видеть и в админке, и в истории сотрудника — поэтому добавляем уточнение.
 */
export function resolverLabel(
    name: string | null | undefined,
    source?: string | null,
): string {
    if (!name) return "Администратор";

    return source === "CLASS_TEACHER" ? `${name} · классный руководитель` : name;
}
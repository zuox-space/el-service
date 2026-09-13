// lib/violations.ts
export interface ViolationType {
    id: string;
    label: string;
    shortLabel: string;
    icon: string;
    color: string;
    bgColor: string;
}

export const VIOLATION_TYPES: ViolationType[] = [
    {
        id: "uniform",
        label: "Нарушение формы одежды",
        shortLabel: "Форма",
        icon: "👔",
        color: "text-amber-400",
        bgColor: "bg-amber-500/20"
    },
    {
        id: "late",
        label: "Опоздание",
        shortLabel: "Опоздание",
        icon: "⏰",
        color: "text-orange-400",
        bgColor: "bg-orange-500/20"
    },
    {
        id: "property",
        label: "Порча имущества",
        shortLabel: "Имущество",
        icon: "🔨",
        color: "text-red-400",
        bgColor: "bg-red-500/20"
    },
    {
        id: "phone",
        label: "Использование телефона",
        shortLabel: "Телефон",
        icon: "📱",
        color: "text-blue-400",
        bgColor: "bg-blue-500/20"
    },
    {
        id: "behavior",
        label: "Нарушение поведения",
        shortLabel: "Поведение",
        icon: "⚠️",
        color: "text-yellow-400",
        bgColor: "bg-yellow-500/20"
    },
    {
        id: "disrespect",
        label: "Неуважение к персоналу",
        shortLabel: "Неуважение",
        icon: "🚫",
        color: "text-rose-400",
        bgColor: "bg-rose-500/20"
    },
    {
        id: "smoking",
        label: "Курение",
        shortLabel: "Курение",
        icon: "🚭",
        color: "text-gray-400",
        bgColor: "bg-gray-500/20"
    },
    {
        id: "other",
        label: "Другое нарушение",
        shortLabel: "Другое",
        icon: "📋",
        color: "text-slate-400",
        bgColor: "bg-slate-500/20"
    },
];

export function getViolationType(typeId: string): ViolationType {
    return VIOLATION_TYPES.find(t => t.id === typeId) || VIOLATION_TYPES[VIOLATION_TYPES.length - 1];
}
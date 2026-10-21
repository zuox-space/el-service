"use client";

// components/ui/charts.tsx
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Диаграммы без внешних библиотек: SVG и flex-разметка на токенах темы.
 *
 * Решение сознательное — приложение ставится в школе, лишний мегабайт
 * графической библиотеки не нужен. Все цвета приходят снаружи строками
 * вида `var(--color-chart-1)`, поэтому тема меняет их автоматически.
 */

export interface ChartSlice {
    label: string;
    value: number;
    color: string;
}

/** Кольцевая диаграмма с итогом в центре. */
export function DonutChart({
    data,
    centerLabel = "всего",
    size = 176,
    thickness = 18,
    activeIndex,
    onSelect,
}: {
    data: ChartSlice[];
    centerLabel?: string;
    size?: number;
    thickness?: number;
    activeIndex?: number | null;
    onSelect?: (index: number | null) => void;
}) {
    const [hovered, setHovered] = useState<number | null>(null);
    const active = activeIndex ?? hovered;

    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;

    let offset = 0;
    const segments = data.map(slice => {
        const length = (slice.value / total) * circumference;
        const segment = { ...slice, length, offset };
        offset += length;
        return segment;
    });

    const centerValue = activeIndex != null && data[activeIndex] ? data[activeIndex].value : total;
    const centerCaption = activeIndex != null && data[activeIndex] ? data[activeIndex].label : centerLabel;

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Распределение по причинам">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--color-surface-2)"
                    strokeWidth={thickness}
                />
                {segments.map((segment, index) => (
                    <circle
                        key={segment.label}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={segment.color}
                        strokeWidth={active === index ? thickness + 4 : thickness}
                        strokeDasharray={`${Math.max(segment.length - 2, 0.5)} ${circumference}`}
                        strokeDashoffset={-segment.offset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{
                            opacity: active === null || active === index ? 1 : 0.35,
                            transition: "opacity 120ms ease, stroke-width 120ms ease",
                            cursor: onSelect ? "pointer" : "default",
                        }}
                        onMouseEnter={() => setHovered(index)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => onSelect?.(activeIndex === index ? null : index)}
                    >
                        <title>{`${segment.label}: ${segment.value}`}</title>
                    </circle>
                ))}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums text-fg">{centerValue}</span>
                <span className="max-w-[70%] truncate text-center text-[11px] text-fg-subtle">{centerCaption}</span>
            </div>
        </div>
    );
}

/** Горизонтальные полосы: классы, учителя, причины. */
export function BarList({
    data,
    activeLabel,
    onSelect,
    emptyText = "Нет данных",
}: {
    data: ChartSlice[];
    activeLabel?: string | null;
    onSelect?: (label: string | null) => void;
    emptyText?: string;
}) {
    if (data.length === 0) {
        return <p className="text-sm text-fg-muted">{emptyText}</p>;
    }

    const max = Math.max(...data.map(item => item.value), 1);

    return (
        <ul role="list" className="space-y-2">
            {data.map(item => {
                const width = Math.max((item.value / max) * 100, 2);
                const dimmed = Boolean(activeLabel) && activeLabel !== item.label;

                return (
                    <li key={item.label} className={cn("transition-opacity", dimmed && "opacity-45")}>
                        <button
                            type="button"
                            onClick={() => onSelect?.(activeLabel === item.label ? null : item.label)}
                            className="w-full text-left"
                            aria-pressed={activeLabel === item.label}
                        >
                            <div className="mb-1 flex items-baseline justify-between gap-2">
                                <span className="truncate text-xs text-fg">{item.label}</span>
                                <span className="shrink-0 text-xs font-medium tabular-nums text-fg-muted">
                                    {item.value}
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full border border-dashed border-border bg-surface-2">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${width}%`, backgroundColor: item.color }}
                                />
                            </div>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

/** Вертикальные столбики: динамика по месяцам. */
export function TrendBars({
    data,
    color = "var(--color-chart-1)",
    height = 132,
}: {
    data: Array<{ label: string; value: number }>;
    color?: string;
    height?: number;
}) {
    if (data.length === 0) {
        return <p className="text-sm text-fg-muted">Нет данных за период</p>;
    }

    const max = Math.max(...data.map(item => item.value), 1);

    return (
        <div className="flex items-end gap-1.5" style={{ height }}>
            {data.map(item => {
                const barHeight = Math.max((item.value / max) * (height - 26), 2);

                return (
                    <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                        <span className="text-[10px] tabular-nums text-fg-subtle">{item.value || ""}</span>
                        <div
                            className="w-full rounded-t-[3px] border border-dashed border-border/70"
                            style={{ height: barHeight, backgroundColor: color, opacity: item.value === 0 ? 0.25 : 0.9 }}
                            title={`${item.label}: ${item.value}`}
                        />
                        <span className="w-full truncate text-center text-[10px] text-fg-subtle">{item.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

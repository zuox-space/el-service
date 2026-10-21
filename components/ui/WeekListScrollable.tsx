"use client";

import { useEffect, useRef, useState } from "react";

/**
 * WeekListScrollable — компактная лента дней.
 *
 * Без строки «Сегодня» и без подписи месяца: выбор даты — это просто полоса дней,
 * которая сама прокручивается к выбранному дню. Чем меньше декораций, тем больше
 * места под содержимое на телефоне.
 */
interface WeekListScrollableProps {
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
}

/** Форматирование даты в YYYY-MM-DD без UTC. */
function formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function WeekListScrollable({ selectedDate, setSelectedDate }: WeekListScrollableProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Окно дней фиксируем относительно сегодняшней даты: выбор дня прокручивает
    // ленту к нему, но не сдвигает весь список (иначе дни «прыгали» после клика).
    const [baseDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    });

    const todayStr = formatDateLocal(new Date());
    const selectedStr = selectedDate ? formatDateLocal(selectedDate) : "";

    // 35 дней вокруг сегодняшнего дня: назад 14, вперёд 20
    const days = Array.from({ length: 35 }, (_, index) => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() - 14 + index);
        const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const value = formatDateLocal(normalized);

        return {
            date: normalized,
            dayName: normalized.toLocaleDateString("ru-RU", { weekday: "short" }),
            dayNumber: normalized.getDate(),
            isToday: value === todayStr,
            isSelected: value === selectedStr,
        };
    });

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !selectedDate) return;

        const index = days.findIndex(day => formatDateLocal(day.date) === formatDateLocal(selectedDate));
        const element = index >= 0 ? (container.children[index] as HTMLElement | undefined) : undefined;

        element?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);

    return (
        <div ref={scrollContainerRef} className="scroll-row flex gap-1 pb-1">
            {days.map(day => (
                <button
                    key={formatDateLocal(day.date)}
                    type="button"
                    onClick={() => setSelectedDate(new Date(day.date))}
                    aria-pressed={day.isSelected}
                    aria-label={day.date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                    className={`flex h-11 min-w-[40px] shrink-0 flex-col items-center justify-center rounded-control border px-1 transition-colors ${
                        day.isSelected
                            ? "border-transparent bg-accent-solid text-accent-fg"
                            : day.isToday
                                ? "border-success/50 bg-success-soft text-success"
                                : "border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg"
                    }`}
                >
                    <span className={`text-[9px] font-medium uppercase ${day.isSelected ? "text-accent-fg" : "text-fg-subtle"}`}>
                        {day.dayName}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${day.isSelected ? "text-accent-fg" : "text-fg"}`}>
                        {day.dayNumber}
                    </span>
                </button>
            ))}
        </div>
    );
}

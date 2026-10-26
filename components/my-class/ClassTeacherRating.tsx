"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, ChevronDown, ClipboardCheck, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/kit";

interface RatingData {
    attendance: { marked: number; total: number; percent: number };
    violations: { resolved: number; total: number; percent: number };
}

/**
 * Рейтинг классного руководителя.
 *
 * Показывается над выбором класса и только для своих классов. Посещаемость
 * считается по парам «класс + учебный день», поэтому при двух классах
 * знаменатель автоматически удваивается и один класс не «вытягивает»
 * статистику за счёт другого.
 */
export function ClassTeacherRating() {
    const [rating, setRating] = useState<RatingData | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        fetch("/api/portal", { cache: "no-store" })
            .then(response => (response.ok ? response.json() : null))
            .then(data => {
                if (!cancelled) setRating(data?.rating ?? null);
            })
            .catch(() => {
                if (!cancelled) setRating(null);
            })
            .finally(() => {
                if (!cancelled) setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (!loaded || !rating) return null;

    const average = Math.round((rating.attendance.percent + rating.violations.percent) / 2);
    const marker = Math.min(100, Math.max(0, average));
    const markerLabel = Math.min(92, Math.max(8, marker));

    return (
        <details className="group rounded-card border border-border bg-surface p-3 shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-fg">
                    <Gauge size={16} className="shrink-0 text-accent-text" aria-hidden />
                    <span className="truncate">Рейтинг классного руководителя</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">текущий месяц</Badge>
                    <ChevronDown
                        size={16}
                        className="text-fg-muted transition-transform group-open:rotate-180"
                        aria-hidden
                    />
                </span>
            </summary>

            <div className="mt-3 divide-y divide-border rounded-control border border-border bg-surface-2/60">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                        <CalendarCheck size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-fg">Отметки присутствия</p>
                        <p className="text-[10px] text-fg-subtle">
                            {rating.attendance.total > 0
                                ? `${rating.attendance.marked} из ${rating.attendance.total} учебных дней`
                                : "Нет учебных дней"}
                        </p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold tabular-nums text-fg">
                        {rating.attendance.percent}%
                    </span>
                </div>

                <div className="flex items-center gap-2.5 px-2.5 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <ClipboardCheck size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-fg">Отработка нарушений</p>
                        <p className="text-[10px] text-fg-subtle">
                            {rating.violations.total > 0
                                ? `${rating.violations.resolved} из ${rating.violations.total} нарушений`
                                : "Нарушений нет"}
                        </p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold tabular-nums text-fg">
                        {rating.violations.percent}%
                    </span>
                </div>
            </div>

            <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-fg-muted">Средний показатель</p>
                    <p className="text-sm font-semibold tabular-nums text-fg">{average}%</p>
                </div>

                <div className="relative mt-1.5 h-7">
                    <span
                        className="absolute top-0 -translate-x-1/2 rounded-full bg-fg px-1.5 py-0.5 text-[9px] font-semibold leading-none text-bg"
                        style={{ left: `${markerLabel}%` }}
                    >
                        Вы
                    </span>
                    <span
                        className="absolute bottom-0 h-2.5 w-px -translate-x-1/2 bg-fg"
                        style={{ left: `${marker}%` }}
                        aria-hidden
                    />
                </div>

                <div
                    className="relative h-2 rounded-full"
                    style={{
                        background:
                            "linear-gradient(90deg, var(--color-danger) 0%, var(--color-danger) 70%, var(--color-warning) 85%, var(--color-success) 100%)",
                    }}
                    aria-hidden
                >
                    <span
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-fg shadow-card"
                        style={{ left: `${marker}%` }}
                    />
                </div>

                <div className="relative mt-1 h-3 text-[9px] text-fg-subtle">
                    <span className="absolute left-0">0%</span>
                    <span className="absolute -translate-x-1/2" style={{ left: "70%" }}>
                        70%
                    </span>
                    <span className="absolute right-0">100%</span>
                </div>
            </div>
        </details>
    );
}

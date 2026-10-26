"use client";

// components/my-class/MyClassStats.tsx
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, ChevronRight, CheckCircle2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, FormError, Skeleton } from "@/components/ui/kit";
import {
    addMonths,
    formatDateShortRu,
    getAcademicYearStart,
    toLocalISODate,
} from "@/lib/date";

interface Stats {
    summary: {
        markedDays: number;
        schoolDays: number;
        attendancePercent: number;
        absentCount: number;
        violationsTotal: number;
        violationsResolved: number;
        violationsUnresolved: number;
        resolutionPercent: number;
    };
    attendance: {
        daily: Array<{
            date: string;
            absent: number;
            marked: boolean;
        }>;
    };
    violations: {
        byMonth: Array<{
            month: string;
            count: number;
            resolved: number;
            unresolved: number;
        }>;
    };
}

type Period = "year" | "month" | "week";

const PERIODS: Array<{ id: Period; label: string }> = [
    { id: "year", label: "Учебный год" },
    { id: "month", label: "Месяц" },
    { id: "week", label: "7 дней" },
];

function rangeFor(period: Period): { from: string; to: string } {
    const today = new Date();
    const to = toLocalISODate(today);
    if (period === "year") return { from: toLocalISODate(getAcademicYearStart(today)), to };
    if (period === "month") return { from: toLocalISODate(addMonths(today, -1)), to };
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    return { from: toLocalISODate(weekStart), to };
}

function monthLabel(value: string): string {
    const [year, month] = value.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("ru-RU", { month: "short" });
}

export function MyClassStats({
    classId,
    className,
}: {
    classId: string;
    className: string;
}) {
    const [period, setPeriod] = useState<Period>("month");
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const range = useMemo(() => rangeFor(period), [period]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        fetch(`/api/admin/classes/${encodeURIComponent(classId)}/stats?from=${range.from}&to=${range.to}`, {
            cache: "no-store",
        })
            .then(async response => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || "Не удалось загрузить статистику");
                if (!cancelled) setStats(data as Stats);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setStats(null);
                    setError(e instanceof Error ? e.message : "Не удалось загрузить статистику");
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [classId, range.from, range.to]);

    if (loading && !stats) {
        return (
            <div className="space-y-3">
                <Skeleton height={52} radius="card" />
                <Skeleton height={210} radius="card" />
                <Skeleton height={210} radius="card" />
            </div>
        );
    }

    if (error || !stats) {
        return <FormError message={error || "Статистика недоступна"} />;
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
                {PERIODS.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setPeriod(item.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            period === item.id
                                ? "border-accent bg-accent-solid text-accent-fg"
                                : "border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
                <span className="ml-auto text-[11px] text-fg-subtle">
                    {formatDateShortRu(range.from)} — {formatDateShortRu(range.to)}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-card border border-border bg-surface px-3 py-2">
                    <p className="flex items-center gap-1 text-[11px] text-fg-subtle">
                        <CalendarCheck size={13} aria-hidden /> Посещаемость
                    </p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-fg">
                        {stats.summary.attendancePercent}%
                    </p>
                    <p className="text-[10px] text-fg-subtle">
                        {stats.summary.markedDays} из {stats.summary.schoolDays} дней
                    </p>
                </div>
                <div className="rounded-card border border-border bg-surface px-3 py-2">
                    <p className="flex items-center gap-1 text-[11px] text-fg-subtle">
                        <AlertTriangle size={13} aria-hidden /> Нарушения
                    </p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-fg">
                        {stats.summary.violationsTotal}
                    </p>
                    <p className="text-[10px] text-fg-subtle">
                        отработано {stats.summary.violationsResolved} · в работе {stats.summary.violationsUnresolved}
                    </p>
                </div>
            </div>

            <Card padding="sm" title="Посещаемость" description={`Класс ${className}`}>
                {stats.attendance.daily.length === 0 ? (
                    <EmptyState icon={CalendarCheck} title="Отметок нет" compact />
                ) : (
                    <AttendanceBars items={stats.attendance.daily} />
                )}
            </Card>

            <Card padding="sm" title="Динамика нарушений" description="По месяцам, отработано и в работе">
                {stats.violations.byMonth.length === 0 ? (
                    <EmptyState icon={AlertTriangle} title="Нарушений нет" compact />
                ) : (
                    <ViolationBars items={stats.violations.byMonth} />
                )}
            </Card>

            <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-2">
                <CheckCircle2 size={16} className="text-success" aria-hidden />
                <p className="text-xs text-fg-muted">
                    Отработано нарушений: <span className="font-semibold text-fg">{stats.summary.resolutionPercent}%</span>
                </p>
                <ChevronRight size={15} className="ml-auto text-fg-subtle" aria-hidden />
                <Badge tone={stats.summary.violationsUnresolved > 0 ? "warning" : "success"}>
                    {stats.summary.violationsUnresolved} в работе
                </Badge>
            </div>
        </div>
    );
}

function AttendanceBars({ items }: { items: Stats["attendance"]["daily"] }) {
    const max = Math.max(1, ...items.map(item => item.absent));

    return (
        <div className="overflow-x-auto">
            <div className="flex h-32 min-w-[360px] items-end gap-1">
                {items.map(item => (
                    <div
                        key={item.date}
                        className="flex min-w-2.5 flex-1 flex-col items-center gap-1"
                        title={
                            item.marked
                                ? `${formatDateShortRu(item.date)}: ${item.absent}`
                                : `${formatDateShortRu(item.date)}: нет отметки`
                        }
                    >
                        <div className="flex h-24 w-full items-end justify-center">
                            {!item.marked ? (
                                <div className="h-full w-full max-w-3 rounded-t border border-danger/40 bg-danger/25" />
                            ) : (
                                <div
                                    className={`w-full max-w-3 rounded-t ${item.absent > 0 ? "bg-warning" : "bg-success/60"}`}
                                    style={{ height: `${Math.max(3, (item.absent / max) * 100)}%` }}
                                />
                            )}
                        </div>
                        <span className="origin-left rotate-45 whitespace-nowrap text-[7px] text-fg-subtle">
                            {formatDateShortRu(item.date)}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-1 flex gap-3 text-[10px] text-fg-muted">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> пропуски</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success/60" /> без пропусков</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-danger/50" /> нет отметки</span>
            </div>
        </div>
    );
}

function ViolationBars({ items }: { items: Stats["violations"]["byMonth"] }) {
    const max = Math.max(1, ...items.map(item => item.count));

    return (
        <div>
            <div className="flex h-32 items-end gap-2 overflow-x-auto">
                {items.map(item => (
                    <div
                        key={item.month}
                        className="flex min-w-8 flex-1 flex-col items-center gap-1"
                        title={`${monthLabel(item.month)}: отработано ${item.resolved}, в работе ${item.unresolved}`}
                    >
                        <div className="flex h-24 w-full max-w-8 flex-col-reverse overflow-hidden rounded-t bg-surface-2">
                            <div className="w-full bg-warning" style={{ height: `${(item.unresolved / max) * 100}%` }} />
                            <div className="w-full bg-success" style={{ height: `${(item.resolved / max) * 100}%` }} />
                        </div>
                        <span className="text-[9px] text-fg-subtle">{monthLabel(item.month)}</span>
                    </div>
                ))}
            </div>
            <div className="mt-1 flex gap-3 text-[10px] text-fg-muted">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success" /> отработано</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> в работе</span>
            </div>
        </div>
    );
}

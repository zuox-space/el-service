"use client";

// components/my-class/MyClassStats.tsx
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarCheck, ChevronDown } from "lucide-react";
import { EmptyState, FormError, Skeleton } from "@/components/ui/kit";
import {
    addMonths,
    formatDateShortRu,
    getAcademicYearStart,
    toLocalISODate,
} from "@/lib/date";
import { getViolationType } from "@/lib/violations";

interface Stats {
    summary: {
        violationsTotal: number;
        violationsResolved: number;
        violationsUnresolved: number;
    };
    attendance: {
        daily: Array<{
            date: string;
            absent: number;
            marked: boolean;
            reasons?: Record<string, number>;
        }>;
        reasons: Array<{ reason: string; count: number }>;
    };
    violations: {
        byMonth: Array<{
            month: string;
            count: number;
            resolved: number;
            unresolved: number;
        }>;
        byType: Array<{
            type: string;
            count: number;
            resolved: number;
            unresolved: number;
        }>;
        byTypeMonth: Array<{
            type: string;
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

const REASON_LABEL: Record<string, string> = {
    sick: "Болен",
    family: "По заявлению родителей",
    vacation: "В отпуске",
    competition: "Соревнования",
    other: "Причина неясна",
    unknown: "Не указана",
};

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
    const [selectedReason, setSelectedReason] = useState("all");
    const [selectedType, setSelectedType] = useState("all");

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

    const violationItems = useMemo(() => {
        if (!stats) return [];
        if (selectedType === "all") return stats.violations.byMonth;
        return stats.violations.byTypeMonth.filter(item => item.type === selectedType);
    }, [stats, selectedType]);

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

            <CollapsibleSection
                title="Посещаемость"
                description={`Класс ${className} · нажмите на причину, чтобы изменить график`}
                icon={CalendarCheck}
            >
                {stats.attendance.daily.length === 0 ? (
                    <EmptyState icon={CalendarCheck} title="Отметок нет" compact />
                ) : (
                    <div className="space-y-2">
                        {stats.attendance.reasons.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                <FilterButton
                                    active={selectedReason === "all"}
                                    onClick={() => setSelectedReason("all")}
                                >
                                    Все причины
                                </FilterButton>
                                {stats.attendance.reasons.map(item => (
                                    <FilterButton
                                        key={item.reason}
                                        active={selectedReason === item.reason}
                                        onClick={() => setSelectedReason(item.reason)}
                                    >
                                        {REASON_LABEL[item.reason] ?? item.reason} · {item.count}
                                    </FilterButton>
                                ))}
                            </div>
                        )}
                        <AttendanceBars items={stats.attendance.daily} selectedReason={selectedReason} />
                    </div>
                )}
            </CollapsibleSection>

            <CollapsibleSection
                title="Динамика нарушений"
                description="По месяцам · нажмите на тип, чтобы изменить график"
                icon={AlertTriangle}
            >
                {stats.violations.byMonth.length === 0 ? (
                    <EmptyState icon={AlertTriangle} title="Нарушений нет" compact />
                ) : (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                            <FilterButton
                                active={selectedType === "all"}
                                onClick={() => setSelectedType("all")}
                            >
                                Все нарушения · {stats.summary.violationsTotal}
                            </FilterButton>
                            {stats.violations.byType.map(item => {
                                const type = getViolationType(item.type);
                                return (
                                    <FilterButton
                                        key={item.type}
                                        active={selectedType === item.type}
                                        onClick={() => setSelectedType(item.type)}
                                    >
                                        {type.shortLabel} · {item.count}
                                    </FilterButton>
                                );
                            })}
                        </div>
                        <ViolationBars items={violationItems} />
                    </div>
                )}
            </CollapsibleSection>
        </div>
    );
}

function CollapsibleSection({
    title,
    description,
    icon: Icon,
    children,
}: {
    title: string;
    description: string;
    icon: typeof CalendarCheck;
    children: React.ReactNode;
}) {
    return (
        <details open className="group rounded-card border border-border bg-surface shadow-card">
            <summary className="flex list-none cursor-pointer items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <Icon size={16} className="shrink-0 text-fg-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg">{title}</p>
                    <p className="truncate text-[11px] text-fg-muted">{description}</p>
                </div>
                <ChevronDown
                    size={17}
                    className="shrink-0 text-fg-subtle transition-transform group-open:rotate-180"
                    aria-hidden
                />
            </summary>
            <div className="border-t border-border p-3">{children}</div>
        </details>
    );
}

function FilterButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                active
                    ? "border-accent bg-accent-solid text-accent-fg"
                    : "border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
            }`}
        >
            {children}
        </button>
    );
}

function AttendanceBars({
    items,
    selectedReason,
}: {
    items: Stats["attendance"]["daily"];
    selectedReason: string;
}) {
    const values = items.map(item => ({
        ...item,
        value: selectedReason === "all" ? item.absent : item.reasons?.[selectedReason] ?? 0,
    }));
    const max = Math.max(1, ...values.map(item => item.value));

    return (
        <div className="overflow-x-auto">
            <div className="flex h-32 min-w-[360px] items-end gap-1">
                {values.map(item => (
                    <div
                        key={item.date}
                        className="flex min-w-2.5 flex-1 flex-col items-center gap-1"
                        title={
                            item.marked
                                ? `${formatDateShortRu(item.date)}: ${item.value}`
                                : `${formatDateShortRu(item.date)}: нет отметки`
                        }
                    >
                        <div className="flex h-24 w-full flex-col items-center justify-end gap-0.5">
                            <span className="text-[8px] tabular-nums text-fg-subtle">
                                {item.marked ? item.value : "—"}
                            </span>
                            {!item.marked ? (
                                <div className="h-20 w-full max-w-3 rounded-t border border-danger/40 bg-danger/25" />
                            ) : (
                                <div
                                    className={`w-full max-w-3 rounded-t ${item.value > 0 ? "bg-warning" : "bg-success/60"}`}
                                    style={{ height: `${Math.max(3, (item.value / max) * 100)}%` }}
                                />
                            )}
                        </div>
                        <span className="origin-left rotate-45 whitespace-nowrap text-[7px] text-fg-subtle">
                            {formatDateShortRu(item.date)}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-fg-muted">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> пропуски</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success/60" /> без пропусков</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-danger/50" /> нет отметки</span>
            </div>
        </div>
    );
}

function ViolationBars({
    items,
}: {
    items: Array<{
        month: string;
        count: number;
        resolved: number;
        unresolved: number;
    }>;
}) {
    if (items.length === 0) {
        return <EmptyState icon={AlertTriangle} title="Нет данных за период" compact />;
    }

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
                        <span className="text-[9px] font-medium tabular-nums text-fg">{item.count}</span>
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

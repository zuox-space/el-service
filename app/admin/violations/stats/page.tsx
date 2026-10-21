// app/admin/violations/stats/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    FormError,
    Input,
    PageHeader,
    Skeleton,
} from "@/components/ui/kit";
import { BarList, DonutChart, TrendBars, type ChartSlice } from "@/components/ui/charts";
import { getViolationType } from "@/lib/violations";
import { addMonths, formatDateRu, getAcademicYearStart, toLocalISODate } from "@/lib/date";

/**
 * Дашборд нарушений: из чего складывается картина за период.
 *
 * Период по умолчанию — с 1 сентября учебного года (считается в lib/date),
 * чтобы «статистика школы» не начиналась с чистого листа 1 января.
 * Диаграммы интерактивные: нажатие на сегмент или строку подсвечивает причину
 * и показывает детали по ней; повторное нажатие снимает выбор.
 */

interface Stats {
    total: number;
    uniqueStudents: number;
    uniqueClasses: number;
    byType: Record<string, number>;
    byTypeStudents: Record<string, number>;
    byClass: Record<string, number>;
    byMonth: Record<string, number>;
    byWeekday: number[];
    byTeacher: Record<string, number>;
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const monthLabel = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month) return key;
    return formatDateRu(new Date(year, month - 1, 1), { month: "short" });
};

export default function ViolationsStatsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);

    const academicStart = useMemo(() => toLocalISODate(getAcademicYearStart()), []);
    const [startDate, setStartDate] = useState(academicStart);
    const [endDate, setEndDate] = useState(() => toLocalISODate());

    const [gradeGroup, setGradeGroup] = useState<string>("");
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) router.replace("/admin");
        }
    }, [session, status, router]);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/admin/violations-stats?startDate=${startDate}&endDate=${endDate}&gradeGroup=${gradeGroup}`,
            );
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const data = await response.json();
            if (!data.success) throw new Error(data.error || "Не удалось получить статистику");

            setStats(data.stats);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось построить статистику");
            setStats(null);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, gradeGroup]);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            void fetchStats();
        }
    }, [session, fetchStats]);

    const typeSlices: ChartSlice[] = useMemo(() => {
        if (!stats) return [];

        return Object.entries(stats.byType)
            .filter(([, value]) => value > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([typeId, value]) => ({
                label: getViolationType(typeId).shortLabel,
                value,
                color: getViolationType(typeId).chartColor,
            }));
    }, [stats]);

    const classSlices: ChartSlice[] = useMemo(() => {
        if (!stats) return [];

        return Object.entries(stats.byClass)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 12)
            .map(([className, value]) => ({ label: className, value, color: "var(--color-chart-1)" }));
    }, [stats]);

    const monthSeries = useMemo(() => {
        if (!stats) return [];

        return Object.keys(stats.byMonth)
            .sort()
            .map(key => ({ label: monthLabel(key), value: stats.byMonth[key] }));
    }, [stats]);

    const weekdaySlices: ChartSlice[] = useMemo(() => {
        if (!stats) return [];

        // byWeekday идёт от воскресенья; переставляем на понедельник
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.map((dayIndex, position) => ({
            label: WEEKDAYS[position],
            value: stats.byWeekday[dayIndex] ?? 0,
            color: "var(--color-chart-6)",
        }));
    }, [stats]);

    const selectedTypeInfo = selectedType ? getViolationType(selectedType) : null;
    const percent = (value: number) => (stats && stats.total > 0 ? Math.round((value / stats.total) * 100) : 0);

    const applyPeriod = (kind: "year" | "3m" | "month" | "30d") => {
        const today = new Date();

        if (kind === "year") {
            setStartDate(academicStart);
            setEndDate(toLocalISODate(today));
            return;
        }

        if (kind === "3m") {
            setStartDate(toLocalISODate(addMonths(today, -3)));
            setEndDate(toLocalISODate(today));
            return;
        }

        if (kind === "month") {
            setStartDate(toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
            setEndDate(toLocalISODate(today));
            return;
        }

        setStartDate(toLocalISODate(addMonths(today, -1)));
        setEndDate(toLocalISODate(today));
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Статистика нарушений" onBack={() => router.push("/admin/violations")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} height={72} radius="card" />
                        ))}
                    </div>
                    <Skeleton height={280} radius="card" />
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Статистика нарушений"
                subtitle={`${formatDateRu(startDate)} — ${formatDateRu(endDate)}`}
                onBack={() => router.push("/admin/violations")}
                actions={
                    <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={RefreshCw}
                        onClick={() => void fetchStats()}
                        disabled={isLoading}
                    >
                        <span className="hidden sm:inline">Обновить</span>
                    </Button>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {error && <FormError message={error} />}

                {/* Период */}
                <Card padding="sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                            type="date"
                            label="Период с"
                            value={startDate}
                            max={endDate}
                            onChange={event => setStartDate(event.target.value)}
                        />
                        <Input
                            type="date"
                            label="по"
                            value={endDate}
                            min={startDate}
                            onChange={event => setEndDate(event.target.value)}
                        />
                    </div>

                    <div className="mt-3">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                            Корпус
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            <Chip selected={gradeGroup === ""} onClick={() => setGradeGroup("")}>
                                Все
                            </Chip>
                            {[
                                { id: "1-3", label: "1–3 классы" },
                                { id: "4-6", label: "4–6 классы" },
                                { id: "7-11", label: "7–11 классы" },
                            ].map(building => (
                                <Chip
                                    key={building.id}
                                    selected={gradeGroup === building.id}
                                    onClick={() => setGradeGroup(gradeGroup === building.id ? "" : building.id)}
                                >
                                    {building.label}
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Chip onClick={() => applyPeriod("year")}>Учебный год</Chip>
                        <Chip onClick={() => applyPeriod("3m")}>3 месяца</Chip>
                        <Chip onClick={() => applyPeriod("month")}>Этот месяц</Chip>
                        <Chip onClick={() => applyPeriod("30d")}>30 дней</Chip>
                        <span className="ml-auto text-xs text-fg-subtle">
                            по умолчанию — с 1 сентября
                        </span>
                    </div>
                </Card>

                {!stats || stats.total === 0 ? (
                    <EmptyState
                        variant="empty"
                        title={stats ? "За период нарушений нет" : "Статистика не загружена"}
                        description={
                            stats
                                ? "Выберите другой период — например, учебный год"
                                : "Нажмите «Обновить», чтобы построить отчёт"
                        }
                        action={
                            stats
                                ? { label: "Показать учебный год", onClick: () => applyPeriod("year") }
                                : { label: "Обновить", onClick: () => void fetchStats() }
                        }
                    />
                ) : (
                    <>
                        {/* Ключевые цифры */}
                        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <KpiTile label="Всего нарушений" value={stats.total} />
                            <KpiTile label="Учеников" value={stats.uniqueStudents} />
                            <KpiTile label="Классов" value={stats.uniqueClasses} />
                            <KpiTile
                                label="На ученика"
                                value={(stats.total / Math.max(stats.uniqueStudents, 1)).toFixed(1)}
                            />
                        </section>

                        <div className="grid gap-3 lg:grid-cols-2">
                            {/* Причины */}
                            <Card
                                title="По причинам"
                                description="Доля каждой причины в общем числе нарушений"
                                padding="md"
                            >
                                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                                    <DonutChart
                                        data={typeSlices}
                                        centerLabel="нарушений"
                                        activeIndex={
                                            selectedType
                                                ? typeSlices.findIndex(slice => slice.label === getViolationType(selectedType).shortLabel)
                                                : null
                                        }
                                        onSelect={index => {
                                            const slice = index != null ? typeSlices[index] : null;
                                            const type = slice
                                                ? Object.keys(stats.byType).find(
                                                    key => getViolationType(key).shortLabel === slice.label,
                                                )
                                                : null;
                                            setSelectedType(previous => (previous === type ? null : type ?? null));
                                        }}
                                    />

                                    <ul role="list" className="w-full min-w-0 space-y-1.5">
                                        {typeSlices.map(slice => {
                                            const typeId = Object.keys(stats.byType).find(
                                                key => getViolationType(key).shortLabel === slice.label,
                                            );
                                            const type = typeId ? getViolationType(typeId) : null;
                                            const Icon = type?.Icon;
                                            const isActive = Boolean(typeId) && selectedType === typeId;

                                            return (
                                                <li key={slice.label}>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedType(previous => (previous === typeId ? null : typeId ?? null))
                                                        }
                                                        aria-pressed={isActive}
                                                        className={`flex w-full items-center gap-2 rounded-control border border-dashed px-2 py-1.5 text-left transition-colors ${
                                                            isActive
                                                                ? "border-accent/60 bg-accent-soft"
                                                                : "border-border hover:border-border-strong"
                                                        }`}
                                                    >
                                                        <span
                                                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                            style={{ backgroundColor: slice.color }}
                                                            aria-hidden
                                                        />
                                                        {Icon && (
                                                            <Icon
                                                                size={14}
                                                                strokeWidth={1.75}
                                                                className="shrink-0 text-fg-subtle"
                                                                aria-hidden
                                                            />
                                                        )}
                                                        <span className="min-w-0 flex-1 truncate text-xs text-fg">
                                                            {type?.label ?? slice.label}
                                                        </span>
                                                        <span className="shrink-0 text-xs font-medium tabular-nums text-fg-muted">
                                                            {percent(slice.value)}%
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>

                                {selectedTypeInfo && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-control border border-dashed border-accent/50 bg-accent-soft px-3 py-2">
                                        <Badge tone="accent">{selectedTypeInfo.label}</Badge>
                                        <span className="text-xs text-fg">
                                            {stats.byType[selectedType!] ?? 0} нарушений ·{" "}
                                            {stats.byTypeStudents[selectedType!] ?? 0} учеников ·{" "}
                                            {percent(stats.byType[selectedType!] ?? 0)}% от всех
                                        </span>
                                    </div>
                                )}
                            </Card>

                            {/* Классы */}
                            <Card
                                title="По классам"
                                description={
                                    selectedClass
                                        ? `Выбран ${selectedClass} — ${stats.byClass[selectedClass] ?? 0} нарушений`
                                        : "Топ классов за период"
                                }
                                padding="md"
                            >
                                <BarList
                                    data={classSlices}
                                    activeLabel={selectedClass}
                                    onSelect={label => setSelectedClass(label)}
                                    emptyText="Нет данных по классам"
                                />
                            </Card>

                            {/* Динамика */}
                            <Card
                                title="Динамика по месяцам"
                                description="Сколько нарушений фиксировали каждый месяц"
                                padding="md"
                                className="lg:col-span-2"
                            >
                                <TrendBars data={monthSeries} color="var(--color-chart-1)" />
                            </Card>

                            {/* Дни недели */}
                            <Card
                                title="По дням недели"
                                description="Когда нарушений больше всего"
                                padding="md"
                                className="lg:col-span-2"
                            >
                                <BarList data={weekdaySlices} emptyText="Нет данных" />
                            </Card>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

function KpiTile({ label, value }: { label: string; value: number | string }) {
    return (
        <div className="rounded-card border border-dashed border-border bg-surface p-3">
            <p className="text-xs text-fg-subtle">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{value}</p>
        </div>
    );
}

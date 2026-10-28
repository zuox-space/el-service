// app/admin/uniform/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw, Shirt } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Chip,
    DataTable,
    EmptyState,
    FormError,
    Input,
    List,
    ListItem,
    PageHeader,
    Skeleton,
    type Column,
} from "@/components/ui/kit";
import { BarList, DonutChart, TrendBars, type ChartSlice } from "@/components/ui/charts";
import { addMonths, formatDateRu, toLocalISODate } from "@/lib/date";

/**
 * Форма одежды: аналитика нарушений по классам за выбранный период.
 *
 * Что показывает:
 *  • сколько нарушений формы в школе и какая это доля от всех нарушений;
 *  • разрез по классам и по параллелям (1–3 / 4–6 / 7–11);
 *  • таблицу «класс × месяц» — видно, в каком классе проблема системная,
 *    а где единичный случай;
 *  • дни недели и учеников с наибольшим числом замечаний (переход в портфолио).
 *
 * Период по умолчанию — месяц; есть «Сегодня», «Неделя» и произвольный период.
 */

type PeriodKind = "today" | "week" | "month" | "custom";

interface UniformStats {
    total: number;
    allViolations: number;
    share: number;
    uniqueStudents: number;
    uniqueClasses: number;
    byClass: Record<string, number>;
    byClassStudents: Record<string, number>;
    byClassMonth: Record<string, Record<string, number>>;
    byMonth: Record<string, number>;
    byGrade: Record<string, number>;
    topStudents: Array<{ id: string; name: string; className: string; count: number }>;
}

const GRADE_LABELS: Record<string, string> = {
    "1-3": "1–3 классы",
    "4-6": "4–6 классы",
    "7-11": "7–11 классы",
};

interface BuildingOption {
    id: string;
    name: string;
    classes: Array<{ id: string; name: string }>;
}

const monthLabel = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    if (!year || !month) return key;
    return formatDateRu(new Date(year, month - 1, 1), { month: "short" });
};

const startOfWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0 — воскресенье
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    return monday;
};

export default function UniformStatsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<UniformStats | null>(null);

    const [period, setPeriod] = useState<PeriodKind>("month");
    const [startDate, setStartDate] = useState(() => toLocalISODate(addMonths(new Date(), -1)));
    const [endDate, setEndDate] = useState(() => toLocalISODate());
    const [buildingId, setBuildingId] = useState("");
    const [buildings, setBuildings] = useState<BuildingOption[]>([]);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");

    }, [session, status, router]);

    const fetchStats = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/admin/uniform-stats?startDate=${startDate}&endDate=${endDate}&buildingId=${buildingId}`,
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
    }, [startDate, endDate, buildingId]);

    useEffect(() => {
        if (session) {
            void fetchStats();
        }
    }, [session, fetchStats]);

    useEffect(() => {
        if (!session) return;
        fetch("/api/buildings", { cache: "no-store" })
            .then(response => response.json())
            .then(data => setBuildings(Array.isArray(data.buildings) ? data.buildings : []))
            .catch(() => setBuildings([]));
    }, [session]);

    const applyPeriod = (kind: PeriodKind) => {
        const today = new Date();
        setPeriod(kind);

        if (kind === "today") {
            setStartDate(toLocalISODate(today));
            setEndDate(toLocalISODate(today));
            return;
        }

        if (kind === "week") {
            setStartDate(toLocalISODate(startOfWeek()));
            setEndDate(toLocalISODate(today));
            return;
        }

        if (kind === "month") {
            setStartDate(toLocalISODate(addMonths(today, -1)));
            setEndDate(toLocalISODate(today));
        }
    };

    const classSlices: ChartSlice[] = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.byClass)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 14)
            .map(([className, value]) => ({ label: className, value, color: "var(--color-chart-2)" }));
    }, [stats]);

    const gradeSlices: ChartSlice[] = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.byGrade)
            .filter(([, value]) => value > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([grade, value], index) => ({
                label: GRADE_LABELS[grade] ?? "Другое",
                value,
                color: `var(--color-chart-${(index % 8) + 1})`,
            }));
    }, [stats]);

    const monthSeries = useMemo(() => {
        if (!stats) return [];
        return Object.keys(stats.byMonth)
            .sort()
            .map(key => ({ label: monthLabel(key), value: stats.byMonth[key] }));
    }, [stats]);

    // Тепловая карта «класс × месяц»
    const heatmap = useMemo(() => {
        if (!stats) return { months: [] as string[], rows: [] as Array<{ className: string; cells: number[] }>, max: 1 };

        const months = Object.keys(stats.byMonth).sort();
        const classes = Object.keys(stats.byClass)
            .sort((a, b) => stats.byClass[b] - stats.byClass[a])
            .slice(0, 18);

        const rows = classes.map(className => ({
            className,
            cells: months.map(month => stats.byClassMonth[className]?.[month] ?? 0),
        }));

        const max = Math.max(1, ...rows.flatMap(row => row.cells));
        return { months, rows, max };
    }, [stats]);

    const columns: Column<{ className: string; count: number; students: number }>[] = [
        { key: "className", header: "Класс", width: "120px" },
        {
            key: "count",
            header: "Нарушений",
            align: "right",
            width: "120px",
            render: row => <span className="font-semibold tabular-nums text-fg">{row.count}</span>,
        },
        {
            key: "students",
            header: "Учеников",
            align: "right",
            width: "120px",
            render: row => <span className="tabular-nums">{row.students}</span>,
        },
        {
            key: "share",
            header: "Доля в школе",
            align: "right",
            render: row => (
                <span className="tabular-nums text-fg-muted">
                    {stats && stats.total > 0 ? Math.round((row.count / stats.total) * 100) : 0}%
                </span>
            ),
        },
    ];

    const tableRows = useMemo(() => {
        if (!stats) return [];
        return Object.entries(stats.byClass)
            .map(([className, count]) => ({
                className,
                count,
                students: stats.byClassStudents[className] ?? 0,
            }))
            .sort((a, b) => b.count - a.count);
    }, [stats]);

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Форма одежды" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} height={72} radius="card" />
                        ))}
                    </div>
                    <Skeleton height={260} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Форма одежды"
                subtitle={`${formatDateRu(startDate)} — ${formatDateRu(endDate)}`}
                onBack={() => router.push("/admin")}
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

                {/* Фильтры периода и корпуса */}
                <Card padding="sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Chip selected={period === "today"} onClick={() => applyPeriod("today")}>
                            Сегодня
                        </Chip>
                        <Chip selected={period === "week"} onClick={() => applyPeriod("week")}>
                            Неделя
                        </Chip>
                        <Chip selected={period === "month"} onClick={() => applyPeriod("month")}>
                            Месяц
                        </Chip>
                        <Chip selected={period === "custom"} onClick={() => setPeriod("custom")}>
                            Период
                        </Chip>
                    </div>

                    {period === "custom" && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
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
                    )}

                    <div className="mt-3">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                            Здание
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {[{ id: "", name: "Все здания" }, ...buildings].map(building => (
                                <Chip
                                    key={building.id || "all"}
                                    selected={buildingId === building.id}
                                    onClick={() => setBuildingId(building.id)}
                                >
                                    {building.name}
                                </Chip>
                            ))}
                        </div>
                    </div>
                </Card>

                {!stats || stats.total === 0 ? (
                    <EmptyState
                        icon={Shirt}
                        title={stats ? "За период нарушений формы нет" : "Статистика не загружена"}
                        description={
                            stats
                                ? "Это хорошая новость: замечаний по форме одежды не зафиксировано"
                                : "Нажмите «Обновить», чтобы построить отчёт"
                        }
                        action={
                            stats ? { label: "Показать месяц", onClick: () => applyPeriod("month") } : undefined
                        }
                    />
                ) : (
                    <>
                        {/* Ключевые цифры */}
                        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <KpiTile label="Нарушений формы" value={stats.total} />
                            <KpiTile label="Учеников" value={stats.uniqueStudents} />
                            <KpiTile label="Классов" value={stats.uniqueClasses} />
                            <KpiTile
                                label="Доля от всех нарушений"
                                value={`${stats.share}%`}
                                hint={`всего нарушений: ${stats.allViolations}`}
                            />
                        </section>

                        <div className="grid gap-3 lg:grid-cols-2">
                            {/* По классам */}
                            <Card title="Нарушения по классам" description="Топ классов за период" padding="md">
                                <BarList data={classSlices} emptyText="Нет данных по классам" />
                            </Card>

                            {/* По параллелям */}
                            <Card title="По параллелям" description="Где форма нарушается чаще" padding="md">
                                <div className="flex flex-col items-center gap-4 sm:flex-row">
                                    <DonutChart data={gradeSlices} centerLabel="нарушений" size={160} />
                                    <ul role="list" className="w-full space-y-1.5">
                                        {gradeSlices.map(slice => (
                                            <li
                                                key={slice.label}
                                                className="flex items-center gap-2 rounded-control border border-dashed border-border px-2 py-1.5"
                                            >
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: slice.color }}
                                                    aria-hidden
                                                />
                                                <span className="min-w-0 flex-1 truncate text-xs text-fg">
                                                    {slice.label}
                                                </span>
                                                <span className="text-xs font-medium tabular-nums text-fg-muted">
                                                    {slice.value}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </Card>

                            {/* Класс × месяц */}
                            <Card
                                title="Класс и месяц"
                                description="Видно, где замечания повторяются системно"
                                padding="md"
                                className="lg:col-span-2"
                            >
                                <div className="scroll-row">
                                    <table className="w-full min-w-[560px] border-collapse text-xs">
                                        <thead>
                                            <tr>
                                                <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left font-medium text-fg-subtle">
                                                    Класс
                                                </th>
                                                {heatmap.months.map(month => (
                                                    <th
                                                        key={month}
                                                        className="px-1 py-1.5 text-center font-medium text-fg-subtle"
                                                    >
                                                        {monthLabel(month)}
                                                    </th>
                                                ))}
                                                <th className="px-2 py-1.5 text-right font-medium text-fg-subtle">Всего</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {heatmap.rows.map(row => (
                                                <tr key={row.className} className="border-t border-border">
                                                    <td className="sticky left-0 z-10 bg-surface px-2 py-1 text-fg">
                                                        {row.className}
                                                    </td>
                                                    {row.cells.map((value, index) => {
                                                        const alpha = value === 0 ? 0 : 18 + Math.round((value / heatmap.max) * 72);

                                                        return (
                                                            <td key={`${row.className}-${heatmap.months[index]}`} className="px-1 py-1">
                                                                <span
                                                                    className="flex h-7 min-w-7 items-center justify-center rounded-control border border-dashed border-border tabular-nums text-fg"
                                                                    style={
                                                                        value > 0
                                                                            ? {
                                                                                backgroundColor: `color-mix(in srgb, var(--color-chart-2) ${alpha}%, transparent)`,
                                                                            }
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {value > 0 ? value : "—"}
                                                                </span>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-2 py-1 text-right font-semibold tabular-nums text-fg">
                                                        {stats.byClass[row.className]}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            {/* Динамика по месяцам */}
                            <Card title="Динамика по месяцам" description="Сколько замечаний фиксировали" padding="md">
                                <TrendBars data={monthSeries} color="var(--color-chart-2)" />
                            </Card>

                            {/* Чаще всех нарушают */}
                            <Card
                                title="Чаще всего нарушают"
                                description="Топ-10 учеников · нажмите, чтобы открыть портфолио"
                                padding="none"
                                className="lg:col-span-2"
                            >
                                {stats.topStudents.length === 0 ? (
                                    <EmptyState title="Нет данных" description="За период замечаний нет" compact />
                                ) : (
                                    <List className="rounded-none border-0">
                                        {stats.topStudents.map(student => (
                                            <li key={student.id}>
                                                <ListItem
                                                    leading={Shirt}
                                                    title={student.name}
                                                    subtitle={student.className}
                                                    trailing="badge"
                                                    trailingContent={
                                                        <Badge tone={student.count >= 3 ? "danger" : "warning"}>
                                                            {student.count}
                                                        </Badge>
                                                    }
                                                    density="compact"
                                                    onClick={() => router.push(`/admin/students/${student.id}`)}
                                                />
                                            </li>
                                        ))}
                                    </List>
                                )}
                            </Card>

                            {/* Таблица по классам */}
                            <Card
                                title="Классы"
                                description="Нарушения, ученики и доля в школе"
                                padding="none"
                                className="lg:col-span-2"
                            >
                                <DataTable
                                    columns={columns}
                                    rows={tableRows}
                                    rowKey={row => row.className}
                                    loading={isLoading}
                                    emptyTitle="Нет данных по классам"
                                    caption="Нарушения формы одежды по классам"
                                />
                            </Card>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}

function KpiTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="rounded-card border border-dashed border-border bg-surface p-3">
            <p className="text-xs text-fg-subtle">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{value}</p>
            {hint && <p className="text-[11px] text-fg-subtle">{hint}</p>}
        </div>
    );
}

// app/admin/absent/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, FileText, HelpCircle, Plane, RefreshCw, Thermometer, Trophy } from "lucide-react";
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
    Modal,
    PageHeader,
    SearchInput,
    Skeleton,
    Switch,
    type Column,
} from "@/components/ui/kit";
import { formatDateRu, safeCell, toLocalISODate } from "@/lib/date";

/**
 * Отсутствия: кто отсутствует, с причинами и разбивкой по корпусам.
 *
 * Переведено на DataTable: на десктопе — таблица классов, на мобильном — карточки.
 * Список отсутствующих по классу открывается в модальном окне.
 * Добавлен выбор даты: раньше страница показывала только «сегодня»,
 * поэтому посмотреть прошлый день было нельзя.
 */

const REASONS = [
    { id: "sick", label: "Болен", tone: "danger" as const, Icon: Thermometer },
    { id: "family", label: "По заявлению родителей", tone: "warning" as const, Icon: FileText },
    { id: "other", label: "Причина неясна", tone: "neutral" as const, Icon: HelpCircle },
    { id: "vacation", label: "Отпуск / каникулы", tone: "info" as const, Icon: Plane },
    { id: "competition", label: "Соревнования", tone: "accent" as const, Icon: Trophy },
];

const reasonLabel = (id: string) => REASONS.find(reason => reason.id === id)?.label ?? id;
const reasonTone = (id: string) => REASONS.find(reason => reason.id === id)?.tone ?? "neutral";

interface BuildingOption {
    id: string;
    name: string;
    classes: Array<{ id: string; name: string }>;
}

interface AbsentStudent {
    id: string | number;
    name: string;
    reason: string;
}

interface ClassAttendance {
    id: string;
    name: string;
    grade: number;
    totalStudents: number;
    presentStudents: Array<string | number>;
    absentStudents: AbsentStudent[];
    isMarked: boolean;
}

interface Statistics {
    totalStudents: number;
    totalPresent: number;
    totalAbsent: number;
    byReason: Record<string, number>;
}

export default function AbsentPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [date, setDate] = useState(() => toLocalISODate());
    const [classes, setClasses] = useState<ClassAttendance[]>([]);
    const [statistics, setStatistics] = useState<Statistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [building, setBuilding] = useState("all");
    const [buildings, setBuildings] = useState<BuildingOption[]>([]);
    const [search, setSearch] = useState("");
    const [onlyMarked, setOnlyMarked] = useState(false);
    const [unmarkedFirst, setUnmarkedFirst] = useState(true);
    const [detail, setDetail] = useState<ClassAttendance | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) router.replace("/admin");
        }
    }, [session, status, router]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/attendance-data?date=${date}`);
            if (!response.ok) {
                throw new Error(`Сервер вернул ошибку ${response.status}`);
            }

            const data = await response.json();
            setClasses(Array.isArray(data.classes) ? data.classes : []);
            setStatistics(data.statistics ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
            setClasses([]);
            setStatistics(null);
        } finally {
            setIsLoading(false);
        }
    }, [date]);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            void fetchData();
        }
    }, [session, fetchData]);

    useEffect(() => {
        if (!session?.user?.roles?.includes("ADMIN")) return;
        fetch("/api/buildings", { cache: "no-store" })
            .then(response => response.json())
            .then(data => setBuildings(Array.isArray(data.buildings) ? data.buildings : []))
            .catch(() => setBuildings([]));
    }, [session]);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();
        const buildingClassNames = building === "all"
            ? null
            : new Set((buildings.find(item => item.id === building)?.classes ?? []).map(item => item.name));

        const filtered = classes.filter(cls => {
            if (buildingClassNames && !buildingClassNames.has(cls.name)) return false;
            if (query && !cls.name.toLowerCase().includes(query)) return false;
            if (onlyMarked && !cls.isMarked) return false;
            return true;
        });

        // Неотмеченные классы — наверх: сразу видно, кто ещё не сдал посещаемость
        if (unmarkedFirst) {
            filtered.sort((a, b) => {
                if (a.isMarked !== b.isMarked) return a.isMarked ? 1 : -1;
                return a.name.localeCompare(b.name, "ru");
            });
        } else {
            filtered.sort((a, b) => a.name.localeCompare(b.name, "ru"));
        }

        return filtered;
    }, [classes, building, buildings, search, onlyMarked, unmarkedFirst]);

    const columns: Column<ClassAttendance>[] = [
        { key: "name", header: "Класс", width: "110px" },
        {
            key: "totalStudents",
            header: "Учеников",
            align: "right",
            width: "110px",
            render: cls => <span className="tabular-nums">{cls.totalStudents}</span>,
        },
        {
            key: "present",
            header: "Присутствуют",
            align: "right",
            width: "130px",
            render: cls => (
                <span className="tabular-nums">{cls.isMarked ? cls.presentStudents.length : "—"}</span>
            ),
        },
        {
            key: "absent",
            header: "Отсутствуют",
            align: "right",
            width: "130px",
            render: cls =>
                cls.isMarked ? (
                    <span
                        className={
                            cls.absentStudents.length > 0
                                ? "font-semibold tabular-nums text-warning"
                                : "tabular-nums text-fg"
                        }
                    >
                        {cls.absentStudents.length}
                    </span>
                ) : (
                    <Badge tone="neutral">не отмечен</Badge>
                ),
        },
        {
            key: "reasons",
            header: "Причины",
            render: cls => {
                if (cls.absentStudents.length === 0) {
                    return <span className="text-xs text-fg-subtle">—</span>;
                }

                const counts = cls.absentStudents.reduce<Record<string, number>>((acc, student) => {
                    acc[student.reason] = (acc[student.reason] || 0) + 1;
                    return acc;
                }, {});

                return (
                    <div className="flex flex-wrap items-center gap-2 py-0.5">
                        {Object.entries(counts)
                            .sort(([, a], [, b]) => b - a)
                            .map(([reason, count]) => {
                                const meta = REASONS.find(item => item.id === reason);
                                const Icon = meta?.Icon ?? HelpCircle;

                                return (
                                    <span
                                        key={reason}
                                        className="inline-flex items-center gap-1.5 rounded-control border border-dashed border-border px-2 py-1 text-xs text-fg-muted"
                                    >
                                        <Icon size={13} strokeWidth={1.75} aria-hidden />
                                        <span className="text-fg">{reasonLabel(reason)}</span>
                                        <span className="font-semibold tabular-nums text-fg">{count}</span>
                                    </span>
                                );
                            })}
                    </div>
                );
            },
        },
    ];

    const exportToExcel = () => {
        let html = `<html><head><meta charset="UTF-8"><title>Отсутствия</title>
            <style>body{font-family:Arial,sans-serif}h1{font-size:16px}table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f2f2f2}</style></head><body>
            <h1>Отсутствия</h1><p>Дата: ${safeCell(date)}</p>
            <table><tr><th>Класс</th><th>Учеников</th><th>Присутствуют</th><th>Отсутствуют</th><th>Кто отсутствует</th></tr>`;

        rows.forEach(cls => {
            const absent = cls.absentStudents
                .map(student => `${student.name} (${reasonLabel(student.reason)})`)
                .join("; ");
            html += `<tr><td>${safeCell(cls.name)}</td><td>${cls.totalStudents}</td>
                <td>${cls.isMarked ? cls.presentStudents.length : "—"}</td>
                <td>${cls.isMarked ? cls.absentStudents.length : "—"}</td>
                <td>${safeCell(absent)}</td></tr>`;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `отсутствия_${date}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Отсутствия" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} height={64} radius="card" />
                        ))}
                    </div>
                    <Skeleton height={200} radius="card" />
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) return null;

    const markedCount = classes.filter(cls => cls.isMarked).length;
    const presentedShare =
        statistics && statistics.totalStudents > 0
            ? Math.round((statistics.totalPresent / statistics.totalStudents) * 100)
            : 0;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Отсутствия"
                subtitle={formatDateRu(date, { day: "numeric", month: "long", year: "numeric" })}
                onBack={() => router.push("/admin")}
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={RefreshCw}
                            onClick={() => void fetchData()}
                            disabled={isLoading}
                        >
                            Обновить
                        </Button>
                        <span className="hidden sm:inline-flex">
                            <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={Download}
                            onClick={exportToExcel}
                            disabled={rows.length === 0}>
                            Выгрузить
                        </Button>
                        </span>
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {error && <FormError message={error} />}

                <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatTile label="Учеников" value={statistics?.totalStudents ?? 0} />
                    <StatTile label="Присутствуют" value={statistics?.totalPresent ?? 0} />
                    <StatTile label="Отсутствуют" value={statistics?.totalAbsent ?? 0} />
                    <StatTile
                        label="Присутствие"
                        value={`${presentedShare}%`}
                        hint={`отмечено классов: ${markedCount} из ${classes.length}`}
                    />
                </section>

                <Card padding="sm">
                    <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                            type="date"
                            label="Дата"
                            value={date}
                            max={toLocalISODate()}
                            onChange={event => setDate(event.target.value)}
                        />
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Например, 7А"
                            label="Поиск класса"
                        />
                        <div className="flex items-end pb-2">
                            <Switch
                                checked={onlyMarked}
                                onChange={setOnlyMarked}
                                label="Только отмеченные"
                                description="Скрыть классы без отметки"
                            />
                        </div>
                    </div>

                    <div className="mt-3">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                            Здание
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {[{ id: "all", name: "Все здания" }, ...buildings].map(item => (
                                <Chip
                                    key={item.id}
                                    selected={building === item.id}
                                    onClick={() => setBuilding(item.id)}
                                >
                                    {item.name}
                                </Chip>
                            ))}
                        </div>
                    </div>
                </Card>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-fg-subtle">
                        Нажмите на класс, чтобы увидеть, кто отсутствует и по какой причине.
                    </p>
                    <Chip selected={unmarkedFirst} onClick={() => setUnmarkedFirst(!unmarkedFirst)}>
                        Сначала неотмеченные
                    </Chip>
                </div>

                {!isLoading && rows.length === 0 ? (
                    <EmptyState
                        variant={search || onlyMarked || building !== "all" ? "no-results" : "empty"}
                        title={
                            search || onlyMarked || building !== "all"
                                ? "Классы не найдены"
                                : "Нет данных за эту дату"
                        }
                        description={
                            search || onlyMarked || building !== "all"
                                ? "Измените фильтры или выберите другое здание"
                                : "Классы не загрузились или за этот день отметок нет"
                        }
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        rows={rows}
                        rowKey={cls => cls.id}
                        loading={isLoading}
                        onRowClick={cls => setDetail(cls)}
                        mobileTitle={cls => `${cls.name} · ${cls.totalStudents} учеников`}
                        mobileSubtitle={cls =>
                            cls.isMarked
                                ? `присутствуют ${cls.presentStudents.length} · отсутствуют ${cls.absentStudents.length}`
                                : "отметки нет"
                        }
                        mobileDetailKeys={["reasons"]}
                        emptyTitle="Нет данных за эту дату"
                        caption="Отсутствия по классам"
                    />
                )}


            </main>

            <Modal
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                title={detail ? `${detail.name} · отсутствуют: ${detail.absentStudents.length}` : "Класс"}
                description={
                    detail
                        ? `Всего учеников: ${detail.totalStudents} · присутствуют: ${detail.presentStudents.length}`
                        : undefined
                }
                size="md"
            >
                {detail &&
                    (detail.absentStudents.length === 0 ? (
                        <EmptyState
                            title="Все на месте"
                            description={detail.isMarked ? "Отсутствующих в этом классе нет" : "Класс ещё не отмечен"}
                            compact
                        />
                    ) : (
                        <List>
                            {detail.absentStudents.map(student => (
                                <li key={String(student.id)}>
                                    <ListItem
                                        title={student.name}
                                        trailing="badge"
                                        trailingContent={
                                            <Badge tone={reasonTone(student.reason)}>
                                                {reasonLabel(student.reason)}
                                            </Badge>
                                        }
                                        density="compact"
                                    />
                                </li>
                            ))}
                        </List>
                    ))}
            </Modal>
        </div>
    );
}

function StatTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="rounded-card border border-border bg-surface p-3">
            <p className="text-xs text-fg-subtle">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{value}</p>
            {hint && <p className="text-[11px] text-fg-subtle">{hint}</p>}
        </div>
    );
}

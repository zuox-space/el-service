// app/admin/truants/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, RefreshCw } from "lucide-react";
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
    Select,
    Skeleton,
    type Column,
} from "@/components/ui/kit";
import { addMonths, formatDateRu, formatDateShortRu, safeCell, toLocalISODate } from "@/lib/date";

/**
 * Прогульщики: кто и сколько уроков пропустил за период.
 *
 * Переведено на DataTable: на десктопе — таблица с сортировкой, на мобильном —
 * карточки-строки из тех же колонок. История пропусков открывается в модальном окне,
 * а не разворачивается в строке таблицы (раньше на мобильном это ломало вёрстку).
 */

const REASONS = [
    { id: "sick", label: "Болен", tone: "danger" as const },
    { id: "family", label: "По заявлению родителей", tone: "warning" as const },
    { id: "other", label: "Причина неясна", tone: "neutral" as const },
    { id: "vacation", label: "В отпуске", tone: "info" as const },
    { id: "competition", label: "Соревнования", tone: "accent" as const },
];

const reasonLabel = (id: string) => REASONS.find(reason => reason.id === id)?.label ?? id;
const reasonTone = (id: string) => REASONS.find(reason => reason.id === id)?.tone ?? "neutral";

const GRADE_GROUPS = [
    { id: "1-3", label: "1–3 классы", grades: [1, 2, 3] },
    { id: "4-6", label: "4–6 классы", grades: [4, 5, 6] },
    { id: "7-9", label: "7–9 классы", grades: [7, 8, 9] },
    { id: "10-11", label: "10–11 классы", grades: [10, 11] },
];

// Ъ, Ы и Ь не могут начинать имя или фамилию — в фильтре они только мешают.
const ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ".split("");

interface Absence {
    date: string;
    reason: string;
    className: string;
}

interface Truant {
    id: string;
    name: string;
    className: string;
    grade: number;
    totalAbsences: number;
    absences: Absence[];
    reasons: Record<string, number>;
}

interface Stats {
    totalTruants: number;
    totalAbsences: number;
    period: { start: string; end: string };
    byReason: Record<string, number>;
}

const defaultRange = () => ({
    start: toLocalISODate(addMonths(new Date(), -1)),
    end: toLocalISODate(),
});

export default function TruantsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [truants, setTruants] = useState<Truant[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const initial = defaultRange();
    const [startDate, setStartDate] = useState(initial.start);
    const [endDate, setEndDate] = useState(initial.end);

    const [search, setSearch] = useState("");
    const [gradeGroup, setGradeGroup] = useState("");
    const [buildingId, setBuildingId] = useState("");
    const [buildings, setBuildings] = useState<Array<{ id: string; name: string; classes: Array<{ id: string; name: string }> }>>([]);
    const [className, setClassName] = useState("");
    const [letter, setLetter] = useState("");
    const [minAbsences, setMinAbsences] = useState("1");
    const [selectedReasons, setSelectedReasons] = useState<string[]>(REASONS.map(reason => reason.id));
    const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>({
        key: "totalAbsences",
        direction: "desc",
    });

    const [detail, setDetail] = useState<Truant | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");

    }, [session, status, router]);

    const fetchTruants = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/admin/truants?startDate=${startDate}&endDate=${endDate}`,
            );
            if (!response.ok) {
                throw new Error(`Сервер вернул ошибку ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "Не удалось получить данные");
            }

            setTruants(Array.isArray(data.truants) ? data.truants : []);
            setStats(data.stats ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить отчёт");
            setTruants([]);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (session) {
            void fetchTruants();
        }
    }, [session, fetchTruants]);

    useEffect(() => {
        if (!session) return;
        fetch("/api/buildings", { cache: "no-store" })
            .then(response => response.json())
            .then(data => setBuildings(Array.isArray(data.buildings) ? data.buildings : []))
            .catch(() => setBuildings([]));
    }, [session]);

    const classOptions = useMemo(() => {
        const unique = [...new Set(truants.map(truant => truant.className).filter(Boolean))];
        return unique.sort((a, b) => a.localeCompare(b, "ru")).map(value => ({ value, label: value }));
    }, [truants]);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();
        const group = GRADE_GROUPS.find(item => item.id === gradeGroup);
        const buildingClassNames = buildingId
            ? new Set((buildings.find(item => item.id === buildingId)?.classes ?? []).map(item => item.name))
            : null;
        const min = Number.parseInt(minAbsences, 10) || 1;

        const filtered = truants.filter(truant => {
            if (query && !truant.name.toLowerCase().includes(query)) return false;
            if (group && !group.grades.includes(truant.grade)) return false;
            if (className && truant.className !== className) return false;
            if (buildingClassNames && !buildingClassNames.has(truant.className)) return false;
            if (letter && truant.name.charAt(0).toUpperCase() !== letter) return false;
            if (truant.totalAbsences < min) return false;

            // если выбраны не все причины — ученик остаётся, когда есть пропуск по выбранной
            if (selectedReasons.length < REASONS.length) {
                const hasSelected = Object.keys(truant.reasons || {}).some(reason =>
                    selectedReasons.includes(reason),
                );
                if (!hasSelected) return false;
            }

            return true;
        });

        return filtered.sort((a, b) => {
            const direction = sort.direction === "asc" ? 1 : -1;

            if (sort.key === "name") return a.name.localeCompare(b.name, "ru") * direction;
            if (sort.key === "className") {
                return (a.grade - b.grade || a.className.localeCompare(b.className, "ru")) * direction;
            }
            return (a.totalAbsences - b.totalAbsences) * direction;
        });
    }, [truants, search, gradeGroup, className, letter, minAbsences, selectedReasons, sort, buildingId, buildings]);

    const columns: Column<Truant>[] = [
        { key: "name", header: "Ученик", sortable: true },
        { key: "className", header: "Класс", width: "96px", sortable: true },
        {
            key: "totalAbsences",
            header: "Пропусков",
            width: "120px",
            align: "right",
            sortable: true,
            render: truant => <span className="font-semibold tabular-nums">{truant.totalAbsences}</span>,
        },
        {
            key: "reasons",
            header: "Причины",
            render: truant => (
                <div className="flex flex-wrap gap-1">
                    {Object.entries(truant.reasons || {})
                        .sort(([, a], [, b]) => b - a)
                        .map(([reason, count]) => (
                            <Badge key={reason} tone={reasonTone(reason)}>
                                {reasonLabel(reason)}: {count}
                            </Badge>
                        ))}
                </div>
            ),
        },
    ];

    const exportToExcel = () => {
        const header = ["#", "Ученик", "Класс", "Пропусков", "Причины"];
        let html = `<html><head><meta charset="UTF-8"><title>Прогульщики</title>
            <style>body{font-family:Arial,sans-serif}h1{font-size:16px}table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f2f2f2}</style></head><body>
            <h1>Прогульщики</h1><p>Период: ${safeCell(startDate)} — ${safeCell(endDate)}</p>
            <table><tr>${header.map(cell => `<th>${cell}</th>`).join("")}</tr>`;

        rows.forEach((truant, index) => {
            const reasons = Object.entries(truant.reasons || {})
                .map(([reason, count]) => `${reasonLabel(reason)}: ${count}`)
                .join(", ");
            html += `<tr><td>${index + 1}</td><td>${safeCell(truant.name)}</td><td>${safeCell(truant.className)}</td>
                <td>${truant.totalAbsences}</td><td>${safeCell(reasons)}</td></tr>`;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `прогульщики_${startDate}_${endDate}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const toggleReason = (id: string) => {
        setSelectedReasons(previous =>
            previous.includes(id) ? previous.filter(reason => reason !== id) : [...previous, id],
        );
    };

    const resetFilters = () => {
        setSearch("");
        setGradeGroup("");
        setClassName("");
        setBuildingId("");
        setLetter("");
        setMinAbsences("1");
        setSelectedReasons(REASONS.map(reason => reason.id));
        setSort({ key: "totalAbsences", direction: "desc" });
        const range = defaultRange();
        setStartDate(range.start);
        setEndDate(range.end);
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Прогульщики" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <Skeleton height={200} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;

    const activeFilters =
        Boolean(search || gradeGroup || className || letter) ||
        minAbsences !== "1" ||
        selectedReasons.length !== REASONS.length;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Прогульщики"
                subtitle={`${formatDateRu(startDate, { day: "numeric", month: "short" })} — ${formatDateRu(endDate, { day: "numeric", month: "short", year: "numeric" })}`}
                onBack={() => router.push("/admin")}
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={RefreshCw}
                            onClick={() => void fetchTruants()}
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

                <section className="grid grid-cols-3 gap-2">
                    <div className="rounded-card border border-border bg-surface p-3">
                        <p className="text-xs text-fg-subtle">Учеников с пропусками</p>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">
                            {stats?.totalTruants ?? 0}
                        </p>
                    </div>
                    <div className="rounded-card border border-border bg-surface p-3">
                        <p className="text-xs text-fg-subtle">Всего пропусков</p>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">
                            {stats?.totalAbsences ?? 0}
                        </p>
                    </div>
                    <div className="rounded-card border border-border bg-surface p-3">
                        <p className="text-xs text-fg-subtle">Показано</p>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{rows.length}</p>
                    </div>
                </section>

                <Card padding="sm">
                    <div className="space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                            <SearchInput
                                value={search}
                                onChange={setSearch}
                                placeholder="Фамилия ученика"
                                label="Поиск"
                            />
                            <div className="grid grid-cols-2 gap-2">
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
                        </div>

                        <div className="grid gap-2 sm:grid-cols-5">
                            <Select
                                aria-label="Параллель"
                                placeholder="Все параллели"
                                value={gradeGroup}
                                onChange={value => {
                                    setGradeGroup(value);
                                    setClassName("");
                                }}
                                options={GRADE_GROUPS.map(group => ({ value: group.id, label: group.label }))}
                            />
                            <Select
                                aria-label="Здание"
                                placeholder="Все здания"
                                value={buildingId}
                                onChange={value => {
                                    setBuildingId(value);
                                    setClassName("");
                                }}
                                options={buildings.map(building => ({ value: building.id, label: building.name }))}
                            />
                            <Select
                                aria-label="Класс"
                                placeholder="Все классы"
                                value={className}
                                onChange={setClassName}
                                options={classOptions}
                            />
                            <Select
                                aria-label="Минимум пропусков"
                                value={minAbsences}
                                onChange={setMinAbsences}
                                options={[
                                    { value: "1", label: "от 1 пропуска" },
                                    { value: "3", label: "от 3 пропусков" },
                                    { value: "5", label: "от 5 пропусков" },
                                    { value: "10", label: "от 10 пропусков" },
                                ]}
                            />
                            <Select
                                aria-label="Сортировка"
                                value={`${sort.key}:${sort.direction}`}
                                onChange={value => {
                                    const [key, direction] = value.split(":") as [string, "asc" | "desc"];
                                    setSort({ key, direction });
                                }}
                                options={[
                                    { value: "totalAbsences:desc", label: "Сначала больше пропусков" },
                                    { value: "totalAbsences:asc", label: "Сначала меньше пропусков" },
                                    { value: "name:asc", label: "По фамилии" },
                                    { value: "className:asc", label: "По классу" },
                                ]}
                            />
                        </div>

                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Причины
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {REASONS.map(reason => (
                                    <Chip
                                        key={reason.id}
                                        selected={selectedReasons.includes(reason.id)}
                                        onClick={() => toggleReason(reason.id)}
                                        count={stats?.byReason?.[reason.id] ?? 0}
                                    >
                                        {reason.label}
                                    </Chip>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Первая буква фамилии
                            </p>
                            <div className="scroll-row flex gap-1 pb-1">
                                <Chip selected={letter === ""} onClick={() => setLetter("")}>
                                    Все
                                </Chip>
                                {ALPHABET.map(symbol => (
                                    <Chip
                                        key={symbol}
                                        selected={letter === symbol}
                                        onClick={() => setLetter(letter === symbol ? "" : symbol)}
                                    >
                                        {symbol}
                                    </Chip>
                                ))}
                            </div>
                        </div>

                        {activeFilters && (
                            <div className="flex justify-end">
                                <Button size="sm" variant="ghost" onClick={resetFilters}>
                                    Сбросить фильтры
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {!isLoading && rows.length === 0 ? (
                    <EmptyState
                        variant={activeFilters ? "no-results" : "empty"}
                        title={activeFilters ? "Никого не найдено" : "Пропусков за период нет"}
                        description={
                            activeFilters
                                ? "Измените период или сбросьте фильтры"
                                : "За выбранный период нет учеников с пропусками"
                        }
                        action={activeFilters ? { label: "Сбросить фильтры", onClick: resetFilters } : undefined}
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        rows={rows}
                        rowKey={truant => truant.id}
                        loading={isLoading}
                        sort={{ key: sort.key, direction: sort.direction }}
                        onSortChange={next => setSort({ key: next.key, direction: next.direction })}
                        onRowClick={truant => setDetail(truant)}
                        mobileTitle={truant => truant.name}
                        mobileSubtitle={truant =>
                            `${truant.className} · пропусков: ${truant.totalAbsences}`
                        }
                        mobileDetailKeys={["reasons"]}
                        emptyTitle="Пропусков за период нет"
                        caption="Ученики с пропусками за период"
                    />
                )}

                <p className="pb-4 text-xs text-fg-subtle">
                    Нажмите на строку, чтобы увидеть даты и причины пропусков.
                </p>
            </main>

            {/* История пропусков ученика */}
            <Modal
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                title={detail?.name ?? "Ученик"}
                description={
                    detail ? `${detail.className} · пропусков: ${detail.totalAbsences}` : undefined
                }
                size="md"
            >
                {detail && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(detail.reasons || {}).map(([reason, count]) => (
                                <Badge key={reason} tone={reasonTone(reason)}>
                                    {reasonLabel(reason)}: {count}
                                </Badge>
                            ))}
                        </div>

                        <List>
                            {[...detail.absences]
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((absence, index) => (
                                    <li key={`${absence.date}-${index}`}>
                                        <ListItem
                                            title={formatDateShortRu(absence.date)}
                                            subtitle={reasonLabel(absence.reason)}
                                            meta={absence.className}
                                            density="compact"
                                        />
                                    </li>
                                ))}
                        </List>
                    </div>
                )}
            </Modal>
        </div>
    );
}

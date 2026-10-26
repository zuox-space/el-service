// app/admin/school-records/page.tsx
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
    EmptyState,
    FormError,
    Input,
    List,
    ListItem,
    PageHeader,
    SearchInput,
    Select,
    Skeleton,
    Tabs,
} from "@/components/ui/kit";
import { addMonths, daysUntil, formatDateRu, safeCell, toLocalISODate } from "@/lib/date";

/**
 * Внутришкольный учёт (ВШУ).
 *
 * Переведено на UI Kit: разделы — segmented tabs, записи — ListItem, период и поиск —
 * поля и чипы, пустые состояния различают «записей нет» и «фильтр ничего не нашёл».
 * Из записи можно перейти в портфолио ученика, чтобы снять или поставить на учёт.
 */

interface SchoolRecord {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    registeredAt: string;
    registeredByName: string;
    reason: string;
    plannedReleaseAt: string | null;
    releasedAt: string | null;
    releasedByName: string | null;
    releaseReason: string | null;
    isActive: boolean;
}

interface Stats {
    total: number;
    active: number;
    released: number;
    expiringIn7Days: number;
    expiringIn14Days: number;
    expiringIn30Days: number;
    overdue: number;
    uniqueClasses: number;
    periodRegistered: number;
    periodReleased: number;
    byClass: Record<string, { active: number; total: number }>;
}

type TabId = "overview" | "active" | "expiring" | "released";

export default function SchoolRecordsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [records, setRecords] = useState<SchoolRecord[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [expiring, setExpiring] = useState<SchoolRecord[]>([]);
    const [overdue, setOverdue] = useState<SchoolRecord[]>([]);
    const [periodRegistered, setPeriodRegistered] = useState<SchoolRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [tab, setTab] = useState<TabId>("overview");
    const [startDate, setStartDate] = useState(() => toLocalISODate(addMonths(new Date(), -3)));
    const [endDate, setEndDate] = useState(() => toLocalISODate());
    const [search, setSearch] = useState("");
    const [className, setClassName] = useState("");
    // На мобильном карточка раскрывается, на десктопе — переход в портфолио
    const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
    }, [session, status, router]);

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/admin/school-records?startDate=${startDate}&endDate=${endDate}`,
            );
            if (!response.ok) {
                throw new Error(`Сервер вернул ошибку ${response.status}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setRecords(Array.isArray(data.records) ? data.records : []);
            setStats(data.stats ?? null);
            setExpiring(Array.isArray(data.expiringIn30Days) ? data.expiringIn30Days : []);
            setOverdue(Array.isArray(data.overdue) ? data.overdue : []);
            setPeriodRegistered(Array.isArray(data.periodRegistered) ? data.periodRegistered : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить записи");
            setRecords([]);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (session) {
            void fetchRecords();
        }
    }, [session, fetchRecords]);

    const classOptions = useMemo(() => {
        const unique = [...new Set(records.map(record => record.className).filter(Boolean))];
        return unique.sort((a, b) => a.localeCompare(b, "ru")).map(value => ({ value, label: value }));
    }, [records]);

    /** Общий фильтр по поиску и классу — применяется во всех вкладках. */
    const filterRecords = useCallback(
        (list: SchoolRecord[]) => {
            const query = search.trim().toLowerCase();

            return list.filter(record => {
                if (className && record.className !== className) return false;
                if (!query) return true;
                return (
                    record.studentName.toLowerCase().includes(query) ||
                    record.className.toLowerCase().includes(query) ||
                    (record.reason ?? "").toLowerCase().includes(query)
                );
            });
        },
        [search, className],
    );

    const activeRecords = useMemo(
        () => filterRecords(records.filter(record => record.isActive)),
        [records, filterRecords],
    );
    const releasedRecords = useMemo(
        () => filterRecords(records.filter(record => !record.isActive)),
        [records, filterRecords],
    );
    const attention = useMemo(
        () =>
            filterRecords(
                [...overdue, ...expiring.filter(item => !overdue.some(overdueItem => overdueItem.id === item.id))],
            ),
        [overdue, expiring, filterRecords],
    );

    const applyPeriod = (months: number) => {
        setStartDate(toLocalISODate(addMonths(new Date(), -months)));
        setEndDate(toLocalISODate());
    };

    const exportToExcel = () => {
        const list = tab === "active" ? activeRecords : tab === "released" ? releasedRecords : attention;

        let html = `<html><head><meta charset="UTF-8"><title>ВШУ</title>
            <style>body{font-family:Arial,sans-serif}h1{font-size:16px}table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f2f2f2}</style></head><body>
            <h1>Внутришкольный учёт</h1><p>Период: ${safeCell(startDate)} — ${safeCell(endDate)}</p>
            <table><tr><th>Ученик</th><th>Класс</th><th>Причина</th><th>Поставлен</th><th>План. снятие</th></tr>`;

        list.forEach(record => {
            html += `<tr><td>${safeCell(record.studentName)}</td><td>${safeCell(record.className)}</td>
                <td>${safeCell(record.reason)}</td><td>${safeCell(formatDateRu(record.registeredAt))}</td>
                <td>${safeCell(record.plannedReleaseAt ? formatDateRu(record.plannedReleaseAt) : "—")}</td></tr>`;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `вшу_${startDate}_${endDate}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="ВШУ" onBack={() => router.push("/admin")} />
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

    if (!session) return null;

    const tabs = [
        { id: "overview", label: "Обзор" },
        { id: "active", label: "На учёте", count: activeRecords.length },
        { id: "expiring", label: "Истекают", count: attention.length },
        { id: "released", label: "Снятые", count: releasedRecords.length },
    ];

    const renderRecord = (record: SchoolRecord, showRelease = false) => {
        const left = record.plannedReleaseAt ? daysUntil(record.plannedReleaseAt) : null;
        const overdueRecord = record.isActive && left !== null && left < 0;

        return (
            <li key={record.id}>
                <ListItem
                    title={record.studentName}
                    subtitle={record.className}
                    meta={
                        showRelease
                            ? `Снят ${formatDateRu(record.releasedAt ?? record.registeredAt)}${
                                record.releaseReason ? ` · ${record.releaseReason}` : ""
                            }`
                            : `Поставлен ${formatDateRu(record.registeredAt)}${
                                record.plannedReleaseAt ? ` · план. снятие ${formatDateRu(record.plannedReleaseAt)}` : ""
                            }`
                    }
                    trailing="badge"
                    trailingContent={
                        showRelease ? (
                            <Badge tone="success">снят</Badge>
                        ) : overdueRecord ? (
                            <Badge tone="danger">просрочено {Math.abs(left ?? 0)} дн.</Badge>
                        ) : left !== null && left <= 30 ? (
                            <Badge tone="warning">{left === 0 ? "снятие сегодня" : `${left} дн.`}</Badge>
                        ) : (
                            <Badge tone="neutral">на учёте</Badge>
                        )
                    }
                    onClick={() => {
                        const mobile =
                            typeof window !== "undefined" &&
                            window.matchMedia("(max-width: 767px)").matches;

                        if (mobile) {
                            setExpandedRecord(current => (current === record.id ? null : record.id));
                            return;
                        }

                        router.push(`/admin/students/${record.studentId}`);
                    }}
                />

                {expandedRecord === record.id && (
                    <div className="space-y-1 border-t border-border bg-surface-2 px-3 py-2.5 text-xs md:hidden">
                        <p className="text-fg-muted">
                            <span className="text-fg-subtle">Причина: </span>
                            {record.reason || "—"}
                        </p>
                        <p className="text-fg-muted">
                            <span className="text-fg-subtle">Поставил: </span>
                            {record.registeredByName || "—"} · {formatDateRu(record.registeredAt)}
                        </p>
                        <p className="text-fg-muted">
                            <span className="text-fg-subtle">План. снятие: </span>
                            {record.plannedReleaseAt ? formatDateRu(record.plannedReleaseAt) : "—"}
                        </p>
                        {showRelease && (
                            <p className="text-fg-muted">
                                <span className="text-fg-subtle">Снят: </span>
                                {formatDateRu(record.releasedAt ?? record.registeredAt)}
                                {record.releaseReason ? ` · ${record.releaseReason}` : ""}
                            </p>
                        )}
                        <Button
                            size="sm"
                            variant="secondary"
                            className="mt-1"
                            onClick={() => router.push(`/admin/students/${record.studentId}`)}
                        >
                            Открыть портфолио
                        </Button>
                    </div>
                )}
            </li>
        );
    };

    const emptyForTab = (title: string, description: string) => (
        <EmptyState
            variant={search || className ? "no-results" : "empty"}
            title={search || className ? "Ничего не найдено" : title}
            description={search || className ? "Измените запрос или сбросьте фильтр класса" : description}
            action={
                search || className
                    ? {
                        label: "Сбросить фильтры",
                        onClick: () => {
                            setSearch("");
                            setClassName("");
                        },
                    }
                    : undefined
            }
        />
    );

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="ВШУ"
                subtitle={`Внутришкольный учёт · на учёте ${stats?.active ?? 0}`}
                onBack={() => router.push("/admin")}
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={RefreshCw}
                            onClick={() => void fetchRecords()}
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
                            disabled={records.length === 0}>
                            Выгрузить
                        </Button>
                        </span>
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {error && <FormError message={error} />}

                <Tabs value={tab} onChange={id => setTab(id as TabId)} items={tabs} ariaLabel="Разделы ВШУ" />

                <Card padding="sm">
                    <div className="grid gap-2 sm:grid-cols-4">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Ученик, класс, причина"
                            label="Поиск"
                        />
                        <Select
                            label="Класс"
                            placeholder="Все классы"
                            value={className}
                            onChange={setClassName}
                            options={classOptions}
                        />
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

                    <div className="mt-3 flex flex-wrap gap-1.5">
                        <Chip onClick={() => applyPeriod(1)}>Месяц</Chip>
                        <Chip onClick={() => applyPeriod(3)}>3 месяца</Chip>
                        <Chip onClick={() => applyPeriod(6)}>6 месяцев</Chip>
                        <Chip onClick={() => applyPeriod(12)}>Год</Chip>
                        {(search || className) && (
                            <Chip
                                onClick={() => {
                                    setSearch("");
                                    setClassName("");
                                }}
                                onRemove={() => {
                                    setSearch("");
                                    setClassName("");
                                }}
                                className="text-danger"
                            >
                                Сбросить фильтры
                            </Chip>
                        )}
                    </div>
                </Card>

                {tab === "overview" && (
                    <>
                        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <StatTile label="Всего записей" value={stats?.total ?? 0} />
                            <StatTile label="На учёте" value={stats?.active ?? 0} />
                            <StatTile label="Снято" value={stats?.released ?? 0} />
                            <StatTile
                                label="Просрочено"
                                value={stats?.overdue ?? 0}
                                hint={`истекают в 30 дней: ${stats?.expiringIn30Days ?? 0}`}
                            />
                        </section>

                        <Card
                            title="Требуют внимания"
                            description="Просроченные и истекающие сроки снятия"
                            padding="none"
                        >
                            {attention.length === 0 ? (
                                <EmptyState
                                    title="Всё под контролем"
                                    description="Нет записей с истекающим или просроченным сроком"
                                    compact
                                />
                            ) : (
                                <List className="rounded-none border-0">
                                    {attention.slice(0, 8).map(record => renderRecord(record))}
                                </List>
                            )}
                        </Card>

                        <Card
                            title="По классам"
                            description={`Постановок за период: ${stats?.periodRegistered ?? 0} · снятий за период: ${stats?.periodReleased ?? 0}`}
                            padding="sm"
                        >
                            {Object.keys(stats?.byClass ?? {}).length === 0 ? (
                                <p className="text-sm text-fg-muted">Записей по классам нет</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(stats?.byClass ?? {})
                                        .sort(([, a], [, b]) => b.active - a.active)
                                        .map(([name, counts]) => (
                                            <Badge key={name} tone={counts.active > 0 ? "warning" : "neutral"}>
                                                {name}: {counts.active} на учёте
                                            </Badge>
                                        ))}
                                </div>
                            )}
                        </Card>

                        <Card title="Постановки за период" padding="none">
                            {periodRegistered.length === 0 ? (
                                <EmptyState
                                    title="Постановок за период нет"
                                    description="Измените период, если нужны более ранние записи"
                                    compact
                                />
                            ) : (
                                <List className="rounded-none border-0">
                                    {filterRecords(periodRegistered)
                                        .slice(0, 10)
                                        .map(record => renderRecord(record, !record.isActive))}
                                </List>
                            )}
                        </Card>
                    </>
                )}

                {tab === "active" &&
                    (activeRecords.length === 0 ? (
                        emptyForTab("На учёте никого нет", "Все записи закрыты")
                    ) : (
                        <List>{activeRecords.map(record => renderRecord(record))}</List>
                    ))}

                {tab === "expiring" &&
                    (attention.length === 0 ? (
                        emptyForTab("Сроки не подходят к концу", "Нет записей с истекающим сроком снятия")
                    ) : (
                        <>
                            {overdue.length > 0 && (
                                <Card
                                    title="Просрочено"
                                    description="Срок снятия прошёл, ученик всё ещё на учёте"
                                    padding="none"
                                >
                                    <List className="rounded-none border-0">
                                        {filterRecords(overdue).map(record => renderRecord(record))}
                                    </List>
                                </Card>
                            )}

                            {expiring.length > 0 && (
                                <Card title="Истекают в ближайшие 30 дней" padding="none">
                                    <List className="rounded-none border-0">
                                        {filterRecords(expiring).map(record => renderRecord(record))}
                                    </List>
                                </Card>
                            )}
                        </>
                    ))}

                {tab === "released" &&
                    (releasedRecords.length === 0 ? (
                        emptyForTab("Снятых записей нет", "Пока никто не снимался с учёта")
                    ) : (
                        <List>{releasedRecords.map(record => renderRecord(record, true))}</List>
                    ))}

                <p className="pb-4 text-xs text-fg-subtle">
                    Нажмите на ученика, чтобы открыть портфолио и поставить на учёт или снять с него.
                </p>
            </main>
        </div>
    );
}

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
    return (
        <div className="rounded-card border border-border bg-surface p-3">
            <p className="text-xs text-fg-subtle">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{value}</p>
            {hint && <p className="text-[11px] text-fg-subtle">{hint}</p>}
        </div>
    );
}

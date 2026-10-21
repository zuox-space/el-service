// app/admin/classes-overview/[className]/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, RefreshCw } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    DataTable,
    EmptyState,
    FormError,
    List,
    ListItem,
    Modal,
    PageHeader,
    SearchInput,
    Skeleton,
    Tabs,
    type Column,
} from "@/components/ui/kit";
import { formatDateRu, safeCell } from "@/lib/date";

/**
 * Карточка класса: у кого есть самовыход и доверенности.
 *
 * Переведено на DataTable + модалку деталей: нажатие на ученика показывает период
 * самовыхода и список доверенных лиц с телефонами. Раньше это разворачивалось
 * внутри строки, и на мобильном список съезжал.
 */

interface Authorization {
    id: string;
    trustedName: string;
    relation: string;
    phone: string | null;
    comment: string | null;
    isActive: boolean;
}

interface SelfExit {
    id: string;
    startDate: string;
    endDate: string;
    reason: string | null;
}

interface StudentRow {
    aisId: string;
    name: string;
    className: string;
    hasActiveSelfExit: boolean;
    activeSelfExit: SelfExit | null;
    selfExitsCount: number;
    hasActiveAuthorization: boolean;
    authorizationsCount: number;
    authorizations: Authorization[];
    totalAuthorizationsCount: number;
}

type FilterId = "all" | "selfExit" | "auth" | "none";

export default function ClassDetailsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();

    const rawClassName = params?.className as string;
    const className = useMemo(() => {
        if (!rawClassName) return "";
        try {
            return /%[0-9A-Fa-f]{2}/.test(rawClassName) ? decodeURIComponent(rawClassName) : rawClassName;
        } catch {
            return rawClassName;
        }
    }, [rawClassName]);

    const [mounted, setMounted] = useState(false);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterId>("all");
    const [detail, setDetail] = useState<StudentRow | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) router.replace("/admin");
        }
    }, [session, status, router]);

    const fetchData = useCallback(async () => {
        if (!className) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/classes-stats/${encodeURIComponent(className)}`);
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setStudents(Array.isArray(data.students) ? data.students : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить класс");
            setStudents([]);
        } finally {
            setIsLoading(false);
        }
    }, [className]);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            void fetchData();
        }
    }, [session, fetchData]);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();

        return students.filter(student => {
            if (query && !student.name.toLowerCase().includes(query)) return false;
            if (filter === "selfExit" && !student.hasActiveSelfExit) return false;
            if (filter === "auth" && !student.hasActiveAuthorization) return false;
            if (filter === "none" && (student.hasActiveSelfExit || student.hasActiveAuthorization)) return false;
            return true;
        });
    }, [students, search, filter]);

    const counts = useMemo(
        () => ({
            all: students.length,
            selfExit: students.filter(student => student.hasActiveSelfExit).length,
            auth: students.filter(student => student.hasActiveAuthorization).length,
            none: students.filter(student => !student.hasActiveSelfExit && !student.hasActiveAuthorization).length,
        }),
        [students],
    );

    const columns: Column<StudentRow>[] = [
        { key: "name", header: "Ученик" },
        {
            key: "selfExit",
            header: "Самовыход",
            width: "160px",
            render: student =>
                student.hasActiveSelfExit && student.activeSelfExit ? (
                    <Badge tone="info">
                        до {formatDateRu(student.activeSelfExit.endDate, { day: "numeric", month: "short" })}
                    </Badge>
                ) : (
                    <span className="text-xs text-fg-subtle">—</span>
                ),
        },
        {
            key: "auth",
            header: "Доверенность",
            width: "170px",
            render: student =>
                student.hasActiveAuthorization ? (
                    <Badge tone="accent">
                        {student.authorizationsCount > 0
                            ? `${student.authorizationsCount} чел.`
                            : "есть"}
                    </Badge>
                ) : (
                    <span className="text-xs text-fg-subtle">—</span>
                ),
        },
    ];

    const exportToExcel = () => {
        let html = `<html><head><meta charset="UTF-8"><title>${safeCell(className)}</title>
            <style>body{font-family:Arial,sans-serif}h1{font-size:16px}table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f2f2f2}</style></head><body>
            <h1>Класс ${safeCell(className)}</h1>
            <table><tr><th>Ученик</th><th>Самовыход</th><th>Доверенные лица</th></tr>`;

        rows.forEach(student => {
            const selfExit = student.activeSelfExit
                ? `${formatDateRu(student.activeSelfExit.startDate)} — ${formatDateRu(student.activeSelfExit.endDate)}`
                : "—";
            const auths =
                student.authorizations
                    ?.map(auth => `${auth.trustedName} (${auth.relation})${auth.phone ? `, ${auth.phone}` : ""}`)
                    .join("; ") || "—";

            html += `<tr><td>${safeCell(student.name)}</td><td>${safeCell(selfExit)}</td>
                <td>${safeCell(auths)}</td></tr>`;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `класс_${className}.xls`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title={className || "Класс"} onBack={() => router.push("/admin/classes-overview")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} height={64} radius="card" />
                        ))}
                    </div>
                    <Skeleton height={220} radius="card" />
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title={className || "Класс"}
                subtitle={`${counts.all} учеников · самовыходы и доверенности`}
                onBack={() => router.push("/admin/classes-overview")}
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
                    <StatTile label="Учеников" value={counts.all} />
                    <StatTile label="С самовыходом" value={counts.selfExit} />
                    <StatTile label="С доверенностью" value={counts.auth} />
                    <StatTile label="Без разрешений" value={counts.none} />
                </section>

                <Card padding="sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Фамилия ученика"
                        label="Поиск"
                    />
                </Card>

                <Tabs
                    value={filter}
                    onChange={id => setFilter(id as FilterId)}
                    ariaLabel="Фильтр по разрешениям"
                    items={[
                        { id: "all", label: "Все", count: counts.all },
                        { id: "selfExit", label: "Самовыход", count: counts.selfExit },
                        { id: "auth", label: "Доверенность", count: counts.auth },
                        { id: "none", label: "Без разрешений", count: counts.none },
                    ]}
                />

                {!isLoading && rows.length === 0 ? (
                    <EmptyState
                        variant={search || filter !== "all" ? "no-results" : "empty"}
                        title={search || filter !== "all" ? "Ученики не найдены" : "В классе нет учеников"}
                        description={
                            search || filter !== "all"
                                ? "Измените запрос или выберите другой фильтр"
                                : "Список класса пуст — проверьте, что класс есть в базе АИС"
                        }
                        action={
                            search || filter !== "all"
                                ? {
                                    label: "Сбросить фильтры",
                                    onClick: () => {
                                        setSearch("");
                                        setFilter("all");
                                    },
                                }
                                : undefined
                        }
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        rows={rows}
                        rowKey={student => student.aisId}
                        loading={isLoading}
                        onRowClick={student => setDetail(student)}
                        mobileTitle={student => student.name}
                        mobileSubtitle={student =>
                            student.hasActiveSelfExit
                                ? "самовыход активен"
                                : student.hasActiveAuthorization
                                    ? "есть доверенность"
                                    : "разрешений нет"
                        }
                        emptyTitle="Ученики не найдены"
                        caption={`Ученики класса ${className}`}
                    />
                )}

                <p className="pb-4 text-xs text-fg-subtle">
                    Нажмите на ученика, чтобы увидеть период самовыхода и доверенных лиц.
                </p>
            </main>

            <Modal
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                title={detail?.name ?? "Ученик"}
                description={detail ? `${detail.className} · ${detail.selfExitsCount} самовыходов за всё время` : undefined}
                size="md"
            >
                {detail && (
                    <div className="space-y-4">
                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Самовыход
                            </p>
                            {detail.activeSelfExit ? (
                                <div className="rounded-control border border-info/30 bg-info-soft px-3 py-2">
                                    <p className="text-sm font-medium text-fg">
                                        {formatDateRu(detail.activeSelfExit.startDate)} —{" "}
                                        {formatDateRu(detail.activeSelfExit.endDate)}
                                    </p>
                                    {detail.activeSelfExit.reason && (
                                        <p className="mt-0.5 text-xs text-fg-muted">{detail.activeSelfExit.reason}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-fg-muted">Активного самовыхода нет</p>
                            )}
                        </div>

                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Доверенные лица
                            </p>
                            {detail.authorizations && detail.authorizations.length > 0 ? (
                                <List>
                                    {detail.authorizations.map(auth => (
                                        <li key={auth.id}>
                                            <ListItem
                                                title={auth.trustedName}
                                                subtitle={auth.relation}
                                                meta={auth.phone ?? undefined}
                                                density="compact"
                                            />
                                        </li>
                                    ))}
                                </List>
                            ) : (
                                <p className="text-sm text-fg-muted">Доверенностей нет</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

function StatTile({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-card border border-border bg-surface p-3">
            <p className="text-xs text-fg-subtle">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{value}</p>
        </div>
    );
}

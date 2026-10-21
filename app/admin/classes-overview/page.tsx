// app/admin/classes-overview/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, RefreshCw } from "lucide-react";
import {
    Button,
    Card,
    Chip,
    DataTable,
    EmptyState,
    FormError,
    PageHeader,
    SearchInput,
    Skeleton,
    type Column,
} from "@/components/ui/kit";
import { safeCell } from "@/lib/date";

/**
 * Обзор классов: самовыходы и доверенности по параллелям 1–4.
 *
 * Переведено на DataTable (таблица на десктопе, карточки на мобильном).
 * Нажатие на класс открывает его карточку со списком учеников.
 */

interface ClassStats {
    classId: string;
    className: string;
    grade: number;
    letter: string;
    ownerId: string;
    totalStudents: number;
    activeSelfExits: number;
    studentsWithSelfExit: number;
    activeAuthorizations: number;
    studentsWithAuth: number;
}

interface Totals {
    totalClasses: number;
    totalStudents: number;
    totalActiveSelfExits: number;
    totalStudentsWithSelfExit: number;
    totalActiveAuthorizations: number;
    totalStudentsWithAuth: number;
}

const GRADES = [1, 2, 3, 4];

export default function ClassesOverviewPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [classes, setClasses] = useState<ClassStats[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [grade, setGrade] = useState<number | null>(null);

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
            const response = await fetch("/api/admin/classes-stats");
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setClasses(Array.isArray(data.classes) ? data.classes : []);
            setTotals(data.totals ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить статистику");
            setClasses([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            void fetchData();
        }
    }, [session, fetchData]);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();

        return classes.filter(cls => {
            if (grade !== null && cls.grade !== grade) return false;
            if (query && !cls.className.toLowerCase().includes(query)) return false;
            return true;
        });
    }, [classes, search, grade]);

    const columns: Column<ClassStats>[] = [
        {
            key: "className",
            header: "Класс",
            width: "110px",
            render: cls => <span className="font-medium">{cls.className}</span>,
        },
        {
            key: "totalStudents",
            header: "Учеников",
            align: "right",
            width: "110px",
            render: cls => <span className="tabular-nums">{cls.totalStudents}</span>,
        },
        {
            key: "activeSelfExits",
            header: "Самовыходы",
            align: "right",
            render: cls => (
                <span className="tabular-nums">
                    {cls.activeSelfExits}
                    <span className="ml-1 text-xs text-fg-subtle">у {cls.studentsWithSelfExit} уч.</span>
                </span>
            ),
        },
        {
            key: "activeAuthorizations",
            header: "Доверенности",
            align: "right",
            render: cls => (
                <span className="tabular-nums">
                    {cls.activeAuthorizations}
                    <span className="ml-1 text-xs text-fg-subtle">у {cls.studentsWithAuth} уч.</span>
                </span>
            ),
        },
    ];

    const exportToExcel = () => {
        let html = `<html><head><meta charset="UTF-8"><title>Обзор классов</title>
            <style>body{font-family:Arial,sans-serif}h1{font-size:16px}table{border-collapse:collapse;width:100%}
            th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f2f2f2}</style></head><body>
            <h1>Самовыходы и доверенности по классам</h1>
            <table><tr><th>Класс</th><th>Учеников</th><th>Самовыходы</th><th>Учеников с самовыходом</th>
            <th>Доверенности</th><th>Учеников с доверенностью</th></tr>`;

        rows.forEach(cls => {
            html += `<tr><td>${safeCell(cls.className)}</td><td>${cls.totalStudents}</td>
                <td>${cls.activeSelfExits}</td><td>${cls.studentsWithSelfExit}</td>
                <td>${cls.activeAuthorizations}</td><td>${cls.studentsWithAuth}</td></tr>`;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "обзор_классов.xls";
        link.click();
        URL.revokeObjectURL(url);
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Обзор классов" onBack={() => router.push("/admin")} />
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

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Обзор классов"
                subtitle="1–4 классы · самовыходы и доверенности"
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
                    <StatTile label="Классов" value={totals?.totalClasses ?? 0} />
                    <StatTile label="Учеников" value={totals?.totalStudents ?? 0} />
                    <StatTile
                        label="Активных самовыходов"
                        value={totals?.totalActiveSelfExits ?? 0}
                        hint={`у ${totals?.totalStudentsWithSelfExit ?? 0} учеников`}
                    />
                    <StatTile
                        label="Активных доверенностей"
                        value={totals?.totalActiveAuthorizations ?? 0}
                        hint={`у ${totals?.totalStudentsWithAuth ?? 0} учеников`}
                    />
                </section>

                <Card padding="sm">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Например, 3А"
                            label="Поиск класса"
                        />
                        <div>
                            <p className="mb-1.5 text-sm font-medium text-fg">Параллель</p>
                            <div className="flex flex-wrap gap-1.5">
                                <Chip selected={grade === null} onClick={() => setGrade(null)}>
                                    Все
                                </Chip>
                                {GRADES.map(value => (
                                    <Chip
                                        key={value}
                                        selected={grade === value}
                                        onClick={() => setGrade(grade === value ? null : value)}
                                    >
                                        {value}
                                    </Chip>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>

                {!isLoading && rows.length === 0 ? (
                    <EmptyState
                        variant={search || grade !== null ? "no-results" : "empty"}
                        title={search || grade !== null ? "Классы не найдены" : "Классов нет"}
                        description={
                            search || grade !== null
                                ? "Измените запрос или выберите другую параллель"
                                : "В системе пока нет классов для 1–4 параллелей"
                        }
                        action={
                            search || grade !== null
                                ? {
                                    label: "Сбросить фильтры",
                                    onClick: () => {
                                        setSearch("");
                                        setGrade(null);
                                    },
                                }
                                : undefined
                        }
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        rows={rows}
                        rowKey={cls => cls.classId}
                        loading={isLoading}
                        onRowClick={cls => router.push(`/admin/classes-overview/${encodeURIComponent(cls.className)}`)}
                        mobileTitle={cls => cls.className}
                        mobileSubtitle={cls => `${cls.totalStudents} учеников`}
                        mobileDetailKeys={["activeSelfExits", "activeAuthorizations"]}
                        emptyTitle="Классов нет"
                        caption="Самовыходы и доверенности по классам"
                    />
                )}

                <p className="pb-4 text-xs text-fg-subtle">
                    Нажмите на класс, чтобы увидеть учеников и их разрешения.
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

// app/admin/classes/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import {
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
    type Column,
} from "@/components/ui/kit";

/**
 * Классы: кто классный руководитель и сколько учеников.
 *
 * Список учеников открывается в модальном окне, а не разворачивается внутри карточки:
 * на мобильном развёрнутый список занимал несколько экранов и уводил остальные классы вниз.
 */

interface Teacher {
    id: string;
    name: string;
    email: string;
}

interface Student {
    id: number;
    name: string;
}

type AttendanceLevel = "excellent" | "good" | "bad" | "veryBad";

interface AttendanceRate {
    markedDays: number;
    schoolDays: number;
    percent: number;
    level: AttendanceLevel;
    since: string;
}

interface SchoolClass {
    id: string;
    name: string;
    grade: number;
    letter: string;
    ownerId: string;
    owner: Teacher | null;
    students?: Student[];
    attendance?: AttendanceRate;
}

const ATTENDANCE_META: Record<AttendanceLevel, { label: string; className: string }> = {
    excellent: { label: "отлично", className: "text-success border-success/60" },
    good: { label: "хорошо", className: "text-info border-info/60" },
    bad: { label: "плохо", className: "text-warning border-warning/60" },
    veryBad: { label: "очень плохо", className: "text-danger border-danger/60" },
};

export default function AdminClassesPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [detail, setDetail] = useState<SchoolClass | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
    }, [session, status, router]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/classes");
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const data = await response.json();
            setClasses(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить классы");
            setClasses([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session) {
            void fetchData();
        }
    }, [session, fetchData]);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return classes;

        return classes.filter(cls => {
            const owner = cls.owner?.name ?? cls.owner?.email ?? "";
            return cls.name.toLowerCase().includes(query) || owner.toLowerCase().includes(query);
        });
    }, [classes, search]);

    const columns: Column<SchoolClass>[] = [
        {
            key: "name",
            header: "Класс",
            width: "120px",
            render: cls => <span className="font-medium">{cls.name}</span>,
        },
        {
            key: "owner",
            header: "Классный руководитель",
            render: cls => (
                <span className={cls.owner ? "text-fg" : "text-fg-subtle"}>
                    {cls.owner?.name || cls.owner?.email?.split("@")[0] || "Не назначен"}
                </span>
            ),
        },
        {
            key: "students",
            header: "Учеников",
            align: "right",
            width: "120px",
            render: cls => <span className="tabular-nums">{cls.students?.length ?? 0}</span>,
        },
        {
            key: "attendance",
            header: "Отметки посещаемости",
            width: "210px",
            render: cls => {
                const rate = cls.attendance;
                const meta = ATTENDANCE_META[rate?.level ?? "veryBad"];

                return (
                    <div className="flex flex-col items-start gap-1">
                        <span
                            className={`inline-flex items-center gap-1 rounded-control border border-dashed px-2 py-0.5 text-xs font-medium tabular-nums ${meta.className}`}
                        >
                            {rate?.percent ?? 0}%
                            <span className="text-[10px] font-normal opacity-80">· {meta.label}</span>
                        </span>
                        <span className="text-[11px] text-fg-subtle">
                            {rate?.markedDays ?? 0} из {rate?.schoolDays ?? 0} учебных дней
                        </span>
                    </div>
                );
            },
        },
    ];

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Классы" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <Skeleton height={240} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Классы"
                subtitle={`Всего классов: ${classes.length}`}
                onBack={() => router.push("/admin")}
                actions={
                    <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={RefreshCw}
                        onClick={() => void fetchData()}
                        disabled={isLoading}
                    >
                        Обновить
                    </Button>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {error && <FormError message={error} />}

                <Card padding="sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Класс или учитель"
                        label="Поиск"
                    />
                </Card>

                {!isLoading && rows.length === 0 ? (
                    <EmptyState
                        variant={search ? "no-results" : "empty"}
                        title={search ? "Классы не найдены" : "Классов нет"}
                        description={
                            search
                                ? "Измените запрос — ищем и по названию класса, и по учителю"
                                : "В системе пока не создано ни одного класса"
                        }
                        action={
                            search
                                ? {
                                    label: "Сбросить поиск",
                                    onClick: () => setSearch(""),
                                }
                                : undefined
                        }
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        rows={rows}
                        rowKey={cls => cls.id}
                        loading={isLoading}
                        onRowClick={cls => setDetail(cls)}
                        mobileTitle={cls => cls.name}
                        mobileSubtitle={cls =>
                            `${cls.owner?.name || "Не назначен"} · ${cls.students?.length ?? 0} учеников`
                        }
                        emptyTitle="Классов нет"
                        caption="Классы и классные руководители"
                    />
                )}

                <p className="pb-4 text-xs text-fg-subtle">
                    Отметки посещаемости считаются с 1 сентября учебного года: дни, когда класс отмечен,
                    делятся на число учебных дней (пн–пт). Нажмите на класс, чтобы посмотреть список учеников.
                </p>
            </main>

            <Modal
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                title={detail?.name ?? "Класс"}
                description={
                    detail
                        ? `${detail.owner?.name || "Классный руководитель не назначен"} · учеников: ${detail.students?.length ?? 0}`
                        : undefined
                }
                size="md"
            >
                {detail &&
                    (detail.students && detail.students.length > 0 ? (
                        <List>
                            {detail.students.map(student => (
                                <li key={student.id}>
                                    <ListItem
                                        title={student.name}
                                        meta={`ID: ${student.id}`}
                                        density="compact"
                                    />
                                </li>
                            ))}
                        </List>
                    ) : (
                        <EmptyState
                            title="В классе нет учеников"
                            description="Проверьте, что класс заполнен в базе АИС"
                            compact
                        />
                    ))}
            </Modal>
        </div>
    );
}

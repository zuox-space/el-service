"use client";

// app/admin/classes/[id]/page.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    AlertTriangle,
    ArrowLeft,
    CalendarCheck,
    CheckCircle2,
    Clock3,
    Percent,
    RefreshCw,
    Shirt,
    ShieldAlert,
    UserRound,
    Users,
} from "lucide-react";
import {
    Badge,
    Button,
    Card,
    EmptyState,
    FormError,
    Input,
    PageHeader,
    Skeleton,
} from "@/components/ui/kit";
import {
    addMonths,
    formatDateRu,
    formatDateShortRu,
    getAcademicYearStart,
    toLocalISODate,
} from "@/lib/date";
import { getViolationType } from "@/lib/violations";

interface Teacher {
    id: string;
    name: string;
    email: string;
}

interface ClassStats {
    classInfo: {
        id: string;
        name: string;
        grade: number;
        letter: string;
        building: { id: string; name: string } | null;
        owner: Teacher | null;
        sharedTeachers: Teacher[];
    };
    period: { from: string; to: string };
    students: Array<{ id: string; name: string }>;
    summary: {
        studentCount: number;
        markedDays: number;
        schoolDays: number;
        attendancePercent: number;
        attendanceLevel: "excellent" | "good" | "bad" | "veryBad";
        presentCount: number;
        absentCount: number;
        lastMarkedAt: string | null;
        violationsTotal: number;
        violationsResolved: number;
        violationsUnresolved: number;
        resolutionPercent: number;
        uniformCount: number;
        activeSchoolRecords: number;
    };
    attendance: {
        daily: Array<{ date: string; present: number; absent: number; marked: boolean }>;
        reasons: Array<{ reason: string; count: number }>;
    };
    violations: {
        byType: Array<{ type: string; count: number }>;
        byMonth: Array<{ month: string; count: number }>;
        topStudents: Array<{ id: string; name: string; count: number }>;
        recent: Array<{
            id: string;
            studentId: string;
            studentName: string;
            violationType: string;
            date: string;
            resolvedAt: string | null;
            resolvedByName: string | null;
            teacherName: string;
        }>;
    };
    uniform: {
        total: number;
        byMonth: Array<{ month: string; count: number }>;
    };
    truants: Array<{ id: string; name: string; count: number }>;
}

const LEVEL_LABEL = {
    excellent: "отлично",
    good: "хорошо",
    bad: "плохо",
    veryBad: "очень плохо",
} as const;

const LEVEL_TONE = {
    excellent: "border-success/50 text-success",
    good: "border-info/50 text-info",
    bad: "border-warning/50 text-warning",
    veryBad: "border-danger/50 text-danger",
} as const;

const REASON_LABEL: Record<string, string> = {
    sick: "Болен",
    family: "По заявлению родителей",
    vacation: "В отпуске",
    competition: "Соревнования",
    other: "Причина неясна",
    unknown: "Причина не указана",
};

function monthLabel(value: string): string {
    const [year, month] = value.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("ru-RU", {
        month: "short",
        year: "2-digit",
    });
}

function shortDate(value: string): string {
    return formatDateShortRu(value);
}

export default function ClassStatsPage() {
    const params = useParams();
    const router = useRouter();
    const { status } = useSession();
    const classId = String(params?.id ?? "");

    const [from, setFrom] = useState(() => toLocalISODate(getAcademicYearStart()));
    const [to, setTo] = useState(() => toLocalISODate());
    const [stats, setStats] = useState<ClassStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/login");
    }, [status, router]);

    const load = useCallback(async () => {
        if (!classId) return;
        setLoading(true);
        setError(null);

        try {
            const search = new URLSearchParams({ from, to });
            const response = await fetch(
                `/api/admin/classes/${encodeURIComponent(classId)}/stats?${search.toString()}`,
                { cache: "no-store" },
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || `Сервер вернул ошибку ${response.status}`);
            setStats(data as ClassStats);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить статистику");
            setStats(null);
        } finally {
            setLoading(false);
        }
    }, [classId, from, to]);

    useEffect(() => {
        if (status === "authenticated") void load();
    }, [status, load]);

    const setAcademicYear = () => {
        setFrom(toLocalISODate(getAcademicYearStart()));
        setTo(toLocalISODate());
    };

    const setLastMonth = () => {
        const today = new Date();
        setFrom(toLocalISODate(addMonths(today, -1)));
        setTo(toLocalISODate(today));
    };

    const setToday = () => {
        const today = toLocalISODate();
        setFrom(today);
        setTo(today);
    };

    const periodLabel = useMemo(() => {
        if (!stats) return "";
        return `${formatDateRu(stats.period.from)} — ${formatDateRu(stats.period.to)}`;
    }, [stats]);

    if (status === "loading" || (loading && !stats)) {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Статистика класса" onBack={() => router.push("/admin/classes")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={120} radius="card" />
                    <Skeleton height={260} radius="card" />
                    <Skeleton height={220} radius="card" />
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Статистика класса" onBack={() => router.push("/admin/classes")} />
                <main className="mx-auto w-full max-w-[1440px] px-4 py-4">
                    <FormError message={error || "Класс не найден"} />
                    <Button className="mt-3" size="sm" leftIcon={ArrowLeft} onClick={() => router.push("/admin/classes")}>
                        К списку классов
                    </Button>
                </main>
            </div>
        );
    }

    const { classInfo, summary } = stats;
    const teacher = classInfo.owner;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title={`Класс ${classInfo.name}`}
                subtitle={`${classInfo.building?.name || "Здание не указано"} · ${summary.studentCount} учеников`}
                onBack={() => router.push("/admin/classes")}
                actions={
                    <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={RefreshCw}
                        loading={loading}
                        onClick={() => void load()}
                    >
                        Обновить
                    </Button>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                <Card padding="sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Input
                            type="date"
                            label="С"
                            value={from}
                            onChange={event => setFrom(event.target.value)}
                            wrapperClassName="w-full sm:w-40"
                        />
                        <Input
                            type="date"
                            label="По"
                            value={to}
                            onChange={event => setTo(event.target.value)}
                            wrapperClassName="w-full sm:w-40"
                        />
                        <div className="flex flex-wrap gap-1.5 pb-0.5">
                            <Button size="sm" variant={from === toLocalISODate(getAcademicYearStart()) ? "primary" : "secondary"} onClick={setAcademicYear}>
                                Учебный год
                            </Button>
                            <Button size="sm" variant="secondary" onClick={setLastMonth}>
                                Месяц
                            </Button>
                            <Button size="sm" variant="secondary" onClick={setToday}>
                                Сегодня
                            </Button>
                        </div>
                        <span className="text-xs text-fg-subtle sm:ml-auto">{periodLabel}</span>
                    </div>
                </Card>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                    <SummaryTile
                        icon={Percent}
                        label="Отметки посещаемости"
                        value={`${summary.attendancePercent}%`}
                        hint={`${summary.markedDays} из ${summary.schoolDays} дней`}
                        tone={LEVEL_TONE[summary.attendanceLevel]}
                    />
                    <SummaryTile
                        icon={Users}
                        label="Учеников"
                        value={String(summary.studentCount)}
                        hint="в классе"
                    />
                    <SummaryTile
                        icon={CalendarCheck}
                        label="Пропусков"
                        value={String(summary.absentCount)}
                        hint={`присутствий: ${summary.presentCount}`}
                        tone="text-info"
                    />
                    <SummaryTile
                        icon={AlertTriangle}
                        label="Нарушений"
                        value={String(summary.violationsTotal)}
                        hint={`не отработано: ${summary.violationsUnresolved}`}
                        tone="text-warning"
                    />
                    <SummaryTile
                        icon={Shirt}
                        label="По форме"
                        value={String(summary.uniformCount)}
                        hint={`ВШУ: ${summary.activeSchoolRecords}`}
                        tone="text-warning"
                    />
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.1fr_1.9fr]">
                    <Card title="Классный руководитель" description="Кто ведёт класс">
                        {teacher ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                        <UserRound size={18} aria-hidden />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-fg">{teacher.name}</p>
                                        <p className="truncate text-xs text-fg-muted">{teacher.email}</p>
                                    </div>
                                </div>
                                <div className="rounded-control border border-dashed border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
                                    Отметки: <span className="font-medium text-fg">{summary.markedDays}</span> из{" "}
                                    {summary.schoolDays} учебных дней ·{" "}
                                    <span className="font-medium text-fg">{summary.attendancePercent}%</span>
                                    {summary.lastMarkedAt ? (
                                        <> · последняя {formatDateRu(summary.lastMarkedAt)}</>
                                    ) : (
                                        <> · отметок ещё не было</>
                                    )}
                                </div>
                                {classInfo.sharedTeachers.length > 0 && (
                                    <p className="text-xs text-fg-subtle">
                                        Также с классом работают: {classInfo.sharedTeachers.map(item => item.name).join(", ")}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-fg-muted">Классный руководитель не назначен.</p>
                        )}
                    </Card>

                    <Card title="Посещаемость" description="Отметки класса и пропуски по дням">
                        {stats.attendance.daily.length === 0 ? (
                            <EmptyState
                                icon={CalendarCheck}
                                title="Отметок за период нет"
                                description="Классный руководитель ещё не отмечал присутствие"
                                compact
                            />
                        ) : (
                            <>
                                <DailyBars items={stats.attendance.daily} />
                                <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
                                    {stats.attendance.reasons.map(item => (
                                        <Badge key={item.reason} tone="neutral">
                                            {REASON_LABEL[item.reason] ?? item.reason}: {item.count}
                                        </Badge>
                                    ))}
                                </div>
                            </>
                        )}
                    </Card>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                    <Card title="Нарушения" description="По типам за период">
                        {stats.violations.byType.length === 0 ? (
                            <EmptyState icon={AlertTriangle} title="Нарушений нет" compact />
                        ) : (
                            <div className="space-y-2">
                                {stats.violations.byType.map(item => {
                                    const type = getViolationType(item.type);
                                    const max = Math.max(...stats.violations.byType.map(row => row.count), 1);
                                    return (
                                        <div key={item.type} className="flex items-center gap-2">
                                            <type.Icon size={15} className={`shrink-0 ${type.color}`} aria-hidden />
                                            <span className="w-32 shrink-0 truncate text-xs text-fg-muted">{type.shortLabel}</span>
                                            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                                                <div
                                                    className="h-full rounded-full bg-warning"
                                                    style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="w-7 text-right text-xs tabular-nums text-fg">{item.count}</span>
                                        </div>
                                    );
                                })}
                                {stats.violations.byMonth.length > 0 && (
                                    <div className="mt-3 border-t border-border pt-2">
                                        <p className="mb-1 text-[11px] text-fg-subtle">По месяцам</p>
                                        <MonthlyBars items={stats.violations.byMonth} />
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    <Card title="Отработка нарушений" description="Сколько замечаний закрыто">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-3xl font-semibold tabular-nums text-fg">{summary.resolutionPercent}%</p>
                                <p className="text-xs text-fg-muted">
                                    отработано {summary.violationsResolved} из {summary.violationsTotal}
                                </p>
                            </div>
                            <Badge tone={summary.violationsUnresolved > 0 ? "warning" : "success"}>
                                {summary.violationsUnresolved} в работе
                            </Badge>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                            <div
                                className="h-full rounded-full bg-success"
                                style={{ width: `${summary.resolutionPercent}%` }}
                            />
                        </div>
                        {stats.violations.recent.length === 0 ? (
                            <p className="mt-3 text-xs text-fg-subtle">Записей нет</p>
                        ) : (
                            <ul className="mt-3 divide-y divide-border rounded-card border border-border">
                                {stats.violations.recent.slice(0, 5).map(item => (
                                    <li key={item.id} className="flex items-center gap-2 px-2.5 py-2">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-xs text-fg">{item.studentName}</span>
                                            <span className="block text-[11px] text-fg-subtle">
                                                {formatDateRu(item.date)} · {getViolationType(item.violationType).shortLabel}
                                            </span>
                                        </span>
                                        {item.resolvedAt ? (
                                            <CheckCircle2 size={15} className="shrink-0 text-success" aria-label="Отработано" />
                                        ) : (
                                            <Clock3 size={15} className="shrink-0 text-warning" aria-label="Не отработано" />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                    <Card title="Пропуски по ученикам" description="Кто чаще отсутствовал за период">
                        {stats.truants.length === 0 ? (
                            <EmptyState icon={Users} title="Пропусков нет" compact />
                        ) : (
                            <ul className="divide-y divide-border rounded-card border border-border">
                                {stats.truants.map(item => (
                                    <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                                        <span className="min-w-0 flex-1 truncate text-sm text-fg">{item.name}</span>
                                        <Badge tone="warning">{item.count} дн.</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card title="Нарушения по ученикам" description="У кого больше замечаний">
                        {stats.violations.topStudents.length === 0 ? (
                            <EmptyState icon={AlertTriangle} title="Нарушений нет" compact />
                        ) : (
                            <ul className="divide-y divide-border rounded-card border border-border">
                                {stats.violations.topStudents.map(item => (
                                    <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                                        <span className="min-w-0 flex-1 truncate text-sm text-fg">{item.name}</span>
                                        <Badge tone="warning">{item.count}</Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card title="Нарушения по форме" description="Динамика по месяцам">
                        {stats.uniform.total === 0 ? (
                            <EmptyState icon={Shirt} title="Нарушений формы нет" compact />
                        ) : (
                            <MonthlyBars items={stats.uniform.byMonth} />
                        )}
                    </Card>
                </div>

                <Card title="Ученики класса" description={`${stats.students.length} человек`}>
                    {stats.students.length === 0 ? (
                        <EmptyState icon={Users} title="В классе нет учеников" compact />
                    ) : (
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                            {stats.students.map(student => (
                                <Link
                                    key={student.id}
                                    href={`/admin/students/${student.id}`}
                                    className="flex items-center justify-between gap-2 rounded-control border border-border px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-hover"
                                >
                                    <span className="truncate">{student.name}</span>
                                    <ShieldAlert size={14} className="shrink-0 text-fg-subtle" aria-hidden />
                                </Link>
                            ))}
                        </div>
                    )}
                </Card>
            </main>
        </div>
    );
}

function SummaryTile({
    icon: Icon,
    label,
    value,
    hint,
    tone = "text-fg",
}: {
    icon: typeof Percent;
    label: string;
    value: string;
    hint: string;
    tone?: string;
}) {
    return (
        <Card padding="sm" className={tone.includes("border-") ? `border ${tone}` : undefined}>
            <div className="flex items-start gap-2">
                <Icon size={16} className="mt-0.5 shrink-0 opacity-70" aria-hidden />
                <div className="min-w-0">
                    <p className="text-[11px] text-fg-subtle">{label}</p>
                    <p className={`text-xl font-semibold tabular-nums ${tone.startsWith("text-") ? tone : "text-fg"}`}>
                        {value}
                    </p>
                    <p className="truncate text-[10px] text-fg-subtle">{hint}</p>
                </div>
            </div>
        </Card>
    );
}

function DailyBars({ items }: { items: ClassStats["attendance"]["daily"] }) {
    const max = Math.max(1, ...items.map(item => item.absent));

    return (
        <div className="overflow-x-auto">
            <div className="flex h-36 min-w-[420px] items-end gap-1">
                {items.map(item => (
                    <div key={item.date} className="flex min-w-3 flex-1 flex-col items-center gap-1" title={`${shortDate(item.date)}: отсутствовали ${item.absent}`}>
                        <div className="flex h-28 w-full items-end justify-center">
                            <div
                                className={`w-full max-w-4 rounded-t bg-warning ${item.absent > 0 ? "" : "bg-success"}`}
                                style={{ height: `${Math.max(3, (item.absent / max) * 100)}%` }}
                            />
                        </div>
                        <span className="origin-left rotate-45 whitespace-nowrap text-[8px] text-fg-subtle">
                            {shortDate(item.date)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MonthlyBars({ items }: { items: Array<{ month: string; count: number }> }) {
    const max = Math.max(1, ...items.map(item => item.count));
    return (
        <div className="flex h-32 items-end gap-2">
            {items.map(item => (
                <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end justify-center">
                        <div
                            className="w-full max-w-8 rounded-t bg-warning"
                            style={{ height: `${Math.max(4, (item.count / max) * 100)}%` }}
                            title={`${monthLabel(item.month)}: ${item.count}`}
                        />
                    </div>
                    <span className="truncate text-[9px] text-fg-subtle">{monthLabel(item.month)}</span>
                    <span className="text-[10px] tabular-nums text-fg">{item.count}</span>
                </div>
            ))}
        </div>
    );
}

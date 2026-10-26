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
    ChevronDown,
    ChevronUp,
    Clock3,
    ExternalLink,
    MoreHorizontal,
    Percent,
    RefreshCw,
    Shirt,
    ShieldAlert,
    UserRound,
    Users,
    UserX,
} from "lucide-react";
import {
    Badge,
    Button,
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

interface ViolationMonth {
    month: string;
    count: number;
    resolved: number;
    unresolved: number;
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
        daily: Array<{
            date: string;
            present: number;
            absent: number;
            marked: boolean;
            reasons?: Record<string, number>;
        }>;
        reasons: Array<{ reason: string; count: number }>;
    };
    violations: {
        byType: Array<{ type: string; count: number; resolved: number; unresolved: number }>;
        byMonth: ViolationMonth[];
        byTypeMonth: Array<{ type: string } & ViolationMonth>;
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

type ResolutionFilter = "all" | "resolved" | "unresolved";

const LEVEL_LABEL = {
    excellent: "отлично",
    good: "хорошо",
    bad: "плохо",
    veryBad: "очень плохо",
} as const;

const LEVEL_TONE = {
    excellent: "text-success",
    good: "text-info",
    bad: "text-warning",
    veryBad: "text-danger",
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
    const [selectedType, setSelectedType] = useState("all");
    const [selectedReason, setSelectedReason] = useState("all");
    const [resolutionFilter, setResolutionFilter] = useState<ResolutionFilter>("all");
    const [showAllResolutions, setShowAllResolutions] = useState(false);

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

    const selectedMonthData = useMemo<ViolationMonth[]>(() => {
        if (!stats) return [];
        if (selectedType === "all") return stats.violations.byMonth;
        return stats.violations.byTypeMonth.filter(item => item.type === selectedType);
    }, [stats, selectedType]);

    const filteredResolutions = useMemo(() => {
        if (!stats) return [];
        return stats.violations.recent.filter(item => {
            if (resolutionFilter === "resolved") return Boolean(item.resolvedAt);
            if (resolutionFilter === "unresolved") return !item.resolvedAt;
            return true;
        });
    }, [stats, resolutionFilter]);

    const visibleResolutions = showAllResolutions ? filteredResolutions : filteredResolutions.slice(0, 5);
    const allResolved = stats?.summary.violationsResolved ?? 0;
    const allTotal = stats?.summary.violationsTotal ?? 0;

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
                <div className="rounded-card border border-border bg-surface p-3">
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
                            <Button size="sm" variant="secondary" onClick={setAcademicYear}>
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
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                    <SummaryTile icon={Users} label="Учеников" value={String(summary.studentCount)} hint="в классе" />
                    <SummaryTile
                        icon={AlertTriangle}
                        label="Нарушений"
                        value={String(summary.violationsTotal)}
                        hint={`не отработано: ${summary.violationsUnresolved}`}
                        tone="text-warning"
                    />
                    <SummaryTile
                        icon={ShieldAlert}
                        label="ВШУ"
                        value={String(summary.activeSchoolRecords)}
                        hint="активных записей"
                        tone="text-fg-muted"
                    />
                </div>

                <CollapsibleSection
                    title="Классный руководитель"
                    description="Кто ведёт класс и как отмечает работу"
                    badge={teacher ? teacher.name : "Не назначен"}
                >
                    {teacher ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="flex h-10 w-10 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                    <UserRound size={18} aria-hidden />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-fg">{teacher.name}</p>
                                    <p className="truncate text-xs text-fg-muted">{teacher.email}</p>
                                </div>
                            </div>
                            <ProgressLine
                                label="Посещаемость"
                                percent={summary.attendancePercent}
                                value={`${summary.attendancePercent}%`}
                                hint={`${summary.markedDays} из ${summary.schoolDays} учебных дней`}
                                tone={LEVEL_TONE[summary.attendanceLevel]}
                            />
                            <ProgressLine
                                label="Отработка нарушений"
                                percent={summary.resolutionPercent}
                                value={`${summary.resolutionPercent}%`}
                                hint={`${allResolved} из ${allTotal} нарушений`}
                                tone={summary.violationsUnresolved > 0 ? "text-warning" : "text-success"}
                            />
                            <p className="text-xs text-fg-subtle">
                                {summary.lastMarkedAt
                                    ? `Последняя отметка: ${formatDateRu(summary.lastMarkedAt)}`
                                    : "Отметок посещаемости ещё не было"}
                                {classInfo.sharedTeachers.length > 0
                                    ? ` · Также с классом: ${classInfo.sharedTeachers.map(item => item.name).join(", ")}`
                                    : ""}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-fg-muted">Классный руководитель не назначен.</p>
                    )}
                </CollapsibleSection>

                <CollapsibleSection
                    title="Посещаемость"
                    description="Отметки класса, пропуски и причины"
                    badge={`${summary.attendancePercent}%`}
                >
                    {stats.attendance.daily.length === 0 ? (
                        <EmptyState
                            icon={CalendarCheck}
                            title="Отметок за период нет"
                            description="Классный руководитель ещё не отмечал присутствие"
                            compact
                        />
                    ) : (
                        <div className="space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                                <FilterButton
                                    active={selectedReason === "all"}
                                    onClick={() => setSelectedReason("all")}
                                >
                                    Все причины · {summary.absentCount}
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
                            <DailyBars
                                items={stats.attendance.daily}
                                selectedReason={selectedReason}
                            />
                        </div>
                    )}
                </CollapsibleSection>

                <CollapsibleSection
                    title="Нарушения"
                    description="Динамика по типам и месяцам"
                    badge={`${summary.violationsTotal} всего`}
                >
                    {stats.violations.byType.length === 0 ? (
                        <EmptyState icon={AlertTriangle} title="Нарушений нет" compact />
                    ) : (
                        <div className="space-y-3">
                            <div className="overflow-hidden rounded-card border border-border">
                                <button
                                    type="button"
                                    onClick={() => setSelectedType("all")}
                                    className={`flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm ${
                                        selectedType === "all" ? "bg-accent-soft/60" : "hover:bg-surface-hover"
                                    }`}
                                >
                                    <span className="flex-1 font-medium text-fg">Все нарушения</span>
                                    <span className="text-xs tabular-nums text-fg-muted">{summary.violationsTotal}</span>
                                    <span className="text-xs text-success">{allResolved} готово</span>
                                    <span className="text-xs text-warning">{summary.violationsUnresolved} в работе</span>
                                </button>
                                {stats.violations.byType.map(item => {
                                    const type = getViolationType(item.type);
                                    return (
                                        <button
                                            key={item.type}
                                            type="button"
                                            onClick={() => setSelectedType(item.type)}
                                            className={`flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 ${
                                                selectedType === item.type ? "bg-accent-soft/60" : "hover:bg-surface-hover"
                                            }`}
                                        >
                                            <type.Icon size={15} className={`shrink-0 ${type.color}`} aria-hidden />
                                            <span className="flex-1 truncate text-fg-muted">{type.shortLabel}</span>
                                            <span className="text-xs tabular-nums text-fg">{item.count}</span>
                                            <span className="text-[11px] text-success">{item.resolved}</span>
                                            <span className="text-[11px] text-warning">{item.unresolved}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <ViolationChart items={selectedMonthData} />
                        </div>
                    )}
                </CollapsibleSection>

                <CollapsibleSection
                    title="Отработка нарушений"
                    description="Закрытые и открытые замечания"
                    badge={`${summary.violationsResolved} из ${summary.violationsTotal}`}
                >
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                            {([
                                ["all", "Все"],
                                ["resolved", "Отработаны"],
                                ["unresolved", "Не отработаны"],
                            ] as const).map(([value, label]) => (
                                <FilterButton
                                    key={value}
                                    active={resolutionFilter === value}
                                    onClick={() => {
                                        setResolutionFilter(value);
                                        setShowAllResolutions(false);
                                    }}
                                >
                                    {label}
                                </FilterButton>
                            ))}
                        </div>

                        {filteredResolutions.length === 0 ? (
                            <EmptyState icon={CheckCircle2} title="Записей нет" compact />
                        ) : (
                            <>
                                <ul className="divide-y divide-border rounded-card border border-border">
                                    {visibleResolutions.map(item => (
                                        <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm text-fg">{item.studentName}</span>
                                                <span className="block text-[11px] text-fg-subtle">
                                                    {formatDateRu(item.date)} · {getViolationType(item.violationType).shortLabel}
                                                </span>
                                            </span>
                                            {item.resolvedAt ? (
                                                <Badge tone="success">отработано</Badge>
                                            ) : (
                                                <Badge tone="warning">в работе</Badge>
                                            )}
                                            <StudentMenu studentId={item.studentId} />
                                        </li>
                                    ))}
                                </ul>
                                {filteredResolutions.length > 5 && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        leftIcon={showAllResolutions ? ChevronUp : ChevronDown}
                                        onClick={() => setShowAllResolutions(value => !value)}
                                    >
                                        {showAllResolutions
                                            ? "Свернуть"
                                            : `Показать все · ${filteredResolutions.length}`}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </CollapsibleSection>

                <CollapsibleSection
                    title="Пропуски по ученикам"
                    description="Кто чаще отсутствовал за период"
                    badge={`${stats.truants.length} учеников`}
                >
                    {stats.truants.length === 0 ? (
                        <EmptyState icon={Users} title="Пропусков нет" compact />
                    ) : (
                        <ul className="divide-y divide-border rounded-card border border-border">
                            {stats.truants.map(item => (
                                <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{item.name}</span>
                                    <Badge tone="warning">{item.count} дн.</Badge>
                                    <StudentMenu studentId={item.id} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CollapsibleSection>

                <CollapsibleSection
                    title="Нарушения по ученикам"
                    description="У кого больше замечаний"
                    badge={`${stats.violations.topStudents.length} учеников`}
                >
                    {stats.violations.topStudents.length === 0 ? (
                        <EmptyState icon={UserX} title="Нарушений нет" compact />
                    ) : (
                        <ul className="divide-y divide-border rounded-card border border-border">
                            {stats.violations.topStudents.map(item => (
                                <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{item.name}</span>
                                    <Badge tone="warning">{item.count}</Badge>
                                    <StudentMenu studentId={item.id} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CollapsibleSection>

                <CollapsibleSection
                    title="Ученики класса"
                    description={`${stats.students.length} человек`}
                    badge={`${classInfo.name}`}
                >
                    {stats.students.length === 0 ? (
                        <EmptyState icon={Users} title="В классе нет учеников" compact />
                    ) : (
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                            {stats.students.map(student => (
                                <div
                                    key={student.id}
                                    className="flex items-center justify-between gap-2 rounded-control border border-border px-3 py-2 text-sm text-fg"
                                >
                                    <span className="truncate">{student.name}</span>
                                    <StudentMenu studentId={student.id} />
                                </div>
                            ))}
                        </div>
                    )}
                </CollapsibleSection>
            </main>
        </div>
    );
}

function CollapsibleSection({
    title,
    description,
    badge,
    children,
    defaultOpen = true,
}: {
    title: string;
    description: string;
    badge?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    return (
        <details open={defaultOpen} className="group rounded-card border border-border bg-surface shadow-card">
            <summary className="flex list-none cursor-pointer items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-fg">{title}</p>
                    <p className="truncate text-xs text-fg-muted">{description}</p>
                </div>
                {badge && <Badge tone="neutral">{badge}</Badge>}
                <ChevronDown
                    size={18}
                    className="shrink-0 text-fg-subtle transition-transform group-open:rotate-180"
                    aria-hidden
                />
            </summary>
            <div className="border-t border-border p-3">{children}</div>
        </details>
    );
}

function ProgressLine({
    label,
    value,
    hint,
    percent,
    tone,
}: {
    label: string;
    value: string;
    hint: string;
    percent: number;
    tone: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-fg-muted">{label}</span>
                <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-current opacity-70" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>
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
        <div className="rounded-card border border-border bg-surface px-3 py-2 shadow-card">
            <div className="flex items-start gap-2">
                <Icon size={16} className="mt-0.5 shrink-0 text-fg-subtle" aria-hidden />
                <div className="min-w-0">
                    <p className="text-[11px] text-fg-subtle">{label}</p>
                    <p className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
                    <p className="truncate text-[10px] text-fg-subtle">{hint}</p>
                </div>
            </div>
        </div>
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

function DailyBars({
    items,
    selectedReason,
}: {
    items: ClassStats["attendance"]["daily"];
    selectedReason: string;
}) {
    const values = items.map(item => ({
        ...item,
        value: selectedReason === "all" ? item.absent : item.reasons?.[selectedReason] ?? 0,
    }));
    const max = Math.max(1, ...values.map(item => item.value));

    return (
        <div className="overflow-x-auto">
            <div className="flex h-36 min-w-[420px] items-end gap-1">
                {values.map(item => (
                    <div
                        key={item.date}
                        className="flex min-w-3 flex-1 flex-col items-center gap-1"
                        title={
                            item.marked
                                ? `${formatDateShortRu(item.date)}: ${item.value}`
                                : `${formatDateShortRu(item.date)}: нет отметки`
                        }
                    >
                        <div className="flex h-28 w-full flex-col items-center justify-end gap-0.5">
                            <span className="text-[9px] tabular-nums text-fg-subtle">
                                {item.marked ? item.value : "—"}
                            </span>
                            {!item.marked ? (
                                <div className="h-24 w-full max-w-4 rounded-t border border-danger/40 bg-danger/25" />
                            ) : (
                                <div
                                    className={`w-full max-w-4 rounded-t ${item.value > 0 ? "bg-warning" : "bg-success/60"}`}
                                    style={{ height: `${Math.max(3, (item.value / max) * 100)}%` }}
                                />
                            )}
                        </div>
                        <span className="origin-left rotate-45 whitespace-nowrap text-[8px] text-fg-subtle">
                            {formatDateShortRu(item.date)}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-fg-muted">
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-warning" /> пропуски
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-success/60" /> отмечено без пропусков
                </span>
                <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-danger/50" /> нет отметки
                </span>
            </div>
        </div>
    );
}

function ViolationChart({ items }: { items: ViolationMonth[] }) {
    if (items.length === 0) {
        return <EmptyState icon={AlertTriangle} title="Нет данных за период" compact />;
    }

    const max = Math.max(1, ...items.map(item => item.count));

    return (
        <div>
            <div className="flex h-40 items-end gap-2 overflow-x-auto">
                {items.map(item => {
                    const resolvedPercent = item.count > 0 ? (item.resolved / item.count) * 100 : 0;
                    return (
                        <div key={item.month} className="flex min-w-10 flex-1 flex-col items-center gap-1" title={`${monthLabel(item.month)}: отработано ${item.resolved}, не отработано ${item.unresolved}`}>
                            <span className="text-[10px] font-medium tabular-nums text-fg">{item.count}</span>
                            <div className="flex h-28 w-full max-w-10 flex-col-reverse overflow-hidden rounded-t bg-surface-2">
                                <div className="w-full bg-warning" style={{ height: `${(item.unresolved / max) * 100}%` }} />
                                <div className="w-full bg-success" style={{ height: `${(item.resolved / max) * 100}%` }} />
                            </div>
                            <span className="text-[9px] text-fg-subtle">{monthLabel(item.month)}</span>
                            <span className="text-[9px] tabular-nums text-success">{Math.round(resolvedPercent)}%</span>
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 flex gap-3 text-[11px] text-fg-muted">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" /> отработано</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> в работе</span>
            </div>
        </div>
    );
}

function StudentMenu({ studentId }: { studentId: string }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                aria-label="Действия с учеником"
                title="Действия с учеником"
                className="flex h-7 w-7 items-center justify-center rounded-control text-fg-subtle hover:bg-surface-hover hover:text-fg"
            >
                <MoreHorizontal size={17} aria-hidden />
            </button>
            {open && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-control border border-border bg-surface p-1 shadow-raised">
                    <Link
                        href={`/admin/students/${studentId}`}
                        className="flex items-center gap-2 rounded-control px-2.5 py-2 text-xs text-fg hover:bg-surface-hover"
                        onClick={() => setOpen(false)}
                    >
                        <ExternalLink size={14} aria-hidden />
                        Перейти к портфолио
                    </Link>
                </div>
            )}
        </div>
    );
}

// app/admin/students/[aisId]/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    Calendar,
    CheckCircle,
    FileText,
    Plane,
    ShieldAlert,
    ShieldCheck,
    Thermometer,
    Trophy,
    UserCheck,
    UserRound,
    XCircle,
    HelpCircle,
} from "lucide-react";
import { getViolationType } from "@/lib/violations";
import SchoolRecordModal from "@/components/ui/SchoolRecordModal";
import {
    Badge,
    Button,
    Card,
    EmptyState,
    List,
    ListItem,
    PageHeader,
    Skeleton,
    Tabs,
    useToast,
} from "@/components/ui/kit";
import { formatDateRu, formatDateTimeMoscow } from "@/lib/date";

/**
 * Портфолио ученика: пропуска, самовыходы, нарушения, пропуски уроков и ВШУ.
 *
 * Переведено на UI Kit: PageHeader, плитки статистики, segmented tabs (со скроллом
 * на мобильном), списки на ListItem, модалка ВШУ. Эмодзи причин пропусков заменены
 * на иконки Lucide — они корректно масштабируются и не ломают вёрстку.
 */

interface StudentInfo {
    aisId: string;
    name: string;
    firstName: string;
    lastName: string;
    className: string;
}

interface Pass {
    id: string;
    date: string;
    exitTime: string;
    reason: string;
    used: boolean;
    usedAt: string | null;
    className: string;
}

interface SelfExit {
    id: string;
    studentId: string;
    studentName: string;
    startDate: string;
    endDate: string;
    photoUrl: string;
    reason: string;
    classId: string;
}

interface Violation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string;
    teacherName: string;
    date: string;
}

interface Absence {
    id: string;
    date: string;
    reason: string;
    className: string;
}

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

interface StudentProfile {
    student: StudentInfo;
    passes: Pass[];
    selfExits: SelfExit[];
    violations: Violation[];
    absences: Absence[];
    schoolRecords: SchoolRecord[];
    stats: {
        passes: { total: number; used: number; notUsed: number };
        selfExits: { total: number; active: number };
        violations: { total: number; byType: Record<string, number> };
        absences: { total: number; byReason: Record<string, number> };
        schoolRecord: {
            isRegistered: boolean;
            total: number;
            activeRecord: SchoolRecord | null;
        };
    };
}

const ABSENCE_REASONS: Record<string, { label: string; Icon: typeof Thermometer; tone: "danger" | "warning" | "neutral" | "info" | "accent" }> = {
    sick: { label: "Болен", Icon: Thermometer, tone: "danger" },
    family: { label: "По заявлению родителей", Icon: FileText, tone: "warning" },
    other: { label: "Без уважительной", Icon: HelpCircle, tone: "neutral" },
    vacation: { label: "В отпуске", Icon: Plane, tone: "info" },
    competition: { label: "Соревнования", Icon: Trophy, tone: "accent" },
};

const absenceReason = (id: string) =>
    ABSENCE_REASONS[id] ?? { label: id, Icon: HelpCircle, tone: "neutral" as const };

type TabId = "overview" | "schoolRecord" | "passes" | "selfExits" | "violations" | "absences";

export default function StudentProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const toast = useToast();
    const params = useParams();
    const aisId = params?.aisId as string;

    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>("overview");

    const [isSchoolRecordModalOpen, setIsSchoolRecordModalOpen] = useState(false);
    const [schoolRecordMode, setSchoolRecordMode] = useState<"register" | "release">("register");

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") {
            router.replace("/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (!aisId || !session) return;

        let cancelled = false;

        const fetchProfile = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/students/${aisId}`);
                if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

                const data = await response.json();
                if (data.error) throw new Error(data.error);

                if (!cancelled) setProfile(data);
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Не удалось загрузить профиль");
                    setProfile(null);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void fetchProfile();
        return () => {
            cancelled = true;
        };
    }, [aisId, session]);

    const refreshProfile = async () => {
        if (!aisId) return;
        const response = await fetch(`/api/students/${aisId}`);
        const updated = await response.json();
        if (!updated.error) setProfile(updated);
    };

    const handleRegisterSchoolRecord = async (data: {
        date: string;
        reason: string;
        plannedReleaseAt?: string | null;
    }) => {
        if (!profile) throw new Error("Профиль ещё не загружен");

        const response = await fetch("/api/school-records", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                studentId: profile.student.aisId,
                studentName: profile.student.name,
                className: profile.student.className,
                reason: data.reason,
                registeredAt: data.date,
                plannedReleaseAt: data.plannedReleaseAt,
            }),
        });

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || "Не удалось поставить на учёт. Попробуйте ещё раз.");
        }

        await refreshProfile();
        toast.show({ title: "Ученик поставлен на внутришкольный учёт", tone: "success" });
    };

    const handleReleaseSchoolRecord = async (data: { date: string; reason: string }) => {
        const activeRecord = profile?.stats.schoolRecord.activeRecord;
        if (!activeRecord) throw new Error("Активная запись не найдена");

        const response = await fetch("/api/school-records", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: activeRecord.id,
                releaseReason: data.reason,
                releasedAt: data.date,
            }),
        });

        if (!response.ok) throw new Error("Не удалось снять с учёта. Попробуйте ещё раз.");

        await refreshProfile();
        toast.show({ title: "Ученик снят с внутришкольного учёта", tone: "success" });
    };

    const tabs = useMemo(() => {
        if (!profile) return [];

        return [
            { id: "overview", label: "Обзор" },
            { id: "schoolRecord", label: "ВШУ", count: profile.stats.schoolRecord.total },
            { id: "passes", label: "Пропуска", count: profile.stats.passes.total },
            { id: "selfExits", label: "Самовыходы", count: profile.stats.selfExits.total },
            { id: "violations", label: "Нарушения", count: profile.stats.violations.total },
            { id: "absences", label: "Пропуски", count: profile.stats.absences.total },
        ];
    }, [profile]);

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Ученик" onBack={() => router.push("/admin/students")} />
                <div className="mx-auto w-full max-w-4xl space-y-3 px-4 py-4">
                    <Skeleton height={96} radius="card" />
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

    if (!profile) {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Ученик" onBack={() => router.push("/admin/students")} />
                <div className="mx-auto w-full max-w-4xl px-4 py-8">
                    <EmptyState
                        variant="error"
                        icon={AlertCircle}
                        title="Ученик не найден"
                        description={error ?? "Не удалось загрузить информацию об ученике"}
                        action={{ label: "Вернуться к поиску", onClick: () => router.push("/admin/students") }}
                    />
                </div>
            </div>
        );
    }

    const { student, stats } = profile;
    const isRegistered = stats.schoolRecord.isRegistered;
    const activeRecord = stats.schoolRecord.activeRecord;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title={student.name}
                subtitle={`${student.className} · ID ${student.aisId}`}
                onBack={() => router.push("/admin/students")}
                actions={
                    isRegistered ? (
                        <Button
                            size="sm"
                            variant="secondary"
                            leftIcon={ShieldCheck}
                            onClick={() => {
                                setSchoolRecordMode("release");
                                setIsSchoolRecordModalOpen(true);
                            }}
                        >
                            Снять с учёта
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            variant="primary"
                            leftIcon={ShieldAlert}
                            onClick={() => {
                                setSchoolRecordMode("register");
                                setIsSchoolRecordModalOpen(true);
                            }}
                        >
                            Поставить на учёт
                        </Button>
                    )
                }
            />

            <main className="mx-auto w-full max-w-4xl space-y-3 px-4 py-4">
                {/* Карточка ученика */}
                <Card
                    className={isRegistered ? "border-warning/40 bg-warning-soft" : undefined}
                    padding="md"
                >
                    <div className="flex items-start gap-3">
                        <div
                            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-card text-xl font-semibold ${
                                isRegistered ? "bg-warning/15 text-warning" : "bg-accent-soft text-accent"
                            }`}
                            aria-hidden
                        >
                            {student.firstName?.charAt(0)?.toUpperCase() || "?"}
                        </div>

                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-lg font-semibold text-fg">{student.name}</h2>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge tone="info">{student.className}</Badge>
                                {isRegistered && (
                                    <Badge tone="warning">
                                        <ShieldAlert size={12} aria-hidden /> на ВШУ
                                    </Badge>
                                )}
                                <span className="text-xs text-fg-subtle">ID: {student.aisId}</span>
                            </div>

                            {isRegistered && activeRecord && (
                                <div className="mt-2 rounded-control border border-warning/30 bg-surface px-3 py-2">
                                    <p className="text-xs text-fg-subtle">
                                        Поставлен {formatDateRu(activeRecord.registeredAt)}
                                        {activeRecord.registeredByName ? ` · ${activeRecord.registeredByName}` : ""}
                                    </p>
                                    <p className="mt-0.5 text-sm text-fg">{activeRecord.reason}</p>
                                    {activeRecord.plannedReleaseAt && (
                                        <p className="mt-1 flex items-center gap-1 text-xs text-fg-muted">
                                            <Calendar size={12} aria-hidden />
                                            План. снятие: {formatDateRu(activeRecord.plannedReleaseAt)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Статистика */}
                <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatTile
                        icon={FileText}
                        label="Пропуска"
                        value={stats.passes.total}
                        hint={`${stats.passes.used} использовано`}
                    />
                    <StatTile
                        icon={UserCheck}
                        label="Самовыходы"
                        value={stats.selfExits.total}
                        hint={`${stats.selfExits.active} активных`}
                    />
                    <StatTile
                        icon={AlertTriangle}
                        label="Нарушения"
                        value={stats.violations.total}
                        hint={`${Object.keys(stats.violations.byType).length} типов`}
                    />
                    <StatTile
                        icon={XCircle}
                        label="Пропуски уроков"
                        value={stats.absences.total}
                        hint="за всё время"
                    />
                </section>

                <Tabs
                    value={activeTab}
                    onChange={id => setActiveTab(id as TabId)}
                    items={tabs}
                    ariaLabel="Разделы портфолио"
                    variant="scrollable"
                />

                {activeTab === "overview" && <OverviewTab profile={profile} onOpenTab={setActiveTab} />}

                {activeTab === "schoolRecord" && <SchoolRecordTab records={profile.schoolRecords} />}

                {activeTab === "passes" &&
                    (profile.passes.length === 0 ? (
                        <EmptyState icon={FileText} title="Пропусков нет" compact />
                    ) : (
                        <List>
                            {profile.passes.map(pass => (
                                <li key={pass.id}>
                                    <ListItem
                                        leading={FileText}
                                        title={`Выход в ${pass.exitTime}`}
                                        subtitle={pass.reason || undefined}
                                        meta={`${formatDateTimeMoscow(pass.date)}${
                                            pass.usedAt ? ` · отмечен ${formatDateTimeMoscow(pass.usedAt)}` : ""
                                        }`}
                                        trailing="badge"
                                        trailingContent={
                                            pass.used ? (
                                                <Badge tone="neutral">
                                                    <CheckCircle size={12} aria-hidden /> использован
                                                </Badge>
                                            ) : (
                                                <Badge tone="success">активен</Badge>
                                            )
                                        }
                                    />
                                </li>
                            ))}
                        </List>
                    ))}

                {activeTab === "selfExits" &&
                    (profile.selfExits.length === 0 ? (
                        <EmptyState icon={UserCheck} title="Самовыходов нет" compact />
                    ) : (
                        <List>
                            {profile.selfExits.map(exit => {
                                const isActive = new Date(exit.endDate) >= new Date();

                                return (
                                    <li key={exit.id}>
                                        <ListItem
                                            leading={UserCheck}
                                            title={`${formatDateRu(exit.startDate)} — ${formatDateRu(exit.endDate)}`}
                                            subtitle={exit.reason || undefined}
                                            trailing="badge"
                                            trailingContent={
                                                isActive ? (
                                                    <Badge tone="success">активен</Badge>
                                                ) : (
                                                    <Badge tone="neutral">завершён</Badge>
                                                )
                                            }
                                        />
                                    </li>
                                );
                            })}
                        </List>
                    ))}

                {activeTab === "violations" &&
                    (profile.violations.length === 0 ? (
                        <EmptyState icon={AlertTriangle} title="Нарушений нет" compact />
                    ) : (
                        <List>
                            {profile.violations.map(violation => {
                                const type = getViolationType(violation.violationType);
                                const Icon = type.Icon;

                                return (
                                    <li key={violation.id}>
                                        <ListItem
                                            leading={
                                                <span
                                                    className={`flex h-9 w-9 items-center justify-center rounded-control ${type.bgColor}`}
                                                    aria-hidden
                                                >
                                                    <Icon size={18} strokeWidth={1.75} className={type.color} />
                                                </span>
                                            }
                                            title={<span className={type.color}>{type.label}</span>}
                                            subtitle={violation.comment || undefined}
                                            meta={`${formatDateTimeMoscow(violation.date)}${
                                                violation.teacherName ? ` · ${violation.teacherName}` : ""
                                            }`}
                                        />
                                    </li>
                                );
                            })}
                        </List>
                    ))}

                {activeTab === "absences" &&
                    (profile.absences.length === 0 ? (
                        <EmptyState icon={XCircle} title="Пропусков уроков нет" compact />
                    ) : (
                        <List>
                            {profile.absences.map(absence => {
                                const reason = absenceReason(absence.reason);
                                const Icon = reason.Icon;

                                return (
                                    <li key={absence.id}>
                                        <ListItem
                                            leading={Icon}
                                            title={reason.label}
                                            meta={formatDateRu(absence.date)}
                                            trailing="badge"
                                            trailingContent={<Badge tone={reason.tone}>{absence.className}</Badge>}
                                        />
                                    </li>
                                );
                            })}
                        </List>
                    ))}
            </main>

            <SchoolRecordModal
                isOpen={isSchoolRecordModalOpen}
                onClose={() => setIsSchoolRecordModalOpen(false)}
                onSubmit={
                    schoolRecordMode === "register" ? handleRegisterSchoolRecord : handleReleaseSchoolRecord
                }
                mode={schoolRecordMode}
                studentName={student.name}
                existingReason={activeRecord?.reason}
            />
        </div>
    );
}

// ============ ТАБ: ОБЗОР ============
function OverviewTab({
    profile,
    onOpenTab,
}: {
    profile: StudentProfile;
    onOpenTab: (tab: TabId) => void;
}) {
    const { stats, passes, selfExits, violations, absences } = profile;
    const activeRecord = stats.schoolRecord.activeRecord;

    const hasEvents = passes.length > 0 || selfExits.length > 0 || violations.length > 0 || absences.length > 0;

    return (
        <div className="space-y-3">
            {activeRecord && (
                <Card
                    title="Состоит на внутришкольном учёте"
                    description={`Поставлен ${formatDateRu(activeRecord.registeredAt)}${
                        activeRecord.registeredByName ? ` · ${activeRecord.registeredByName}` : ""
                    }`}
                    padding="md"
                    className="border-warning/40"
                >
                    <p className="text-sm text-fg">{activeRecord.reason}</p>
                </Card>
            )}

            <Card title="Последние события" padding="none">
                {!hasEvents ? (
                    <EmptyState
                        icon={Activity}
                        title="Нет данных для отображения"
                        description="Пока у ученика нет пропусков, нарушений и самовыходов"
                        compact
                    />
                ) : (
                    <List className="rounded-none border-0">
                        {passes[0] && (
                            <li>
                                <ListItem
                                    leading={FileText}
                                    title="Пропуск"
                                    subtitle={`${formatDateRu(passes[0].date)} · выход в ${passes[0].exitTime}`}
                                    trailing="badge"
                                    trailingContent={
                                        passes[0].used ? (
                                            <Badge tone="neutral">использован</Badge>
                                        ) : (
                                            <Badge tone="success">активен</Badge>
                                        )
                                    }
                                    onClick={() => onOpenTab("passes")}
                                />
                            </li>
                        )}

                        {selfExits[0] && (
                            <li>
                                <ListItem
                                    leading={UserCheck}
                                    title="Самовыход"
                                    subtitle={`${formatDateRu(selfExits[0].startDate)} — ${formatDateRu(selfExits[0].endDate)}`}
                                    trailing="badge"
                                    trailingContent={
                                        new Date(selfExits[0].endDate) >= new Date() ? (
                                            <Badge tone="success">активен</Badge>
                                        ) : (
                                            <Badge tone="neutral">завершён</Badge>
                                        )
                                    }
                                    onClick={() => onOpenTab("selfExits")}
                                />
                            </li>
                        )}

                        {violations[0] && (
                            <li>
                                <ListItem
                                    leading={getViolationType(violations[0].violationType).Icon}
                                    title={getViolationType(violations[0].violationType).label}
                                    meta={`${formatDateTimeMoscow(violations[0].date)}${
                                        violations[0].teacherName ? ` · ${violations[0].teacherName}` : ""
                                    }`}
                                    onClick={() => onOpenTab("violations")}
                                />
                            </li>
                        )}

                        {absences[0] && (
                            <li>
                                <ListItem
                                    leading={absenceReason(absences[0].reason).Icon}
                                    title={`Пропуск урока: ${absenceReason(absences[0].reason).label}`}
                                    meta={formatDateRu(absences[0].date)}
                                    onClick={() => onOpenTab("absences")}
                                />
                            </li>
                        )}
                    </List>
                )}
            </Card>

            {Object.keys(stats.violations.byType).length > 0 && (
                <Card title="Нарушения по типам" padding="sm">
                    <div className="space-y-1.5">
                        {Object.entries(stats.violations.byType)
                            .sort(([, a], [, b]) => b - a)
                            .map(([typeId, count]) => {
                                const type = getViolationType(typeId);
                                const Icon = type.Icon;

                                return (
                                    <div key={typeId} className="flex items-center gap-2">
                                        <Icon size={16} strokeWidth={1.75} className={type.color} aria-hidden />
                                        <span className="flex-1 text-sm text-fg">{type.label}</span>
                                        <span className="text-sm font-semibold tabular-nums text-fg">{count}</span>
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            )}

            {Object.keys(stats.absences.byReason).length > 0 && (
                <Card title="Пропуски по причинам" padding="sm">
                    <div className="space-y-1.5">
                        {Object.entries(stats.absences.byReason)
                            .sort(([, a], [, b]) => b - a)
                            .map(([reasonId, count]) => {
                                const reason = absenceReason(reasonId);
                                const Icon = reason.Icon;

                                return (
                                    <div key={reasonId} className="flex items-center gap-2">
                                        <Icon size={16} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
                                        <span className="flex-1 text-sm text-fg">{reason.label}</span>
                                        <span className="text-sm font-semibold tabular-nums text-fg">{count}</span>
                                    </div>
                                );
                            })}
                    </div>
                </Card>
            )}
        </div>
    );
}

// ============ ТАБ: ВШУ ============
function SchoolRecordTab({ records }: { records: SchoolRecord[] }) {
    if (records.length === 0) {
        return (
            <EmptyState
                icon={ShieldAlert}
                title="Не состоит на внутришкольном учёте"
                description="Записей о постановке нет"
                compact
            />
        );
    }

    const activeRecord = records.find(record => record.isActive);
    const history = records.filter(record => !record.isActive);

    return (
        <div className="space-y-3">
            {activeRecord && (
                <Card
                    title="Активная запись · на учёте"
                    description={`Поставлен ${formatDateRu(activeRecord.registeredAt)} · ${activeRecord.registeredByName}`}
                    padding="md"
                    className="border-warning/40"
                >
                    <p className="text-sm text-fg">{activeRecord.reason}</p>
                    {activeRecord.plannedReleaseAt && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-fg-muted">
                            <Calendar size={12} aria-hidden />
                            Планируемое снятие: {formatDateRu(activeRecord.plannedReleaseAt)}
                        </p>
                    )}
                </Card>
            )}

            {history.length > 0 && (
                <Card title="История" padding="none">
                    <List className="rounded-none border-0">
                        {history.map(record => (
                            <li key={record.id}>
                                <ListItem
                                    leading={ShieldCheck}
                                    title={`${formatDateRu(record.registeredAt)} — ${
                                        record.releasedAt ? formatDateRu(record.releasedAt) : "—"
                                    }`}
                                    subtitle={record.reason}
                                    meta={
                                        record.releaseReason
                                            ? `Снят: ${record.releaseReason}${
                                                record.releasedByName ? ` (${record.releasedByName})` : ""
                                            }`
                                            : undefined
                                    }
                                    trailing="badge"
                                    trailingContent={<Badge tone="success">завершено</Badge>}
                                />
                            </li>
                        ))}
                    </List>
                </Card>
            )}
        </div>
    );
}

function StatTile({
    icon: Icon,
    label,
    value,
    hint,
}: {
    icon: typeof FileText;
    label: string;
    value: number;
    hint?: string;
}) {
    return (
        <div className="rounded-card border border-border bg-surface p-3">
            <div className="mb-1 flex items-center gap-1.5 text-fg-subtle">
                <Icon size={12} strokeWidth={1.75} aria-hidden />
                <span className="text-xs">{label}</span>
            </div>
            <p className="text-xl font-semibold tabular-nums text-fg">{value}</p>
            {hint && <p className="text-[11px] text-fg-subtle">{hint}</p>}
        </div>
    );
}

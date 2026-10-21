"use client";

// app/my-violations/page.tsx
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ChevronDown, History } from "lucide-react";
import { Badge, Card, Chip, PageHeader, Skeleton } from "@/components/ui/kit";
import { formatDateTimeMoscow } from "@/lib/date";
import { getViolationType, resolverLabel } from "@/lib/violations";

/**
 * «Мои фиксации» — история замечаний, которые сотрудник зафиксировал сам.
 *
 * Строка списка — карточка: ученик, тип, дата и статус справа. По нажатию
 * карточка раскрывается: видно свой комментарий, что сделала администрация
 * (или классный руководитель) и когда. Страница личная, раздел доступа не нужен.
 */

interface MineViolation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string | null;
    teacherName: string;
    date: string;
    resolvedAt?: string | null;
    resolvedByName?: string | null;
    resolutionComment?: string | null;
    resolvedSource?: string | null;
}

interface MineStats {
    total: number;
    resolved: number;
    unresolved: number;
    shown: number;
}

const EMPTY_STATS: MineStats = { total: 0, resolved: 0, unresolved: 0, shown: 0 };

export default function MyViolationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [violations, setViolations] = useState<MineViolation[]>([]);
    const [stats, setStats] = useState<MineStats>(EMPTY_STATS);
    const [resolution, setResolution] = useState("");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
    }, [status, router]);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (resolution) params.set("resolution", resolution);

            const response = await fetch(`/api/violations/mine?${params.toString()}`);
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const data = await response.json();
            setViolations(Array.isArray(data?.violations) ? data.violations : []);
            setStats(data?.stats ?? EMPTY_STATS);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить историю");
            setViolations([]);
            setStats(EMPTY_STATS);
        } finally {
            setIsLoading(false);
        }
    }, [resolution]);

    useEffect(() => {
        if (status === "authenticated") void load();
    }, [status, load]);

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <div className="mx-auto w-full max-w-3xl px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <div className="mt-3 space-y-2">
                        <Skeleton height={84} radius="card" />
                        <Skeleton height={84} radius="card" />
                    </div>
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-full bg-bg">
            {/* Мобильный хэдер: стрелка назад и название раздела; на десктопе — с подзаголовком */}
            <PageHeader
                title="Мои фиксации"
                subtitle={
                    <span className="hidden sm:inline">Замечания, которые вы зафиксировали, и их отработка</span>
                }
                onBack={() => router.push("/")}
            />

            <main className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
                <section className="grid grid-cols-3 gap-2">
                    <Card padding="sm">
                        <p className="text-xs text-fg-subtle">Всего</p>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{stats.total}</p>
                    </Card>
                    <Card padding="sm">
                        <p className="text-xs text-fg-subtle">Не отработано</p>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums text-warning">{stats.unresolved}</p>
                    </Card>
                    <Card padding="sm">
                        <p className="text-xs text-fg-subtle">Отработано</p>
                        <p className="mt-0.5 text-xl font-semibold tabular-nums text-success">{stats.resolved}</p>
                    </Card>
                </section>

                <Card padding="sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Chip selected={resolution === ""} onClick={() => setResolution("")}>
                            Все
                        </Chip>
                        <Chip selected={resolution === "unresolved"} onClick={() => setResolution("unresolved")}>
                            Не отработаны
                        </Chip>
                        <Chip selected={resolution === "resolved"} onClick={() => setResolution("resolved")}>
                            Отработаны
                        </Chip>
                    </div>
                </Card>

                {error && (
                    <Card padding="sm">
                        <p className="text-sm text-danger">{error}</p>
                    </Card>
                )}

                {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton height={84} radius="card" />
                        <Skeleton height={84} radius="card" />
                    </div>
                ) : violations.length === 0 && !error ? (
                    <Card padding="none">
                        <div className="px-4 py-10 text-center">
                            <History size={22} className="mx-auto text-fg-subtle" aria-hidden />
                            <p className="mt-2 text-sm text-fg">Вы ещё не фиксировали нарушения</p>
                            <p className="mt-1 text-xs text-fg-muted">
                                Нажмите кнопку с восклицательным знаком внизу справа — замечание появится здесь.
                            </p>
                            <Link
                                href="/"
                                className="mt-3 inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg"
                            >
                                <ArrowLeft size={14} aria-hidden />
                                На главную
                            </Link>
                        </div>
                    </Card>
                ) : (
                    <ul role="list" className="space-y-2">
                        {violations.map(violation => {
                            const type = getViolationType(violation.violationType);
                            const Icon = type.Icon;
                            const resolved = Boolean(violation.resolvedAt);
                            const expanded = expandedId === violation.id;

                            return (
                                <li key={violation.id}>
                                    <Card padding="none" className="overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId(expanded ? null : violation.id)}
                                            aria-expanded={expanded}
                                            className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-hover"
                                        >
                                            <span
                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${type.bgColor}`}
                                                aria-hidden
                                            >
                                                <Icon size={18} strokeWidth={1.75} className={type.color} />
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-1.5">
                                                    <span className="truncate text-sm font-medium text-fg">
                                                        {violation.studentName}
                                                    </span>
                                                    <span className={`shrink-0 text-xs ${type.color}`}>
                                                        {type.shortLabel}
                                                    </span>
                                                </span>
                                                <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                                                    {formatDateTimeMoscow(violation.date)} · {violation.className}
                                                </span>
                                                {violation.comment && (
                                                    <span
                                                        className={`mt-1 block text-xs text-fg-muted ${expanded ? "" : "truncate"}`}
                                                    >
                                                        {violation.comment}
                                                    </span>
                                                )}
                                            </span>

                                            {/* Статус — справа */}
                                            <span className="flex shrink-0 flex-col items-end gap-1">
                                                <Badge tone={resolved ? "success" : "warning"}>
                                                    {resolved ? "Отработано" : "Не отработано"}
                                                </Badge>
                                                <ChevronDown
                                                    size={16}
                                                    className={`text-fg-subtle transition-transform ${expanded ? "rotate-180" : ""}`}
                                                    aria-hidden
                                                />
                                            </span>
                                        </button>

                                        {expanded && (
                                            <div className="space-y-1.5 border-t border-border bg-surface-2 px-3 py-2.5 text-xs">
                                                <p className="text-fg-muted">
                                                    <span className="text-fg-subtle">Ваш комментарий: </span>
                                                    {violation.comment?.trim() ? violation.comment : "—"}
                                                </p>

                                                {resolved ? (
                                                    <>
                                                        <p className="text-fg-muted">
                                                            <span className="text-fg-subtle">Отработано: </span>
                                                            {resolverLabel(
                                                                violation.resolvedByName,
                                                                violation.resolvedSource,
                                                            )}
                                                            {violation.resolvedAt
                                                                ? ` · ${formatDateTimeMoscow(violation.resolvedAt)}`
                                                                : ""}
                                                        </p>
                                                        <p className="text-fg-muted">
                                                            <span className="text-fg-subtle">Что сделано: </span>
                                                            {violation.resolutionComment || "—"}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-warning">
                                                        Ждёт отработки: администрация или классный руководитель ещё не
                                                        отметили работу.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <p className="pb-6 text-center text-[11px] text-fg-subtle">
                    Нажмите на карточку, чтобы увидеть ответ по нарушению.
                </p>
            </main>
        </div>
    );
}

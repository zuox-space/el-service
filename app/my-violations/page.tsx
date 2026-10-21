"use client";

// app/my-violations/page.tsx
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, History } from "lucide-react";
import { Card, Chip, PageHeader, Skeleton } from "@/components/ui/kit";
import ViolationsList from "@/components/ui/ViolationsList";

/**
 * «Мои фиксации» — история замечаний, которые сотрудник зафиксировал сам.
 *
 * Здесь видно, что с ними стало: ждут администрацию или уже отработаны,
 * кто отметил отработку и что именно было сделано. Страница личная, поэтому
 * не требует раздела доступа — данные принадлежат автору.
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
                <PageHeader title="Мои фиксации" onBack={() => router.push("/")} />
                <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4">
                    <Skeleton height={72} radius="card" />
                    <Skeleton height={220} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Мои фиксации"
                subtitle="Замечания, которые вы зафиксировали, и их отработка"
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

                {violations.length === 0 && !isLoading && !error ? (
                    <Card padding="none">
                        <div className="px-4 py-10 text-center">
                            <History size={22} className="mx-auto text-fg-subtle" aria-hidden />
                            <p className="mt-2 text-sm text-fg">Вы ещё не фиксировали нарушения</p>
                            <p className="mt-1 text-xs text-fg-muted">
                                Нажмите кнопку с дизлайком внизу справа — и замечание появится здесь.
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
                    <ViolationsList
                        violations={violations}
                        isLoading={isLoading}
                        showResolution
                        showTeacher={false}
                        emptyMessage="Нарушений нет"
                    />
                )}

                <p className="pb-6 text-center text-[11px] text-fg-subtle">
                    Отработку отмечает администрация — комментарий и автор решения видны в записи.
                </p>
            </main>
        </div>
    );
}

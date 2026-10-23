"use client";

// app/my-violations/page.tsx
import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { Card, Chip, SearchInput, Skeleton } from "@/components/ui/kit";
import { ViolationAccordion } from "@/components/ui/ViolationAccordion";
import { EmployeeHeader } from "@/components/shell/EmployeeHeader";

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
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);
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
            if (deferredSearch.trim()) params.set("search", deferredSearch.trim());

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
    }, [resolution, deferredSearch]);

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

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    return (
        <div className="min-h-full bg-bg">
            <EmployeeHeader
                title="Мои фиксации"
                backHref="/"
                userName={session.user.name}
                userEmail={session.user.email ?? null}
                roles={(session.user.roles as string[]) ?? []}
                onLogout={() => void handleLogout()}
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

                <Card padding="sm" className="space-y-2">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Фамилия или имя ученика"
                        label="Поиск"
                    />
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

                <ViolationAccordion
                    items={violations}
                    isLoading={isLoading}
                    showStudent
                    showTeacher={false}
                    emptyTitle="Вы ещё не фиксировали нарушения"
                    emptyDescription="Нажмите кнопку с восклицательным знаком внизу справа — замечание появится здесь."
                />
                <p className="pb-6 text-center text-[11px] text-fg-subtle">
                    Нажмите на карточку, чтобы увидеть ответ по нарушению.
                </p>
            </main>
        </div>
    );
}

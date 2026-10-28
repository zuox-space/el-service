"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { EmployeeHeader } from "@/components/shell/EmployeeHeader";
import { useAccess } from "@/components/access/AccessProvider";
import { NoAccess } from "@/components/access/NoAccess";
import { Card, EmptyState, Select, Skeleton } from "@/components/ui/kit";
import { SeatingBoard } from "@/components/seating/SeatingBoard";

interface SeatingClass {
    id: string;
    name: string;
}

function Fallback() {
    return (
        <div className="min-h-full bg-bg">
            <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-4">
                <Skeleton height={56} radius="card" />
                <Skeleton height={320} radius="card" />
            </div>
        </div>
    );
}

export default function SeatingPage() {
    return (
        <Suspense fallback={<Fallback />}>
            <SeatingContent />
        </Suspense>
    );
}

function SeatingContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { can, loading: accessLoading } = useAccess();
    const [classes, setClasses] = useState<SeatingClass[]>([]);
    const [classId, setClassId] = useState(() => searchParams.get("classId") || "");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const allowed = !accessLoading && (can("seating") || can("myClass"));

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/login");
    }, [status, router]);

    const loadClasses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/seating/classes", { cache: "no-store" });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Не удалось загрузить классы");
            const next: SeatingClass[] = Array.isArray(payload.classes) ? payload.classes : [];
            setClasses(next);
            setClassId(current => current && next.some(item => item.id === current) ? current : next[0]?.id ?? "");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить классы");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (allowed) void loadClasses();
    }, [allowed, loadClasses]);

    if (status === "loading" || accessLoading) return <Fallback />;
    if (!session) return null;
    if (!allowed) return <NoAccess title="Нет доступа к разделу «Электронная рассадка»" />;

    return (
        <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg">
            <EmployeeHeader
                title="Электронная рассадка"
                backHref="/"
                userName={session.user.name ?? null}
                userEmail={session.user.email ?? null}
                roles={(session.user.roles as string[]) ?? []}
                onLogout={() => void signOut({ callbackUrl: "/" })}
            />

            <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-hidden px-4 py-4">
                <Card padding="md" className="shrink-0">
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-48 flex-1">
                            <Select
                                label="Класс"
                                value={classId}
                                onChange={value => {
                                    setClassId(value);
                                    router.replace(`/seating?classId=${encodeURIComponent(value)}`, { scroll: false });
                                }}
                                placeholder="Выберите класс"
                                options={classes.map(item => ({ value: item.id, label: item.name }))}
                            />
                        </div>
                    </div>
                </Card>

                {error && <Card padding="md" className="border-danger/40 bg-danger-soft"><p className="text-sm text-fg">{error}</p></Card>}

                {isLoading ? (
                    <Fallback />
                ) : !classId ? (
                    <EmptyState icon={undefined} title="Нет доступных классов" description="Обратитесь к администратору" />
                ) : (
                    <SeatingBoard classId={classId} canEdit={false} />
                )}
            </main>
        </div>
    );
}

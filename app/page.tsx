"use client";

// app/page.tsx — стартовая страница-портал
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    ArrowRight,
    School,
    ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { roleLabel, roleTone } from "@/lib/roles";

/**
 * Стартовая страница-портал.
 *
 * Здесь нет данных и форм — только сервисы, к которым у сотрудника есть доступ:
 *  • «Мой класс» — если он классный руководитель (у него есть класс);
 *  • «Панель управления» — если ему выдан хотя бы один раздел админки;
 *  • новые сервисы появляются здесь автоматически, когда у раздела есть href.
 *
 * Портал открыт любому авторизованному сотруднику, поэтому роль «Сотрудник»
 * без доступов — нормальное состояние: человек видит понятное меню, а не
 * пустую страницу.
 */

interface PortalService {
    id: string;
    label: string;
    description: string;
    href: string;
    group: string;
}

interface PortalData {
    user: { name: string; email: string; roles: string[] };
    myClass: { available: boolean; classes: string[]; studentsCount: number };
    services: PortalService[];
}

const shortName = (fullName: string | null | undefined): string => {
    if (!fullName) return "Коллега";

    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return parts[0] ?? "Коллега";

    return `${parts[1]} ${parts[0][0]}.${parts[2] ? ` ${parts[2][0]}.` : ""}`;
};

export default function PortalPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<PortalData | null>(null);
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
            const response = await fetch("/api/portal");
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const payload = await response.json();
            if (!payload?.user) throw new Error(payload?.error || "Не удалось загрузить сервисы");

            setData(payload);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить сервисы");
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (status === "authenticated") void load();
    }, [status, load]);

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/login" });
    };

    const services = data?.services ?? [];
    const hasServices = services.length > 0;
    const hasMyClass = Boolean(data?.myClass.available);
    const roles = (data?.user.roles ?? []) as string[];


    if (!mounted || status === "loading" || (isLoading && !data)) {
        return (
            <div className="min-h-full bg-bg">
                <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-6">
                    <Skeleton height={88} radius="card" />
                    <Skeleton height={140} radius="card" />
                    <Skeleton height={220} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="min-h-full bg-bg">
            <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5">
                {/* Профиль */}
                <div className="flex items-center justify-between gap-3">
                    <ProfileMenu
                        userName={shortName(data?.user.name ?? session.user.name)}
                        userEmail={data?.user.email ?? session.user.email ?? null}
                        onLogout={() => void handleLogout()}
                        variant="full"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {roles.slice(0, 3).map(role => (
                            <Badge key={role} tone={roleTone(role)}>
                                {roleLabel(role)}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Приветствие */}
                <Card padding="md" className="relative overflow-hidden">
                    <div
                        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl"
                        aria-hidden
                    />
                    <p className="text-xs uppercase tracking-wide text-fg-subtle">Электронные сервисы школы</p>
                    <h1 className="mt-1 text-xl font-semibold text-fg sm:text-2xl">
                        Здравствуйте, {shortName(data?.user.name ?? session.user.name)}
                    </h1>
                    <p className="mt-1 max-w-xl text-sm text-fg-muted">
                        {hasMyClass || hasServices
                            ? "Выберите сервис — доступные разделы уже собраны для вас."
                            : "Пока сервисы не назначены. Обратитесь к администратору — он выдаст нужные разделы."}
                    </p>
                </Card>

                {error && (
                    <Card padding="md" className="border-danger/40 bg-danger-soft">
                        <p className="text-sm text-fg">{error}</p>
                        <Button size="sm" variant="ghost" className="mt-2" onClick={() => void load()}>
                            Повторить
                        </Button>
                    </Card>
                )}

                {/* Мой класс */}
                {hasMyClass && (
                    <section aria-labelledby="my-class-title">
                        <h2
                            id="my-class-title"
                            className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-fg-subtle"
                        >
                            Классное руководство
                        </h2>
                        <Link
                            href="/my-class"
                            className="group block rounded-card border border-dashed border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/50 hover:bg-surface-hover"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                    <School size={22} aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-semibold text-fg">Мой класс</h3>
                                        {data?.myClass.classes.map(className => (
                                            <Badge key={className} tone="info">
                                                {className}
                                            </Badge>
                                        ))}
                                    </div>
                                    <p className="mt-1 text-sm text-fg-muted">
                                        Посещаемость, пропуска, нарушения, самовыходы и доверенности
                                        {data && data.myClass.studentsCount > 0
                                            ? ` · ${data.myClass.studentsCount} учеников`
                                            : ""}
                                    </p>
                                </div>
                                <ArrowRight
                                    size={18}
                                    className="mt-1 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text"
                                    aria-hidden
                                />
                            </div>
                        </Link>
                    </section>
                )}

                {/* Админ панель — одна карточка: внутри уже показываются доступные разделы */}
                {hasServices && (
                    <section aria-labelledby="admin-title">
                        <h2
                            id="admin-title"
                            className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-fg-subtle"
                        >
                            Управление школой
                        </h2>
                        <Link
                            href="/admin"
                            className="group block rounded-card border border-dashed border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/50 hover:bg-surface-hover"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                    <ShieldCheck size={22} aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-semibold text-fg">Админ панель</h3>
                                        <Badge tone="info">
                                            {services.length}{" "}
                                            {services.length === 1 ? "раздел" : services.length < 5 ? "раздела" : "разделов"}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-fg-muted">
                                        Контроль выхода, нарушения, аналитика и другие разделы, которые вам выданы
                                    </p>
                                </div>
                                <ArrowRight
                                    size={18}
                                    className="mt-1 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text"
                                    aria-hidden
                                />
                            </div>
                        </Link>
                    </section>
                )}
                {!hasMyClass && !hasServices && (
                    <Card padding="none">
                        <EmptyState
                            icon={School}
                            title="Сервисы пока не назначены"
                            description="Администратор выдаёт доступы к разделам: класс, дисциплина, аналитика. После этого они появятся здесь."
                        />
                    </Card>
                )}

                <p className="pb-4 pt-1 text-center text-[11px] text-fg-subtle">
                    Электронный пропуск · вход {data?.user.email ?? session.user.email}
                </p>
            </main>
        </div>
    );
}

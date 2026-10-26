"use client";

// app/page.tsx — стартовая страница-портал
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    ArrowRight,
    BarChart3,
    ChevronDown,
    KeyRound,
    School,
    ShieldCheck,
    Star,
    X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";
import { EmployeeHeader } from "@/components/shell/EmployeeHeader";

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

    // Всегда «Фамилия И.О.».
    return `${parts[0]} ${parts[1][0]}.${parts[2] ? ` ${parts[2][0]}.` : ""}`;
};

export default function PortalPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<PortalData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);

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
    // «Ключи» — обычный кабинет сотрудника, а не раздел админки.
    const adminServices = services.filter(service => service.id !== "keys");
    const hasAdminServices = adminServices.length > 0;
    const hasMyClass = Boolean(data?.myClass.available);
    const hasKeys = services.some(service => service.id === "keys");
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
            <EmployeeHeader
                home
                userName={shortName(data?.user.name ?? session.user.name)}
                userEmail={data?.user.email ?? session.user.email ?? null}
                roles={roles}
                onLogout={() => void handleLogout()}
            />

            <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5">
                {/* Приветствие + статистика сотрудника */}
                <div className="relative md:grid md:grid-cols-[minmax(0,1fr)_300px] md:items-start md:gap-3">
                    <Card
                        padding="md"
                        className="relative cursor-pointer overflow-hidden md:cursor-default"
                        onClick={() => setProfileOpen(value => !value)}
                    >
                        <div
                            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-2xl"
                            aria-hidden
                        />
                        <p className="text-xs uppercase tracking-wide text-fg-subtle">Электронные сервисы школы</p>
                        <h1 className="mt-1 text-xl font-semibold text-fg sm:text-2xl">
                            Здравствуйте, {shortName(data?.user.name ?? session.user.name)}
                        </h1>
                        <p className="mt-1 max-w-xl truncate text-sm text-fg-muted">
                            {hasMyClass || hasKeys || hasAdminServices
                                ? "Выберите сервис — доступные разделы уже собраны для вас."
                                : "Пока сервисы не назначены. Обратитесь к администратору — он выдаст нужные разделы."}
                        </p>
                        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-fg-muted md:hidden">
                            <ChevronDown
                                size={16}
                                className={`transition-transform ${profileOpen ? "rotate-180" : ""}`}
                                aria-hidden
                            />
                        </span>
                    </Card>

                    {profileOpen && (
                        <div
                            className="fixed inset-0 z-10 bg-backdrop/50 md:hidden"
                            onClick={() => setProfileOpen(false)}
                            aria-hidden
                        />
                    )}

                    <div
                        className={`${
                            profileOpen ? "absolute left-0 right-0 top-full z-20 mt-2 block" : "hidden"
                        } md:static md:mt-0 md:block`}
                    >
                        <UserStatsCard onClose={() => setProfileOpen(false)} />
                    </div>
                </div>

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
                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                    <School size={26} aria-hidden />
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
                                    <p className="mt-1 truncate text-sm text-fg-muted">
                                        Посещаемость, нарушения, выход из школы и др.
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

                {/* Ключи */}
                {hasKeys && (
                    <section aria-labelledby="keys-title">
                        <h2
                            id="keys-title"
                            className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-fg-subtle"
                        >
                            Ключница
                        </h2>
                        <Link
                            href="/keys"
                            className="group block rounded-card border border-dashed border-border bg-surface p-4 shadow-card transition-colors hover:border-accent/50 hover:bg-surface-hover"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                    <KeyRound size={26} aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base font-semibold text-fg">Ключи</h3>
                                    <p className="mt-1 truncate text-sm text-fg-muted">
                                        Взять, сдать или передать ключ, мои ключи и заявки
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

                {/* Админ панель — только если есть хотя бы один административный раздел */}
                {hasAdminServices && (
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
                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                    <ShieldCheck size={26} aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-semibold text-fg">Админ панель</h3>
                                        <Badge tone="info">
                                            {adminServices.length}{" "}
                                            {adminServices.length === 1 ? "раздел" : adminServices.length < 5 ? "раздела" : "разделов"}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 truncate text-sm text-fg-muted">
                                        Администрирование и аналитика
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
                {!hasMyClass && !hasKeys && !hasAdminServices && (
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

function UserStatsCard({
    onClose,
}: {
    onClose: () => void;
}) {
    return (
        <div className="rounded-card border border-border bg-surface p-3 shadow-raised md:shadow-card">
            <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-fg">
                    <BarChart3 size={16} className="text-accent-text" aria-hidden />
                    Статистика сотрудника
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Закрыть статистику"
                    className="flex h-7 w-7 items-center justify-center rounded-control text-fg-muted hover:bg-surface-hover hover:text-fg md:hidden"
                >
                    <X size={16} aria-hidden />
                </button>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-control border border-dashed border-border bg-surface-2 px-3 py-3">
                <Star size={18} className="shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">Мой рейтинг</p>
                    <p className="text-[11px] text-fg-subtle">Здесь появится ваш рейтинг сотрудника</p>
                </div>
                <Badge tone="neutral">скоро</Badge>
            </div>
        </div>
    );
}
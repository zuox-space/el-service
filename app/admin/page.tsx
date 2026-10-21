// app/admin/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle, DoorOpen, RefreshCw, Undo2, UserCheck } from "lucide-react";
import {
    Button,
    Chip,
    EmptyState,
    FormError,
    SearchInput,
    Select,
    Skeleton,
    Tabs,
    useToast,
} from "@/components/ui/kit";
import { useHeaderActions } from "@/components/shell/header-actions";
import { formatDateRu } from "@/lib/date";

/** Ключ сохранения фильтров панели: переживают перезагрузку и переходы */
const FILTERS_STORAGE_KEY = "el-dashboard-filters";

/**
 * Панель дежурного администратора: кто выходит прямо сейчас.
 *
 * Вкладки «Разовые · Самовыходы · Ушедшие» были потеряны при переходе на общий
 * каркас (вместе со старой шапкой удалили и переключатель), поэтому раздел
 * «Ушедшие» с возможностью отменить выход стал недоступен. Здесь он восстановлен
 * на компоненте Tabs.
 *
 * Пропуска выводятся сеткой: на десктопе по три в ряд, на планшете по два,
 * на телефоне в колонку. Цвет карточки говорит о состоянии: зелёный — ещё в школе
 * (можно отметить выход), синий — уже ушёл (можно отменить), акцентный — самовыход.
 */

type TabId = "single" | "self-exit" | "departed";

interface DashboardPass {
    id: string;
    studentName: string;
    exitTime: string;
    reason: string;
    date: string;
    className: string;
    grade: number;
    used: boolean;
    usedAt: string | null;
    type: "single" | "self-exit";
    startDate?: string;
    endDate?: string;
}

interface Stats {
    totalPasses: number;
    totalSelfExits: number;
    totalDeparted: number;
}

const GRADE_GROUPS = [
    { id: "1-3", label: "1–3 классы", grades: [1, 2, 3] },
    { id: "4-6", label: "4–6 классы", grades: [4, 5, 6] },
    { id: "7-9", label: "7–9 классы", grades: [7, 8, 9] },
    { id: "10-11", label: "10–11 классы", grades: [10, 11] },
];

// Ъ, Ы и Ь не могут начинать имя — в фильтре они только мешают
const ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ".split("");

export default function AdminDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const toast = useToast();

    const [mounted, setMounted] = useState(false);
    const [tab, setTab] = useState<TabId>("single");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const [passes, setPasses] = useState<DashboardPass[]>([]);
    const [selfExits, setSelfExits] = useState<DashboardPass[]>([]);
    const [departed, setDeparted] = useState<DashboardPass[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    // Фильтры общие для всех вкладок: переключение раздела не сбрасывает поиск
    const [search, setSearch] = useState("");
    const [gradeGroup, setGradeGroup] = useState("");
    const [letter, setLetter] = useState("");

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) router.replace("/");
        }
    }, [session, status, router]);

    const fetchData = useCallback(async (nextTab: TabId) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/admin/dashboard-data?tab=${nextTab}`);
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (nextTab === "single") setPasses(Array.isArray(data.passes) ? data.passes : []);
            if (nextTab === "self-exit") setSelfExits(Array.isArray(data.selfExits) ? data.selfExits : []);
            if (nextTab === "departed") setDeparted(Array.isArray(data.departed) ? data.departed : []);

            if (data.stats) {
                setStats({
                    totalPasses: data.stats.totalPasses ?? 0,
                    totalSelfExits: data.stats.totalSelfExits ?? 0,
                    totalDeparted: data.stats.totalDeparted ?? 0,
                });
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить данные панели");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            void fetchData(tab);
        }
    }, [session, tab, fetchData]);

    // Фильтры (параллель и буква) сохраняются между визитами и действуют
    // на все три вкладки: они живут в общем состоянии, а не в состоянии вкладки.
    useEffect(() => {
        if (!mounted) return;

        try {
            const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
            if (!raw) return;

            const saved = JSON.parse(raw) as { gradeGroup?: string; letter?: string };
            if (saved.gradeGroup) setGradeGroup(saved.gradeGroup);
            if (saved.letter) setLetter(saved.letter);
        } catch {
            // повреждённое значение не должно ломать панель
        }
    }, [mounted]);

    useEffect(() => {
        if (!mounted) return;

        try {
            localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ gradeGroup, letter }));
        } catch {
            // приватный режим — не критично
        }
    }, [mounted, gradeGroup, letter]);

    // «Обновить» — в шапке каркаса, а не в теле страницы
    useHeaderActions(
        () => (
            <Button
                size="sm"
                variant="ghost"
                leftIcon={RefreshCw}
                onClick={() => void fetchData(tab)}
                disabled={isLoading}
                aria-label="Обновить данные панели"
            >
                <span className="hidden sm:inline">Обновить</span>
            </Button>
        ),
        [fetchData, tab, isLoading],
    );

    const markAsUsed = async (pass: DashboardPass) => {
        setBusyId(pass.id);
        try {
            const response = await fetch(`/api/passes?id=${pass.id}`, { method: "PUT" });
            if (!response.ok) throw new Error("Не удалось отметить выход");

            toast.show({ title: "Выход отмечен", description: pass.studentName, tone: "success" });
            await fetchData(tab);
        } catch (e) {
            toast.show({ title: e instanceof Error ? e.message : "Ошибка", tone: "danger" });
        } finally {
            setBusyId(null);
        }
    };

    const undoMarkAsUsed = async (pass: DashboardPass) => {
        setBusyId(pass.id);
        try {
            const response = await fetch(`/api/passes/${pass.id}/undo`, { method: "PUT" });
            if (!response.ok) throw new Error("Не удалось отменить выход");

            toast.show({
                title: "Выход отменён",
                description: `${pass.studentName} снова в школе`,
                tone: "success",
            });
            await fetchData(tab);
        } catch (e) {
            toast.show({ title: e instanceof Error ? e.message : "Ошибка", tone: "danger" });
        } finally {
            setBusyId(null);
        }
    };

    const current = tab === "single" ? passes : tab === "self-exit" ? selfExits : departed;

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();
        const grades = GRADE_GROUPS.find(group => group.id === gradeGroup)?.grades ?? [];

        return current.filter(item => {
            if (query && !item.studentName.toLowerCase().includes(query)) return false;
            if (grades.length > 0 && !grades.includes(item.grade)) return false;
            if (letter && item.studentName.charAt(0).toUpperCase() !== letter) return false;
            return true;
        });
    }, [current, search, gradeGroup, letter]);

    const filtersActive = Boolean(search || gradeGroup || letter);
    const resetFilters = () => {
        setSearch("");
        setGradeGroup("");
        setLetter("");
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <Skeleton height={72} radius="card" />
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} height={150} radius="card" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) return null;

    const emptyByTab = () => {
        if (filtersActive) {
            return (
                <EmptyState
                    variant="no-results"
                    title="Никого не найдено"
                    description="Измените поиск или сбросьте фильтры"
                    action={{ label: "Сбросить фильтры", onClick: resetFilters }}
                />
            );
        }

        if (tab === "departed") {
            return (
                <EmptyState
                    icon={CheckCircle}
                    title="Сегодня никто не уходил"
                    description="Как только охранник отметит выход, ученик появится здесь"
                />
            );
        }

        if (tab === "self-exit") {
            return (
                <EmptyState
                    icon={UserCheck}
                    title="Нет активных самовыходов"
                    description="Самовыход оформляется на главной странице учителя"
                />
            );
        }

        return (
            <EmptyState
                icon={DoorOpen}
                title="Нет разовых пропусков на сегодня"
                description="Пропуск создаёт классный руководитель на главной странице"
            />
        );
    };

    return (
        <div className="min-h-full bg-bg pb-20 md:pb-6">
            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {/* Переключатель разделов — восстановлен */}
                <Tabs
                    value={tab}
                    onChange={id => setTab(id as TabId)}
                    ariaLabel="Разделы панели"
                    size="sm"
                    items={[
                        { id: "single", label: "Разовые", count: stats?.totalPasses },
                        { id: "self-exit", label: "Самовыходы", count: stats?.totalSelfExits },
                        { id: "departed", label: "Ушедшие", count: stats?.totalDeparted },
                    ]}
                />

                {error && <FormError message={error} />}

                {/* Фильтры: два поля в ряд, алфавит — отдельной строкой на всю ширину */}
                <div className="grid gap-2 sm:grid-cols-2">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Фамилия ученика"
                        label="Поиск"
                    />
                    <Select
                        label="Параллель"
                        placeholder="Все классы"
                        value={gradeGroup}
                        onChange={setGradeGroup}
                        options={GRADE_GROUPS.map(group => ({ value: group.id, label: group.label }))}
                    />
                </div>

                <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-fg">Первая буква фамилии</p>
                        {letter && (
                            <button
                                type="button"
                                onClick={() => setLetter("")}
                                className="text-xs text-fg-muted hover:text-fg"
                            >
                                Сбросить
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                        <Chip selected={letter === ""} onClick={() => setLetter("")}>
                            Все
                        </Chip>
                        {ALPHABET.map(symbol => (
                            <Chip
                                key={symbol}
                                selected={letter === symbol}
                                onClick={() => setLetter(letter === symbol ? "" : symbol)}
                                className="min-w-8 justify-center"
                            >
                                {symbol}
                            </Chip>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-xs text-fg-subtle">
                        {isLoading
                            ? "Загрузка…"
                            : `${tab === "departed" ? "Ушли" : tab === "self-exit" ? "Самовыходов" : "Пропусков"}: ${rows.length}`}
                    </p>
                    {filtersActive && (
                        <Chip onClick={resetFilters} onRemove={resetFilters} className="text-danger">
                            Сбросить фильтры
                        </Chip>
                    )}
                </div>

                {isLoading && current.length === 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <Skeleton key={index} height={160} radius="card" />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    emptyByTab()
                ) : (
                    <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {rows.map(pass => {
                            const isDeparted = tab === "departed";
                            const isSelfExit = tab === "self-exit";
                            const Icon = isDeparted ? CheckCircle : isSelfExit ? UserCheck : DoorOpen;
                            const iconTone = isDeparted ? "text-info" : isSelfExit ? "text-warning" : "text-success";

                            // Для тех, кто ещё в школе, статус не нужен — это и так очевидно по кнопке
                            const statusText = isDeparted
                                ? pass.usedAt
                                    ? `ушёл в ${new Date(pass.usedAt).toLocaleTimeString("ru-RU", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}`
                                    : "выход отмечен"
                                : null;

                            return (
                                <li
                                    key={pass.id}
                                    className="flex flex-col rounded-card border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <span
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-2"
                                                aria-hidden
                                            >
                                                <Icon size={17} strokeWidth={1.75} className={iconTone} />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-fg">
                                                    {pass.studentName}
                                                </p>
                                                <p className="text-xs text-fg-subtle">{pass.className}</p>
                                            </div>
                                        </div>

                                        {isSelfExit ? (
                                            <p className="shrink-0 text-right text-xs text-fg-muted">
                                                {pass.startDate && pass.endDate
                                                    ? `${formatDateRu(pass.startDate)} — ${formatDateRu(pass.endDate)}`
                                                    : "Постоянно"}
                                            </p>
                                        ) : (
                                            <p className="shrink-0 text-xl font-semibold leading-none tabular-nums text-fg">
                                                {pass.exitTime}
                                            </p>
                                        )}
                                    </div>

                                    <p className="mt-3 line-clamp-2 text-xs text-fg-muted">
                                        {pass.reason}
                                    </p>

                                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                                        <span className="text-[11px] text-fg-subtle">{statusText}</span>

                                        {!isSelfExit &&
                                            (isDeparted ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    leftIcon={Undo2}
                                                    loading={busyId === pass.id}
                                                    onClick={() => void undoMarkAsUsed(pass)}
                                                >
                                                    Отменить
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    leftIcon={CheckCircle}
                                                    loading={busyId === pass.id}
                                                    onClick={() => void markAsUsed(pass)}
                                                >
                                                    Отметить
                                                </Button>
                                            ))}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </main>
        </div>
    );
}

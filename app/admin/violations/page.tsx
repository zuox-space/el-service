// app/admin/violations/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useMemo, useCallback, Suspense } from "react";
import { BarChart3, ChartPie, ChevronLeft, ChevronRight, Download, Filter } from "lucide-react";
import ViolationsList from "@/components/ui/ViolationsList";
import { VIOLATION_TYPES, getViolationType } from "@/lib/violations";
import { toLocalISODate, formatDateTimeMoscow, safeCell } from "@/lib/date";
import { Button, Card, Chip, Input, Modal, ModalFooter, PageHeader, SearchInput, Select, Skeleton, useToast } from "@/components/ui/kit";

const PAGE_SIZE = 25;

interface Violation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string | null;
    teacherName: string;
    date: string;
}

interface ViolationStats {
    total: number;
    byType: Record<string, number>;
    byClass: Record<string, number>;
    uniqueStudents: number;
    uniqueClasses: number;
}

const EMPTY_STATS: ViolationStats = {
    total: 0,
    byType: {},
    byClass: {},
    uniqueStudents: 0,
    uniqueClasses: 0,
};

/** Дата нарушения в московском времени — школа работает по нему, независимо от того, откуда открыт браузер. */
const formatViolationDate = formatDateTimeMoscow;

function getDefaultRange(): { start: string; end: string } {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { start: toLocalISODate(weekAgo), end: toLocalISODate(today) };
}

export default function AdminViolationsPage() {
    return (
        <Suspense fallback={<ViolationsPageFallback />}>
            <ViolationsContent />
        </Suspense>
    );
}

function ViolationsPageFallback() {
    return (
        <div className="min-h-full bg-bg">
            <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} height={64} radius="card" />
                    ))}
                </div>
                <Skeleton height={120} radius="card" />
                <Skeleton height={200} radius="card" />
            </div>
        </div>
    );
}

// useSearchParams требует границы Suspense: без неё страница не собирается статически
function ViolationsContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const toast = useToast();

    const [mounted, setMounted] = useState(false);
    // На телефоне по умолчанию виден только поиск: фильтры раскрываются кнопкой
    const [filtersOpen, setFiltersOpen] = useState(false);

    // 🔥 Фильтры живут в URL: их можно переслать коллегой одной ссылкой,
    // и они не теряются при перезагрузке страницы или возврате «назад» на телефоне.
    const [startDate, setStartDate] = useState(() => searchParams.get('startDate') || getDefaultRange().start);
    const [endDate, setEndDate] = useState(() => searchParams.get('endDate') || getDefaultRange().end);
    const [selectedType, setSelectedType] = useState(() => searchParams.get('type') || "");
    const [selectedClass, setSelectedClass] = useState(() => searchParams.get('className') || "");
    const [gradeGroup, setGradeGroup] = useState(() => searchParams.get('gradeGroup') || "");
    const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || "");
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || "");
    const [page, setPage] = useState(() => {
        const p = Number.parseInt(searchParams.get('page') || '1', 10);
        return Number.isFinite(p) && p > 0 ? p : 1;
    });

    const [violations, setViolations] = useState<Violation[]>([]);
    const [stats, setStats] = useState<ViolationStats>(EMPTY_STATS);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Список классов для фильтра: получаем один раз по всему периоду,
    // иначе после фильтрации в выпадающем списке остаётся только выбранный класс.
    const [classOptions, setClassOptions] = useState<string[]>([]);

    useLayoutEffect(() => {
        setMounted(true);
    }, []);

    // Проверка прав (интерфейсная; серверную проверку делает API)
    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) {
                router.replace("/admin");
            }
        }
    }, [session, status, router]);

    const isAdmin = status === "authenticated" && (((session?.user?.roles as string[]) || []).includes("ADMIN"));

    // Ввод в поиске не должен дёргать сервер на каждую букву
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Синхронизация фильтров с URL
    useEffect(() => {
        if (!mounted) return;
        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        if (selectedType) params.set('type', selectedType);
        if (selectedClass) params.set('className', selectedClass);
        if (gradeGroup) params.set('gradeGroup', gradeGroup);
        if (searchQuery) params.set('search', searchQuery);
        if (page > 1) params.set('page', String(page));
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [mounted, startDate, endDate, selectedType, selectedClass, gradeGroup, searchQuery, page, pathname, router]);

    const fetchViolations = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams({
                startDate,
                endDate,
                page: String(page),
                pageSize: String(PAGE_SIZE),
            });
            if (selectedType) params.set('type', selectedType);
            if (selectedClass) params.set('className', selectedClass);
            if (gradeGroup) params.set('gradeGroup', gradeGroup);
            if (searchQuery) params.set('search', searchQuery);

            const response = await fetch(`/api/violations?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Сервер вернул ошибку ${response.status}`);
            }

            const data = await response.json();

            // Защита от неожиданного формата ответа (иначе был белый экран)
            const rows: Violation[] = Array.isArray(data) ? data : (Array.isArray(data?.violations) ? data.violations : []);
            setViolations(rows);

            if (data && Array.isArray(data.violations)) {
                setTotal(typeof data.total === 'number' ? data.total : rows.length);
                setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : 1);
                setStats({
                    total: data.stats?.total ?? 0,
                    byType: data.stats?.byType ?? {},
                    byClass: data.stats?.byClass ?? {},
                    uniqueStudents: data.stats?.uniqueStudents ?? 0,
                    uniqueClasses: data.stats?.uniqueClasses ?? 0,
                });
            } else {
                // Старый формат ответа (массив) — считаем сами
                setTotal(rows.length);
                setTotalPages(1);
                setStats({
                    total: rows.length,
                    byType: rows.reduce((acc: Record<string, number>, v) => {
                        acc[v.violationType] = (acc[v.violationType] || 0) + 1;
                        return acc;
                    }, {}),
                    byClass: rows.reduce((acc: Record<string, number>, v) => {
                        if (v.className) acc[v.className] = (acc[v.className] || 0) + 1;
                        return acc;
                    }, {}),
                    uniqueStudents: new Set(rows.map(v => v.studentId)).size,
                    uniqueClasses: new Set(rows.map(v => v.className).filter(Boolean)).size,
                });
            }
        } catch (e) {
            console.error("Error fetching violations:", e);
            setError(e instanceof Error ? e.message : "Не удалось загрузить нарушения");
            setViolations([]);
            setTotal(0);
            setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    }, [startDate, endDate, page, selectedType, selectedClass, gradeGroup, searchQuery]);

    useEffect(() => {
        if (isAdmin) {
            fetchViolations();
        }
    }, [isAdmin, fetchViolations]);

    // Список классов для фильтра — по всему периоду, без текущих фильтров
    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;

        const loadClassOptions = async () => {
            try {
                const params = new URLSearchParams({ startDate, endDate, stats: 'true' });
                const response = await fetch(`/api/violations?${params.toString()}`);
                if (!response.ok) return;
                const data = await response.json();
                if (cancelled) return;
                const byClass = data?.stats?.byClass ?? {};
                setClassOptions(Object.keys(byClass).sort((a, b) => a.localeCompare(b, 'ru')));
            } catch {
                // список классов не критичен для работы страницы
            }
        };

        loadClassOptions();
        return () => { cancelled = true; };
    }, [isAdmin, startDate, endDate]);

    const [pendingDelete, setPendingDelete] = useState<{ id: string; studentName: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    /** Удаление спрашиваем в своём окне: confirm() блокирует интерфейс и выглядит как системный сбой. */
    const handleDelete = (id: string) => {
        const row = violations.find(item => item.id === id);
        setPendingDelete({ id, studentName: row?.studentName ?? "это нарушение" });
    };

    const confirmDelete = async () => {
        if (!pendingDelete) return;

        const { id, studentName } = pendingDelete;
        setPendingDelete(null);
        setIsDeleting(true);

        try {
            const response = await fetch(`/api/violations?id=${id}`, { method: "DELETE" });
            if (!response.ok) {
                toast.show({ title: "Не удалось удалить нарушение", tone: "danger" });
                return;
            }

            toast.show({ title: "Нарушение удалено", description: studentName, tone: "success" });

            // Если удалили последнюю запись на странице — уходим на предыдущую
            if (violations.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                fetchViolations();
            }
        } catch (error) {
            console.error("Error deleting violation:", error);
            toast.show({ title: "Ошибка при удалении", tone: "danger" });
        } finally {
            setIsDeleting(false);
        }
    };

    // Экспорт текущей страницы (в списке может быть и выборка по фильтрам)
    const exportToExcel = () => {
        let html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Нарушения</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Нарушения</h1>
        <p>Период: ${safeCell(startDate)} — ${safeCell(endDate)}</p>
        <p>Всего по фильтру: ${total}. Выгружено строк: ${violations.length} (страница ${page} из ${totalPages}).</p>

        <table>
          <tr>
            <th>#</th>
            <th>Дата</th>
            <th>Ученик</th>
            <th>Класс</th>
            <th>Нарушение</th>
            <th>Комментарий</th>
            <th>Учитель</th>
          </tr>
    `;

        violations.forEach((v, i) => {
            const type = getViolationType(v.violationType);
            html += `
        <tr>
          <td>${(page - 1) * PAGE_SIZE + i + 1}</td>
          <td>${safeCell(formatViolationDate(v.date))}</td>
          <td>${safeCell(v.studentName)}</td>
          <td>${safeCell(v.className)}</td>
          <td>${safeCell(type.label)}</td>
          <td>${safeCell(v.comment || '')}</td>
          <td>${safeCell(v.teacherName)}</td>
        </tr>
      `;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `нарушения_${startDate}_${endDate}_стр${page}.xls`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const applyRange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
        setPage(1);
    };

    const quickRanges = useMemo(() => ([
        { label: "Сегодня", get: () => { const d = toLocalISODate(); return { start: d, end: d }; } },
        {
            label: "7 дней", get: () => {
                const d = new Date(); d.setDate(d.getDate() - 7);
                return { start: toLocalISODate(d), end: toLocalISODate() };
            }
        },
        {
            label: "30 дней", get: () => {
                const d = new Date(); d.setDate(d.getDate() - 30);
                return { start: toLocalISODate(d), end: toLocalISODate() };
            }
        },
        {
            label: "С начала года", get: () => {
                const d = new Date(new Date().getFullYear(), 0, 1);
                return { start: toLocalISODate(d), end: toLocalISODate() };
            }
        },
    ]), []);

    const hasActiveFilters = Boolean(selectedType || selectedClass || gradeGroup || searchQuery);
    const rangeInvalid = startDate > endDate;
    const firstShown = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const lastShown = Math.min(page * PAGE_SIZE, total);

    const resetFilters = () => {
        setGradeGroup("");
        const { start, end } = getDefaultRange();
        setStartDate(start);
        setEndDate(end);
        setSelectedType("");
        setSelectedClass("");
        setSearchInput("");
        setPage(1);
    };

    if (!mounted || status === "loading") {
        return <ViolationsPageFallback />;
    }

    if (!isAdmin) {
        return null;
    }

// Хвост страницы нарушений (JSX) — подставляется скриптом вместо старой разметки.
    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Нарушения"
                subtitle={`${stats.uniqueClasses} классов · ${stats.uniqueStudents} учеников за период`}
                onBack={() => router.push("/admin")}
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={ChartPie}
                            onClick={() => router.push("/admin/violations/stats")}
                        >
                            <span className="hidden sm:inline">Статистика</span>
                        </Button>
                        <span className="hidden sm:inline-flex">
                            <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={Download}
                            onClick={exportToExcel}
                            disabled={violations.length === 0}>
                            Выгрузить
                        </Button>
                        </span>
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {rangeInvalid && (
                    <div className="rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-fg">
                        Дата начала позже даты окончания — период будет пустым.
                    </div>
                )}

                {/* Статистика считается на сервере по ВСЕМ нарушениям периода, а не по странице */}
                <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <StatTile label="Всего за период" value={stats.total} />
                    <StatTile label="Учеников" value={stats.uniqueStudents} />
                    <StatTile label="Классов" value={stats.uniqueClasses} />
                    <StatTile label="Страниц" value={total === 0 ? 0 : totalPages} />
                </section>

                {/* Фильтры: поиск всегда на виду, остальное — по кнопке.
                    Скрыты по умолчанию и на мобильном, и на десктопе. */}
                <Card padding="sm">
                    <div className="space-y-3">
                        <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                                <SearchInput
                                    value={searchInput}
                                    onChange={setSearchInput}
                                    placeholder="Ученик, учитель или комментарий"
                                    label="Поиск"
                                />
                            </div>
                            <Button
                                variant={filtersOpen ? "secondary" : "ghost"}
                                size="sm"
                                leftIcon={Filter}
                                onClick={() => setFiltersOpen(open => !open)}
                                aria-expanded={filtersOpen}
                                aria-label={filtersOpen ? "Скрыть фильтры" : "Показать фильтры"}
                                className="mb-0.5 shrink-0"
                            >
                                <span className="hidden sm:inline">{filtersOpen ? "Скрыть" : "Фильтры"}</span>
                                {hasActiveFilters && (
                                    <span className="rounded-full bg-accent-soft px-1.5 text-[10px] text-accent-text">
                                        !
                                    </span>
                                )}
                            </Button>
                        </div>

                        {filtersOpen && (
                            <div className="space-y-3 border-t border-border pt-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="date"
                                        aria-label="Начало периода"
                                        value={startDate}
                                        max={endDate}
                                        onChange={event => {
                                            setStartDate(event.target.value);
                                            setPage(1);
                                        }}
                                    />
                                    <Input
                                        type="date"
                                        aria-label="Конец периода"
                                        value={endDate}
                                        min={startDate}
                                        onChange={event => {
                                            setEndDate(event.target.value);
                                            setPage(1);
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    <Select
                                        aria-label="Корпус"
                                        placeholder="Все корпуса"
                                        value={gradeGroup}
                                        onChange={value => {
                                            setGradeGroup(value);
                                            setSelectedClass("");
                                            setPage(1);
                                        }}
                                        options={[
                                            { value: "1-3", label: "1–3 классы" },
                                            { value: "4-6", label: "4–6 классы" },
                                            { value: "7-11", label: "7–11 классы" },
                                        ]}
                                    />
                                    <Select
                                        aria-label="Класс"
                                        placeholder="Все классы"
                                        value={selectedClass}
                                        onChange={value => {
                                            setSelectedClass(value);
                                            setPage(1);
                                        }}
                                        options={classOptions.map(cls => ({ value: cls, label: cls }))}
                                    />
                                    <Select
                                        aria-label="Тип нарушения"
                                        placeholder="Все типы"
                                        value={selectedType}
                                        onChange={value => {
                                            setSelectedType(value);
                                            setPage(1);
                                        }}
                                        options={VIOLATION_TYPES.map(type => ({ value: type.id, label: type.shortLabel }))}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    {quickRanges.map(range => (
                                        <Chip
                                            key={range.label}
                                            onClick={() => {
                                                const next = range.get();
                                                applyRange(next.start, next.end);
                                            }}
                                        >
                                            {range.label}
                                        </Chip>
                                    ))}
                                    {hasActiveFilters && (
                                        <Chip onRemove={resetFilters} onClick={resetFilters} className="text-danger">
                                            Сбросить фильтры
                                        </Chip>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Разбивка по типам: цифры за период, клик — фильтр */}
                {Object.keys(stats.byType).length > 0 && (
                    <Card padding="sm">
                        <div className="mb-2 flex items-center gap-2">
                            <BarChart3 size={14} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
                            <span className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                По типам за период
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(stats.byType)
                                .sort(([, a], [, b]) => b - a)
                                .map(([typeId, count]) => {
                                    const type = getViolationType(typeId);
                                    return (
                                        <Chip
                                            key={typeId}
                                            icon={type.Icon}
                                            count={count}
                                            selected={selectedType === typeId}
                                            onClick={() => {
                                                setSelectedType(selectedType === typeId ? "" : typeId);
                                                setPage(1);
                                            }}
                                        >
                                            {type.shortLabel}
                                        </Chip>
                                    );
                                })}
                        </div>
                    </Card>
                )}

                {/* Итоговая строка: честно показываем, что видно, а что всего */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <p className="text-xs text-fg-subtle">
                        {total === 0 ? "Ничего не найдено" : `Показано ${firstShown}–${lastShown} из ${total}`}
                    </p>
                    {isLoading && violations.length > 0 && <p className="text-xs text-fg-subtle">Обновление…</p>}
                </div>

                {error && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-danger/40 bg-danger-soft px-3 py-2">
                        <p className="text-sm text-fg">Не удалось загрузить нарушения: {error}</p>
                        <Button size="sm" variant="danger" onClick={fetchViolations}>
                            Повторить
                        </Button>
                    </div>
                )}

                <ViolationsList
                    violations={violations}
                    isLoading={isLoading && violations.length === 0}
                    onDelete={handleDelete}
                    showClassName={true}
                    showTeacher={true}
                    emptyMessage={
                        error
                            ? "Данные не загружены"
                            : hasActiveFilters || startDate || endDate
                                ? "Нарушений за выбранный период и фильтры нет"
                                : "Нарушений нет"
                    }
                />

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pb-6">
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={page <= 1 || isLoading}
                            onClick={() => setPage(previous => Math.max(1, previous - 1))}
                            leftIcon={ChevronLeft}
                        >
                            Назад
                        </Button>
                        <span className="px-2 text-sm tabular-nums text-fg-muted">
                            {page} / {totalPages}
                        </span>
                        <Button
                            size="sm"
                            variant="secondary"
                            disabled={page >= totalPages || isLoading}
                            onClick={() => setPage(previous => Math.min(totalPages, previous + 1))}
                            rightIcon={ChevronRight}
                        >
                            Вперёд
                        </Button>
                    </div>
                )}
            </main>

            {/* Подтверждение удаления нарушения */}
            <Modal
                open={Boolean(pendingDelete)}
                onClose={() => setPendingDelete(null)}
                title="Удалить нарушение?"
                description={pendingDelete?.studentName}
                size="sm"
                footer={
                    <ModalFooter
                        onCancel={() => setPendingDelete(null)}
                        onSubmit={confirmDelete}
                        submitLabel="Удалить"
                        loading={isDeleting}
                        tone="danger"
                    />
                }
            >
                <p className="text-sm text-fg-muted">
                    Запись исчезнет из статистики и из портфолио ученика. Действие необратимо.
                </p>
            </Modal>
        </div>
    );
}

function StatTile({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-card border border-border bg-surface p-3">
            <p className="text-xs text-fg-subtle">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{value}</p>
        </div>
    );
}

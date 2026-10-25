"use client";

// components/guard/GuardHistoryPanel.tsx
//
// Компактная история для пульта охраны: фильтры в одну строку, список
// прокручивается внутри панели — весь пульт помещается на один экран.
import { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { Badge, Button, Chip, EmptyState, Input, Select, Skeleton } from "@/components/ui/kit";
import type { KeyRequestDto } from "@/lib/keys/queries";

const TYPE_LABEL: Record<string, string> = { ISSUE: "Выдача", RETURN: "Сдача", TRANSFER: "Передача" };
const STATUS_LABEL: Record<string, string> = {
    PENDING: "ожидает",
    CONFIRMED: "подтверждена",
    CANCELLED: "отменена",
};

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function GuardHistoryPanel({
    buildingId,
    onOpenKey,
}: {
    buildingId: string;
    onOpenKey: (keyId: string) => void;
}) {
    const [q, setQ] = useState("");
    const [type, setType] = useState("all");
    const [status, setStatus] = useState("all");
    const [todayOnly, setTodayOnly] = useState(true);
    const [items, setItems] = useState<KeyRequestDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const params = useMemo(() => {
        const search = new URLSearchParams({ limit: "100" });
        if (buildingId !== "all") search.set("buildingId", buildingId);
        if (q.trim()) search.set("q", q.trim());
        if (type !== "all") search.set("type", type);
        if (status !== "all") search.set("status", status);
        if (todayOnly) {
            const today = new Date().toISOString().slice(0, 10);
            search.set("dateFrom", today);
            search.set("dateTo", today);
        }
        return search;
    }, [buildingId, q, type, status, todayOnly]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/guard/history?${params.toString()}`, { cache: "no-store" });
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);
            const data = await response.json();
            setItems(Array.isArray(data.items) ? data.items : []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить историю");
        } finally {
            setLoading(false);
        }
    }, [params]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-1.5">
                <Input
                    value={q}
                    onChange={event => setQ(event.target.value)}
                    placeholder="Ключ, кабинет, сотрудник"
                    aria-label="Поиск по истории"
                />
                <Select
                    aria-label="Тип"
                    value={type}
                    onChange={setType}
                    options={[
                        { value: "all", label: "Все" },
                        { value: "ISSUE", label: "Выдача" },
                        { value: "RETURN", label: "Сдача" },
                        { value: "TRANSFER", label: "Передача" },
                    ]}
                    wrapperClassName="w-28"
                />
                <Select
                    aria-label="Статус"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: "all", label: "Все" },
                        { value: "PENDING", label: "Ожидают" },
                        { value: "CONFIRMED", label: "Готово" },
                        { value: "CANCELLED", label: "Отменены" },
                    ]}
                    wrapperClassName="w-32"
                />
            </div>

            <div className="mb-2 flex items-center gap-1.5">
                <Chip selected={todayOnly} onClick={() => setTodayOnly(true)}>
                    Сегодня
                </Chip>
                <Chip selected={!todayOnly} onClick={() => setTodayOnly(false)}>
                    Все дни
                </Chip>
                <span className="ml-auto text-[11px] text-fg-subtle">{items.length}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {loading ? (
                    <Skeleton height={100} radius="card" />
                ) : error ? (
                    <EmptyState title="Нет данных" description={error} compact />
                ) : items.length === 0 ? (
                    <EmptyState icon={History} title="Записей нет" description="Измените фильтры" compact />
                ) : (
                    <ul className="space-y-1.5">
                        {items.map(item => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => item.keys.length === 1 && onOpenKey(item.keys[0].id)}
                                    className="w-full rounded-control border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm text-fg">
                                            <span className="font-medium">{TYPE_LABEL[item.type]}</span> ·{" "}
                                            {item.keys.map(key => key.roomNumber).join(", ")}
                                        </p>
                                        <Badge
                                            tone={
                                                item.status === "CONFIRMED"
                                                    ? "success"
                                                    : item.status === "PENDING"
                                                        ? "warning"
                                                        : "neutral"
                                            }
                                        >
                                            {STATUS_LABEL[item.status]}
                                        </Badge>
                                    </div>
                                    <p className="truncate text-[11px] text-fg-subtle">
                                        {formatDateTime(item.createdAt)} · {item.requestedByName}
                                        {item.targetUserName ? ` → ${item.targetUserName}` : ""}
                                    </p>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <Button size="sm" variant="ghost" className="mt-1" onClick={() => void load()} loading={loading}>
                Обновить
            </Button>
        </div>
    );
}

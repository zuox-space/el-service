"use client";

// components/keys/HistoryPanel.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    Input,
    Select,
    Skeleton,
} from "@/components/ui/kit";
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
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function HistoryPanel({
    type = "all",
    keyId = null,
    defaultToday = false,
    pageSize = 30,
    onOpenKey,
    endpoint = "/api/keys/history",
    buildingId = "",
}: {
    type?: "all" | "key";
    keyId?: string | null;
    defaultToday?: boolean;
    pageSize?: number;
    onOpenKey?: (keyId: string) => void;
    endpoint?: string;
    buildingId?: string;
}) {
    const [q, setQ] = useState("");
    const [participantName, setParticipantName] = useState("");
    const [requestType, setRequestType] = useState("all");
    const [status, setStatus] = useState("all");
    const [dateFrom, setDateFrom] = useState(defaultToday ? new Date().toISOString().slice(0, 10) : "");
    const [dateTo, setDateTo] = useState(defaultToday ? new Date().toISOString().slice(0, 10) : "");
    const [items, setItems] = useState<KeyRequestDto[]>([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);

    const params = useMemo(() => {
        const search = new URLSearchParams();
        search.set("limit", String(pageSize));
        if (keyId) search.set("keyId", keyId);
        if (buildingId && buildingId !== "all") search.set("buildingId", buildingId);
        if (q.trim()) search.set("q", q.trim());
        if (participantName.trim()) search.set("participantName", participantName.trim());
        if (requestType !== "all") search.set("type", requestType);
        if (status !== "all") search.set("status", status);
        if (dateFrom) search.set("dateFrom", dateFrom);
        if (dateTo) search.set("dateTo", dateTo);
        return search;
    }, [keyId, q, participantName, requestType, status, dateFrom, dateTo, pageSize, buildingId]);

    const load = useCallback(
        async (offset = 0) => {
            setLoading(true);
            try {
                const search = new URLSearchParams(params);
                search.set("offset", String(offset));
                const response = await fetch(`${endpoint}?${search.toString()}`, { cache: "no-store" });
                const data = await response.json();
                const next = Array.isArray(data.items) ? data.items : [];
                setItems(current => (offset === 0 ? next : [...current, ...next]));
                setTotal(Number(data.total) || 0);
                setHasMore(Boolean(data.hasMore));

            } finally {
                setLoading(false);
            }
        },
        [params, endpoint],
    );

    useEffect(() => {
        void load(0);
    }, [load]);

    return (
        <Card padding="sm">
            <div className="grid gap-2 sm:grid-cols-2">
                {keyId ? (
                    <Input
                        label="Сотрудник"
                        placeholder="Фамилия или имя"
                        value={participantName}
                        onChange={event => setParticipantName(event.target.value)}
                    />
                ) : (
                    <Input
                        label="Поиск"
                        placeholder="Ключ, кабинет, сотрудник"
                        value={q}
                        onChange={event => setQ(event.target.value)}
                    />
                )}
                <Select
                    label="Тип"
                    value={requestType}
                    onChange={setRequestType}
                    options={[
                        { value: "all", label: "Все" },
                        { value: "ISSUE", label: "Выдача" },
                        { value: "RETURN", label: "Сдача" },
                        { value: "TRANSFER", label: "Передача" },
                    ]}
                />
                <Select
                    label="Статус"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: "all", label: "Все" },
                        { value: "PENDING", label: "Ожидает" },
                        { value: "CONFIRMED", label: "Подтверждена" },
                        { value: "CANCELLED", label: "Отменена" },
                    ]}
                />
                <Input label="С" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} />
                <Input label="По" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Chip
                    onClick={() => {
                        const today = new Date().toISOString().slice(0, 10);
                        setDateFrom(today);
                        setDateTo(today);
                    }}
                >
                    Сегодня
                </Chip>
                <Chip
                    onClick={() => {
                        setDateFrom("");
                        setDateTo("");
                        setQ("");
                        setParticipantName("");
                        setRequestType("all");
                        setStatus("all");
                    }}
                >
                    Сбросить
                </Chip>
                <span className="ml-auto text-xs text-fg-subtle">найдено: {total}</span>
            </div>

            <div className="mt-3">
                {loading && items.length === 0 ? (
                    <Skeleton height={120} radius="card" />
                ) : items.length === 0 ? (
                    <EmptyState
                        icon={History}
                        title="Записей нет"
                        description="Измените фильтры или период"
                        compact
                    />
                ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                        {items.map(item => {
                            const rooms = item.keys.map(key => key.roomNumber).join(", ");
                            return (
                                <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-fg">
                                            <span className="font-medium">{TYPE_LABEL[item.type]}</span> · {rooms}
                                        </p>
                                        <p className="truncate text-xs text-fg-muted">
                                            {item.requestedByName}
                                            {item.targetUserName ? ` → ${item.targetUserName}` : ""}
                                            {item.decidedByName ? ` · ${item.decidedByName}` : ""}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-fg-subtle">
                                        {formatDateTime(item.createdAt)}
                                    </span>
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
                                    {onOpenKey && item.keys.length === 1 && (
                                        <Button size="sm" variant="ghost" onClick={() => onOpenKey(item.keys[0].id)}>
                                            Ключ
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {hasMore && (
                <Button fullWidth variant="secondary" className="mt-2" loading={loading} onClick={() => void load(items.length)}>
                    Показать ещё
                </Button>
            )}
        </Card>
    );
}

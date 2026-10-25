"use client";

// components/keys/AdminKeyHistorySheet.tsx
//
// Админская история одного ключа: широкая правая панель без фильтров.
// Показывает не только тип, но и участников: кто запросил, кому передали,
// кто подтвердил/отменил и когда.
import { useEffect, useState } from "react";
import { Badge, EmptyState, Input, Sheet, Skeleton } from "@/components/ui/kit";
import type { KeyItemDto, KeyRequestDto } from "@/lib/keys/queries";

const TYPE_LABEL: Record<string, string> = { ISSUE: "Выдача", RETURN: "Сдача", TRANSFER: "Передача" };
const STATUS_LABEL: Record<string, string> = {
    PENDING: "ожидает",
    CONFIRMED: "подтверждена",
    CANCELLED: "отменена",
};

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function AdminKeyHistorySheet({
    keyItem,
    onClose,
}: {
    keyItem: KeyItemDto | null;
    onClose: () => void;
}) {
    const [items, setItems] = useState<KeyRequestDto[]>([]);
    const [employeeQuery, setEmployeeQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!keyItem) {
            setItems([]);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        fetch(`/api/keys/history?keyId=${encodeURIComponent(keyItem.id)}&limit=200`, { cache: "no-store" })
            .then(response => {
                if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);
                return response.json();
            })
            .then(data => setItems(Array.isArray(data.items) ? data.items : []))
            .catch(e => setError(e instanceof Error ? e.message : "Не удалось загрузить историю"))
            .finally(() => setLoading(false));
    }, [keyItem]);

    return (
        <Sheet
            open={Boolean(keyItem)}
            onClose={onClose}
            title={keyItem ? `История ключа ${keyItem.roomNumber}` : "История ключа"}
            description={keyItem ? `${keyItem.buildingName} · ${keyItem.floor} этаж` : undefined}
            size="lg"
        >
            {keyItem && (
                <div className="mb-3 rounded-card border border-border bg-surface-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-fg">
                            {keyItem.roomNumber} {keyItem.roomName ? `· ${keyItem.roomName}` : ""}
                        </p>
                        <Badge tone={keyItem.status === "FREE" ? "success" : "info"}>
                            {keyItem.status === "FREE" ? "свободен" : "выдан"}
                        </Badge>
                        {keyItem.accessScope === "RESTRICTED" && <Badge tone="neutral">по списку</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-fg-muted">
                        {keyItem.buildingName} · {keyItem.floor} этаж
                        {keyItem.holderName ? ` · на руках: ${keyItem.holderName}` : ""}
                        {keyItem.issuedAt ? ` с ${formatDateTime(keyItem.issuedAt)}` : ""}
                    </p>
                </div>
            )}

            <Input
                label="Сотрудник"
                value={employeeQuery}
                onChange={event => setEmployeeQuery(event.target.value)}
                placeholder="Фамилия или имя участника"
                wrapperClassName="mb-2"
            />

            {loading ? (
                <div className="space-y-2">
                    <Skeleton height={90} radius="card" />
                    <Skeleton height={90} radius="card" />
                </div>
            ) : error ? (
                <EmptyState title="Не удалось загрузить" description={error} compact />
            ) : (() => {
                const query = employeeQuery.trim().toLowerCase();
                const visible = query
                    ? items.filter(item =>
                        [item.requestedByName, item.targetUserName, item.decidedByName]
                            .filter(Boolean)
                            .some(name => String(name).toLowerCase().includes(query)),
                    )
                    : items;

                return visible.length === 0 ? (
                    <EmptyState title="Никого не найдено" description="Измените фамилию сотрудника" compact />
                ) : (
                    <ol className="relative space-y-2 border-l border-border pl-4">
                        {visible.map(item => {
                        const confirmed = item.status === "CONFIRMED";
                        const cancelled = item.status === "CANCELLED";

                        return (
                            <li key={item.id} className="relative">
                                <span
                                    aria-hidden
                                    className={`absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border-2 border-surface ${
                                        confirmed ? "bg-success" : cancelled ? "bg-fg-subtle" : "bg-warning"
                                    }`}
                                />
                                <div className="rounded-card border border-border bg-surface p-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-fg">
                                                {TYPE_LABEL[item.type]} ·{" "}
                                                {item.keys
                                                    .map(key => `${key.roomNumber}${key.roomName ? ` ${key.roomName}` : ""}`)
                                                    .join(", ")}
                                            </p>
                                            <p className="text-[11px] text-fg-subtle">
                                                Создана: {formatDateTime(item.createdAt)}
                                            </p>
                                        </div>
                                        <Badge
                                            tone={
                                                confirmed ? "success" : cancelled ? "neutral" : "warning"
                                            }
                                        >
                                            {STATUS_LABEL[item.status]}
                                        </Badge>
                                    </div>

                                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                                        <div>
                                            <dt className="text-fg-subtle">Запросил</dt>
                                            <dd className="text-fg">{item.requestedByName || "—"}</dd>
                                        </div>
                                        {item.type === "TRANSFER" && (
                                            <div>
                                                <dt className="text-fg-subtle">Кому передают</dt>
                                                <dd className="text-fg">{item.targetUserName || "—"}</dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt className="text-fg-subtle">
                                                {cancelled ? "Отменил" : "Подтвердил"}
                                            </dt>
                                            <dd className="text-fg">
                                                {item.decidedByName ||
                                                    (item.status === "PENDING" ? "ещё не подтверждено" : "—")}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-fg-subtle">Решение</dt>
                                            <dd className="text-fg">{formatDateTime(item.updatedAt)}</dd>
                                        </div>
                                        {item.keys.length > 1 && (
                                            <div className="sm:col-span-2">
                                                <dt className="text-fg-subtle">Ключи в заявке</dt>
                                                <dd className="text-fg">
                                                    {item.keys
                                                        .map(key => `${key.roomNumber} · ${key.roomName || key.buildingName}`)
                                                        .join("; ")}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>
                            </li>
                        );
                    })}
                </ol>
                );
            })()}
        </Sheet>
    );
}

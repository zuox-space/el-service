"use client";

// components/keys/EmployeeKeyHistory.tsx
//
// История ключа для сотрудника: последние 5 операций со статусами,
// без фильтров. Отменённые заявки не показываем.
import { useEffect, useState } from "react";
import { Badge, EmptyState, Sheet, Skeleton } from "@/components/ui/kit";
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

export function EmployeeKeyHistory({
    keyId,
    onClose,
}: {
    keyId: string | null;
    onClose: () => void;
}) {
    const [items, setItems] = useState<KeyRequestDto[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!keyId) {
            setItems([]);
            return;
        }

        setLoading(true);
        fetch(`/api/keys/history?keyId=${encodeURIComponent(keyId)}&limit=30`, { cache: "no-store" })
            .then(response => response.json())
            .then(data => {
                const list: KeyRequestDto[] = Array.isArray(data.items) ? data.items : [];
                setItems(list.filter(item => item.status !== "CANCELLED").slice(0, 5));
            })
            .finally(() => setLoading(false));
    }, [keyId]);

    return (
        <Sheet
            open={Boolean(keyId)}
            onClose={onClose}
            title="История ключа"
            description="Последние 5 операций"
        >
            {loading ? (
                <Skeleton height={120} radius="card" />
            ) : items.length === 0 ? (
                <EmptyState title="Операций нет" description="Этот ключ ещё не выдавали" compact />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                    {items.map(item => (
                        <li key={item.id} className="px-3 py-2.5">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm text-fg">
                                        {TYPE_LABEL[item.type]} · {item.keys.map(key => key.roomNumber).join(", ")}
                                    </p>
                                    <p className="text-[11px] text-fg-subtle">
                                        {formatDateTime(item.createdAt)}
                                        {item.targetUserName ? ` · → ${item.targetUserName}` : ""}
                                    </p>
                                </div>
                                <Badge tone={item.status === "PENDING" ? "warning" : "success"}>
                                    {STATUS_LABEL[item.status]}
                                </Badge>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Sheet>
    );
}

"use client";

// components/guard/GuardNotReturnedTab.tsx
import { useMemo, useState } from "react";
import { Check, KeyRound, UserRound } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui/kit";
import type { KeyItemDto } from "@/lib/keys/queries";

function heldSince(value: string | null): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function GuardNotReturnedTab({
    keys,
    busyId,
    onConfirmReturn,
}: {
    keys: KeyItemDto[];
    busyId: string | null;
    onConfirmReturn: (key: KeyItemDto) => Promise<void>;
}) {
    const [keyQuery, setKeyQuery] = useState("");

    const filtered = useMemo(() => {
        const keyQ = keyQuery.trim().toLowerCase();
        return keys
            .filter(key => {
                if (keyQ && !`${key.roomNumber} ${key.roomName} ${key.buildingName}`.toLowerCase().includes(keyQ)) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                const left = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
                const right = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
                return left - right;
            });
    }, [keys, keyQuery]);

    const after18 = keys.some(
        key => key.issuedAt && new Date(key.issuedAt).getHours() < 18 && new Date().getHours() >= 18,
    );

    return (
        <Card padding="sm" className="flex h-full min-h-0 flex-col">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-fg">Не сдали ключи</p>
                    <p className="text-xs text-fg-muted">
                        Ключи на руках сотрудников · {keys.length}
                        {after18 ? " · есть невозвраты после 18:00" : ""}
                    </p>
                </div>
                <Badge tone={keys.length > 0 ? "warning" : "success"}>{filtered.length}</Badge>
            </div>

            <div className="mb-2 max-w-sm">
                <Input
                    label="Ключ"
                    value={keyQuery}
                    onChange={event => setKeyQuery(event.target.value)}
                    placeholder="Номер, кабинет или здание"
                />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={KeyRound}
                        title={keys.length === 0 ? "Все ключи сданы" : "Ничего не найдено"}
                        description={keys.length === 0 ? "На руках у сотрудников нет ключей" : "Измените фильтр по ключу"}
                        compact
                    />
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {filtered.map(key => (
                            <Card key={key.id} padding="sm" className="flex flex-col gap-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-fg">
                                            {key.roomNumber} {key.roomName ? `· ${key.roomName}` : ""}
                                        </p>
                                        <p className="truncate text-xs text-fg-muted">
                                            {key.buildingName} · {key.floor} этаж
                                        </p>
                                    </div>
                                    <Badge tone={key.pending ? "warning" : "neutral"}>
                                        {key.pending ? "сдаёт" : "на руках"}
                                    </Badge>
                                </div>
                                <p className="flex items-center gap-1 text-xs text-fg">
                                    <UserRound size={12} className="text-fg-subtle" aria-hidden />
                                    {key.holderName || "Сотрудник"}
                                </p>
                                <p className="text-[11px] text-fg-subtle">выдан {heldSince(key.issuedAt)}</p>
                                <Button
                                    size="sm"
                                    leftIcon={Check}
                                    className="mt-1 w-full"
                                    loading={busyId === key.id}
                                    onClick={() => void onConfirmReturn(key)}
                                >
                                    Подтвердить сдачу
                                </Button>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}

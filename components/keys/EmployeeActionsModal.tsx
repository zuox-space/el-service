"use client";

// components/keys/EmployeeActionsModal.tsx
//
// Модалки кнопки ключей на главной: взять, сдать, передать, принять.
// Логика — как в кабинете keys-app: сдача и передача из «моих ключей»,
// передача с поиском коллеги и проверкой доступа на сервере.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, KeyRound, Send } from "lucide-react";
import {
    Badge,
    Button,
    Checkbox,
    EmptyState,
    Input,
    Modal,
    ModalFooter,
    Select,
    useToast,
} from "@/components/ui/kit";
import { useKeys } from "./KeysProvider";
import { ColleaguePicker } from "./ColleaguePicker";
import { RequestCard } from "./RequestCard";
import type { KeyItemDto, KeyRequestDto } from "@/lib/keys/queries";

export type EmployeeActionMode = "take" | "my" | "transfer" | "incoming";

const TITLES: Record<EmployeeActionMode, string> = {
    take: "Взять ключ",
    my: "Мои ключи",
    transfer: "Передать ключ",
    incoming: "Принять ключ",
};

export function EmployeeActionsModal({
    open,
    mode,
    onClose,
}: {
    open: boolean;
    mode: EmployeeActionMode;
    onClose: () => void;
}) {
    const { state, users, submitRequest, decide, loadUsers } = useKeys();
    const toast = useToast();

    const [buildingId, setBuildingId] = useState("all");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [transferKey, setTransferKey] = useState<KeyItemDto | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setSelected([]);
        setQuery("");
        setTransferKey(null);
        void loadUsers();
    }, [open, mode, loadUsers]);

    const me = state?.me;
    const keys = state?.keys ?? [];
    const myKeys = keys.filter(key => key.holderId === me?.id);
    const buildings = state?.buildings ?? [];

    const available = useMemo(() => {
        const q = query.trim().toLowerCase();
        return keys.filter(key => {
            if (key.status !== "FREE" || key.pending) return false;
            if (buildingId !== "all" && key.buildingId !== buildingId) return false;
            if (q) {
                return `${key.roomNumber} ${key.roomName}`.toLowerCase().includes(q);
            }
            return true;
        });
    }, [keys, buildingId, query]);

    const incoming = (state?.requests ?? []).filter(
        item => item.type === "TRANSFER" && item.status === "PENDING" && item.targetUserId === me?.id,
    );

    const run = async (action: () => Promise<void>, successTitle: string) => {
        setBusy("action");
        try {
            await action();
            toast.show({ title: successTitle, description: "Охрана подтвердит операцию", tone: "success" });
            onClose();
        } catch (e) {
            toast.show({
                title: "Не удалось выполнить действие",
                description: e instanceof Error ? e.message : undefined,
                tone: "danger",
            });
        } finally {
            setBusy(null);
        }
    };

    const submitTake = () => {
        if (selected.length === 0) {
            toast.show({ title: "Выберите ключ", tone: "warning" });
            return;
        }
        void run(() => submitRequest({ type: "ISSUE", keyIds: selected }), "Заявка на выдачу отправлена");
    };

    const returnKey = (key: KeyItemDto) => {
        void run(() => submitRequest({ type: "RETURN", keyIds: [key.id] }), "Заявка на сдачу отправлена");
    };

    const transferTo = async (user: { id: string; name: string }) => {
        if (!transferKey) return;
        await run(
            () => submitRequest({ type: "TRANSFER", keyIds: [transferKey.id], targetUserId: user.id }),
            `Ключ передаётся: ${user.name}`,
        );
    };

    const decideRequest = async (request: KeyRequestDto, action: "confirm" | "cancel") => {
        await run(
            () => decide(request.id, action),
            action === "confirm" ? "Ключ принят" : "Передача отклонена",
        );
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={transferKey ? `Передать ключ ${transferKey.roomNumber}` : TITLES[mode]}
            description={
                mode === "take"
                    ? "Выберите здание и ключ из доступных вам"
                    : mode === "my"
                        ? "Ключи на руках: можно сдать или передать коллеге"
                        : mode === "transfer"
                            ? "Выберите ключ и коллегу — он подтвердит получение"
                            : "Коллеги передают вам ключи"
            }
            size="md"
            footer={
                mode === "take" ? (
                    <ModalFooter
                        onCancel={onClose}
                        onSubmit={submitTake}
                        submitLabel={`Взять${selected.length ? ` · ${selected.length}` : ""}`}
                        loading={busy === "action"}
                    />
                ) : undefined
            }
        >
            {transferKey ? (
                <div className="space-y-3">
                    <Button size="sm" variant="ghost" leftIcon={ArrowLeft} onClick={() => setTransferKey(null)}>
                        Назад
                    </Button>
                    <ColleaguePicker onSelect={user => void transferTo(user)} disabled={busy === "action"} />
                </div>
            ) : mode === "take" ? (
                <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Select
                            label="Здание"
                            value={buildingId}
                            onChange={setBuildingId}
                            options={[
                                { value: "all", label: "Все здания" },
                                ...buildings.map(building => ({ value: building.id, label: building.name })),
                            ]}
                        />
                        <Input
                            label="Номер или кабинет"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="101 или физика"
                        />
                    </div>

                    {available.length === 0 ? (
                        <EmptyState icon={KeyRound} title="Нет доступных ключей" description="Измените здание или запрос" compact />
                    ) : (
                        <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-card border border-border">
                            {available.map(key => (
                                <li key={key.id} className="px-3 py-2">
                                    <div className="flex items-start gap-2">
                                        <Checkbox
                                            checked={selected.includes(key.id)}
                                            onChange={() =>
                                                setSelected(current =>
                                                    current.includes(key.id)
                                                        ? current.filter(id => id !== key.id)
                                                        : [...current, key.id],
                                                )
                                            }
                                            label={`${key.roomNumber}${key.roomName ? ` · ${key.roomName}` : ""}`}
                                            description={`${key.buildingName} · ${key.floor} этаж`}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : mode === "incoming" ? (
                incoming.length === 0 ? (
                    <EmptyState icon={Send} title="Нет входящих передач" description="Коллеги пока не передают вам ключи" compact />
                ) : (
                    <div className="space-y-2">
                        {incoming.map(item => (
                            <div key={item.id} className="space-y-1">
                                <p className="text-xs text-fg-muted">
                                    Передаёт: <span className="font-medium text-fg">{item.requestedByName}</span>
                                </p>
                                <RequestCard
                                    item={item}
                                    mode="recipient"
                                    busy={busy === "action"}
                                    onDecide={(id, action) => {
                                        const request = incoming.find(entry => entry.id === id);
                                        if (request) void decideRequest(request, action);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )
            ) : (
                <div className="space-y-2">
                    {myKeys.length === 0 ? (
                        <EmptyState icon={KeyRound} title="У вас нет ключей" description="Сначала возьмите ключ" compact />
                    ) : (
                        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                            {myKeys.map(key => (
                                <li key={key.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-fg">
                                            {key.roomNumber} {key.roomName ? `· ${key.roomName}` : ""}
                                        </p>
                                        <p className="text-xs text-fg-muted">
                                            {key.buildingName} · {key.floor} этаж
                                        </p>
                                    </div>
                                    {key.pending ? (
                                        <Badge tone="warning">заявка</Badge>
                                    ) : (
                                        <div className="flex gap-1.5">
                                            <Button size="sm" onClick={() => returnKey(key)} disabled={busy === "action"}>
                                                Сдать
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => setTransferKey(key)}
                                                disabled={busy === "action"}
                                            >
                                                Передать…
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Modal>
    );
}

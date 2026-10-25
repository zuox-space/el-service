"use client";

// components/keys/EmployeeActionsModal.tsx
//
// Модалки кнопки ключей на главной: взять, сдать, передать, принять.
// Логика — как в кабинете keys-app: сдача и передача из «моих ключей»,
// передача с поиском коллеги и проверкой доступа на сервере.
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, KeyRound, Loader2, Send, XCircle } from "lucide-react";
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
    const { state, users, requestWithId, decide, loadUsers, refresh } = useKeys();
    const toast = useToast();

    const [buildingId, setBuildingId] = useState("all");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [transferKey, setTransferKey] = useState<KeyItemDto | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [pendingType, setPendingType] = useState<"ISSUE" | "RETURN" | "TRANSFER" | null>(null);
    const [pendingStartedAt, setPendingStartedAt] = useState(0);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!open) return;
        setSelected([]);
        setQuery("");
        setTransferKey(null);
        setPendingId(null);
        setPendingType(null);
        setPendingStartedAt(0);
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

    const pendingRequest = pendingId ? (state?.requests ?? []).find(item => item.id === pendingId) ?? null : null;
    const expiresAt = pendingRequest?.expiresAt
        ? new Date(pendingRequest.expiresAt).getTime()
        : pendingStartedAt + 60_000;
    const secondsLeft = pendingId ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
    const pendingStatus = pendingRequest?.status ?? "PENDING";

    const incoming = (state?.requests ?? []).filter(
        item => item.type === "TRANSFER" && item.status === "PENDING" && item.targetUserId === me?.id,
    );

    useEffect(() => {
        if (!pendingId) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [pendingId]);

    useEffect(() => {
        if (!pendingId || secondsLeft > 0 || pendingStatus !== "PENDING") return;
        void refresh();
    }, [pendingId, secondsLeft, pendingStatus, refresh]);

    const startRequest = async (
        type: "ISSUE" | "RETURN" | "TRANSFER",
        keyIds: string[],
        targetUserId?: string | null,
    ) => {
        setBusy("action");
        try {
            const id = await requestWithId({ type, keyIds, targetUserId });
            setPendingType(type);
            setPendingId(id);
            setPendingStartedAt(Date.now());
            setNow(Date.now());
            setTransferKey(null);
            setSelected([]);
        } catch (e) {
            toast.show({
                title: "Не удалось создать заявку",
                description: e instanceof Error ? e.message : undefined,
                tone: "danger",
            });
        } finally {
            setBusy(null);
        }
    };

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
        void startRequest("ISSUE", selected);
    };

    const returnKey = (key: KeyItemDto) => {
        void startRequest("RETURN", [key.id]);
    };

    const transferTo = async (user: { id: string; name: string }) => {
        if (!transferKey) return;
        await startRequest("TRANSFER", [transferKey.id], user.id);
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
            title={pendingId ? "Ожидание подтверждения" : transferKey ? `Передать ключ ${transferKey.roomNumber}` : TITLES[mode]}
            description={
                pendingId
                    ? "Заявка живёт 1 минуту — если охрана не ответит, она отменится"
                    : 
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
                pendingId ? (
                    <div className="flex justify-end">
                        <Button variant="ghost" onClick={onClose}>
                            Закрыть
                        </Button>
                    </div>
                ) : mode === "take" ? (
                    <ModalFooter
                        onCancel={onClose}
                        onSubmit={submitTake}
                        submitLabel={`Взять${selected.length ? ` · ${selected.length}` : ""}`}
                        loading={busy === "action"}
                    />
                ) : undefined
            }
        >
            {pendingId ? (
                <PendingRequestView
                    type={pendingType ?? "ISSUE"}
                    request={pendingRequest}
                    secondsLeft={secondsLeft}
                    onClose={onClose}
                />
            ) : transferKey ? (
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
                                            description={
                pendingId
                    ? "Заявка живёт 1 минуту — если охрана не ответит, она отменится"
                    : `${key.buildingName} · ${key.floor} этаж`}
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

function PendingRequestView({
    type,
    request,
    secondsLeft,
    onClose,
}: {
    type: "ISSUE" | "RETURN" | "TRANSFER";
    request: KeyRequestDto | null;
    secondsLeft: number;
    onClose: () => void;
}) {
    const status = request?.status ?? "PENDING";
    const expired = status === "PENDING" && secondsLeft <= 0;
    const rooms = request?.keys.map(item => item.roomNumber).join(", ") || "ключ";

    if (status === "CONFIRMED") {
        return (
            <div className="space-y-3 rounded-card border border-success/40 bg-success-soft p-4 text-center">
                <CheckCircle2 size={32} className="mx-auto text-success" aria-hidden />
                <p className="text-sm font-medium text-fg">Готово</p>
                <p className="text-xs text-fg-muted">
                    {type === "ISSUE" ? `Ключ ${rooms} выдан` : type === "RETURN" ? `Ключ ${rooms} принят` : `Ключ ${rooms} передан`}
                </p>
                <Button size="sm" onClick={onClose}>Закрыть</Button>
            </div>
        );
    }

    if (status === "CANCELLED" || expired) {
        return (
            <div className="space-y-3 rounded-card border border-border bg-surface-2 p-4 text-center">
                <XCircle size={32} className="mx-auto text-fg-subtle" aria-hidden />
                <p className="text-sm font-medium text-fg">{expired ? "Время истекло" : "Заявка отменена"}</p>
                <p className="text-xs text-fg-muted">Попробуйте создать заявку снова.</p>
                <Button size="sm" onClick={onClose}>Закрыть</Button>
            </div>
        );
    }

    return (
        <div className="space-y-3 rounded-card border border-warning/40 bg-warning-soft p-4 text-center">
            <Loader2 size={30} className="mx-auto animate-spin text-warning" aria-hidden />
            <p className="text-sm font-medium text-fg">
                {type === "ISSUE" && "Ждём подтверждения выдачи ключа"}
                {type === "RETURN" && "Ждём подтверждения сдачи ключа"}
                {type === "TRANSFER" && "Ждём подтверждения получателя"}
            </p>
            <p className="text-xs text-fg-muted">
                {request?.keys.map(item => `${item.roomNumber}${item.roomName ? ` · ${item.roomName}` : ""}`).join(", ") || "Ключ"}
                {type === "TRANSFER" && request?.targetUserName ? ` → ${request.targetUserName}` : ""}
            </p>
            <p className="flex items-center justify-center gap-1 text-xs tabular-nums text-fg-subtle">
                <Clock3 size={12} aria-hidden />
                осталось {secondsLeft} сек
            </p>
        </div>
    );
}
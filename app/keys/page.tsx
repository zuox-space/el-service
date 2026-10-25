"use client";

// app/keys/page.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { KeyRound, Star } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    Skeleton,
    Tabs,
    useToast,
} from "@/components/ui/kit";
import { EmployeeHeader } from "@/components/shell/EmployeeHeader";
import { NoAccess } from "@/components/access/NoAccess";
import { useAccess } from "@/components/access/AccessProvider";
import { KeysModal } from "@/components/keys/KeysModal";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";
import type { KeyItemDto, KeyRequestDto } from "@/lib/keys/queries";

const TYPE_LABEL: Record<string, string> = {
    ISSUE: "Выдача",
    RETURN: "Сдача",
    TRANSFER: "Передача",
};

const STATUS_LABEL: Record<string, string> = {
    PENDING: "ожидает",
    CONFIRMED: "подтверждена",
    CANCELLED: "отменена",
};

const STATUS_TONE: Record<string, "warning" | "success" | "neutral"> = {
    PENDING: "warning",
    CONFIRMED: "success",
    CANCELLED: "neutral",
};

export default function KeysPage() {
    const { data: session, status } = useSession();
    const { can, loading } = useAccess();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/login");
    }, [status, router]);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-full bg-bg">
                <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-6">
                    <Skeleton height={56} radius="card" />
                    <Skeleton height={140} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;
    if (!can("keys")) return <NoAccess title="Нет доступа к разделу «Ключи»" />;

    return (
        <div className="min-h-full bg-bg pb-24">
            <KeysProvider>
                <KeysScreen sessionName={session.user.name ?? null} sessionEmail={session.user.email ?? null} roles={(session.user.roles as string[]) ?? []} />
            </KeysProvider>
        </div>
    );
}

function KeysScreen({
    sessionName,
    sessionEmail,
    roles,
}: {
    sessionName: string | null;
    sessionEmail: string | null;
    roles: string[];
}) {
    const { state, loading, error, refresh, decide, toggleFavorite, submitRequest } = useKeys();
    const toast = useToast();

    const [tab, setTab] = useState("available");
    const [modal, setModal] = useState<{ open: boolean; type: "ISSUE" | "RETURN" | "TRANSFER"; keyId?: string | null }>({
        open: false,
        type: "ISSUE",
        keyId: null,
    });
    const [history, setHistory] = useState<KeyRequestDto[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const operator = Boolean(state?.canConfirm);

    useEffect(() => {
        setTab(operator ? "pending" : "available");
    }, [operator]);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch("/api/keys/history?limit=40", { cache: "no-store" });
            const data = await response.json();
            setHistory(Array.isArray(data.items) ? data.items : []);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === "history") void loadHistory();
    }, [tab, loadHistory]);

    const keys = state?.keys ?? [];
    const available = useMemo(() => keys.filter(key => key.status === "FREE"), [keys]);
    const mine = useMemo(() => keys.filter(key => key.holderId === state?.me.id), [keys, state?.me.id]);
    const pending = useMemo(() => (state?.requests ?? []).filter(item => item.status === "PENDING"), [state?.requests]);
    const out = useMemo(() => keys.filter(key => key.status === "ISSUED"), [keys]);

    const decideRequest = async (request: KeyRequestDto, action: "confirm" | "cancel") => {
        try {
            await decide(request.id, action);
            toast.show({ title: action === "confirm" ? "Заявка подтверждена" : "Заявка отменена", tone: "success" });
        } catch (e) {
            toast.show({ title: "Не удалось", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        }
    };

    const submitDirect = (type: "ISSUE" | "RETURN", keyId: string) => submitRequest({ type, keyIds: [keyId] });

    const quickRequest = async (key: KeyItemDto, type: "ISSUE" | "RETURN") => {
        try {
            await submitDirect(type, key.id);
            toast.show({ title: "Заявка отправлена", description: "Охрана подтвердит операцию", tone: "success" });
        } catch (e) {
            toast.show({ title: "Не удалось", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        }
    };

    const tabs = operator
        ? [
              { id: "pending", label: "Заявки", count: pending.length },
              { id: "out", label: "На руках", count: out.length },
              { id: "keys", label: "Ключи", count: keys.length },
              { id: "history", label: "Журнал" },
          ]
        : [
              { id: "available", label: "Свободные", count: available.length },
              { id: "mine", label: "Мои ключи", count: mine.length },
              { id: "requests", label: "Заявки", count: pending.length },
              { id: "history", label: "История" },
          ];

    return (
        <>
            <EmployeeHeader
                title="Ключи"
                backHref="/"
                userName={sessionName}
                userEmail={sessionEmail}
                roles={roles}
                onLogout={() => void signOut({ callbackUrl: "/login" })}
            />

            <main className="mx-auto w-full max-w-5xl space-y-3 px-4 py-4">
                {error && (
                    <Card padding="sm" className="border-danger/40 bg-danger-soft">
                        <p className="text-sm text-fg">{error}</p>
                        <Button size="sm" variant="ghost" className="mt-2" onClick={() => void refresh()}>
                            Повторить
                        </Button>
                    </Card>
                )}

                <Tabs value={tab} onChange={setTab} items={tabs} ariaLabel="Раздел ключей" size="sm" variant="scrollable" />

                {loading && !state ? (
                    <Skeleton height={180} radius="card" />
                ) : tab === "history" ? (
                    <HistoryList items={history} loading={historyLoading} />
                ) : (tab === "pending" || tab === "requests") ? (
                    <RequestsList
                        items={pending}
                        canConfirm={Boolean(state?.canConfirm)}
                        meId={state?.me.id ?? ""}
                        onDecide={decideRequest}
                        emptyTitle={operator ? "Заявок нет" : "У вас нет активных заявок"}
                    />
                ) : tab === "out" ? (
                    <KeysGrid
                        keys={out}
                        meId={state?.me.id ?? ""}
                        onFavorite={toggleFavorite}
                        onIssue={key => void quickRequest(key, "RETURN")}
                        onTransfer={key => setModal({ open: true, type: "TRANSFER", keyId: key.id })}
                        onReturn={key => setModal({ open: true, type: "RETURN", keyId: key.id })}
                        showHolder
                        emptyTitle="Все ключи на месте"
                    />
                ) : (
                    <KeysGrid
                        keys={tab === "available" ? available : tab === "mine" ? mine : keys}
                        meId={state?.me.id ?? ""}
                        onFavorite={toggleFavorite}
                        onIssue={key => void quickRequest(key, "ISSUE")}
                        onTransfer={key => setModal({ open: true, type: "TRANSFER", keyId: key.id })}
                        onReturn={key => setModal({ open: true, type: "RETURN", keyId: key.id })}
                        showHolder={tab !== "available"}
                        emptyTitle={tab === "mine" ? "У вас нет ключей" : "Свободных ключей нет"}
                    />
                )}
            </main>

            <KeysModal
                open={modal.open}
                initialType={modal.type}
                initialKeyId={modal.keyId}
                onClose={() => setModal({ ...modal, open: false })}
            />
        </>
    );
}

function KeysGrid({
    keys,
    meId,
    onFavorite,
    onIssue,
    onReturn,
    onTransfer,
    showHolder,
    emptyTitle,
}: {
    keys: KeyItemDto[];
    meId: string;
    onFavorite: (keyId: string) => Promise<void>;
    onIssue: (key: KeyItemDto) => void;
    onReturn: (key: KeyItemDto) => void;
    onTransfer: (key: KeyItemDto) => void;
    showHolder?: boolean;
    emptyTitle: string;
}) {
    if (keys.length === 0) {
        return <EmptyState icon={KeyRound} title={emptyTitle} description="Ключи появятся после добавления в админке" />;
    }

    return (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {keys.map(key => {
                const mine = key.holderId === meId;
                const busy = Boolean(key.pending);

                return (
                    <li key={key.id}>
                        <Card padding="sm" className="h-full">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-base font-semibold text-fg">{key.roomNumber}</p>
                                    <p className="truncate text-xs text-fg-muted">{key.roomName || key.buildingName}</p>
                                    <p className="mt-0.5 text-[11px] text-fg-subtle">
                                        {key.buildingName} · {key.floor} этаж
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <Badge tone={key.status === "FREE" ? "success" : "info"}>
                                        {key.status === "FREE" ? "свободен" : "выдан"}
                                    </Badge>
                                    <button
                                        type="button"
                                        aria-label={key.favorite ? "Убрать из избранного" : "В избранное"}
                                        onClick={() => void onFavorite(key.id)}
                                        className="flex h-8 w-8 items-center justify-center rounded-control text-fg-subtle hover:bg-surface-hover hover:text-warning"
                                    >
                                        <Star size={16} className={key.favorite ? "fill-warning text-warning" : ""} aria-hidden />
                                    </button>
                                </div>
                            </div>

                            {showHolder && key.holderName && (
                                <p className="mt-2 text-xs text-fg-muted">У {key.holderName}</p>
                            )}
                            {busy && <p className="mt-1 text-[11px] text-warning">Есть активная заявка</p>}

                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {key.status === "FREE" && !busy && (
                                    <Button size="sm" onClick={() => onIssue(key)}>
                                        Взять
                                    </Button>
                                )}
                                {mine && !busy && (
                                    <>
                                        <Button size="sm" variant="secondary" onClick={() => onReturn(key)}>
                                            Сдать
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => onTransfer(key)}>
                                            Передать
                                        </Button>
                                    </>
                                )}
                            </div>
                        </Card>
                    </li>
                );
            })}
        </ul>
    );
}

function RequestsList({
    items,
    canConfirm,
    meId,
    onDecide,
    emptyTitle,
}: {
    items: KeyRequestDto[];
    canConfirm: boolean;
    meId: string;
    onDecide: (request: KeyRequestDto, action: "confirm" | "cancel") => void;
    emptyTitle: string;
}) {
    if (items.length === 0) {
        return <EmptyState icon={KeyRound} title={emptyTitle} description="Новые заявки появятся здесь" />;
    }

    return (
        <ul className="space-y-2">
            {items.map(request => {
                const isTarget = request.targetUserId === meId;
                const isRequester = request.requestedById === meId;
                const canConfirmHere =
                    (request.type === "TRANSFER" && isTarget) || (request.type !== "TRANSFER" && canConfirm);
                const canCancel = canConfirm || isRequester || (request.type === "TRANSFER" && isTarget);

                return (
                    <li key={request.id}>
                        <Card padding="sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-fg">
                                        {TYPE_LABEL[request.type]} · {request.keys.map(key => key.roomNumber).join(", ")}
                                    </p>
                                    <p className="text-xs text-fg-muted">
                                        {request.requestedByName}
                                        {request.targetUserName ? ` → ${request.targetUserName}` : ""}
                                    </p>
                                </div>
                                <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {canConfirmHere && (
                                    <Button size="sm" onClick={() => onDecide(request, "confirm")}>
                                        Подтвердить
                                    </Button>
                                )}
                                {canCancel && (
                                    <Button size="sm" variant="ghost" onClick={() => onDecide(request, "cancel")}>
                                        Отменить
                                    </Button>
                                )}
                            </div>
                        </Card>
                    </li>
                );
            })}
        </ul>
    );
}

function HistoryList({ items, loading }: { items: KeyRequestDto[]; loading: boolean }) {
    if (loading) return <Skeleton height={140} radius="card" />;
    if (items.length === 0) {
        return <EmptyState icon={KeyRound} title="История пуста" description="Операции с ключами появятся здесь" />;
    }

    return (
        <ul className="space-y-2">
            {items.map(item => (
                <li key={item.id}>
                    <Card padding="sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-fg">
                                    {TYPE_LABEL[item.type]} · {item.keys.map(key => key.roomNumber).join(", ")}
                                </p>
                                <p className="text-xs text-fg-muted">
                                    {item.requestedByName}
                                    {item.targetUserName ? ` → ${item.targetUserName}` : ""}
                                </p>
                            </div>
                            <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-fg-subtle">
                            {new Date(item.createdAt).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                            {item.decidedByName ? ` · ${item.decidedByName}` : ""}
                        </p>
                    </Card>
                </li>
            ))}
        </ul>
    );
}

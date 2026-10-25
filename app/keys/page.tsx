"use client";

// app/keys/page.tsx
//
// Повторяет экраны keys-app:
//  • сотрудник — «Кабинет»: Ключи / Мои ключи / Избранное / Заявки;
//  • охрана — «Пульт охраны»: Выдача / Не сдали / Ключи / Журнал.
// Логика и подписи взяты из keys-app, UI — наш кит.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Check, Clock, Inbox, KeyRound, List, Lock, Star, X } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    Input,
    Modal,
    Select,
    Skeleton,
    Tabs,
    useToast,
} from "@/components/ui/kit";
import { EmployeeHeader } from "@/components/shell/EmployeeHeader";
import { NoAccess } from "@/components/access/NoAccess";
import { useAccess } from "@/components/access/AccessProvider";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";
import { KeyCard } from "@/components/keys/KeyCard";
import { RequestCard } from "@/components/keys/RequestCard";
import { HistoryPanel } from "@/components/keys/HistoryPanel";
import { KeyHistoryDrawer } from "@/components/keys/KeyHistoryDrawer";
import { EmployeeKeyHistory } from "@/components/keys/EmployeeKeyHistory";
import { ColleaguePicker } from "@/components/keys/ColleaguePicker";
import type { KeyItemDto, KeyRequestDto } from "@/lib/keys/queries";

const REQUEST_TYPE_LABEL: Record<string, string> = { ISSUE: "Выдача", RETURN: "Сдача", TRANSFER: "Передача" };
const REQUEST_STATUS_LABEL: Record<string, string> = {
    PENDING: "ожидает",
    CONFIRMED: "подтверждена",
    CANCELLED: "отменена",
};
const AFTER_HOURS_MIN = 18 * 60;
const HISTORY_PAGE = 5;

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "—";
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function filterKeys(keys: KeyItemDto[], buildingId: string, floor: string, query: string) {
    const q = query.trim().toLowerCase();
    return keys.filter(key => {
        if (buildingId !== "all" && key.buildingId !== buildingId) return false;
        if (floor !== "all" && String(key.floor) !== floor) return false;
        if (q) {
            const haystack = `${key.roomNumber} ${key.roomName} ${key.buildingName}`.toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });
}

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
                    <Skeleton height={180} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;
    if (!can("keys")) return <NoAccess title="Нет доступа к разделу «Ключи»" />;

    const roles = (session.user.roles as string[]) ?? [];
    const isSecurity = roles.includes("SECURITY");

    return (
        <div className="min-h-full bg-bg pb-24">
            <KeysProvider>
                {isSecurity ? (
                    <>
                        <EmployeeHeader
                            title="Пульт охраны"
                            backHref="/"
                            userName={session.user.name ?? null}
                            userEmail={session.user.email ?? null}
                            roles={roles}
                            onLogout={() => void signOut({ callbackUrl: "/login" })}
                        />
                        <SecurityDashboard />
                    </>
                ) : (
                    <Cabinet sessionName={session.user.name ?? null} sessionEmail={session.user.email ?? null} roles={roles} />
                )}
            </KeysProvider>
        </div>
    );
}

/* ============================ КАБИНЕТ СОТРУДНИКА ============================ */

function Cabinet({
    sessionName,
    sessionEmail,
    roles,
}: {
    sessionName: string | null;
    sessionEmail: string | null;
    roles: string[];
}) {
    const { state, loading, error, refresh, decide, toggleFavorite, submitRequest, users, loadUsers } = useKeys();
    const toast = useToast();

    const [tab, setTab] = useState("keys");
    const [buildingId, setBuildingId] = useState("all");
    const [floor, setFloor] = useState("all");
    const [query, setQuery] = useState("");
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [transferOpen, setTransferOpen] = useState(false);
    const [historyKeyId, setHistoryKeyId] = useState<string | null>(null);
    const [historyShown, setHistoryShown] = useState(HISTORY_PAGE);

    useEffect(() => {
        void loadUsers();
        const stored = window.localStorage.getItem("keys-building-id");
        if (stored) setBuildingId(stored);
    }, [loadUsers]);

    const me = state?.me;
    const keys = state?.keys ?? [];
    const favoriteIds = new Set(state?.favorites ?? []);
    const myKeys = keys.filter(key => key.holderId === me?.id);
    const incoming = (state?.requests ?? []).filter(
        item => item.type === "TRANSFER" && item.status === "PENDING" && item.targetUserId === me?.id,
    );
    const myRequests = (state?.requests ?? [])
        .filter(item => item.requestedById === me?.id && item.status !== "CANCELLED")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const shownRequests = myRequests.slice(0, historyShown);

    const filtered = filterKeys(keys, buildingId, floor, query);
    const visibleKeys = filtered.filter(key => {
        if (tab === "favorites") return favoriteIds.has(key.id);
        if (tab === "mine") return key.holderId === me?.id;
        return true;
    });

    const selectedKeys = keys.filter(key => selected.includes(key.id));
    const selectedFree = selectedKeys.filter(key => key.status === "FREE" && !key.pending);
    const selectedMine = selectedKeys.filter(key => key.holderId === me?.id && !key.pending);

    const perform = async (action: () => Promise<void>, errorTitle = "Не удалось выполнить действие") => {
        try {
            await action();
        } catch (e) {
            toast.show({
                title: errorTitle,
                description: e instanceof Error ? e.message : undefined,
                tone: "danger",
            });
        }
    };

    const floors = [...new Set(keys.map(key => key.floor))].sort((a, b) => a - b);

    function changeTab(next: string) {
        setTab(next);
        setSelectMode(false);
        setSelected([]);
    }

    function toggleSelect(keyId: string) {
        setSelected(current =>
            current.includes(keyId) ? current.filter(id => id !== keyId) : [...current, keyId],
        );
    }

    const tabs = [
        { id: "keys", label: "Ключи", icon: KeyRound },
        { id: "mine", label: "Мои ключи", icon: Lock, count: myKeys.length },
        { id: "favorites", label: "Избранное", icon: Star, count: favoriteIds.size },
        { id: "requests", label: "Заявки", icon: Inbox, count: incoming.length },
    ];

    const canSelectHere = tab === "keys" || tab === "mine";

    const filterRow = (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Номер или кабинет"
                aria-label="Поиск ключа"
                leftIcon={KeyRound}
                wrapperClassName="sm:flex-1"
            />
            <Select
                aria-label="Этаж"
                value={floor}
                onChange={setFloor}
                options={[
                    { value: "all", label: "Все этажи" },
                    ...floors.map(value => ({ value: String(value), label: `${value} этаж` })),
                ]}
                wrapperClassName="sm:w-40"
            />
        </div>
    );

    if (loading && !state) return <PageShell sessionName={sessionName} sessionEmail={sessionEmail} roles={roles} title="Кабинет"><Skeleton height={220} radius="card" /></PageShell>;

    return (
        <>
            <EmployeeHeader
                title="Кабинет"
                backHref="/"
                userName={sessionName}
                userEmail={sessionEmail}
                roles={roles}
                onLogout={() => void signOut({ callbackUrl: "/login" })}
            />

            <main className="mx-auto w-full max-w-5xl space-y-3 px-4 py-4">
                {error && <Card padding="sm" className="border-danger/40 bg-danger-soft"><p className="text-sm text-fg">{error}</p><Button size="sm" variant="ghost" className="mt-2" onClick={() => void refresh()}>Повторить</Button></Card>}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                        aria-label="Здание"
                        value={buildingId}
                        onChange={value => {
                            setBuildingId(value);
                            window.localStorage.setItem("keys-building-id", value);
                        }}
                        options={[{ value: "all", label: "Все здания" }, ...(state?.buildings ?? []).map(building => ({ value: building.id, label: building.name }))]}
                        wrapperClassName="sm:w-64"
                    />
                    <div className="flex-1" />
                    {canSelectHere && (
                        selectMode ? (
                            <Button size="sm" variant="ghost" leftIcon={X} onClick={() => { setSelectMode(false); setSelected([]); }}>
                                Готово
                            </Button>
                        ) : (
                            <Button size="sm" variant="secondary" leftIcon={List} onClick={() => setSelectMode(true)}>
                                Выбрать
                            </Button>
                        )
                    )}
                </div>

                <Tabs value={tab} onChange={changeTab} items={tabs} ariaLabel="Разделы кабинета" size="sm" variant="scrollable" />

                {tab === "keys" && (
                    <Card padding="sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-fg">Ключи школы</p>
                                <p className="text-xs text-fg-muted">
                                    {selectMode ? "Отметьте ключи и выберите действие внизу" : "Нажмите на ключ, чтобы увидеть историю"}
                                </p>
                            </div>
                            <Badge tone="neutral">{visibleKeys.length}</Badge>
                        </div>
                        {filterRow}
                        {visibleKeys.length === 0 ? (
                            <EmptyState icon={KeyRound} title="Ключей не найдено" description="Измените этаж или запрос" />
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {visibleKeys.map(key => (
                                    <KeyCard
                                        key={key.id}
                                        keyItem={key}
                                        currentUserId={me?.id}
                                        variant="cabinet"
                                        showBuilding={buildingId === "all"}
                                        selectMode={selectMode}
                                        selected={selected.includes(key.id)}
                                        onToggleSelect={() => toggleSelect(key.id)}
                                        busy={false}
                                        onRequest={item => void perform(() => submitRequest({ type: "ISSUE", keyIds: [item.id] }))}
                                        onReturn={item => void perform(() => submitRequest({ type: "RETURN", keyIds: [item.id] }))}
                                        onTransfer={(item, targetUserId) => void perform(() => submitRequest({ type: "TRANSFER", keyIds: [item.id], targetUserId }))}
                                        onCancelPending={request => void perform(() => decide(request.id, "cancel"))}
                                        onToggleFavorite={item => void perform(() => toggleFavorite(item.id))}
                                        onShowHistory={item => setHistoryKeyId(item.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                {tab === "mine" && (
                    <Card padding="sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-fg">Мои ключи</p>
                                <p className="text-xs text-fg-muted">
                                    {myKeys.length > 0 ? "Ключи на руках. Можно сдать или передать коллеге." : "Сейчас у вас нет ключей"}
                                </p>
                            </div>
                            <Badge tone={myKeys.length > 0 ? "success" : "neutral"}>{myKeys.length}</Badge>
                        </div>
                        {filterRow}
                        {visibleKeys.length === 0 ? (
                            <EmptyState icon={Lock} title={myKeys.length === 0 ? "Ключей на руках нет" : "Ничего не найдено"} description={myKeys.length === 0 ? "Запросите ключ на вкладке «Ключи»" : "Измените этаж или запрос"} />
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {visibleKeys.map(key => (
                                    <KeyCard
                                        key={key.id}
                                        keyItem={key}
                                        currentUserId={me?.id}
                                        variant="cabinet"
                                        showBuilding={buildingId === "all"}
                                        selectMode={selectMode}
                                        selected={selected.includes(key.id)}
                                        onToggleSelect={() => toggleSelect(key.id)}
                                        onRequest={item => void perform(() => submitRequest({ type: "ISSUE", keyIds: [item.id] }))}
                                        onReturn={item => void perform(() => submitRequest({ type: "RETURN", keyIds: [item.id] }))}
                                        onTransfer={(item, targetUserId) => void perform(() => submitRequest({ type: "TRANSFER", keyIds: [item.id], targetUserId }))}
                                        onCancelPending={request => void perform(() => decide(request.id, "cancel"))}
                                        onToggleFavorite={item => void perform(() => toggleFavorite(item.id))}
                                        onShowHistory={item => setHistoryKeyId(item.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                {tab === "favorites" && (
                    <Card padding="sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-fg">Избранное</p>
                                <p className="text-xs text-fg-muted">Ключи, отмеченные звёздочкой</p>
                            </div>
                            <Badge tone="neutral">{favoriteIds.size}</Badge>
                        </div>
                        {filterRow}
                        {visibleKeys.length === 0 ? (
                            <EmptyState icon={Star} title="Избранных ключей пока нет" description="Отметьте ключ звёздочкой на вкладке «Ключи»" />
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {visibleKeys.map(key => (
                                    <KeyCard
                                        key={key.id}
                                        keyItem={key}
                                        currentUserId={me?.id}
                                        variant="cabinet"
                                        showBuilding={buildingId === "all"}
                                        onRequest={item => void perform(() => submitRequest({ type: "ISSUE", keyIds: [item.id] }))}
                                        onReturn={item => void perform(() => submitRequest({ type: "RETURN", keyIds: [item.id] }))}
                                        onTransfer={(item, targetUserId) => void perform(() => submitRequest({ type: "TRANSFER", keyIds: [item.id], targetUserId }))}
                                        onCancelPending={request => void perform(() => decide(request.id, "cancel"))}
                                        onToggleFavorite={item => void perform(() => toggleFavorite(item.id))}
                                        onShowHistory={item => setHistoryKeyId(item.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </Card>
                )}

                {tab === "requests" && (
                    <>
                        <Card padding="sm" className={incoming.length > 0 ? "border-accent/40" : undefined}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-fg">Входящие</p>
                                    <p className="text-xs text-fg-muted">Коллеги передают вам ключи — подтвердите получение</p>
                                </div>
                                <Badge tone={incoming.length > 0 ? "info" : "neutral"}>{incoming.length}</Badge>
                            </div>
                            {incoming.length === 0 ? (
                                <EmptyState compact icon={KeyRound} title="Входящих заявок нет" description="Здесь появятся передачи ключей от коллег" />
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {incoming.map(item => (
                                        <RequestCard key={item.id} item={item} mode="recipient" onDecide={(id, action) => void perform(() => decide(id, action))} />
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card padding="sm">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-fg">Моя история</p>
                                    <p className="text-xs text-fg-muted">Выдача, сдача и передача · ожидающие можно отменить</p>
                                </div>
                                <Badge tone="neutral">{myRequests.length}</Badge>
                            </div>
                            {myRequests.length === 0 ? (
                                <EmptyState icon={Clock} title="Заявок пока нет" description="Запросите ключ на вкладке «Ключи»" compact />
                            ) : (
                                <>
                                    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                                        {shownRequests.map(request => (
                                            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-fg">
                                                        {REQUEST_TYPE_LABEL[request.type]} · {request.keys.map(key => key.roomNumber).join(", ")}
                                                    </p>
                                                    <p className="truncate text-[11px] text-fg-subtle">
                                                        {formatDateTime(request.createdAt)} · запросил {request.requestedByName}
                                                        {request.targetUserName ? ` → ${request.targetUserName}` : ""}
                                                    </p>
                                                    <p className="truncate text-[11px] text-fg-subtle">
                                                        {request.status === "PENDING"
                                                            ? "ждёт подтверждения"
                                                            : `подтвердил ${request.decidedByName ?? "—"}`}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    <Badge tone={request.status === "PENDING" ? "warning" : request.status === "CONFIRMED" ? "success" : "neutral"}>
                                                        {REQUEST_STATUS_LABEL[request.status]}
                                                    </Badge>
                                                    {request.status === "PENDING" && (
                                                        <Button size="sm" variant="ghost" onClick={() => void perform(() => decide(request.id, "cancel"))}>
                                                            Отменить
                                                        </Button>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    {myRequests.length > shownRequests.length && (
                                        <Button fullWidth variant="secondary" className="mt-2" onClick={() => setHistoryShown(value => value + HISTORY_PAGE)}>
                                            Показать ещё · {myRequests.length - shownRequests.length}
                                        </Button>
                                    )}
                                </>
                            )}
                        </Card>
                    </>
                )}
            </main>

            {selectMode && selected.length > 0 && (
                <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 px-3 lg:bottom-4">
                    <div className="mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-3 py-2.5 shadow-raised">
                        <span className="mr-auto text-xs text-fg-muted">Выбрано: <span className="font-medium text-fg">{selected.length}</span></span>
                        {selectedFree.length > 0 && (
                            <Button size="sm" leftIcon={Check} onClick={() => void perform(() => submitRequest({ type: "ISSUE", keyIds: selectedFree.map(key => key.id) })).then(() => { setSelected([]); setSelectMode(false); })}>
                                Запросить ({selectedFree.length})
                            </Button>
                        )}
                        {selectedMine.length > 0 && (
                            <>
                                <Button size="sm" onClick={() => void perform(() => submitRequest({ type: "RETURN", keyIds: selectedMine.map(key => key.id) })).then(() => { setSelected([]); setSelectMode(false); })}>
                                    Сдать ({selectedMine.length})
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>Передать…</Button>
                            </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Сбросить</Button>
                    </div>
                </div>
            )}

            <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Передать ключи" description="Получатель подтвердит получение" size="sm">
                <ColleaguePicker onSelect={user => { setTransferOpen(false); void perform(() => submitRequest({ type: "TRANSFER", keyIds: selectedMine.map(key => key.id), targetUserId: user.id })).then(() => { setSelected([]); setSelectMode(false); }); }} />
                <p className="mt-3 text-xs text-fg-muted">Передаётся: {selectedMine.map(key => key.roomNumber).join(", ")}</p>
            </Modal>

            <EmployeeKeyHistory keyId={historyKeyId} onClose={() => setHistoryKeyId(null)} />
        </>
    );
}

/* =============================== ПУЛЬТ ОХРАНЫ =============================== */

function SecurityDashboard() {
    const { state, loading, error, refresh, decide } = useKeys();
    const toast = useToast();

    const [tab, setTab] = useState("issue");
    const [buildingId, setBuildingId] = useState("all");
    const [floor, setFloor] = useState("all");
    const [query, setQuery] = useState("");
    const [historyKeyId, setHistoryKeyId] = useState<string | null>(null);
    const [nowMin, setNowMin] = useState(0);
    const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

    useEffect(() => {
        const read = () => {
            const now = new Date();
            setNowMin(now.getHours() * 60 + now.getMinutes());
        };
        read();
        const timer = setInterval(read, 60_000);
        return () => clearInterval(timer);
    }, []);

    const pending = (state?.requests ?? []).filter(item => item.status === "PENDING");
    const pendingIssue = pending.filter(item => item.type === "ISSUE");
    const pendingReturn = pending.filter(item => item.type === "RETURN");

    const keys = state?.keys ?? [];
    const filtered = filterKeys(keys, buildingId, floor, query);
    const issued = filtered.filter(key => key.status === "ISSUED" && !key.pending);
    const free = filtered.filter(key => key.status === "FREE" && !key.pending).length;
    const isAfter18 = nowMin >= AFTER_HOURS_MIN;

    const byHolder = new Map<string, KeyItemDto[]>();
    for (const key of issued) {
        const holder = key.holderName ?? "Неизвестно";
        byHolder.set(holder, [...(byHolder.get(holder) ?? []), key]);
    }

    const decideRequest = async (requestId: string, action: "confirm" | "cancel") => {
        setBusyRequestId(requestId);
        try {
            await decide(requestId, action);
        } catch (e) {
            toast.show({ title: "Действие не выполнено", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        } finally {
            setBusyRequestId(null);
        }
    };

    const tabs = [
        { id: "issue", label: "Выдача", icon: KeyRound, count: pendingIssue.length },
        { id: "notReturned", label: "Не сдали", icon: Clock, count: issued.length },
        { id: "keys", label: "Ключи", icon: KeyRound },
        { id: "history", label: "Журнал", icon: List },
    ];

    const floors = [...new Set(keys.map(key => key.floor))].sort((a, b) => a - b);

    if (loading && !state) return <Skeleton height={260} radius="card" />;

    return (
        <main className="mx-auto w-full max-w-5xl space-y-3 px-4 py-4">
            {error && <Card padding="sm" className="border-danger/40 bg-danger-soft"><p className="text-sm text-fg">{error}</p><Button size="sm" variant="ghost" className="mt-2" onClick={() => void refresh()}>Повторить</Button></Card>}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                    aria-label="Здание"
                    value={buildingId}
                    onChange={setBuildingId}
                    options={[{ value: "all", label: "Все здания" }, ...(state?.buildings ?? []).map(building => ({ value: building.id, label: building.name }))]}
                    wrapperClassName="sm:w-64"
                />
            </div>

            <Tabs value={tab} onChange={setTab} items={tabs} ariaLabel="Разделы пульта" size="sm" variant="scrollable" />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="Всего ключей" value={filtered.length} />
                <StatTile label="Свободно" value={free} tone="success" />
                <StatTile label="Выдано" value={issued.length} tone="info" />
                <StatTile label="Ожидают решения" value={pending.length} tone={pending.length > 0 ? "warning" : "neutral"} />
            </div>

            {tab === "issue" && (
                <div className="grid gap-3 lg:grid-cols-2">
                    <Card padding="sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div><p className="text-sm font-semibold text-fg">Выдача</p><p className="text-xs text-fg-muted">Сотрудники ждут ключи у охраны</p></div>
                            <Badge tone="info">{pendingIssue.length}</Badge>
                        </div>
                        {pendingIssue.length === 0 ? (
                            <EmptyState compact icon={KeyRound} title="Нет заявок на выдачу" description="Новые заявки появятся здесь автоматически" />
                        ) : (
                            <div className="space-y-2">
                                {pendingIssue.map(item => (
                                    <RequestCard key={item.id} item={item} mode="security" busy={busyRequestId === item.id} onDecide={(id, action) => void decideRequest(id, action)} />
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card padding="sm">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div><p className="text-sm font-semibold text-fg">Сдача</p><p className="text-xs text-fg-muted">Сотрудники возвращают ключи</p></div>
                            <Badge tone="success">{pendingReturn.length}</Badge>
                        </div>
                        {pendingReturn.length === 0 ? (
                            <EmptyState compact icon={KeyRound} title="Нет заявок на сдачу" description="Сдача подтверждается здесь же" />
                        ) : (
                            <div className="space-y-2">
                                {pendingReturn.map(item => (
                                    <RequestCard key={item.id} item={item} mode="security" busy={busyRequestId === item.id} onDecide={(id, action) => void decideRequest(id, action)} />
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {tab === "notReturned" && (
                <Card padding="sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-fg">Не сдали</p>
                            <p className="text-xs text-fg-muted">{isAfter18 ? "После 18:00 — просроченные ключи" : "Выданные ключи · отчёт критичен после 18:00"}</p>
                        </div>
                        <Badge tone={isAfter18 ? "danger" : "warning"}>{issued.length}</Badge>
                    </div>
                    {issued.length === 0 ? (
                        <EmptyState compact icon={KeyRound} title="Все ключи сданы" description="Ни одного ключа на руках" />
                    ) : (
                        <div className="space-y-2">
                            {[...byHolder.entries()].map(([holder, holderKeys]) => (
                                <div key={holder} className="overflow-hidden rounded-control border border-border">
                                    <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2">
                                        <p className="min-w-0 truncate text-sm font-medium text-fg">{holder}</p>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <span className="text-[11px] text-fg-subtle">{holderKeys.length} шт.</span>
                                            <Badge tone={isAfter18 ? "danger" : "warning"}>{isAfter18 ? "просрочено" : "на руках"}</Badge>
                                        </div>
                                    </div>
                                    <ul className="divide-y divide-border">
                                        {holderKeys.map(key => (
                                            <li key={key.id} className="flex items-center justify-between gap-3 px-3 py-2">
                                                <button type="button" onClick={() => setHistoryKeyId(key.id)} className="min-w-0 text-left text-sm text-fg hover:underline">
                                                    <span className="font-medium">{key.roomNumber}</span>{" "}
                                                    <span className="text-fg-muted">{key.roomName}</span>
                                                </button>
                                                <span className="shrink-0 text-[11px] text-fg-subtle">{formatDateTime(key.issuedAt)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {tab === "keys" && (
                <Card padding="sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div><p className="text-sm font-semibold text-fg">Состояние ключей</p><p className="text-xs text-fg-muted">{filtered.length} в выбранном здании</p></div>
                        <Badge tone="neutral">{filtered.length}</Badge>
                    </div>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                        <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Номер или кабинет" aria-label="Поиск ключа" leftIcon={KeyRound} wrapperClassName="sm:flex-1" />
                        <Select aria-label="Этаж" value={floor} onChange={setFloor} options={[{ value: "all", label: "Все этажи" }, ...floors.map(value => ({ value: String(value), label: `${value} этаж` }))]} wrapperClassName="sm:w-40" />
                    </div>
                    {filtered.length === 0 ? (
                        <EmptyState icon={KeyRound} title="Ключи не найдены" description="Измените этаж или запрос" />
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {filtered.map(key => (
                                <KeyCard key={key.id} keyItem={key} showBuilding={buildingId === "all"} onShowHistory={item => setHistoryKeyId(item.id)} />
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {tab === "history" && (
                <div>
                    <p className="mb-2 text-sm font-semibold text-fg">Журнал операций</p>
                    <HistoryPanel type="all" defaultToday pageSize={100} onOpenKey={setHistoryKeyId} />
                </div>
            )}

            <KeyHistoryDrawer keyId={historyKeyId} onClose={() => setHistoryKeyId(null)} />
        </main>
    );
}

function PageShell({ children }: { children: React.ReactNode; sessionName: string | null; sessionEmail: string | null; roles: string[]; title: string }) {
    return <main className="mx-auto w-full max-w-5xl px-4 py-4">{children}</main>;
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "info" | "warning" }) {
    const color = tone === "success" ? "text-success" : tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : "text-fg";
    return (
        <div className="rounded-card border border-border bg-surface p-3">
            <p className="text-xs text-fg-subtle">{label}</p>
            <p className={`mt-0.5 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
        </div>
    );
}

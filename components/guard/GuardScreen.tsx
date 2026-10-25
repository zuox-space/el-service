"use client";

// components/guard/GuardScreen.tsx
//
// Пульт охраны на планшете: один экран, сверху табы.
//  • Заявки — выдача/сдача слева, история справа;
//  • Ключи — состояние ключей с фильтром по зданию;
//  • Пропуска — выходы учеников;
//  • Самовыходы.
// Страница не скроллится на планшете: внутри табов свои прокручиваемые списки.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    EmptyState,
    Input,
    Modal,
    Select,
    Skeleton,
    Tabs,
    useToast,
} from "@/components/ui/kit";
import { RequestCard } from "@/components/keys/RequestCard";
import { KeyCard } from "@/components/keys/KeyCard";
import { KeyHistoryDrawer } from "@/components/keys/KeyHistoryDrawer";
import { GuardHistoryPanel } from "./GuardHistoryPanel";
import { GuardPassesTab, type GuardPass } from "./GuardPassesTab";
import { GuardSelfExitsTab, type GuardSelfExit } from "./GuardSelfExitsTab";
import { GuardNotReturnedTab } from "./GuardNotReturnedTab";
import type { KeyItemDto, KeyRequestDto, KeysState } from "@/lib/keys/queries";


interface GuardState {
    serverTime: string;
    keys: KeysState;
    passes: GuardPass[];
    selfExits: GuardSelfExit[];
}

const BUILDING_STORAGE_KEY = "guard-building-id";

export function GuardScreen() {
    const router = useRouter();
    const toast = useToast();

    const [state, setState] = useState<GuardState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState("requests");
    const [buildingId, setBuildingId] = useState("all");
    const [floor, setFloor] = useState("all");
    const [query, setQuery] = useState("");
    const [now, setNow] = useState(new Date());
    const [historyKeyId, setHistoryKeyId] = useState<string | null>(null);
    const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
    const [busyPassId, setBusyPassId] = useState<string | null>(null);
    const [approvalId, setApprovalId] = useState<string | null>(null);
    const [dismissedApprovals, setDismissedApprovals] = useState<string[]>([]);

    useEffect(() => {
        const stored = window.localStorage.getItem(BUILDING_STORAGE_KEY);
        if (stored) setBuildingId(stored);
    }, []);

    const refresh = useCallback(async () => {
        try {
            const response = await fetch("/api/guard/state", { cache: "no-store" });
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);
            const data = await response.json();
            setState(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
        const clock = setInterval(() => setNow(new Date()), 30_000);
        const poll = setInterval(() => void refresh(), 15_000);

        const source = new EventSource("/api/guard/events");
        const onUpdate = () => void refresh();
        source.addEventListener("update", onUpdate);

        return () => {
            clearInterval(clock);
            clearInterval(poll);
            source.removeEventListener("update", onUpdate);
            source.close();
        };
    }, [refresh]);

    const changeBuilding = (value: string) => {
        setBuildingId(value);
        window.localStorage.setItem(BUILDING_STORAGE_KEY, value);
    };

    const keys = state?.keys.keys ?? [];
    const buildings = state?.keys.buildings ?? [];
    const filteredKeys = useMemo(
        () => keys.filter(key => buildingId === "all" || key.buildingId === buildingId),
        [keys, buildingId],
    );

    const pending = (state?.keys.requests ?? []).filter(item => {
        if (item.status !== "PENDING") return false;
        if (buildingId === "all") return true;
        return item.keys.some(key => key.buildingId === buildingId);
    });
    const pendingIssue = pending.filter(item => item.type === "ISSUE");
    const pendingReturn = pending.filter(item => item.type === "RETURN");
    const approvalCandidates = [...pendingIssue, ...pendingReturn]
        .filter(item => item.expiresAt && new Date(item.expiresAt).getTime() > Date.now())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const approvalRequest = pending.find(item => item.id === approvalId) ?? null;

    useEffect(() => {
        if (approvalId && !pending.some(item => item.id === approvalId && item.status === "PENDING")) {
            setApprovalId(null);
            return;
        }
        if (approvalId) return;
        const next = approvalCandidates.find(item => !dismissedApprovals.includes(item.id));
        if (next) setApprovalId(next.id);
    }, [approvalId, pending, approvalCandidates, dismissedApprovals]);
    const issued = filteredKeys.filter(key => key.status === "ISSUED");
    const free = filteredKeys.filter(key => key.status === "FREE" && !key.pending);

    const buildingClassIds = useMemo(() => {
        if (buildingId === "all") return null;
        const building = buildings.find(item => item.id === buildingId);
        return new Set((building?.classes ?? []).map(item => item.id));
    }, [buildingId, buildings]);

    const filteredPasses = buildingClassIds
        ? (state?.passes ?? []).filter(pass => buildingClassIds.has(pass.classId))
        : (state?.passes ?? []);
    const filteredSelfExits = buildingClassIds
        ? (state?.selfExits ?? []).filter(item => buildingClassIds.has(item.classId))
        : (state?.selfExits ?? []);

    const floors = [...new Set(filteredKeys.map(key => key.floor))].sort((a, b) => a - b);
    const keysForGrid = filteredKeys.filter(key => {
        if (floor !== "all" && String(key.floor) !== floor) return false;
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            if (!`${key.roomNumber} ${key.roomName}`.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const decide = async (requestId: string, action: "confirm" | "cancel") => {
        setBusyRequestId(requestId);
        try {
            const response = await fetch(`/api/guard/requests/${requestId}/decision`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось обработать заявку");
            await refresh();
        } catch (e) {
            toast.show({
                title: "Действие не выполнено",
                description: e instanceof Error ? e.message : undefined,
                tone: "danger",
            });
        } finally {
            setBusyRequestId(null);
        }
    };

    const markPassUsed = async (passId: string) => {
        setBusyPassId(passId);
        try {
            const response = await fetch(`/api/guard/passes/${passId}/use`, { method: "POST" });
            if (!response.ok) throw new Error("Не удалось отметить выход");
            await refresh();
        } catch (e) {
            toast.show({ title: "Ошибка", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        } finally {
            setBusyPassId(null);
        }
    };

    const undoPass = async (passId: string) => {
        setBusyPassId(passId);
        try {
            const response = await fetch(`/api/guard/passes/${passId}/undo`, { method: "POST" });
            if (!response.ok) throw new Error("Не удалось отменить выход");
            await refresh();
        } catch (e) {
            toast.show({ title: "Ошибка", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        } finally {
            setBusyPassId(null);
        }
    };

    const logout = async () => {
        await fetch("/api/guard/logout", { method: "POST" });
        router.replace("/guard/login");
    };

    if (loading && !state) {
        return (
            <div className="min-h-dvh bg-bg p-4">
                <Skeleton height={56} radius="card" />
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <Skeleton height={300} radius="card" />
                    <Skeleton height={300} radius="card" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh flex-col bg-bg lg:h-dvh lg:overflow-hidden">
            <header className="shrink-0 border-b border-border bg-bg/95 px-3 py-2 backdrop-blur-sm">
                <div className="mx-auto flex w-full max-w-[1500px] items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-control bg-accent-solid text-accent-fg">
                        <ShieldCheck size={18} aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate text-sm font-semibold text-fg">Пульт охраны</h1>
                        <p className="text-[11px] text-fg-subtle">Планшет охраны</p>
                    </div>
                    <Select
                        aria-label="Здание"
                        value={buildingId}
                        onChange={changeBuilding}
                        options={[
                            { value: "all", label: "Все здания" },
                            ...buildings.map(building => ({ value: building.id, label: building.name })),
                        ]}
                        wrapperClassName="ml-2 w-36 sm:w-48"
                    />
                    <div className="ml-auto flex items-center gap-2">
                        <span className="hidden items-center gap-1 text-xs tabular-nums text-fg-muted sm:flex">
                            <Clock size={14} aria-hidden />
                            {now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <Button size="sm" variant="ghost" leftIcon={RefreshCw} onClick={() => void refresh()}>
                            Обновить
                        </Button>
                        <Button size="sm" variant="ghost" leftIcon={LogOut} onClick={() => void logout()}>
                            Выйти
                        </Button>
                    </div>
                </div>
            </header>

            <div className="shrink-0 border-b border-border bg-bg px-3">
                <div className="mx-auto w-full max-w-[1500px] py-1.5">
                    <Tabs
                        value={tab}
                        onChange={setTab}
                        size="sm"
                        variant="scrollable"
                        ariaLabel="Разделы пульта"
                        items={[
                            { id: "requests", label: "Заявки", count: pending.length },
                            { id: "keys", label: "Ключи", count: filteredKeys.length },
                            { id: "notReturned", label: "Не сдали", count: issued.length },
                            { id: "passes", label: "Пропуска", count: filteredPasses.length },
                            { id: "selfExits", label: "Самовыходы", count: filteredSelfExits.length },
                        ]}
                    />
                </div>
            </div>

            <main className="min-h-0 flex-1 overflow-y-auto p-3 lg:flex lg:flex-col lg:overflow-hidden">
                {error && (
                    <Card padding="sm" className="mb-2 border-danger/40 bg-danger-soft">
                        <p className="text-sm text-fg">{error}</p>
                    </Card>
                )}

                {tab === "requests" && (
                    <div className="flex h-full min-h-0 flex-col gap-2 lg:h-[calc(100dvh-8.75rem)] lg:overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2">

                            <div className="ml-auto flex flex-wrap gap-1.5">
                                <MiniStat label="Свободно" value={free.length} tone="success" />
                                <MiniStat label="Выдано" value={issued.length} tone="info" />
                                <MiniStat label="Ожидают" value={pending.length} tone="warning" />
                            </div>
                        </div>

                        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-2">
                            <div className="flex min-h-0 flex-col gap-2">
                                <RequestQueue
                                    title="Выдача"
                                    description="Сотрудники ждут ключи"
                                    tone="info"
                                    items={pendingIssue}
                                    busyRequestId={busyRequestId}
                                    onDecide={decide}
                                />
                                <RequestQueue
                                    title="Сдача"
                                    description="Сотрудники возвращают ключи"
                                    tone="success"
                                    items={pendingReturn}
                                    busyRequestId={busyRequestId}
                                    onDecide={decide}
                                />
                            </div>

                            <Card padding="sm" className="flex min-h-0 flex-col">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-semibold text-fg">История</p>
                                        <p className="text-xs text-fg-muted">Операции с ключами</p>
                                    </div>
                                    <Badge tone="neutral">{pending.length} в работе</Badge>
                                </div>
                                <div className="min-h-0 flex-1">
                                    <GuardHistoryPanel buildingId={buildingId} onOpenKey={setHistoryKeyId} />
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {tab === "keys" && (
                    <div className="flex h-full min-h-0 flex-col gap-2 lg:h-[calc(100dvh-8.75rem)] lg:overflow-hidden">
                        <div className="flex flex-wrap items-end gap-2">

                            <Input
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder="Номер или кабинет"
                                aria-label="Поиск ключа"
                                wrapperClassName="w-48"
                            />
                            <Select
                                aria-label="Этаж"
                                value={floor}
                                onChange={setFloor}
                                options={[
                                    { value: "all", label: "Все этажи" },
                                    ...floors.map(value => ({ value: String(value), label: `${value} этаж` })),
                                ]}
                                wrapperClassName="w-32"
                            />
                            <span className="ml-auto text-xs text-fg-subtle">{keysForGrid.length} ключей</span>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {keysForGrid.length === 0 ? (
                                <EmptyState icon={KeyRound} title="Ключей нет" description="Измените фильтр" />
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {keysForGrid.map(key => (
                                        <KeyCard
                                            key={key.id}
                                            keyItem={key}
                                            showBuilding={buildingId === "all"}
                                            onShowHistory={item => setHistoryKeyId(item.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === "notReturned" && (
                    <div className="h-full min-h-[60vh] lg:h-[calc(100dvh-8.75rem)] lg:min-h-0 lg:overflow-hidden">
                        <GuardNotReturnedTab keys={issued} />
                    </div>
                )}

                {tab === "passes" && (
                    <div className="h-full min-h-[60vh] lg:h-[calc(100dvh-8.75rem)] lg:min-h-0 lg:overflow-hidden">
                        <GuardPassesTab
                            passes={filteredPasses}
                            busyId={busyPassId}
                            onMarkUsed={markPassUsed}
                            onUndo={undoPass}
                        />
                    </div>
                )}
                {tab === "selfExits" && (
                    <div className="h-full min-h-[60vh] lg:h-[calc(100dvh-8.75rem)] lg:min-h-0 lg:overflow-hidden">
                        <GuardSelfExitsTab items={filteredSelfExits} />
                    </div>
                )}            </main>

            <GuardApprovalModal
                request={approvalRequest}
                onClose={() => {
                    if (approvalId) setDismissedApprovals(current => [...current, approvalId]);
                    setApprovalId(null);
                }}
                onExpire={() => void refresh()}
                onDecide={async (id, action) => {
                    await decide(id, action);
                    setDismissedApprovals(current => (id ? [...current, id] : current));
                    setApprovalId(null);
                }}
            />

            <KeyHistoryDrawer keyId={historyKeyId} onClose={() => setHistoryKeyId(null)} endpoint="/api/guard/history" />
        </div>
    );
}

function RequestQueue({
    title,
    description,
    tone,
    items,
    busyRequestId,
    onDecide,
}: {
    title: string;
    description: string;
    tone: "info" | "success";
    items: KeyRequestDto[];
    busyRequestId: string | null;
    onDecide: (id: string, action: "confirm" | "cancel") => Promise<void>;
}) {
    return (
        <Card padding="sm" className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1.5 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-fg">{title}</p>
                    <p className="text-[11px] text-fg-muted">{description}</p>
                </div>
                <Badge tone={tone}>{items.length}</Badge>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <EmptyState compact icon={KeyRound} title="Заявок нет" description="Появятся автоматически" />
                ) : (
                    <div className="space-y-1.5">
                        {items.map(item => (
                            <RequestCard
                                key={item.id}
                                item={item}
                                mode="security"
                                busy={busyRequestId === item.id}
                                onDecide={(id, action) => void onDecide(id, action)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}

function MiniStat({
    label,
    value,
    tone = "neutral",
}: {
    label: string;
    value: number;
    tone?: "neutral" | "success" | "info" | "warning";
}) {
    const color =
        tone === "success" ? "text-success" : tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : "text-fg";
    return (
        <div className="rounded-control border border-border bg-surface px-2 py-1">
            <span className="text-[10px] text-fg-subtle">{label} </span>
            <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
        </div>
    );
}

function GuardApprovalModal({
    request,
    onClose,
    onDecide,
    onExpire,
}: {
    request: KeyRequestDto | null;
    onClose: () => void;
    onDecide: (id: string, action: "confirm" | "cancel") => Promise<void>;
    onExpire: () => void;
}) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!request) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [request]);

    const seconds = request
        ? Math.max(0, Math.ceil((new Date(request.expiresAt ?? 0).getTime() - now) / 1000))
        : 0;

    useEffect(() => {
        if (request && seconds <= 0) onExpire();
    }, [request, seconds, onExpire]);

    if (!request) return null;

    return (
        <Modal
            open
            onClose={onClose}
            title={request.type === "ISSUE" ? "Заявка на выдачу ключа" : "Заявка на сдачу ключа"}
            description={`${request.requestedByName} · осталось ${seconds} сек`}
            size="sm"
        >
            <div className="space-y-2">
                <RequestCard
                    item={request}
                    mode="security"
                    busy={false}
                    onDecide={(id, action) => void onDecide(id, action)}
                />
                <p className="text-xs text-fg-subtle">
                    Если закрыть окно, заявка останется в очереди и истечёт через минуту.
                </p>
            </div>
        </Modal>
    );
}
"use client";

// components/guard/GuardScreen.tsx
//
// Планшет охраны: пропуска, самовыходы, ключи. Отдельная авторизация,
// не Яндекс и не NextAuth. Вёрстка рассчитана на горизонтальный планшет.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, KeyRound, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, Select, Skeleton, useToast } from "@/components/ui/kit";
import { RequestCard } from "@/components/keys/RequestCard";
import { KeyCard } from "@/components/keys/KeyCard";
import { HistoryPanel } from "@/components/keys/HistoryPanel";
import { KeyHistoryDrawer } from "@/components/keys/KeyHistoryDrawer";
import type { KeyItemDto, KeyRequestDto, KeysState } from "@/lib/keys/queries";

interface GuardPass {
    id: string;
    className: string;
    exitTime: string;
    reason: string;
    used: boolean;
    usedAt: string | null;
    students: Array<{ id?: string | number; name?: string }>;
}

interface GuardSelfExit {
    id: string;
    studentName: string;
    className: string;
    reason: string | null;
    startDate: string;
    endDate: string;
}

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
    const [buildingId, setBuildingId] = useState("all");
    const [now, setNow] = useState(new Date());
    const [historyKeyId, setHistoryKeyId] = useState<string | null>(null);
    const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

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
        const timer = setInterval(() => setNow(new Date()), 30_000);
        const poll = setInterval(() => void refresh(), 60_000);

        const source = new EventSource("/api/guard/events");
        const onUpdate = () => void refresh();
        source.addEventListener("update", onUpdate);

        return () => {
            clearInterval(timer);
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

    const pending = (state?.keys.requests ?? []).filter(item => item.status === "PENDING");
    const pendingIssue = pending.filter(item => item.type === "ISSUE");
    const pendingReturn = pending.filter(item => item.type === "RETURN");
    const issued = filteredKeys.filter(key => key.status === "ISSUED");
    const free = filteredKeys.filter(key => key.status === "FREE" && !key.pending);

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
            toast.show({ title: "Действие не выполнено", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        } finally {
            setBusyRequestId(null);
        }
    };

    const markPassUsed = async (passId: string) => {
        const response = await fetch(`/api/guard/passes/${passId}/use`, { method: "POST" });
        if (!response.ok) {
            toast.show({ title: "Не удалось отметить выход", tone: "danger" });
            return;
        }
        await refresh();
    };

    const logout = async () => {
        await fetch("/api/guard/logout", { method: "POST" });
        router.replace("/guard/login");
    };

    if (loading && !state) {
        return (
            <div className="min-h-dvh bg-bg p-4">
                <Skeleton height={72} radius="card" />
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <Skeleton height={260} radius="card" />
                    <Skeleton height={260} radius="card" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-bg">
            <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur-sm">
                <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-3 px-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-control bg-accent-solid text-accent-fg">
                        <ShieldCheck size={20} aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold text-fg">Пульт охраны</h1>
                        <p className="text-xs text-fg-subtle">Планшет охраны · ключи и пропуска</p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <span className="hidden items-center gap-1.5 text-sm tabular-nums text-fg-muted sm:flex">
                            <Clock size={15} aria-hidden />
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

            <main className="mx-auto w-full max-w-[1500px] space-y-3 px-4 py-4">
                {error && (
                    <Card padding="sm" className="border-danger/40 bg-danger-soft">
                        <p className="text-sm text-fg">{error}</p>
                    </Card>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                    <PassesPanel passes={state?.passes ?? []} onMarkUsed={markPassUsed} />
                    <SelfExitsPanel items={state?.selfExits ?? []} />
                </div>

                <Card padding="sm">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-fg">Ключи</p>
                            <p className="text-xs text-fg-muted">Выдача и приём ключей, состояние и журнал</p>
                        </div>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <Select
                                aria-label="Здание"
                                value={buildingId}
                                onChange={changeBuilding}
                                options={[{ value: "all", label: "Все здания" }, ...buildings.map(building => ({ value: building.id, label: building.name }))]}
                                wrapperClassName="w-52"
                            />
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatTile label="Всего" value={filteredKeys.length} />
                        <StatTile label="Свободно" value={free.length} tone="success" />
                        <StatTile label="Выдано" value={issued.length} tone="info" />
                        <StatTile label="Ожидают" value={pending.length} tone={pending.length ? "warning" : "neutral"} />
                    </div>
                </Card>

                <div className="grid gap-3 lg:grid-cols-2">
                    <div className="space-y-3">
                        <Card padding="sm">
                            <div className="mb-2 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-fg">Выдача</p>
                                    <p className="text-xs text-fg-muted">Сотрудники ждут ключи</p>
                                </div>
                                <Badge tone="info">{pendingIssue.length}</Badge>
                            </div>
                            {pendingIssue.length === 0 ? (
                                <EmptyState compact icon={KeyRound} title="Нет заявок на выдачу" description="Новые появятся автоматически" />
                            ) : (
                                <div className="space-y-2">
                                    {pendingIssue.map(item => (
                                        <RequestCard key={item.id} item={item} mode="security" busy={busyRequestId === item.id} onDecide={(id, action) => void decide(id, action)} />
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card padding="sm">
                            <div className="mb-2 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-fg">Сдача</p>
                                    <p className="text-xs text-fg-muted">Сотрудники возвращают ключи</p>
                                </div>
                                <Badge tone="success">{pendingReturn.length}</Badge>
                            </div>
                            {pendingReturn.length === 0 ? (
                                <EmptyState compact icon={KeyRound} title="Нет заявок на сдачу" description="Сдача подтверждается здесь" />
                            ) : (
                                <div className="space-y-2">
                                    {pendingReturn.map(item => (
                                        <RequestCard key={item.id} item={item} mode="security" busy={busyRequestId === item.id} onDecide={(id, action) => void decide(id, action)} />
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    <Card padding="sm">
                        <div className="mb-2">
                            <p className="text-sm font-semibold text-fg">История</p>
                            <p className="text-xs text-fg-muted">Операции с ключами за сегодня</p>
                        </div>
                        <HistoryPanel
                            type="all"
                            defaultToday
                            pageSize={50}
                            buildingId={buildingId}
                            endpoint="/api/guard/history"
                            onOpenKey={setHistoryKeyId}
                        />
                    </Card>
                </div>

                <Card padding="sm">
                    <div className="mb-2 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-fg">Состояние ключей</p>
                            <p className="text-xs text-fg-muted">
                                {buildingId === "all" ? "Все здания" : buildings.find(item => item.id === buildingId)?.name}
                            </p>
                        </div>
                        <Badge tone="neutral">{filteredKeys.length}</Badge>
                    </div>
                    {filteredKeys.length === 0 ? (
                        <EmptyState icon={KeyRound} title="Ключей нет" description="Ключи появятся после добавления в админке" />
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {filteredKeys.map(key => (
                                <KeyCard key={key.id} keyItem={key} showBuilding={buildingId === "all"} onShowHistory={item => setHistoryKeyId(item.id)} />
                            ))}
                        </div>
                    )}
                </Card>
            </main>

            <KeyHistoryDrawer keyId={historyKeyId} onClose={() => setHistoryKeyId(null)} endpoint="/api/guard/history" />
        </div>
    );
}

function PassesPanel({ passes, onMarkUsed }: { passes: GuardPass[]; onMarkUsed: (id: string) => Promise<void> }) {
    return (
        <Card padding="sm">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-fg">Пропуска</p>
                    <p className="text-xs text-fg-muted">Выходы учеников на сегодня</p>
                </div>
                <Badge tone="info">{passes.length}</Badge>
            </div>
            {passes.length === 0 ? (
                <EmptyState compact icon={KeyRound} title="Пропусков нет" description="На сегодня пропуска не оформляли" />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                    {passes.map(pass => (
                        <li key={pass.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-fg">
                                    <span className="font-medium">{pass.className}</span> · {pass.students.map(student => student.name).filter(Boolean).join(", ") || "Ученики"}
                                </p>
                                <p className="text-xs text-fg-muted">
                                    {pass.exitTime} · {pass.reason}
                                </p>
                            </div>
                            {pass.used ? (
                                <Badge tone="success">
                                    вышел {pass.usedAt ? new Date(pass.usedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""}
                                </Badge>
                            ) : (
                                <Button size="sm" onClick={() => void onMarkUsed(pass.id)}>
                                    Отметить выход
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

function SelfExitsPanel({ items }: { items: GuardSelfExit[] }) {
    return (
        <Card padding="sm">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-fg">Самовыходы</p>
                    <p className="text-xs text-fg-muted">Ученики, которые могут уходить сами</p>
                </div>
                <Badge tone="neutral">{items.length}</Badge>
            </div>
            {items.length === 0 ? (
                <EmptyState compact icon={KeyRound} title="Самовыходов нет" description="На сегодня разрешений нет" />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                    {items.map(item => (
                        <li key={item.id} className="px-3 py-2">
                            <p className="truncate text-sm text-fg">
                                <span className="font-medium">{item.className}</span> · {item.studentName}
                            </p>
                            <p className="text-xs text-fg-muted">
                                {new Date(item.startDate).toLocaleDateString("ru-RU")} — {new Date(item.endDate).toLocaleDateString("ru-RU")}
                                {item.reason ? ` · ${item.reason}` : ""}
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "info" | "warning" }) {
    const color = tone === "success" ? "text-success" : tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : "text-fg";
    return (
        <div className="rounded-control border border-border bg-surface-2 px-2.5 py-2">
            <p className="text-[11px] text-fg-subtle">{label}</p>
            <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
        </div>
    );
}

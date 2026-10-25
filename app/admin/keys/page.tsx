"use client";

// app/admin/keys/page.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Checkbox,
    EmptyState,
    Input,
    Modal,
    ModalFooter,
    PageHeader,
    Select,
    Skeleton,
    Tabs,
    Textarea,
    useToast,
} from "@/components/ui/kit";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";
import type { KeyItemDto, KeyRequestDto } from "@/lib/keys/queries";

const TYPE_LABEL: Record<string, string> = { ISSUE: "Выдача", RETURN: "Сдача", TRANSFER: "Передача" };

export default function AdminKeysPage() {
    return (
        <KeysProvider>
            <AdminKeysScreen />
        </KeysProvider>
    );
}

function AdminKeysScreen() {
    const { state, loading, users, loadUsers, refresh, decide, error } = useKeys();
    const toast = useToast();

    const [tab, setTab] = useState("keys");
    const [addOpen, setAddOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [permissionsKey, setPermissionsKey] = useState<KeyItemDto | null>(null);
    const [history, setHistory] = useState<KeyRequestDto[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const keys = state?.keys ?? [];
    const buildings = state?.buildings ?? [];
    const pending = (state?.requests ?? []).filter(item => item.status === "PENDING");

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch("/api/keys/history?limit=60", { cache: "no-store" });
            const data = await response.json();
            setHistory(Array.isArray(data.items) ? data.items : []);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === "history") void loadHistory();
    }, [tab, loadHistory]);

    const removeKey = async (key: KeyItemDto) => {
        if (!window.confirm(`Удалить ключ ${key.roomNumber}?`)) return;
        const response = await fetch(`/api/keys/${key.id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            toast.show({ title: "Не удалось удалить", description: data.error, tone: "danger" });
            return;
        }
        toast.show({ title: "Ключ удалён", tone: "success" });
        await refresh();
    };

    const decideRequest = async (request: KeyRequestDto, action: "confirm" | "cancel") => {
        try {
            await decide(request.id, action);
            toast.show({ title: action === "confirm" ? "Подтверждено" : "Отменено", tone: "success" });
        } catch (e) {
            toast.show({ title: "Ошибка", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        }
    };

    const tabs = [
        { id: "keys", label: "Ключи", count: keys.length },
        { id: "buildings", label: "Здания", count: buildings.length },
        { id: "requests", label: "Заявки", count: pending.length },
        { id: "history", label: "Журнал" },
    ];

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Ключи"
                subtitle="Ключи, здания, заявки и журнал операций"
                onBack={() => (window.location.href = "/admin")}
                actions={
                    <>
                        <Button size="sm" variant="ghost" leftIcon={Upload} onClick={() => setImportOpen(true)}>
                            Импорт
                        </Button>
                        <Button size="sm" leftIcon={Plus} onClick={() => setAddOpen(true)}>
                            Ключ
                        </Button>
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1200px] space-y-3 px-4 py-4">
                {error && <Card padding="sm" className="border-danger/40 bg-danger-soft"><p className="text-sm text-fg">{error}</p></Card>}

                <Tabs value={tab} onChange={setTab} items={tabs} ariaLabel="Администрирование ключами" size="sm" />

                {loading && !state ? (
                    <Skeleton height={200} radius="card" />
                ) : tab === "keys" ? (
                    <KeysTable keys={keys} onDelete={removeKey} onPermissions={setPermissionsKey} />
                ) : tab === "buildings" ? (
                    <BuildingsPanel buildings={buildings} onChanged={refresh} />
                ) : tab === "requests" ? (
                    <RequestsPanel items={pending} onDecide={decideRequest} />
                ) : (
                    <HistoryPanel items={history} loading={historyLoading} />
                )}
            </main>

            <AddKeyModal open={addOpen} buildings={buildings} onClose={() => setAddOpen(false)} onCreated={refresh} />
            <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refresh} />
            <PermissionsModal
                keyItem={permissionsKey}
                users={users}
                onClose={() => setPermissionsKey(null)}
                onSaved={refresh}
            />
        </div>
    );
}

function KeysTable({
    keys,
    onDelete,
    onPermissions,
}: {
    keys: KeyItemDto[];
    onDelete: (key: KeyItemDto) => void;
    onPermissions: (key: KeyItemDto) => void;
}) {
    if (keys.length === 0) {
        return <EmptyState icon={KeyRound} title="Ключей нет" description="Добавьте первый ключ или импортируйте CSV" />;
    }

    return (
        <Card padding="none">
            <ul className="divide-y divide-border">
                {keys.map(key => (
                    <li key={key.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-fg">
                                {key.roomNumber} · {key.roomName || "без названия"}
                            </p>
                            <p className="text-xs text-fg-muted">
                                {key.buildingName} · {key.floor} этаж
                                {key.holderName ? ` · у ${key.holderName}` : ""}
                            </p>
                        </div>
                        <Badge tone={key.status === "FREE" ? "success" : "info"}>
                            {key.status === "FREE" ? "свободен" : "выдан"}
                        </Badge>
                        <Button size="sm" variant="ghost" leftIcon={ShieldCheck} onClick={() => onPermissions(key)}>
                            Доступ
                        </Button>
                        <Button size="sm" variant="ghost" leftIcon={Trash2} onClick={() => onDelete(key)}>
                            Удалить
                        </Button>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

function BuildingsPanel({
    buildings,
    onChanged,
}: {
    buildings: Array<{ id: string; name: string; address: string }>;
    onChanged: () => Promise<void>;
}) {
    const toast = useToast();
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");

    const add = async () => {
        const response = await fetch("/api/keys/buildings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, address }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            toast.show({ title: "Ошибка", description: data.error, tone: "danger" });
            return;
        }
        setName("");
        setAddress("");
        await onChanged();
    };

    const remove = async (id: string) => {
        if (!window.confirm("Удалить здание?")) return;
        const response = await fetch(`/api/keys/buildings/${id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            toast.show({ title: "Ошибка", description: data.error, tone: "danger" });
            return;
        }
        await onChanged();
    };

    return (
        <div className="space-y-2">
            <Card padding="sm">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <Input label="Название" value={name} onChange={e => setName(e.target.value)} />
                    <Input label="Адрес" value={address} onChange={e => setAddress(e.target.value)} />
                    <Button onClick={() => void add()} disabled={!name.trim()}>
                        Добавить
                    </Button>
                </div>
            </Card>

            {buildings.length === 0 ? (
                <EmptyState title="Зданий нет" description="Добавьте здание, чтобы создавать ключи" />
            ) : (
                <Card padding="none">
                    <ul className="divide-y divide-border">
                        {buildings.map(building => (
                            <li key={building.id} className="flex items-center gap-2 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-fg">{building.name}</p>
                                    {building.address && <p className="text-xs text-fg-muted">{building.address}</p>}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => void remove(building.id)}>
                                    Удалить
                                </Button>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}

function RequestsPanel({
    items,
    onDecide,
}: {
    items: KeyRequestDto[];
    onDecide: (request: KeyRequestDto, action: "confirm" | "cancel") => void;
}) {
    if (items.length === 0) return <EmptyState icon={KeyRound} title="Заявок нет" description="Все заявки обработаны" />;

    return (
        <div className="space-y-2">
            {items.map(request => (
                <Card key={request.id} padding="sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p className="text-sm font-semibold text-fg">
                                {TYPE_LABEL[request.type]} · {request.keys.map(key => key.roomNumber).join(", ")}
                            </p>
                            <p className="text-xs text-fg-muted">
                                {request.requestedByName}
                                {request.targetUserName ? ` → ${request.targetUserName}` : ""}
                            </p>
                        </div>
                        <div className="flex gap-1.5">
                            <Button size="sm" onClick={() => onDecide(request, "confirm")}>
                                Подтвердить
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onDecide(request, "cancel")}>
                                Отменить
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function HistoryPanel({ items, loading }: { items: KeyRequestDto[]; loading: boolean }) {
    if (loading) return <Skeleton height={160} radius="card" />;
    if (items.length === 0) return <EmptyState icon={KeyRound} title="Журнал пуст" description="Операции появятся здесь" />;

    return (
        <Card padding="none">
            <ul className="divide-y divide-border">
                {items.map(item => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm text-fg">
                                {TYPE_LABEL[item.type]} · {item.keys.map(key => key.roomNumber).join(", ")}
                            </p>
                            <p className="text-xs text-fg-muted">
                                {item.requestedByName}
                                {item.targetUserName ? ` → ${item.targetUserName}` : ""}
                            </p>
                        </div>
                        <Badge tone={item.status === "CONFIRMED" ? "success" : item.status === "PENDING" ? "warning" : "neutral"}>
                            {item.status === "CONFIRMED" ? "подтверждено" : item.status === "PENDING" ? "ожидает" : "отменено"}
                        </Badge>
                        <span className="text-[11px] text-fg-subtle">
                            {new Date(item.createdAt).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

function AddKeyModal({
    open,
    buildings,
    onClose,
    onCreated,
}: {
    open: boolean;
    buildings: Array<{ id: string; name: string }>;
    onClose: () => void;
    onCreated: () => Promise<void>;
}) {
    const toast = useToast();
    const [buildingId, setBuildingId] = useState("");
    const [roomNumber, setRoomNumber] = useState("");
    const [roomName, setRoomName] = useState("");
    const [floor, setFloor] = useState("1");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ buildingId, roomNumber, roomName, floor: Number(floor), accessScope: "ALL" }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось создать ключ");
            toast.show({ title: "Ключ добавлен", tone: "success" });
            setRoomNumber("");
            setRoomName("");
            onClose();
            await onCreated();
        } catch (e) {
            toast.show({ title: "Ошибка", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Новый ключ"
            size="sm"
            footer={<ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel="Добавить" loading={saving} disabled={!buildingId || !roomNumber.trim()} />}
        >
            <div className="space-y-2">
                <Select
                    label="Здание"
                    placeholder="Выберите здание"
                    value={buildingId}
                    onChange={setBuildingId}
                    options={buildings.map(building => ({ value: building.id, label: building.name }))}
                />
                <Input label="Номер" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} />
                <Input label="Название кабинета" value={roomName} onChange={e => setRoomName(e.target.value)} />
                <Input label="Этаж" type="number" value={floor} onChange={e => setFloor(e.target.value)} />
            </div>
        </Modal>
    );
}

function ImportModal({
    open,
    onClose,
    onImported,
}: {
    open: boolean;
    onClose: () => void;
    onImported: () => Promise<void>;
}) {
    const toast = useToast();
    const [csv, setCsv] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/keys/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csv }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось импортировать");
            toast.show({
                title: "Импорт завершён",
                description: `Зданий +${data.buildings}, ключей +${data.keys}, обновлено ${data.updated}`,
                tone: "success",
            });
            onClose();
            await onImported();
        } catch (e) {
            toast.show({ title: "Ошибка", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Импорт ключей"
            description="CSV: building;building_address;room_number;room_name;floor"
            size="md"
            footer={<ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel="Импортировать" loading={saving} disabled={!csv.trim()} />}
        >
            <Textarea
                label="CSV"
                rows={10}
                value={csv}
                onChange={e => setCsv(e.target.value)}
                placeholder={"Основной корпус;ул. Школьная, 1;101;Кабинет математики;1"}
            />
        </Modal>
    );
}

function PermissionsModal({
    keyItem,
    users,
    onClose,
    onSaved,
}: {
    keyItem: KeyItemDto | null;
    users: Array<{ id: string; name: string }>;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const toast = useToast();
    const [scope, setScope] = useState<"ALL" | "RESTRICTED">("ALL");
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!keyItem) return;
        setScope(keyItem.accessScope);
        setLoading(true);
        fetch(`/api/keys/${keyItem.id}/permissions`)
            .then(response => response.json())
            .then(data => setSelected(Array.isArray(data.userIds) ? data.userIds : []))
            .finally(() => setLoading(false));
    }, [keyItem]);

    const save = async () => {
        if (!keyItem) return;
        const response = await fetch(`/api/keys/${keyItem.id}/permissions`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessScope: scope, userIds: selected }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            toast.show({ title: "Ошибка", description: data.error, tone: "danger" });
            return;
        }
        toast.show({ title: "Доступ обновлён", tone: "success" });
        onClose();
        await onSaved();
    };

    return (
        <Modal
            open={Boolean(keyItem)}
            onClose={onClose}
            title={keyItem ? `Доступ к ключу ${keyItem.roomNumber}` : "Доступ"}
            size="md"
            footer={<ModalFooter onCancel={onClose} onSubmit={() => void save()} submitLabel="Сохранить" loading={loading} />}
        >
            <div className="space-y-3">
                <Select
                    label="Кто может брать"
                    value={scope}
                    onChange={value => setScope(value as "ALL" | "RESTRICTED")}
                    options={[
                        { value: "ALL", label: "Все сотрудники" },
                        { value: "RESTRICTED", label: "Только выбранные" },
                    ]}
                />

                {scope === "RESTRICTED" && (
                    <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-card border border-border p-2">
                        {users.map(user => (
                            <Checkbox
                                key={user.id}
                                checked={selected.includes(user.id)}
                                onChange={() =>
                                    setSelected(current =>
                                        current.includes(user.id)
                                            ? current.filter(id => id !== user.id)
                                            : [...current, user.id],
                                    )
                                }
                                label={user.name}
                            />
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}

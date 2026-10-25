"use client";

// app/admin/keys/page.tsx
import { useEffect, useMemo, useState } from "react";
import { History, KeyRound, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    EmptyState,
    Input,
    Modal,
    ModalFooter,
    PageHeader,
    Select,
    Sheet,
    Skeleton,
    Textarea,
    useToast,
} from "@/components/ui/kit";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";
import { AdminKeyHistorySheet } from "@/components/keys/AdminKeyHistorySheet";
import type { KeyItemDto } from "@/lib/keys/queries";

export default function AdminKeysPage() {
    return (
        <KeysProvider>
            <AdminKeysScreen />
        </KeysProvider>
    );
}

function AdminKeysScreen() {
    const { state, loading, error, refresh, users, loadUsers } = useKeys();
    const toast = useToast();

    const [buildingId, setBuildingId] = useState("all");
    const [floor, setFloor] = useState("all");
    const [query, setQuery] = useState("");
    const [createOpen, setCreateOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [accessKey, setAccessKey] = useState<KeyItemDto | null>(null);
    const [historyKey, setHistoryKey] = useState<KeyItemDto | null>(null);
    const [deleteKey, setDeleteKey] = useState<KeyItemDto | null>(null);

    const keys = state?.keys ?? [];
    const buildings = state?.buildings ?? [];

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return keys
            .filter(key => {
                if (buildingId !== "all" && key.buildingId !== buildingId) return false;
                if (floor !== "all" && String(key.floor) !== floor) return false;
                if (q) {
                    const haystack = `${key.roomNumber} ${key.roomName} ${key.buildingName}`.toLowerCase();
                    if (!haystack.includes(q)) return false;
                }
                return true;
            })
            .sort(
                (a, b) =>
                    a.buildingName.localeCompare(b.buildingName, "ru") ||
                    a.roomNumber.localeCompare(b.roomNumber, "ru", { numeric: true }),
            );
    }, [keys, buildingId, floor, query]);

    const floors = [...new Set(keys.map(key => key.floor))].sort((a, b) => a - b);

    const removeKey = async () => {
        if (!deleteKey) return;
        const response = await fetch(`/api/keys/${deleteKey.id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            toast.show({ title: "Не удалось удалить", description: data.error, tone: "danger" });
            return;
        }
        toast.show({ title: "Ключ удалён", tone: "success" });
        setDeleteKey(null);
        await refresh();
    };

    if (loading && !state) return <Skeleton height={240} radius="card" />;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Ключи"
                subtitle="Список всех ключей. Здесь создают ключи, настраивают доступ и смотрят историю."
                onBack={() => (window.location.href = "/admin")}
                actions={
                    <>
                        <Button size="sm" variant="secondary" leftIcon={Upload} onClick={() => setImportOpen(true)}>
                            Импорт CSV
                        </Button>
                        <Button size="sm" leftIcon={Plus} onClick={() => setCreateOpen(true)}>
                            Создать ключ
                        </Button>
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1200px] space-y-3 px-4 py-4">
                {error && <Card padding="sm" className="border-danger/40 bg-danger-soft"><p className="text-sm text-fg">{error}</p></Card>}

                <Card padding="sm">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Input
                            placeholder="Кабинет или название"
                            aria-label="Поиск ключа"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            wrapperClassName="sm:flex-1"
                        />
                        <Select
                            aria-label="Здание"
                            value={buildingId}
                            onChange={setBuildingId}
                            options={[{ value: "all", label: "Все здания" }, ...buildings.map(building => ({ value: building.id, label: building.name }))]}
                            wrapperClassName="sm:w-56"
                        />
                        <Select
                            aria-label="Этаж"
                            value={floor}
                            onChange={setFloor}
                            options={[{ value: "all", label: "Все этажи" }, ...floors.map(value => ({ value: String(value), label: `${value} этаж` }))]}
                            wrapperClassName="sm:w-40"
                        />
                        <span className="shrink-0 pb-3 text-xs text-fg-muted sm:ml-auto">
                            {visible.length} из {keys.length}
                        </span>
                    </div>

                    {keys.length === 0 ? (
                        <EmptyState icon={KeyRound} title="Ключей нет" description="Создайте первый ключ или импортируйте CSV" />
                    ) : visible.length === 0 ? (
                        <EmptyState icon={KeyRound} title="Ключи не найдены" description="Измените фильтр или запрос" />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] border-collapse text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-fg-subtle">
                                        <th className="py-2 pr-3 font-medium">Кабинет</th>
                                        <th className="hidden py-2 pr-3 font-medium md:table-cell">Здание</th>
                                        <th className="hidden py-2 pr-3 font-medium sm:table-cell">Этаж</th>
                                        <th className="py-2 pr-3 font-medium">Статус</th>
                                        <th className="hidden py-2 pr-3 font-medium lg:table-cell">Владелец</th>
                                        <th className="hidden py-2 pr-3 font-medium lg:table-cell">Доступ</th>
                                        <th className="py-2 text-right font-medium">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map(key => (
                                        <tr key={key.id} className="border-b border-border/60">
                                            <td className="py-2 pr-3">
                                                <p className="font-medium text-fg">{key.roomNumber}</p>
                                                <p className="truncate text-xs text-fg-muted">{key.roomName || "Кабинет"}</p>
                                            </td>
                                            <td className="hidden py-2 pr-3 text-xs text-fg-muted md:table-cell">{key.buildingName}</td>
                                            <td className="hidden py-2 pr-3 text-xs text-fg-muted sm:table-cell">{key.floor} этаж</td>
                                            <td className="py-2 pr-3">
                                                <Badge tone={key.pending ? "warning" : key.status === "FREE" ? "success" : "info"}>
                                                    {key.pending ? "заявка" : key.status === "FREE" ? "свободен" : "выдан"}
                                                </Badge>
                                            </td>
                                            <td className="hidden py-2 pr-3 text-xs text-fg-muted lg:table-cell">
                                                {key.holderName ?? "—"}
                                            </td>
                                            <td className="hidden py-2 pr-3 text-xs text-fg-muted lg:table-cell">
                                                {key.accessScope === "RESTRICTED" ? "По списку" : "Все сотрудники"}
                                            </td>
                                            <td className="py-2">
                                                <div className="flex justify-end gap-1">
                                                    <Button size="sm" variant="ghost" leftIcon={History} onClick={() => setHistoryKey(key)}>
                                                        История
                                                    </Button>
                                                    <Button size="sm" variant="ghost" leftIcon={Pencil} onClick={() => { setAccessKey(key); void loadUsers(); }}>
                                                        Права
                                                    </Button>
                                                    <Button size="sm" variant="ghost" leftIcon={Trash2} onClick={() => setDeleteKey(key)}>
                                                        Удалить
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </main>

            <CreateKeyModal open={createOpen} buildings={buildings} onClose={() => setCreateOpen(false)} onCreated={refresh} />
            <ImportKeysModal open={importOpen} onClose={() => setImportOpen(false)} onImported={refresh} />
            <KeyAccessModal keyItem={accessKey} users={users} onClose={() => setAccessKey(null)} onSaved={refresh} />
            <DeleteKeyModal keyItem={deleteKey} onClose={() => setDeleteKey(null)} onConfirm={() => void removeKey()} />
            <AdminKeyHistorySheet keyItem={historyKey} onClose={() => setHistoryKey(null)} />
        </div>
    );
}

function CreateKeyModal({
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
    const [scope, setScope] = useState("ALL");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ buildingId, roomNumber, roomName, floor: Number(floor), accessScope: scope }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось создать ключ");
            toast.show({ title: "Ключ создан", tone: "success" });
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
            title="Создать ключ"
            size="sm"
            footer={<ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel="Создать" loading={saving} disabled={!buildingId || !roomNumber.trim()} />}
        >
            <div className="space-y-2">
                <Select label="Здание" placeholder="Выберите здание" value={buildingId} onChange={setBuildingId} options={buildings.map(building => ({ value: building.id, label: building.name }))} />
                <Input label="Номер" value={roomNumber} onChange={event => setRoomNumber(event.target.value)} />
                <Input label="Название кабинета" value={roomName} onChange={event => setRoomName(event.target.value)} />
                <Input label="Этаж" type="number" value={floor} onChange={event => setFloor(event.target.value)} />
                <Select
                    label="Доступ"
                    value={scope}
                    onChange={setScope}
                    options={[
                        { value: "ALL", label: "Все сотрудники" },
                        { value: "RESTRICTED", label: "Только выбранные" },
                    ]}
                />
            </div>
        </Modal>
    );
}

function ImportKeysModal({
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
            title="Импорт CSV"
            description="building;building_address;room_number;room_name;floor"
            size="md"
            footer={<ModalFooter onCancel={onClose} onSubmit={() => void submit()} submitLabel="Импортировать" loading={saving} disabled={!csv.trim()} />}
        >
            <Textarea label="CSV" rows={10} value={csv} onChange={event => setCsv(event.target.value)} placeholder="Основной корпус;ул. Школьная, 1;101;Кабинет математики;1" />
        </Modal>
    );
}

function KeyAccessModal({
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
    const [userQuery, setUserQuery] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!keyItem) {
            setSelected([]);
            setScope("ALL");
            return;
        }

        setLoading(true);
        fetch(`/api/keys/${keyItem.id}/permissions`, { cache: "no-store" })
            .then(response => response.json())
            .then(data => {
                setScope(data.accessScope === "RESTRICTED" ? "RESTRICTED" : "ALL");
                setSelected(Array.isArray(data.userIds) ? data.userIds : []);
            })
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
        <Sheet
            open={Boolean(keyItem)}
            onClose={onClose}
            title={keyItem ? `Доступ к ключу ${keyItem.roomNumber}` : "Доступ"}
            description="Кому разрешён этот ключ"
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
                    <>
                        <Input
                            label="Поиск по ФИО"
                            value={userQuery}
                            onChange={event => setUserQuery(event.target.value)}
                            placeholder="Фамилия или имя"
                        />
                        <div className="max-h-[50vh] space-y-1 overflow-y-auto rounded-card border border-border p-2">
                            {users
                                .filter(user => user.name.toLowerCase().includes(userQuery.trim().toLowerCase()))
                                .map(user => (
                                    <label key={user.id} className="flex items-center gap-2 text-sm text-fg">
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(user.id)}
                                            onChange={() =>
                                                setSelected(current =>
                                                    current.includes(user.id)
                                                        ? current.filter(id => id !== user.id)
                                                        : [...current, user.id],
                                                )
                                            }
                                        />
                                        {user.name}
                                    </label>
                                ))}
                        </div>
                    </>
                )}
            </div>
        </Sheet>
    );
}

function DeleteKeyModal({
    keyItem,
    onClose,
    onConfirm,
}: {
    keyItem: KeyItemDto | null;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <Modal
            open={Boolean(keyItem)}
            onClose={onClose}
            title="Удалить ключ?"
            description={keyItem ? `${keyItem.roomNumber} · ${keyItem.roomName}` : undefined}
            size="sm"
            footer={<ModalFooter onCancel={onClose} onSubmit={onConfirm} submitLabel="Удалить" tone="danger" />}
        >
            <p className="text-sm text-fg-muted">Ключ исчезнет из списка. История операций останется.</p>
        </Modal>
    );
}

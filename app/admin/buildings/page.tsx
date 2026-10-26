"use client";

// app/admin/buildings/page.tsx
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Pencil, Plus, Trash2 } from "lucide-react";
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
    Skeleton,
    useToast,
} from "@/components/ui/kit";

interface ClassOption {
    id: string;
    name: string;
    grade: number;
    buildingId: string | null;
}

interface BuildingDto {
    id: string;
    name: string;
    address: string;
    classes: Array<{ id: string; name: string }>;
}

export default function AdminBuildingsPage() {
    return <BuildingsScreen />;
}

function BuildingsScreen() {
    const toast = useToast();

    const [buildings, setBuildings] = useState<BuildingDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<ClassOption[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<BuildingDto | null>(null);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [classQuery, setClassQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<BuildingDto | null>(null);

    const loadBuildings = async () => {
        try {
            const response = await fetch("/api/keys/buildings", { cache: "no-store" });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось загрузить здания");
            setBuildings(Array.isArray(data.buildings) ? data.buildings : []);
        } catch (e) {
            toast.show({
                title: "Не удалось загрузить здания",
                description: e instanceof Error ? e.message : undefined,
                tone: "danger",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadBuildings();
        fetch("/api/keys/classes", { cache: "no-store" })
            .then(response => response.json())
            .then(data => setClasses(Array.isArray(data.classes) ? data.classes : []))
            .catch(() => setClasses([]));
    }, []);

    const visibleClasses = useMemo(() => {
        const q = classQuery.trim().toLowerCase();
        if (!q) return classes;
        return classes.filter(item => item.name.toLowerCase().includes(q));
    }, [classes, classQuery]);

    const openCreate = () => {
        setEditing(null);
        setName("");
        setAddress("");
        setSelectedClasses([]);
        setClassQuery("");
        setFormOpen(true);
    };

    const openEdit = (building: BuildingDto) => {
        setEditing(building);
        setName(building.name);
        setAddress(building.address);
        setSelectedClasses(building.classes.map(item => item.id));
        setClassQuery("");
        setFormOpen(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            const response = await fetch(
                editing ? `/api/keys/buildings/${editing.id}` : "/api/keys/buildings",
                {
                    method: editing ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, address, classIds: selectedClasses }),
                },
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось сохранить здание");

            toast.show({
                title: editing ? "Здание обновлено" : "Здание добавлено",
                description: selectedClasses.length
                    ? `Классов: ${selectedClasses.length}`
                    : "Классы можно привязать позже",
                tone: "success",
            });
            setFormOpen(false);
            await loadBuildings();
        } catch (e) {
            toast.show({ title: "Ошибка", description: e instanceof Error ? e.message : undefined, tone: "danger" });
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        if (!deleting) return;
        const response = await fetch(`/api/keys/buildings/${deleting.id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            toast.show({ title: "Не удалось удалить", description: data.error, tone: "danger" });
            return;
        }
        toast.show({ title: "Здание удалено", tone: "success" });
        setDeleting(null);
        await loadBuildings();
    };

    const toggleClass = (classId: string) => {
        setSelectedClasses(current =>
            current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId],
        );
    };

    if (loading) return <Skeleton height={220} radius="card" />;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Здания"
                subtitle="Ключи и классы привязаны к зданию — по нему фильтруются пульт охраны и ключи."
                onBack={() => (window.location.href = "/admin")}
                actions={
                    <Button size="sm" leftIcon={Plus} onClick={openCreate}>
                        Добавить здание
                    </Button>
                }
            />

            <main className="mx-auto w-full max-w-[1200px] space-y-3 px-4 py-4">
                {buildings.length === 0 ? (
                    <EmptyState
                        icon={Building2}
                        title="Зданий нет"
                        description="Добавьте здание и отметьте, какие классы в нём учатся"
                    />
                ) : (
                    <div className="space-y-2">
                        {buildings.map(building => (
                            <Card key={building.id} padding="sm">
                                <div className="flex flex-wrap items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-fg">{building.name}</p>
                                            <Badge tone="neutral">классов: {building.classes.length}</Badge>
                                        </div>
                                        <p className="mt-0.5 text-xs text-fg-muted">
                                            {building.address || "Адрес не указан"}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {building.classes.length === 0 ? (
                                                <span className="text-xs text-fg-subtle">Классы не привязаны</span>
                                            ) : (
                                                building.classes.map(item => (
                                                    <Badge key={item.id} tone="info">
                                                        {item.name}
                                                    </Badge>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <Button size="sm" variant="ghost" leftIcon={Pencil} onClick={() => openEdit(building)}>
                                            Изменить
                                        </Button>
                                        <Button size="sm" variant="ghost" leftIcon={Trash2} onClick={() => setDeleting(building)}>
                                            Удалить
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <Modal
                open={formOpen}
                onClose={() => setFormOpen(false)}
                title={editing ? "Изменить здание" : "Новое здание"}
                description="Отметьте классы, которые учатся в этом здании"
                size="md"
                footer={
                    <ModalFooter
                        onCancel={() => setFormOpen(false)}
                        onSubmit={() => void save()}
                        submitLabel={editing ? "Сохранить" : "Добавить"}
                        loading={saving}
                        disabled={!name.trim()}
                    />
                }
            >
                <div className="space-y-3">
                    <Input label="Название" value={name} onChange={event => setName(event.target.value)} />
                    <Input label="Адрес" value={address} onChange={event => setAddress(event.target.value)} />

                    <div>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Классы в здании · {selectedClasses.length}
                            </p>
                            <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedClasses(classes.map(item => item.id))}
                                    disabled={classes.length === 0}
                                >
                                    Все
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedClasses(classes.filter(item => item.grade <= 4).map(item => item.id))}
                                    disabled={classes.length === 0}
                                >
                                    1–4
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedClasses(classes.filter(item => item.grade >= 5).map(item => item.id))}
                                    disabled={classes.length === 0}
                                >
                                    5–11
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedClasses([])} disabled={selectedClasses.length === 0}>
                                    Снять
                                </Button>
                            </div>
                        </div>
                        <Input
                            value={classQuery}
                            onChange={event => setClassQuery(event.target.value)}
                            placeholder="Поиск класса, например 5А"
                            wrapperClassName="mb-2"
                        />
                        <div className="max-h-56 overflow-y-auto rounded-card border border-border p-2">
                            {visibleClasses.length === 0 ? (
                                <p className="px-1 py-3 text-xs text-fg-muted">Классы не найдены</p>
                            ) : (
                                <div className="grid gap-1 sm:grid-cols-2">
                                    {visibleClasses.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center gap-2 rounded-control px-1.5 py-1 text-sm text-fg hover:bg-surface-hover"
                                        >
                                            <Checkbox
                                                checked={selectedClasses.includes(item.id)}
                                                onChange={() => toggleClass(item.id)}
                                                label={item.name}
                                            />
                                            {item.buildingId && item.buildingId !== editing?.id && (
                                                <span className="ml-auto text-[10px] text-fg-subtle">в другом здании</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-fg-subtle">
                            <Check size={12} aria-hidden />
                            Класс может быть только в одном здании — при сохранении он перенесётся сюда.
                        </p>
                    </div>
                </div>
            </Modal>

            <Modal
                open={Boolean(deleting)}
                onClose={() => setDeleting(null)}
                title="Удалить здание?"
                description={deleting?.name}
                size="sm"
                footer={<ModalFooter onCancel={() => setDeleting(null)} onSubmit={() => void remove()} submitLabel="Удалить" tone="danger" />}
            >
                <p className="text-sm text-fg-muted">
                    Удалить можно только здание без ключей. Классы останутся без здания.
                </p>
            </Modal>
        </div>
    );
}

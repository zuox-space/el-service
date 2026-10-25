"use client";

// app/admin/keys/buildings/page.tsx
import { useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import {
    Button,
    Card,
    EmptyState,
    Input,
    Modal,
    ModalFooter,
    PageHeader,
    Skeleton,
    useToast,
} from "@/components/ui/kit";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";

export default function AdminBuildingsPage() {
    return (
        <KeysProvider>
            <BuildingsScreen />
        </KeysProvider>
    );
}

function BuildingsScreen() {
    const { state, loading, refresh } = useKeys();
    const toast = useToast();
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

    const buildings = state?.buildings ?? [];

    const create = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/keys/buildings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, address }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось создать здание");
            toast.show({ title: "Здание добавлено", tone: "success" });
            setName("");
            setAddress("");
            setCreateOpen(false);
            await refresh();
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
        await refresh();
    };

    if (loading && !state) return <Skeleton height={220} radius="card" />;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Здания"
                subtitle="Каждый ключ принадлежит зданию. Выбранное здание фильтрует ключи и историю."
                onBack={() => (window.location.href = "/admin/keys")}
                actions={
                    <Button size="sm" leftIcon={Plus} onClick={() => setCreateOpen(true)}>
                        Добавить здание
                    </Button>
                }
            />

            <main className="mx-auto w-full max-w-[1200px] space-y-3 px-4 py-4">
                {buildings.length === 0 ? (
                    <EmptyState icon={Building2} title="Зданий нет" description="Добавьте здание, чтобы создавать ключи" />
                ) : (
                    <Card padding="none">
                        <ul className="divide-y divide-border">
                            {buildings.map(building => (
                                <li key={building.id} className="flex items-center gap-2 px-3 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-fg">{building.name}</p>
                                        <p className="truncate text-xs text-fg-muted">{building.address || "Адрес не указан"}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" leftIcon={Trash2} onClick={() => setDeleting(building)}>
                                        Удалить
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}
            </main>

            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Новое здание"
                size="sm"
                footer={<ModalFooter onCancel={() => setCreateOpen(false)} onSubmit={() => void create()} submitLabel="Добавить" loading={saving} disabled={!name.trim()} />}
            >
                <div className="space-y-2">
                    <Input label="Название" value={name} onChange={event => setName(event.target.value)} />
                    <Input label="Адрес" value={address} onChange={event => setAddress(event.target.value)} />
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
                <p className="text-sm text-fg-muted">Удалить можно только здание без ключей.</p>
            </Modal>
        </div>
    );
}

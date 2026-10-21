// app/admin/roles/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Checkbox,
    EmptyState,
    FormError,
    Input,
    Modal,
    ModalFooter,
    PageHeader,
    Sheet,
    Skeleton,
    useToast,
} from "@/components/ui/kit";
import { ACCESS_GROUPS, ACCESS_SECTIONS, type AccessSectionId } from "@/lib/access/registry";
import { roleLabel, roleTone } from "@/lib/roles";

/**
 * Роли и доступы.
 *
 * Роль — это «кто человек» (учитель, завуч, охрана). Здесь администратор создаёт
 * роли и сразу задаёт, какие разделы они открывают по умолчанию. Сотруднику
 * достаточно выдать роль — и он увидит нужные разделы без индивидуальной настройки.
 *
 * Если у роли пустой список доступов, действуют значения из реестра
 * (lib/access/registry.ts) — так работают встроенные роли.
 */

interface RoleRow {
    id: string;
    name: string;
    description: string | null;
    defaultSections: string[];
    registryDefaults?: string[];
    usersCount: number;
}



const GRANTABLE_SECTIONS = ACCESS_SECTIONS.filter(section => !section.adminOnly);
const sectionLabel = (id: string) => GRANTABLE_SECTIONS.find(section => section.id === id)?.label ?? id;

export default function RolesPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const toast = useToast();

    const [mounted, setMounted] = useState(false);
    const [roles, setRoles] = useState<RoleRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [sheetOpen, setSheetOpen] = useState(false);
    const [editing, setEditing] = useState<RoleRow | null>(null);
    const [form, setForm] = useState({ name: "", description: "" });
    const [sections, setSections] = useState<AccessSectionId[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
        if (status === "authenticated") {
            const userRoles = (session?.user?.roles as string[]) || [];
            if (!userRoles.includes("ADMIN")) router.replace("/admin");
        }
    }, [session, status, router]);

    const fetchRoles = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/roles");
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

            const data = await response.json();
            if (!Array.isArray(data)) throw new Error(data?.error || "Не удалось получить роли");

            setRoles(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить роли");
            setRoles([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            void fetchRoles();
        }
    }, [session, fetchRoles]);

    const openCreate = () => {
        setEditing(null);
        setForm({ name: "", description: "" });
        setSections([]);
        setFormError(null);
        setSheetOpen(true);
    };

    const openEdit = (role: RoleRow) => {
        setEditing(role);
        setForm({ name: role.name, description: role.description ?? "" });
        // Показываем: что реально действует — сохранённое или значения из реестра
        setSections(
            (role.defaultSections.length > 0 ? role.defaultSections : role.registryDefaults ?? []) as AccessSectionId[],
        );
        setFormError(null);
        setSheetOpen(true);
    };

    const toggleSection = (id: AccessSectionId) => {
        setSections(previous =>
            previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id],
        );
    };

    const save = async () => {
        setFormError(null);

        if (!editing && !/^[A-Z][A-Z0-9_]{1,39}$/.test(form.name.trim().toUpperCase())) {
            setFormError("Название роли: латиница в верхнем регистре, от 2 до 40 символов (например, METHODIST)");
            return;
        }

        setIsSaving(true);
        try {
            const response = editing
                ? await fetch(`/api/admin/roles/${editing.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ description: form.description, defaultSections: sections }),
                })
                : await fetch("/api/admin/roles", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: form.name,
                        description: form.description,
                        defaultSections: sections,
                    }),
                });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Не удалось сохранить роль");
            }

            await fetchRoles();
            setSheetOpen(false);
            toast.show({
                title: editing ? "Роль обновлена" : "Роль создана",
                description: `${roleLabel(editing?.name ?? form.name.trim().toUpperCase())} · разделов: ${sections.length}`,
                tone: "success",
            });
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Не удалось сохранить роль");
        } finally {
            setIsSaving(false);
        }
    };

    const remove = async () => {
        if (!pendingDelete) return;

        const role = pendingDelete;
        setPendingDelete(null);
        setIsDeleting(true);

        try {
            const response = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Не удалось удалить роль");
            }

            await fetchRoles();
            toast.show({ title: "Роль удалена", description: roleLabel(role.name), tone: "success" });
        } catch (e) {
            toast.show({
                title: e instanceof Error ? e.message : "Не удалось удалить роль",
                tone: "danger",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const groupedSections = useMemo(
        () =>
            ACCESS_GROUPS.map(group => ({
                group,
                items: GRANTABLE_SECTIONS.filter(section => section.group === group.id),
            })).filter(entry => entry.items.length > 0),
        [],
    );

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Роли и доступы" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={140} radius="card" />
                    <Skeleton height={140} radius="card" />
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Роли и доступы"
                subtitle={`${roles.length} ролей · доступы по умолчанию для новых сотрудников`}
                onBack={() => router.push("/admin")}
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={RefreshCw}
                            onClick={() => void fetchRoles()}
                            disabled={isLoading}
                        >
                            <span className="hidden sm:inline">Обновить</span>
                        </Button>
                        <Button size="sm" variant="primary" leftIcon={Plus} onClick={openCreate}>
                            Добавить роль
                        </Button>
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {error && <FormError message={error} />}

                {!isLoading && roles.length === 0 ? (
                    <EmptyState
                        icon={ShieldCheck}
                        title="Ролей нет"
                        description="Создайте роль и сразу отметьте, какие разделы она открывает"
                        action={{ label: "Добавить роль", onClick: openCreate }}
                    />
                ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                        {roles.map(role => {
                            const isAdminRole = role.name === "ADMIN";
                            const effective = role.defaultSections.length > 0 ? role.defaultSections : role.registryDefaults ?? [];
                            const fromRegistry = role.defaultSections.length === 0 && effective.length > 0;

                            return (
                                <Card key={role.id} padding="md">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="truncate text-base font-semibold text-fg">
                                                    {roleLabel(role.name)}
                                                </h2>
                                                <Badge tone={roleTone(role.name)}>{role.name}</Badge>
                                                {isAdminRole && <Badge tone="accent">полный доступ</Badge>}
                                            </div>
                                            <p className="mt-1 text-sm text-fg-muted">
                                                {role.description || "Без описания"}
                                            </p>
                                        </div>
                                        <Badge tone="neutral">{role.usersCount} чел.</Badge>
                                    </div>

                                    <div className="mt-3">
                                        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
                                            {isAdminRole
                                                ? "Доступы"
                                                : fromRegistry
                                                    ? "Доступы из реестра (не настроены вручную)"
                                                    : "Доступы по умолчанию"}
                                        </p>
                                        {isAdminRole ? (
                                            <p className="text-xs text-fg-muted">
                                                Администратор всегда видит все разделы — настраивать нечего.
                                            </p>
                                        ) : effective.length === 0 ? (
                                            <p className="text-xs text-fg-muted">
                                                Ничего не выдаётся: разделы назначаются индивидуально.
                                            </p>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {effective.map(section => (
                                                    <Badge key={section} tone={fromRegistry ? "neutral" : "info"}>
                                                        {sectionLabel(section)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            leftIcon={Pencil}
                                            onClick={() => openEdit(role)}
                                            disabled={isAdminRole}
                                        >
                                            Изменить доступы
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            leftIcon={Trash2}
                                            onClick={() => setPendingDelete(role)}
                                            disabled={isAdminRole || role.usersCount > 0}
                                            className="text-danger"
                                        >
                                            Удалить
                                        </Button>
                                        {role.usersCount > 0 && !isAdminRole && (
                                            <span className="text-xs text-fg-subtle">
                                                выдана {role.usersCount} — удалить нельзя
                                            </span>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <p className="pb-4 text-xs text-fg-subtle">
                    Доступы роли действуют на сотрудников, которым она выдана, и только пока у сотрудника
                    не включены индивидуальные доступы. Изменения применяются после обновления страницы.
                </p>
            </main>

            {/* Создание / редактирование роли */}
            <Sheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                title={editing ? roleLabel(editing.name) : "Новая роль"}
                description={
                    editing
                        ? "Доступы по умолчанию: что увидит сотрудник с этой ролью"
                        : "Название латиницей, например METHODIST"
                }
                footer={
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="ghost" onClick={() => setSheetOpen(false)} disabled={isSaving}>
                            Отмена
                        </Button>
                        <Button onClick={() => void save()} loading={isSaving}>
                            {editing ? "Сохранить" : "Создать роль"}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <FormError message={formError} />

                    {!editing && (
                        <Input
                            label="Название роли"
                            value={form.name}
                            onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))}
                            placeholder="METHODIST"
                            hint="Латиница в верхнем регистре: так роль хранится в базе"
                            required
                        />
                    )}

                    <Input
                        label="Описание"
                        value={form.description}
                        onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))}
                        placeholder="Методист: отчёты и аналитика"
                        hint="Видно администратору в списке ролей"
                    />

                    <div>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                            Доступы по умолчанию
                        </p>
                        <p className="mb-2 text-xs text-fg-subtle">
                            Отметьте разделы, которые увидит сотрудник с этой ролью. Если ничего не отметить,
                            будут действовать значения из реестра (для встроенных ролей) или доступы придётся
                            выдавать индивидуально.
                        </p>

                        <div className="space-y-3">
                            {groupedSections.map(entry => (
                                <div key={entry.group.id}>
                                    <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
                                        {entry.group.title}
                                    </p>
                                    <div className="rounded-card border border-dashed border-border p-1">
                                        {entry.items.map(section => (
                                            <Checkbox
                                                key={section.id}
                                                checked={sections.includes(section.id)}
                                                onChange={() => toggleSection(section.id)}
                                                label={section.label}
                                                description={section.description}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="text-xs text-fg-subtle">Выбрано разделов: {sections.length}</p>
                </div>
            </Sheet>

            {/* Подтверждение удаления */}
            <Modal
                open={Boolean(pendingDelete)}
                onClose={() => setPendingDelete(null)}
                title="Удалить роль?"
                description={pendingDelete ? roleLabel(pendingDelete.name) : undefined}
                size="sm"
                footer={
                    <ModalFooter
                        onCancel={() => setPendingDelete(null)}
                        onSubmit={() => void remove()}
                        submitLabel="Удалить роль"
                        loading={isDeleting}
                        tone="danger"
                    />
                }
            >
                <p className="text-sm text-fg-muted">
                    Роль исчезнет из списка. Это возможно только пока она не выдана ни одному сотруднику.
                </p>
            </Modal>
        </div>
    );
}

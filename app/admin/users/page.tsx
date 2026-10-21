// app/admin/users/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Copy, Plus, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    Checkbox,
    Chip,
    DataTable,
    EmptyState,
    FormError,
    Input,
    PageHeader,
    SearchInput,
    Sheet,
    Skeleton,
    Switch,
    useToast,
    type Column,
} from "@/components/ui/kit";
import { ACCESS_GROUPS, ACCESS_SECTIONS } from "@/lib/access/registry";
import { roleLabel, roleTone } from "@/lib/roles";
import { formatDateRu } from "@/lib/date";

/**
 * Сотрудники и роли.
 *
 * Что изменилось по UX:
 *  • вместо модалки по центру — панель справа (на телефоне шторка снизу):
 *    список сотрудников остаётся видимым, длинный список ролей не «прыгает»;
 *  • роли переключаются чекбоксами в один клик, с описанием «что даёт роль»
 *    и числом сотрудников — не нужно открывать отдельное окно на каждую роль;
 *  • нового сотрудника можно сразу завести с несколькими ролями;
 *  • фильтр по ролям и по «без роли» — видно, у кого доступ забыли выдать.
 */

interface RoleInfo {
    id: string;
    name: string;
    description?: string | null;
}

interface StaffUser {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    userRoles?: Array<{ role: RoleInfo }>;
}

// Подписи и цвета ролей — общие для страницы сотрудников и страницы ролей

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Сколько разделов можно выдать (без админского «Персонал») */
const ALL_GRANTABLE = ACCESS_SECTIONS.filter(section => !section.adminOnly).length;

export default function AdminUsersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const toast = useToast();

    const [mounted, setMounted] = useState(false);
    const [users, setUsers] = useState<StaffUser[]>([]);
    const [roles, setRoles] = useState<RoleInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");

    // панель редактирования: id, а не объект — после обновления списка данные свежие
    const [editingId, setEditingId] = useState<string | null>(null);
    const [busyRoleId, setBusyRoleId] = useState<string | null>(null);

    // Доступы к разделам выбранного сотрудника
    const [accessInfo, setAccessInfo] = useState<{
        override: boolean;
        granted: string[];
        roleDefaults: string[];
        effective: string[];
    } | null>(null);
    const [accessLoading, setAccessLoading] = useState(false);
    const [accessBusy, setAccessBusy] = useState<string | null>(null);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ name: "", email: "" });
    const [createRoles, setCreateRoles] = useState<string[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
        if (status === "authenticated") {
            const userRoles = (session?.user?.roles as string[]) || [];
            if (!userRoles.includes("ADMIN")) router.replace("/admin");
        }
    }, [session, status, router]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [usersResponse, rolesResponse] = await Promise.all([
                fetch("/api/admin/users"),
                fetch("/api/admin/roles"),
            ]);

            if (!usersResponse.ok) throw new Error(`Не удалось получить сотрудников (${usersResponse.status})`);

            const usersData = await usersResponse.json();
            const list: StaffUser[] = Array.isArray(usersData) ? usersData : [];
            list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
            setUsers(list);

            if (rolesResponse.ok) {
                const rolesData = await rolesResponse.json();
                setRoles(Array.isArray(rolesData) ? rolesData : []);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить сотрудников");
            setUsers([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            void fetchData();
        }
    }, [session, fetchData]);

    const rolesOf = (user: StaffUser) => (user.userRoles ?? []).map(item => item.role);

    const adminCount = useMemo(
        () => users.filter(user => rolesOf(user).some(role => role.name === "ADMIN")).length,
        [users],
    );

    const roleCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const user of users) {
            for (const role of rolesOf(user)) counts[role.name] = (counts[role.name] ?? 0) + 1;
        }
        return counts;
    }, [users]);

    const withoutRoleCount = useMemo(() => users.filter(user => rolesOf(user).length === 0).length, [users]);

    const rows = useMemo(() => {
        const query = search.trim().toLowerCase();

        return users.filter(user => {
            if (query) {
                const matches =
                    user.name.toLowerCase().includes(query) ||
                    user.email.toLowerCase().includes(query) ||
                    rolesOf(user).some(role => roleLabel(role.name).toLowerCase().includes(query));
                if (!matches) return false;
            }

            if (roleFilter === "none") return rolesOf(user).length === 0;
            if (roleFilter !== "all") return rolesOf(user).some(role => role.name === roleFilter);

            return true;
        });
    }, [users, search, roleFilter]);

    const editingUser = editingId ? users.find(user => user.id === editingId) ?? null : null;
    const isSelf = Boolean(editingUser && session?.user?.email === editingUser.email);

    const copyEmail = async (email: string) => {
        try {
            await navigator.clipboard.writeText(email);
            toast.show({ title: "Email скопирован", description: email, tone: "success" });
        } catch {
            toast.show({ title: "Браузер не разрешил копирование", tone: "danger" });
        }
    };

    const toggleRole = async (user: StaffUser, role: RoleInfo, checked: boolean) => {
        if (!checked && role.name === "ADMIN" && adminCount <= 1) {
            toast.show({
                title: "Нельзя снять последнюю роль администратора",
                description: "Сначала назначьте администратором другого сотрудника",
                tone: "danger",
            });
            return;
        }

        setBusyRoleId(role.id);
        try {
            const response = checked
                ? await fetch(`/api/admin/users/${user.id}/roles`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ roleId: role.id }),
                })
                : await fetch(`/api/admin/users/${user.id}/roles?roleId=${role.id}`, { method: "DELETE" });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Не удалось изменить роль");
            }

            await fetchData();
            await loadAccess(user.id);
            toast.show({
                title: checked ? "Роль выдана" : "Роль снята",
                description: `${roleLabel(role.name)} · ${user.name}`,
                tone: "success",
            });
        } catch (e) {
            toast.show({
                title: e instanceof Error ? e.message : "Не удалось изменить роль",
                tone: "danger",
            });
        } finally {
            setBusyRoleId(null);
        }
    };

    /* ------------------------- Доступы к разделам ------------------------- */

    const loadAccess = useCallback(async (userId: string) => {
        setAccessLoading(true);
        try {
            const response = await fetch(`/api/admin/users/${userId}/access`);
            if (!response.ok) throw new Error("Не удалось получить доступы");

            const data = await response.json();
            setAccessInfo({
                override: Boolean(data.override),
                granted: Array.isArray(data.granted) ? data.granted : [],
                roleDefaults: Array.isArray(data.roleDefaults) ? data.roleDefaults : [],
                effective: Array.isArray(data.effective) ? data.effective : [],
            });
        } catch {
            setAccessInfo(null);
        } finally {
            setAccessLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!editingId) {
            setAccessInfo(null);
            return;
        }
        void loadAccess(editingId);
    }, [editingId, loadAccess]);

    const saveAccess = async (override: boolean, sections: string[]) => {
        if (!editingId) return;

        setAccessBusy("save");
        try {
            const response = await fetch(`/api/admin/users/${editingId}/access`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ override, sections }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Не удалось сохранить доступы");
            }

            await loadAccess(editingId);
            toast.show({ title: "Доступы сохранены", tone: "success" });
        } catch (e) {
            toast.show({
                title: e instanceof Error ? e.message : "Не удалось сохранить доступы",
                tone: "danger",
            });
        } finally {
            setAccessBusy(null);
        }
    };

    const toggleSection = (section: string) => {
        if (!accessInfo) return;

        const current = accessInfo.override ? accessInfo.granted : accessInfo.effective;
        const next = current.includes(section)
            ? current.filter(value => value !== section)
            : [...current, section];

        void saveAccess(true, next);
    };

    const switchOverride = (enabled: boolean) => {
        if (!accessInfo) return;
        // Включаем индивидуальные доступы — стартуем с того, что дают роли
        void saveAccess(enabled, enabled ? accessInfo.roleDefaults : []);
    };

    const createUser = async () => {
        setCreateError(null);

        const name = createForm.name.trim();
        const email = createForm.email.trim();

        if (name.length < 3) {
            setCreateError("Укажите имя и фамилию — минимум 3 символа");
            return;
        }
        if (!EMAIL_PATTERN.test(email)) {
            setCreateError("Проверьте email: он должен совпадать с почтой в Яндексе");
            return;
        }
        // Роль можно не выбирать — сервер выдаст «Сотрудник» (доступ только к главной)

        setIsCreating(true);
        try {
            const selected = roles.filter(role => createRoles.includes(role.id));
            const [first, ...rest] = selected;

            const response = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, role: first?.name }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || "Не удалось добавить сотрудника");
            }

            const created = (await response.json()) as StaffUser | null;

            // Дополнительные роли назначаем вторым шагом: API создания принимает одну
            if (created?.id) {
                for (const role of rest) {
                    await fetch(`/api/admin/users/${created.id}/roles`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ roleId: role.id }),
                    });
                }
            }

            await fetchData();
            toast.show({
                title: "Сотрудник добавлен",
                description: `${name} · ${selected.map(role => roleLabel(role.name)).join(", ")}`,
                tone: "success",
            });

            setIsCreateOpen(false);
            setCreateForm({ name: "", email: "" });
            setCreateRoles([]);
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : "Не удалось добавить сотрудника");
        } finally {
            setIsCreating(false);
        }
    };

    const columns: Column<StaffUser>[] = [
        {
            key: "name",
            header: "Сотрудник",
            render: user => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{user.name}</p>
                    <p className="truncate text-xs text-fg-subtle">{user.email}</p>
                </div>
            ),
        },
        {
            key: "roles",
            header: "Роли",
            render: user => {
                const userRoles = rolesOf(user);

                return userRoles.length === 0 ? (
                    <Badge tone="danger">без роли</Badge>
                ) : (
                    <div className="flex flex-wrap gap-1">
                        {userRoles.map(role => (
                            <Badge key={role.id} tone={roleTone(role.name)}>
                                {roleLabel(role.name)}
                            </Badge>
                        ))}
                    </div>
                );
            },
        },
        {
            key: "createdAt",
            header: "Добавлен",
            width: "130px",
            render: user => <span className="text-xs text-fg-subtle">{formatDateRu(user.createdAt)}</span>,
        },
    ];

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Сотрудники" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <Skeleton height={260} radius="card" />
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Сотрудники"
                subtitle={`${users.length} человек · администраторов: ${adminCount}`}
                onBack={() => router.push("/admin")}
                actions={
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            leftIcon={RefreshCw}
                            onClick={() => void fetchData()}
                            disabled={isLoading}
                        >
                            <span className="hidden sm:inline">Обновить</span>
                        </Button>
                        <Button size="sm" variant="primary" leftIcon={Plus} onClick={() => setIsCreateOpen(true)}>
                            Добавить
                        </Button>
                    </>
                }
            />

            <main className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                {error && <FormError message={error} />}

                <Card padding="sm">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Имя, email или роль"
                        label="Поиск"
                    />

                    <div className="mt-3">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                            Фильтр по роли
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            <Chip selected={roleFilter === "all"} onClick={() => setRoleFilter("all")} count={users.length}>
                                Все
                            </Chip>
                            {roles.map(role => (
                                <Chip
                                    key={role.id}
                                    selected={roleFilter === role.name}
                                    onClick={() => setRoleFilter(roleFilter === role.name ? "all" : role.name)}
                                    count={roleCounts[role.name] ?? 0}
                                >
                                    {roleLabel(role.name)}
                                </Chip>
                            ))}
                            <Chip
                                selected={roleFilter === "none"}
                                onClick={() => setRoleFilter(roleFilter === "none" ? "all" : "none")}
                                count={withoutRoleCount}
                                className={withoutRoleCount > 0 ? "text-danger" : undefined}
                            >
                                Без роли
                            </Chip>
                        </div>
                    </div>
                </Card>

                {!isLoading && rows.length === 0 ? (
                    <EmptyState
                        variant={search || roleFilter !== "all" ? "no-results" : "empty"}
                        title={search || roleFilter !== "all" ? "Сотрудники не найдены" : "Сотрудников нет"}
                        description={
                            search || roleFilter !== "all"
                                ? "Измените запрос или снимите фильтр по роли"
                                : "Добавьте первого сотрудника — доступ появится после входа через Яндекс"
                        }
                        action={
                            search || roleFilter !== "all"
                                ? {
                                    label: "Сбросить фильтры",
                                    onClick: () => {
                                        setSearch("");
                                        setRoleFilter("all");
                                    },
                                }
                                : { label: "Добавить сотрудника", onClick: () => setIsCreateOpen(true) }
                        }
                    />
                ) : (
                    <DataTable
                        columns={columns}
                        rows={rows}
                        rowKey={user => user.id}
                        loading={isLoading}
                        onRowClick={user => setEditingId(user.id)}
                        mobileTitle={user => user.name}
                        mobileSubtitle={user =>
                            rolesOf(user).length === 0
                                ? "без роли — доступ закрыт"
                                : rolesOf(user).map(role => roleLabel(role.name)).join(" · ")
                        }
                        emptyTitle="Сотрудники не найдены"
                        caption="Сотрудники и их роли"
                    />
                )}

                <p className="pb-4 text-xs text-fg-subtle">
                    Нажмите на сотрудника, чтобы выдать или снять роли. Доступ появится после первого входа
                    через Яндекс с этой почтой.
                </p>
            </main>

            {/* Панель редактирования ролей */}
            <Sheet
                open={Boolean(editingUser)}
                onClose={() => setEditingId(null)}
                title={editingUser?.name ?? "Сотрудник"}
                description={editingUser?.email}
                footer={
                    <div className="flex justify-end">
                        <Button onClick={() => setEditingId(null)}>Готово</Button>
                    </div>
                }
            >
                {editingUser && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2 rounded-control border border-dashed border-border px-3 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm text-fg">{editingUser.email}</p>
                                <p className="text-xs text-fg-subtle">
                                    добавлен {formatDateRu(editingUser.createdAt)}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={Copy}
                                onClick={() => void copyEmail(editingUser.email)}
                            >
                                Копировать
                            </Button>
                        </div>

                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Роли и права
                            </p>
                            <div className="rounded-card border border-dashed border-border p-1">
                                {roles.map(role => {
                                    const assigned = rolesOf(editingUser).some(item => item.id === role.id);
                                    const description = [role.description, `${roleCounts[role.name] ?? 0} чел.`]
                                        .filter(Boolean)
                                        .join(" · ");

                                    return (
                                        <Checkbox
                                            key={role.id}
                                            checked={assigned}
                                            disabled={busyRoleId === role.id}
                                            onChange={checked => void toggleRole(editingUser, role, checked)}
                                            label={roleLabel(role.name)}
                                            description={description}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-control border border-warning/30 bg-warning-soft px-3 py-2">
                            <p className="text-xs text-fg">
                                Роль «Администратор» нельзя снять у последнего администратора — система
                                останется без управления.
                            </p>
                        </div>

                        {/* Доступы к разделам данных */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                                <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                    Доступ к разделам
                                </p>
                                <span className="text-xs text-fg-subtle">
                                    {accessInfo ? `${accessInfo.effective.length} из ${ALL_GRANTABLE} разделов` : ""}
                                </span>
                            </div>

                            {accessLoading ? (
                                <div className="space-y-2">
                                    <Skeleton height={44} radius="control" />
                                    <Skeleton height={44} radius="control" />
                                </div>
                            ) : !accessInfo ? (
                                <p className="text-xs text-danger">Не удалось загрузить доступы</p>
                            ) : isSelf ? (
                                <div className="rounded-control border border-dashed border-border px-3 py-2 text-xs text-fg-muted">
                                    Это ваша учётная запись — свои доступы менять нельзя, чтобы не потерять
                                    управление системой. Изменять может другой администратор.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Switch
                                        checked={accessInfo.override}
                                        onChange={checked => void switchOverride(checked)}
                                        label="Индивидуальные доступы"
                                        description={
                                            accessInfo.override
                                                ? "Действует только отмеченное ниже"
                                                : "Пока считается по ролям — включите, чтобы настроить вручную"
                                        }
                                    />

                                    {ACCESS_GROUPS.map(group => {
                                        const groupSections = ACCESS_SECTIONS.filter(
                                            section => section.group === group.id && !section.adminOnly,
                                        );
                                        if (groupSections.length === 0) return null;

                                        return (
                                            <div key={group.id}>
                                                <p className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
                                                    {group.title}
                                                </p>
                                                <div className="rounded-card border border-dashed border-border p-1">
                                                    {groupSections.map(section => {
                                                        const checked = accessInfo.effective.includes(section.id);
                                                        // Пока доступы по ролям, чекбоксы только показывают
                                                        // результат; первое нажатие включает индивидуальный режим
                                                        return (
                                                            <Checkbox
                                                                key={section.id}
                                                                checked={checked}
                                                                disabled={accessBusy !== null}
                                                                onChange={() => toggleSection(section.id)}
                                                                label={section.label}
                                                                description={section.description}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {accessInfo.override && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => void switchOverride(false)}
                                            disabled={accessBusy !== null}
                                        >
                                            Вернуть доступы по ролям
                                        </Button>
                                    )}
                                </div>
                            )}

                            <p className="mt-2 text-xs text-fg-subtle">
                                Администратор всегда видит все разделы. «Персонал» выдать нельзя —
                                это админский раздел.
                            </p>
                        </div>
                    </div>
                )}
            </Sheet>

            {/* Панель создания сотрудника */}
            <Sheet
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Новый сотрудник"
                description="Доступ появится после входа через Яндекс"
                footer={
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                            Отмена
                        </Button>
                        <Button leftIcon={UserPlus} onClick={() => void createUser()} loading={isCreating}>
                            Добавить
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <FormError message={createError} />

                    <Input
                        label="Имя и фамилия"
                        value={createForm.name}
                        onChange={event => setCreateForm(previous => ({ ...previous, name: event.target.value }))}
                        placeholder="Иванова Мария Петровна"
                        required
                    />

                    <Input
                        label="Email"
                        type="email"
                        inputMode="email"
                        value={createForm.email}
                        onChange={event => setCreateForm(previous => ({ ...previous, email: event.target.value }))}
                        placeholder="teacher@school1298.ru"
                        hint="Должен совпадать с почтой в Яндексе"
                        required
                    />

                    <div>
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                            Роли
                        </p>
                        <div className="rounded-card border border-dashed border-border p-1">
                            {roles.map(role => (
                                <Checkbox
                                    key={role.id}
                                    checked={createRoles.includes(role.id)}
                                    onChange={checked =>
                                        setCreateRoles(previous =>
                                            checked ? [...previous, role.id] : previous.filter(id => id !== role.id),
                                        )
                                    }
                                    label={roleLabel(role.name)}
                                    description={role.description ?? undefined}
                                />
                            ))}
                        </div>
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-fg-subtle">
                            <ShieldCheck size={12} aria-hidden />
                            Можно выбрать несколько ролей сразу
                        </p>
                    </div>
                </div>
            </Sheet>
        </div>
    );
}

"use client";

// components/keys/ColleaguePicker.tsx
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EmptyState, Input } from "@/components/ui/kit";
import { useKeys } from "./KeysProvider";

/** Выбор коллеги для передачи ключа — как ColleaguePicker в keys-app. */
export function ColleaguePicker({
    onSelect,
    disabled = false,
}: {
    onSelect: (user: { id: string; name: string }) => void;
    disabled?: boolean;
}) {
    const { users } = useKeys();
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter(user => {
            if (user.roles.includes("SECURITY")) return false;
            if (!q) return true;
            return `${user.name} ${user.email}`.toLowerCase().includes(q);
        });
    }, [users, query]);

    return (
        <div className="space-y-2">
            <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Фамилия или почта"
                aria-label="Поиск коллеги"
                leftIcon={Search}
            />

            {filtered.length === 0 ? (
                <EmptyState title="Коллеги не найдены" description="Измените запрос" compact />
            ) : (
                <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-card border border-border">
                    {filtered.map(user => (
                        <li key={user.id}>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onSelect(user)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-sm text-fg">{user.name}</span>
                                    <span className="block truncate text-xs text-fg-subtle">{user.email}</span>
                                </span>
                                <span className="text-xs text-fg-subtle">Выбрать</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

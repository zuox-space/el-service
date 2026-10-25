"use client";

// components/guard/GuardSelfExitsTab.tsx
import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Badge, Card, EmptyState, Input } from "@/components/ui/kit";
import { AlphabetFilter, surnameLetter } from "./AlphabetFilter";

export interface GuardSelfExit {
    id: string;
    classId: string;
    studentName: string;
    className: string;
    reason: string | null;
    startDate: string;
    endDate: string;
}

export function GuardSelfExitsTab({ items }: { items: GuardSelfExit[] }) {
    const [query, setQuery] = useState("");
    const [letter, setLetter] = useState("all");

    const filtered = useMemo(
        () =>
            items.filter(item => {
                if (letter !== "all" && surnameLetter(item.studentName) !== letter) return false;
                if (query.trim()) {
                    const haystack = `${item.studentName} ${item.className} ${item.reason ?? ""}`.toLowerCase();
                    if (!haystack.includes(query.trim().toLowerCase())) return false;
                }
                return true;
            }),
        [items, query, letter],
    );

    return (
        <Card padding="sm" className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <div>
                    <p className="text-sm font-semibold text-fg">Самовыходы</p>
                    <p className="text-xs text-fg-muted">Ученики, которые могут уходить сами</p>
                </div>
                <Badge tone="neutral" className="ml-auto">
                    {filtered.length}
                </Badge>
            </div>

            <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Поиск по имени ребёнка"
                aria-label="Поиск по имени ребёнка"
                wrapperClassName="mb-2 w-full sm:w-72"
            />
            <div className="mb-2">
                <AlphabetFilter value={letter} onChange={setLetter} />
            </div>

            <div className="min-h-0 max-h-[60vh] flex-1 overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-18rem)]">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={CalendarCheck}
                        title={items.length === 0 ? "Самовыходов нет" : "Никого не найдено"}
                        description={items.length === 0 ? "На сегодня разрешений нет" : "Измените имя или букву"}
                        compact
                    />
                ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                        {filtered.map(item => (
                            <li key={item.id} className="px-3 py-2">
                                <p className="truncate text-sm text-fg">
                                    <span className="font-medium">{item.className}</span> · {item.studentName}
                                </p>
                                <p className="text-xs text-fg-muted">
                                    {new Date(item.startDate).toLocaleDateString("ru-RU")} —{" "}
                                    {new Date(item.endDate).toLocaleDateString("ru-RU")}
                                    {item.reason ? ` · ${item.reason}` : ""}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Card>
    );
}

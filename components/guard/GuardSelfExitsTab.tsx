"use client";

// components/guard/GuardSelfExitsTab.tsx
import { useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Badge, Card, EmptyState, Select } from "@/components/ui/kit";
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
    const [letter, setLetter] = useState("all");
    const [className, setClassName] = useState("all");

    const classes = useMemo(
        () => [...new Set(items.map(item => item.className))].sort((a, b) => a.localeCompare(b, "ru")),
        [items],
    );

    const filtered = useMemo(
        () =>
            items.filter(item => {
                if (className !== "all" && item.className !== className) return false;
                if (letter !== "all" && surnameLetter(item.studentName) !== letter) return false;
                return true;
            }),
        [items, letter, className],
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

            <Select
                aria-label="Класс"
                value={className}
                onChange={setClassName}
                options={[
                    { value: "all", label: "Все классы" },
                    ...classes.map(item => ({ value: item, label: item })),
                ]}
                wrapperClassName="mb-2 w-full sm:w-56"
            />
            <div className="mb-2">
                <AlphabetFilter value={letter} onChange={setLetter} />
            </div>

            <div className="min-h-0 max-h-[60vh] flex-1 overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-18rem)]">
                {filtered.length === 0 ? (
                    <EmptyState
                        icon={CalendarCheck}
                        title={items.length === 0 ? "Самовыходов нет" : "Никого не найдено"}
                        description={items.length === 0 ? "На сегодня разрешений нет" : "Измените класс или букву"}
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

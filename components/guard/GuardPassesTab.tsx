"use client";

// components/guard/GuardPassesTab.tsx
import { useMemo, useState } from "react";
import { Clock, LogOut, Undo2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input } from "@/components/ui/kit";
import { AlphabetFilter, surnameLetter } from "./AlphabetFilter";

export interface GuardPass {
    id: string;
    classId: string;
    className: string;
    exitTime: string;
    reason: string;
    used: boolean;
    usedAt: string | null;
    students: Array<{ id?: string | number; name?: string }>;
}

function names(pass: GuardPass): string[] {
    return pass.students.map(student => student.name ?? "").filter(Boolean);
}

function matches(pass: GuardPass, query: string, letter: string): boolean {
    const students = names(pass);
    if (letter !== "all" && !students.some(name => surnameLetter(name) === letter)) return false;
    if (query.trim()) {
        const haystack = `${pass.className} ${students.join(" ")} ${pass.reason}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
}

export function GuardPassesTab({
    passes,
    busyId,
    onMarkUsed,
    onUndo,
}: {
    passes: GuardPass[];
    busyId: string | null;
    onMarkUsed: (id: string) => Promise<void>;
    onUndo: (id: string) => Promise<void>;
}) {
    const [query, setQuery] = useState("");
    const [letter, setLetter] = useState("all");

    const filtered = useMemo(() => passes.filter(pass => matches(pass, query, letter)), [passes, query, letter]);
    const active = filtered.filter(pass => !pass.used);
    const used = filtered.filter(pass => pass.used);

    return (
        <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Ученик, класс или причина"
                    aria-label="Поиск пропуска"
                    wrapperClassName="w-full sm:w-64"
                />
                <div className="ml-auto flex gap-1.5">
                    <Badge tone="info">активные · {active.length}</Badge>
                    <Badge tone="neutral">ушли · {used.length}</Badge>
                </div>
            </div>

            <AlphabetFilter value={letter} onChange={setLetter} />

            <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-2">
                <PassColumn
                    title="Активные"
                    description="Ещё не выходили"
                    count={active.length}
                    empty="Активных пропусков нет"
                >
                    {active.map(pass => (
                        <li key={pass.id}>
                            <PassRow pass={pass} busy={busyId === pass.id}>
                                <Button
                                    size="sm"
                                    leftIcon={LogOut}
                                    loading={busyId === pass.id}
                                    onClick={() => void onMarkUsed(pass.id)}
                                >
                                    Отметить выход
                                </Button>
                            </PassRow>
                        </li>
                    ))}
                </PassColumn>

                <PassColumn
                    title="Ушедшие"
                    description="Выход отмечен"
                    count={used.length}
                    empty="Ушедших сегодня нет"
                >
                    {used.map(pass => (
                        <li key={pass.id}>
                            <PassRow pass={pass} busy={busyId === pass.id}>
                                <div className="flex items-center gap-2">
                                    <Badge tone="success">
                                        вышел{" "}
                                        {pass.usedAt
                                            ? new Date(pass.usedAt).toLocaleTimeString("ru-RU", {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                              })
                                            : ""}
                                    </Badge>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        leftIcon={Undo2}
                                        loading={busyId === pass.id}
                                        onClick={() => void onUndo(pass.id)}
                                    >
                                        Отменить
                                    </Button>
                                </div>
                            </PassRow>
                        </li>
                    ))}
                </PassColumn>
            </div>
        </div>
    );
}

function PassColumn({
    title,
    description,
    count,
    empty,
    children,
}: {
    title: string;
    description: string;
    count: number;
    empty: string;
    children: React.ReactNode;
}) {
    return (
        <Card padding="sm" className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-fg">{title}</p>
                    <p className="text-[11px] text-fg-muted">{description}</p>
                </div>
                <Badge tone={title === "Активные" ? "info" : "neutral"}>{count}</Badge>
            </div>
            <div className="min-h-0 max-h-[60vh] flex-1 overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-18rem)]">
                {count === 0 ? (
                    <EmptyState compact icon={Clock} title={empty} description="Список обновится автоматически" />
                ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">{children}</ul>
                )}
            </div>
        </Card>
    );
}

function PassRow({
    pass,
    busy,
    children,
}: {
    pass: GuardPass;
    busy: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <div className={`min-w-0 flex-1 ${busy ? "opacity-60" : ""}`}>
                <p className="truncate text-sm text-fg">
                    <span className="font-medium">{pass.className}</span> · {names(pass).join(", ") || "Ученики"}
                </p>
                <p className="truncate text-xs text-fg-muted">
                    {pass.exitTime} · {pass.reason}
                </p>
            </div>
            {children}
        </div>
    );
}

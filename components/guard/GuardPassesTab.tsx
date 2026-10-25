"use client";

// components/guard/GuardPassesTab.tsx
import { useMemo, useState } from "react";
import { Clock, LogOut, Undo2, UserRound } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Tabs } from "@/components/ui/kit";
import { AlphabetFilter, surnameLetter } from "./AlphabetFilter";

export interface GuardPass {
    id: string;
    classId: string;
    className: string;
    teacherName: string;
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
        const haystack = `${pass.className} ${students.join(" ")} ${pass.reason} ${pass.teacherName}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
}

function time(value: string | null): string {
    if (!value) return "";
    return new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
    const [tab, setTab] = useState<"active" | "used">("active");
    const [query, setQuery] = useState("");
    const [letter, setLetter] = useState("all");

    const filtered = useMemo(() => passes.filter(pass => matches(pass, query, letter)), [passes, query, letter]);
    const active = filtered.filter(pass => !pass.used);
    const used = filtered.filter(pass => pass.used);
    const current = tab === "active" ? active : used;

    return (
        <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Ученик, класс, причина или кто выписал"
                    aria-label="Поиск пропуска"
                    wrapperClassName="w-full sm:w-80"
                />
                <div className="ml-auto text-xs text-fg-subtle">
                    {tab === "active" ? "Ещё в школе" : "Выход отмечен"}
                </div>
            </div>

            <AlphabetFilter value={letter} onChange={setLetter} />

            <Tabs
                value={tab}
                onChange={value => setTab(value as "active" | "used")}
                size="sm"
                ariaLabel="Пропуска"
                items={[
                    { id: "active", label: "Активные", count: active.length },
                    { id: "used", label: "Ушедшие", count: used.length },
                ]}
            />

            <div className="min-h-0 max-h-[60vh] flex-1 overflow-y-auto overscroll-contain lg:max-h-[calc(100dvh-18rem)]">
                {current.length === 0 ? (
                    <EmptyState
                        compact
                        icon={Clock}
                        title={tab === "active" ? "Активных пропусков нет" : "Ушедших сегодня нет"}
                        description={
                            tab === "active"
                                ? "Как только учитель выпишет пропуск, он появится здесь"
                                : "Отметьте выход — пропуск переедет сюда"
                        }
                    />
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {current.map(pass => (
                            <Card key={pass.id} padding="sm" className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-fg">{pass.className}</p>
                                        <p className="truncate text-sm text-fg">
                                            {names(pass).join(", ") || "Ученики"}
                                        </p>
                                    </div>
                                    <Badge tone={pass.used ? "success" : "info"}>{pass.exitTime}</Badge>
                                </div>

                                <p className="text-xs text-fg-muted">{pass.reason}</p>
                                <p className="flex items-center gap-1 text-[11px] text-fg-subtle">
                                    <UserRound size={12} aria-hidden />
                                    Выписал: {pass.teacherName || "не указан"}
                                </p>

                                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
                                    {pass.used ? (
                                        <>
                                            <Badge tone="success">вышел {time(pass.usedAt)}</Badge>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                leftIcon={Undo2}
                                                loading={busyId === pass.id}
                                                onClick={() => void onUndo(pass.id)}
                                            >
                                                Отменить
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[11px] text-fg-subtle">В школе</span>
                                            <Button
                                                size="sm"
                                                leftIcon={LogOut}
                                                loading={busyId === pass.id}
                                                onClick={() => void onMarkUsed(pass.id)}
                                            >
                                                Отметить выход
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

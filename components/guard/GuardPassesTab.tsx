"use client";

// components/guard/GuardPassesTab.tsx
import { useMemo, useState } from "react";
import { Clock, LogOut, Undo2, UserRound } from "lucide-react";
import { Badge, Button, Card, EmptyState, Select, Tabs } from "@/components/ui/kit";
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

function matches(pass: GuardPass, letter: string, className: string): boolean {
    if (className !== "all" && pass.className !== className) return false;
    const students = names(pass);
    if (letter !== "all" && !students.some(name => surnameLetter(name) === letter)) return false;
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
    const [letter, setLetter] = useState("all");
    const [className, setClassName] = useState("all");

    const classes = useMemo(
        () => [...new Set(passes.map(pass => pass.className))].sort((a, b) => a.localeCompare(b, "ru")),
        [passes],
    );
    const filtered = useMemo(
        () => passes.filter(pass => matches(pass, letter, className)),
        [passes, letter, className],
    );
    const active = filtered.filter(pass => !pass.used);
    const used = filtered.filter(pass => pass.used);
    const current = tab === "active" ? active : used;

    return (
        <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    aria-label="Класс"
                    value={className}
                    onChange={setClassName}
                    options={[
                        { value: "all", label: "Все классы" },
                        ...classes.map(item => ({ value: item, label: item })),
                    ]}
                    wrapperClassName="w-full sm:w-56"
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

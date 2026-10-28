"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, Monitor, Printer, UserRound } from "lucide-react";
import { Badge, Button, Card, Checkbox, EmptyState, FormError, SearchInput, Select, Skeleton, useToast } from "@/components/ui/kit";

const ROWS = 15;
const DESKS = [1, 2, 3] as const;

function normalize(value: string) {
    return value.toLowerCase().replace(/ё/g, "е").trim();
}

function shortStudentName(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return parts[0] ?? name;
    return `${parts[0]} ${parts[1][0]}.`;
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }[char] ?? char));
}

interface SeatingStudent {
    id: string;
    name: string;
}

interface Seat {
    row: number;
    desk: number;
    side: "left" | "right";
    studentId: string | null;
    studentName: string | null;
}

interface SeatingResponse {
    class: { id: string; name: string };
    students: SeatingStudent[];
    seats: Seat[];
    absentStudentIds: string[];
    releasedSeats?: number;
}

interface SeatingBoardProps {
    classId: string;
    canEdit: boolean;
}

/**
 * Схема рассадки: 15 рядов, в каждом 3 парты по 2 места.
 * Используется и в «Мой класс» (редактирование), и в отдельном разделе
 * «Электронная рассадка» (только просмотр).
 */
export function SeatingBoard({ classId, canEdit }: SeatingBoardProps) {
    const toast = useToast();
    const [data, setData] = useState<SeatingResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAbsent, setShowAbsent] = useState(false);
    const [editing, setEditing] = useState<{ row: number; desk: number } | null>(null);
    const [draftLeft, setDraftLeft] = useState("");
    const [draftRight, setDraftRight] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [expandedDesk, setExpandedDesk] = useState<{ row: number; desk: number } | null>(null);

    const load = useCallback(async () => {
        if (!classId) {
            setData(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/seating?classId=${encodeURIComponent(classId)}`, {
                cache: "no-store",
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Не удалось загрузить рассадку");
            setData(payload);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить рассадку");
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, [classId]);

    useEffect(() => {
        void load();
    }, [load]);

    const seats = data?.seats ?? [];
    const students = data?.students ?? [];
    const absentIds = new Set(data?.absentStudentIds ?? []);
    const occupied = seats.filter(seat => seat.studentId).length;
    const allSeated = students.length > 0 && occupied === students.length;
    const noPlan = occupied === 0;
    const remaining = Math.max(0, students.length - occupied);

    const seatFor = (row: number, desk: number, side: "left" | "right") =>
        seats.find(seat => seat.row === row && seat.desk === desk && seat.side === side);

    const query = normalize(search);
    const filterActive = query.length > 0;
    const isMatch = (seat: Seat | undefined) =>
        Boolean(seat?.studentName && normalize(seat.studentName).includes(query));

    const toggleDeskView = (row: number, desk: number) => {
        setExpandedDesk(current =>
            current?.row === row && current.desk === desk ? null : { row, desk },
        );
    };

    const printSeating = () => {
        if (!data) return;
        const win = window.open("", "_blank", "width=900,height=1200");
        if (!win) {
            toast.show({ title: "Разрешите всплывающие окна для печати", tone: "danger" });
            return;
        }

        const rowsHtml = Array.from({ length: ROWS }, (_, index) => {
            const row = index + 1;
            const desksHtml = DESKS.map(desk => {
                const left = seatFor(row, desk, "left");
                const right = seatFor(row, desk, "right");
                const cell = (seat: Seat | undefined) => seat?.studentName
                    ? escapeHtml(shortStudentName(seat.studentName))
                    : "—";
                return `<div class="desk"><span>${cell(left)}</span><span>${cell(right)}</span></div>`;
            }).join("");
            return `<div class="row"><span class="row-number">${row}</span><div class="desks">${desksHtml}</div></div>`;
        }).join("");

        win.document.write(`<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Рассадка ${escapeHtml(data.class.name)}</title>
<style>
@page { size: A4 portrait; margin: 9mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #111; font: 10pt Arial, sans-serif; }
h1 { margin: 0 0 2mm; font-size: 16pt; text-align: center; }
.subtitle { margin: 0 0 4mm; text-align: center; color: #555; font-size: 9pt; }
.rows { display: flex; flex-direction: column; gap: 2.2mm; }
.row { display: flex; align-items: center; gap: 2mm; }
.row-number { width: 6mm; color: #777; font-size: 8pt; text-align: right; }
.desks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; flex: 1; }
.desk { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm; border: 1px solid #999; border-radius: 1.5mm; padding: 1.5mm; }
.desk span { min-height: 7mm; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; font-size: 8pt; text-align: center; }
.teacher { margin: 4mm auto 0; width: 55mm; border: 1.5px solid #333; border-radius: 2mm; padding: 2mm; text-align: center; font-weight: 600; font-size: 9pt; }
.note { margin-top: 3mm; text-align: center; color: #666; font-size: 7.5pt; }
</style></head><body>
<h1>Рассадка · ${escapeHtml(data.class.name)}</h1>
<div class="subtitle">Слева и справа — со стороны учителя</div>
<div class="rows">${rowsHtml}</div>
<div class="teacher">Стол учителя</div>
<div class="note">Фамилия и инициал имени. Пустое место — «—».</div>
</body></html>`);
        win.document.close();
        win.focus();
        window.setTimeout(() => win.print(), 250);
    };

    const openEditor = (row: number, desk: number) => {
        if (!canEdit) return;
        setEditing({ row, desk });
        setDraftLeft(seatFor(row, desk, "left")?.studentId ?? "");
        setDraftRight(seatFor(row, desk, "right")?.studentId ?? "");
        setEditorError(null);
    };

    const closeEditor = () => {
        if (isSaving) return;
        setEditing(null);
        setEditorError(null);
    };

    const occupiedElsewhere = useMemo(() => {
        const ids = new Set<string>();
        if (!editing) return ids;
        for (const seat of seats) {
            if ((seat.row !== editing.row || seat.desk !== editing.desk) && seat.studentId) {
                ids.add(seat.studentId);
            }
        }
        return ids;
    }, [editing, seats]);

    const optionsFor = (otherDraft: string) => [
        { value: "", label: "Никого" },
        ...students
            .filter(student => !occupiedElsewhere.has(student.id) && student.id !== otherDraft)
            .map(student => ({ value: student.id, label: student.name })),
    ];

    const saveDesk = async () => {
        if (!data || !editing) return;

        setIsSaving(true);
        setEditorError(null);
        try {
            const response = await fetch("/api/seating", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: data.class.id,
                    row: editing.row,
                    desk: editing.desk,
                    left: draftLeft || null,
                    right: draftRight || null,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Не удалось сохранить рассадку");

            const updated: Seat[] = Array.isArray(payload.seats) ? payload.seats : [];
            setData(previous => previous ? {
                ...previous,
                seats: [
                    ...previous.seats.filter(seat => seat.row !== editing.row || seat.desk !== editing.desk),
                    ...updated,
                ],
            } : previous);
            setEditing(null);
            toast.show({ title: "Рассадка сохранена", tone: "success" });
        } catch (e) {
            setEditorError(e instanceof Error ? e.message : "Не удалось сохранить рассадку");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <Card padding="md"><Skeleton height={420} radius="card" /></Card>;
    }

    if (error) {
        return <FormError message={error} />;
    }

    if (!data) {
        return <EmptyState title="Рассадка не загружена" />;
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col space-y-3">
            {(!allSeated || canEdit) && (
                <div className={`rounded-card border px-3 py-2 text-sm ${
                    allSeated
                        ? "border-success/30 bg-success-soft text-success"
                        : "border-warning/30 bg-warning-soft text-warning"
                }`}>
                    {allSeated ? (
                        <span className="flex items-center gap-1.5"><Check size={16} aria-hidden /> Весь класс рассажен</span>
                    ) : noPlan ? (
                        <span>Рассадка на этот класс не заполнена. Заполните её — это не займёт много времени.</span>
                    ) : (
                        <span>Заполните рассадку: осталось мест — {remaining}.</span>
                    )}
                </div>
            )}

            {data.releasedSeats ? (
                <div className="rounded-control border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
                    Состав класса изменился: освобождено мест — {data.releasedSeats}. Проверьте рассадку.
                </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        label="Поиск по фамилии"
                        placeholder="Фамилия ученика"
                    />
                </div>
                <label className="flex min-h-9 items-center gap-2 rounded-control border border-border bg-surface-2 px-2.5 text-xs text-fg-muted">
                    <Checkbox
                        checked={showAbsent}
                        onChange={() => setShowAbsent(value => !value)}
                        label="Отсутствующие"
                        compact
                    />
                </label>
                <Button size="sm" variant="secondary" leftIcon={Printer} onClick={printSeating}>
                    Печать
                </Button>
            </div>

            <div className="max-h-[calc(100dvh-22rem)] min-h-40 space-y-1.5 overflow-y-auto pr-1">
                {Array.from({ length: ROWS }, (_, index) => index + 1).map(row => (
                    <div key={row} className="space-y-1">
                        {!canEdit && expandedDesk?.row === row && (
                            <div className="rounded-control border border-accent/30 bg-accent-soft px-2 py-1 text-[10px] text-accent-text">
                                Ряд {row}, парта {expandedDesk.desk}: слева {seatFor(row, expandedDesk.desk, "left")?.studentName ?? "свободно"} · справа {seatFor(row, expandedDesk.desk, "right")?.studentName ?? "свободно"}
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <span className="w-4 shrink-0 text-right text-[9px] tabular-nums text-fg-subtle">{row}</span>
                            <div className="grid min-w-0 flex-1 grid-cols-[1fr_6px_1fr_6px_1fr] items-stretch gap-1">
                                {DESKS.map(desk => (
                                    <Fragment key={desk}>
                                        <button
                                            type="button"
                                            onClick={() => canEdit ? openEditor(row, desk) : toggleDeskView(row, desk)}
                                            aria-expanded={!canEdit ? expandedDesk?.row === row && expandedDesk.desk === desk : undefined}
                                            aria-label={`Ряд ${row}, парта ${desk}: слева ${seatFor(row, desk, "left")?.studentName ?? "свободно"}, справа ${seatFor(row, desk, "right")?.studentName ?? "свободно"}`}
                                            className={`grid min-w-0 grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 text-left shadow-card transition-colors ${
                                                canEdit ? "hover:border-accent/40 hover:bg-surface-2" : "hover:border-accent/40"
                                            }`}
                                        >
                                            <SeatCell
                                                seat={seatFor(row, desk, "left")}
                                                showAbsent={showAbsent}
                                                absentIds={absentIds}
                                                dimmed={filterActive && !isMatch(seatFor(row, desk, "left"))}
                                                highlight={filterActive && isMatch(seatFor(row, desk, "left"))}
                                            />
                                            <SeatCell
                                                seat={seatFor(row, desk, "right")}
                                                showAbsent={showAbsent}
                                                absentIds={absentIds}
                                                dimmed={filterActive && !isMatch(seatFor(row, desk, "right"))}
                                                highlight={filterActive && isMatch(seatFor(row, desk, "right"))}
                                            />
                                        </button>
                                        {desk < 3 && <span className="w-1.5 rounded-full bg-bg" aria-hidden />}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-4 py-2 text-xs font-medium text-accent-text">
                <Monitor size={15} aria-hidden />
                Стол учителя
            </div>

            {canEdit && (
                <p className="pb-2 text-center text-[11px] text-fg-subtle">
                    Нажмите на парту, чтобы изменить места. Слева и справа — со стороны учителя.
                </p>
            )}

            {canEdit && editing && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-backdrop/50 p-3" onClick={closeEditor}>
                    <div
                        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-4 shadow-raised"
                        onClick={event => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Редактирование парты ${editing.row}, ${editing.desk}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-base font-semibold text-fg">Ряд {editing.row} · парта {editing.desk}</p>
                                <p className="text-[11px] text-fg-subtle">Слева и справа — лицом к учителю</p>
                            </div>
                            <Badge tone={draftLeft || draftRight ? "success" : "neutral"}>
                                {Number(Boolean(draftLeft)) + Number(Boolean(draftRight))} из 2
                            </Badge>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Select
                                label="Слева"
                                value={draftLeft}
                                onChange={setDraftLeft}
                                options={optionsFor(draftRight)}
                            />
                            <Select
                                label="Справа"
                                value={draftRight}
                                onChange={setDraftRight}
                                options={optionsFor(draftLeft)}
                            />
                        </div>

                        <FormError message={editorError} />

                        <div className="mt-4 flex gap-2">
                            <Button variant="ghost" fullWidth onClick={closeEditor} disabled={isSaving}>
                                Отмена
                            </Button>
                            <Button fullWidth onClick={() => void saveDesk()} loading={isSaving}>
                                Сохранить
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SeatCell({
    seat,
    showAbsent,
    absentIds,
    dimmed,
    highlight,
}: {
    seat: Seat | undefined;
    showAbsent: boolean;
    absentIds: Set<string>;
    dimmed?: boolean;
    highlight?: boolean;
}) {
    const student = seat?.studentId
        ? { id: seat.studentId, name: seat.studentName ?? "Ученик" }
        : null;
    const absent = Boolean(student && showAbsent && absentIds.has(student.id));

    return (
        <span className={`flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-md px-1 transition-opacity ${
            student ? "bg-success-soft/70" : "bg-surface-2"
        } ${dimmed ? "opacity-30 grayscale" : ""} ${highlight ? "ring-1 ring-accent/60" : ""}`}>
            {student ? (
                absent ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger text-xs font-bold text-white">н</span>
                ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white sm:hidden">
                        <UserRound size={13} aria-hidden />
                    </span>
                )
            ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-fg-subtle sm:hidden">
                    <Ban size={13} aria-hidden />
                </span>
            )}
            <span className="hidden min-w-0 truncate text-[10px] text-fg sm:block">
                {student ? (absent ? "н" : student.name.split(" ")[0]) : "—"}
            </span>
        </span>
    );
}

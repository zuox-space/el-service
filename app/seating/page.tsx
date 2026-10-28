"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, Check, LayoutGrid, Monitor, UserRound } from "lucide-react";
import { EmployeeHeader } from "@/components/shell/EmployeeHeader";
import { useAccess } from "@/components/access/AccessProvider";
import { NoAccess } from "@/components/access/NoAccess";
import { Badge, Button, Card, Checkbox, EmptyState, FormError, Select, Skeleton, useToast } from "@/components/ui/kit";
import { useSession, signOut } from "next-auth/react";

const ROWS = 15;

interface SeatingClass {
    id: string;
    name: string;
    grade: number;
    letter: string;
}

interface SeatingStudent {
    id: string;
    name: string;
}

interface Seat {
    row: number;
    side: "left" | "right";
    studentId: string | null;
    studentName: string | null;
}

interface SeatingResponse {
    class: { id: string; name: string };
    students: SeatingStudent[];
    seats: Seat[];
    absentStudentIds: string[];
}

function SeatingPageFallback() {
    return (
        <div className="min-h-full bg-bg">
            <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-4">
                <Skeleton height={56} radius="card" />
                <Skeleton height={280} radius="card" />
            </div>
        </div>
    );
}

export default function SeatingPage() {
    return (
        <Suspense fallback={<SeatingPageFallback />}>
            <SeatingContent />
        </Suspense>
    );
}

function SeatingContent() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const toast = useToast();
    const { can, loading: accessLoading } = useAccess();

    const [classes, setClasses] = useState<SeatingClass[]>([]);
    const [classId, setClassId] = useState(() => searchParams.get("classId") || "");
    const [data, setData] = useState<SeatingResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAbsent, setShowAbsent] = useState(false);
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [draftLeft, setDraftLeft] = useState("");
    const [draftRight, setDraftRight] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);

    const allowed = !accessLoading && (can("seating") || can("myClass"));

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/login");
    }, [status, router]);

    const loadClasses = useCallback(async () => {
        const response = await fetch("/api/seating/classes", { cache: "no-store" });
        if (!response.ok) throw new Error("Не удалось загрузить классы");
        const payload = await response.json();
        const next: SeatingClass[] = Array.isArray(payload.classes) ? payload.classes : [];
        setClasses(next);
        setClassId(current => {
            if (current && next.some(item => item.id === current)) return current;
            return next[0]?.id ?? "";
        });
    }, []);

    useEffect(() => {
        if (!allowed) return;
        void loadClasses().catch(e => setError(e instanceof Error ? e.message : "Не удалось загрузить классы"));
    }, [allowed, loadClasses]);

    const loadSeating = useCallback(async (id: string) => {
        if (!id) {
            setData(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/seating?classId=${encodeURIComponent(id)}`, {
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
    }, []);

    useEffect(() => {
        if (!allowed) return;
        void loadSeating(classId);
    }, [allowed, classId, loadSeating]);

    const seats = data?.seats ?? [];
    const students = data?.students ?? [];
    const absentIds = new Set(data?.absentStudentIds ?? []);
    const occupied = seats.filter(seat => seat.studentId).length;
    const allSeated = students.length > 0 && occupied === students.length;
    const noPlan = occupied === 0;
    const remaining = Math.max(0, students.length - occupied);

    const seatFor = (row: number, side: "left" | "right") =>
        seats.find(seat => seat.row === row && seat.side === side);

    const openEditor = (row: number) => {
        setEditingRow(row);
        setDraftLeft(seatFor(row, "left")?.studentId ?? "");
        setDraftRight(seatFor(row, "right")?.studentId ?? "");
        setEditorError(null);
    };

    const closeEditor = () => {
        if (isSaving) return;
        setEditingRow(null);
        setEditorError(null);
    };

    const occupiedElsewhere = useMemo(() => {
        const ids = new Set<string>();
        if (editingRow == null) return ids;
        for (const seat of seats) {
            if (seat.row !== editingRow && seat.studentId) ids.add(seat.studentId);
        }
        return ids;
    }, [editingRow, seats]);

    const optionsFor = (otherDraft: string) => [
        { value: "", label: "Никого" },
        ...students
            .filter(student => !occupiedElsewhere.has(student.id) && student.id !== otherDraft)
            .map(student => ({ value: student.id, label: student.name })),
    ];

    const saveRow = async () => {
        if (!data || editingRow == null) return;

        setIsSaving(true);
        setEditorError(null);
        try {
            const response = await fetch("/api/seating", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: data.class.id,
                    row: editingRow,
                    left: draftLeft || null,
                    right: draftRight || null,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Не удалось сохранить рассадку");

            const updatedSeats: Seat[] = Array.isArray(payload.seats) ? payload.seats : [];
            setData(previous => previous ? {
                ...previous,
                seats: [
                    ...previous.seats.filter(seat => seat.row !== editingRow),
                    ...updatedSeats,
                ],
            } : previous);
            setEditingRow(null);
            toast.show({ title: "Рассадка сохранена", tone: "success" });
        } catch (e) {
            setEditorError(e instanceof Error ? e.message : "Не удалось сохранить рассадку");
        } finally {
            setIsSaving(false);
        }
    };

    if (status === "loading" || accessLoading) return <SeatingPageFallback />;
    if (!session) return null;
    if (!allowed) return <NoAccess title="Нет доступа к разделу «Электронная рассадка»" />;

    const selectedClass = classes.find(item => item.id === classId);

    return (
        <div className="min-h-full bg-bg pb-24">
            <EmployeeHeader
                title="Электронная рассадка"
                backHref="/"
                userName={session.user.name ?? null}
                userEmail={session.user.email ?? null}
                roles={(session.user.roles as string[]) ?? []}
                onLogout={() => void signOut({ callbackUrl: "/" })}
            />

            <main className="mx-auto w-full max-w-5xl space-y-3 px-4 py-4">
                <Card padding="md">
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-48 flex-1">
                            <Select
                                label="Класс"
                                value={classId}
                                onChange={value => {
                                    setClassId(value);
                                    router.replace(`/seating?classId=${encodeURIComponent(value)}`, { scroll: false });
                                }}
                                placeholder="Выберите класс"
                                options={classes.map(item => ({ value: item.id, label: item.name }))}
                            />
                        </div>
                        <label className="flex min-h-12 items-center gap-2 rounded-control border border-border bg-surface-2 px-3 text-sm text-fg-muted">
                            <Checkbox
                                checked={showAbsent}
                                onChange={() => setShowAbsent(value => !value)}
                                label="Показывать отсутствующих («н»)"
                                compact
                            />
                        </label>
                    </div>
                </Card>

                {error && <FormError message={error} />}

                {isLoading ? (
                    <Card padding="md"><Skeleton height={320} radius="card" /></Card>
                ) : !selectedClass ? (
                    <EmptyState icon={LayoutGrid} title="Нет доступных классов" description="Обратитесь к администратору" />
                ) : !data ? (
                    <EmptyState icon={LayoutGrid} title="Рассадка не загружена" />
                ) : (
                    <>
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

                        <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-4 py-2 text-xs font-medium text-accent-text">
                            <Monitor size={15} aria-hidden />
                            Стол учителя
                        </div>

                        <div className="space-y-1.5">
                            {Array.from({ length: ROWS }, (_, index) => index + 1).map(row => {
                                const left = seatFor(row, "left");
                                const right = seatFor(row, "right");
                                return (
                                    <button
                                        type="button"
                                        key={row}
                                        onClick={() => openEditor(row)}
                                        aria-label={`Парта ${row}, слева ${left?.studentName ?? "свободно"}, справа ${right?.studentName ?? "свободно"}`}
                                        className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-xl border border-border bg-surface p-1.5 text-left shadow-card transition-colors hover:border-accent/40 hover:bg-surface-2"
                                    >
                                        <SeatCell seat={left} showAbsent={showAbsent} absentIds={absentIds} />
                                        <span className="w-5 text-center text-[10px] tabular-nums text-fg-subtle">{row}</span>
                                        <SeatCell seat={right} showAbsent={showAbsent} absentIds={absentIds} />
                                    </button>
                                );
                            })}
                        </div>

                        <p className="pb-4 pt-2 text-center text-[11px] text-fg-subtle">
                            Нажмите на парту, чтобы изменить места. Слева и справа — со стороны учителя.
                        </p>
                    </>
                )}
            </main>

            {editingRow != null && data && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-backdrop/50 p-3" onClick={closeEditor}>
                    <div
                        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-4 shadow-raised"
                        onClick={event => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Редактирование парты ${editingRow}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-base font-semibold text-fg">Парта {editingRow}</p>
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
                            <Button fullWidth onClick={() => void saveRow()} loading={isSaving}>
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
}: {
    seat: Seat | undefined;
    showAbsent: boolean;
    absentIds: Set<string>;
}) {
    const student = seat?.studentId
        ? { id: seat.studentId, name: seat.studentName ?? "Ученик" }
        : null;
    const absent = Boolean(student && showAbsent && absentIds.has(student.id));

    return (
        <span className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 sm:justify-start ${
            student ? "bg-success-soft/70" : "bg-surface-2"
        }`}>
            {student ? (
                absent ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-bold text-white">н</span>
                ) : (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-white sm:hidden">
                        <UserRound size={15} aria-hidden />
                    </span>
                )
            ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-fg-subtle sm:hidden">
                    <Ban size={15} aria-hidden />
                </span>
            )}
            <span className="hidden min-w-0 flex-1 truncate text-xs text-fg sm:block">
                {student ? (absent ? "Отсутствует" : student.name.split(" ")[0]) : "Свободно"}
            </span>
            <span className="hidden shrink-0 text-[10px] text-fg-subtle sm:block">
                {student && !absent ? "на месте" : ""}
            </span>
        </span>
    );
}

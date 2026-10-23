"use client";

// components/ui/AttendanceModal.tsx
import { useEffect, useMemo, useState } from "react";
import { Check, UserX } from "lucide-react";
import {
    Button,
    Checkbox,
    FormError,
    Modal,
    ModalFooter,
    Select,
    useSubmit,
} from "@/components/ui/kit";
import { formatDateRu, toLocalISODate } from "@/lib/date";

/**
 * AttendanceModal — отметка присутствия класса.
 *
 * Ключевые изменения:
 *  • общий Modal: шторка на мобильном, окно на десктопе; список скроллится, кнопки на виду;
 *  • причина отсутствия выбирается прямо в строке ученика — раньше для этого
 *    открывалась вторая модалка поверх первой;
 *  • пока список учеников не загружен, сохранение заблокировано: пустой набор
 *    больше не может затереть уже сделанную отметку;
 *  • ID сравниваются как строки (aisId из базы АИС — строка).
 */

const ABSENCE_REASONS = [
    { value: "sick", label: "Болен" },
    { value: "family", label: "По заявлению родителей" },
    { value: "other", label: "Причина неясна" },
    { value: "vacation", label: "Отпуск / каникулы" },
    { value: "competition", label: "Соревнования" },
];

interface Student {
    id: string | number;
    name: string;
}

interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    /** Бросает исключение при ошибке */
    onSubmit: (data: {
        date: string;
        presentStudents: string[];
        absentStudents: string[];
        absentReasons: Record<string, string>;
    }) => Promise<void>;
    existingAttendance: {
        presentStudents?: Array<string | number>;
        absentStudents?: Array<string | number>;
        absentReasons?: Record<string, string>;
    } | null;
    studentsList: Student[] | string | unknown;
}

function normalizeStudents(input: AttendanceModalProps["studentsList"]): Student[] {
    if (!input) return [];
    if (Array.isArray(input)) return input as Student[];
    if (typeof input === "string") {
        try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

export default function AttendanceModal({
    isOpen,
    onClose,
    selectedDate,
    onSubmit,
    existingAttendance,
    studentsList,
}: AttendanceModalProps) {
    const students = useMemo(() => normalizeStudents(studentsList), [studentsList]);
    const [absentIds, setAbsentIds] = useState<string[]>([]);
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const { submitting, error, setError, run } = useSubmit(onClose);

    // Инициализация при открытии: либо сохранённая отметка, либо «все присутствуют».
    // students.length в зависимостях — если список догрузился позже, состояние
    // пересобирается по актуальному списку, а не остаётся пустым.
    useEffect(() => {
        if (!isOpen) return;

        if (existingAttendance) {
            setAbsentIds((existingAttendance.absentStudents ?? []).map(String));
            setReasons(existingAttendance.absentReasons ?? {});
        } else {
            setAbsentIds([]);
            setReasons({});
        }
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, existingAttendance, students.length]);

    const toggle = (id: string | number) => {
        const key = String(id);
        setAbsentIds(prev => (prev.includes(key) ? prev.filter(value => value !== key) : [...prev, key]));
        setReasons(prev => {
            if (!(key in prev)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const markAllPresent = () => {
        setAbsentIds([]);
        setReasons({});
    };

    const markAllAbsent = () => {
        setAbsentIds(students.map(student => String(student.id)));
        setReasons({});
    };

    const presentCount = students.length - absentIds.length;
    const missingReasons = absentIds.filter(id => !reasons[id]);
    const listLoaded = students.length > 0;

    const handleSubmit = () => {
        if (!listLoaded) {
            setError("Список учеников ещё не загрузился. Подождите пару секунд.");
            return;
        }
        if (missingReasons.length > 0) {
            setError(`Укажите причину отсутствия для ${missingReasons.length} ученик(ов).`);
            return;
        }

        const presentStudents = students
            .map(student => String(student.id))
            .filter(id => !absentIds.includes(id));

        void run(async () => {
            await onSubmit({
                date: toLocalISODate(selectedDate),
                presentStudents,
                absentStudents: absentIds,
                absentReasons: reasons,
            });
        });
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Отметка присутствия"
            description={formatDateRu(selectedDate, { day: "numeric", month: "long", year: "numeric" })}
            size="md"
            confirmOnClose
            isDirty={absentIds.length > 0}
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={handleSubmit}
                    submitLabel={`Сохранить · ${presentCount} из ${students.length}`}
                    loading={submitting}
                    disabled={!listLoaded}
                />
            }
        >
            <div className="space-y-3">
                <FormError message={error} />

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] tabular-nums text-fg-subtle sm:text-xs">
                        <span className="whitespace-nowrap">Присутствуют {presentCount}</span>
                        <span className="mx-1">·</span>
                        <span className="whitespace-nowrap">отсутствуют {absentIds.length}</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" onClick={markAllPresent} disabled={absentIds.length === 0}>
                            Все на месте
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={markAllAbsent}
                            disabled={absentIds.length === students.length}
                        >
                            Все отсутствуют
                        </Button>
                    </div>
                </div>

                {/* Инструкция — до списка, чтобы было понятно, что делать */}
                <div className="flex items-start gap-2 rounded-control border border-dashed border-border px-3 py-2 text-xs text-fg-subtle">
                    <UserX size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                    <p>
                        Снимите галочку у отсутствующих и выберите причину справа. Сохранить пустой список
                        нельзя — это защита от затирания уже сделанной отметки.
                    </p>
                </div>

                {!listLoaded ? (
                    <p className="rounded-card border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-fg">
                        Список учеников загружается…
                    </p>
                ) : (
                    <ul role="list" className="divide-y divide-border overflow-hidden rounded-card border border-border">
                        {students.map(student => {
                            const absent = absentIds.includes(String(student.id));
                            const key = String(student.id);

                            return (
                                <li key={key} className="px-3 py-2">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                        <div className="min-w-0 flex-1">
                                            <Checkbox
                                                checked={!absent}
                                                onChange={() => toggle(student.id)}
                                                label={student.name}
                                                description={absent ? "Отсутствует" : undefined}
                                            />
                                        </div>

                                        {absent && (
                                            <div className="w-full shrink-0 sm:w-48">
                                                <Select
                                                    aria-label={`Причина отсутствия: ${student.name}`}
                                                    placeholder="Причина"
                                                    value={reasons[key] ?? ""}
                                                    onChange={value => setReasons(prev => ({ ...prev, [key]: value }))}
                                                    options={ABSENCE_REASONS}
                                                    error={
                                                        missingReasons.includes(key) && absentIds.length > 0
                                                            ? "Укажите причину"
                                                            : undefined
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {existingAttendance && (
                    <p className="flex items-center gap-1.5 text-xs text-success">
                        <Check size={14} strokeWidth={2} aria-hidden />
                        Отметка за этот день уже есть — изменения её заменят.
                    </p>
                )}
            </div>
        </Modal>
    );
}

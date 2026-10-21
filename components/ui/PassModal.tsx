"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { Button, Checkbox, FormError, Input, Modal, ModalFooter, SearchInput, useSubmit } from "@/components/ui/kit";
import { formatDateRu, toLocalISODate } from "@/lib/date";

/**
 * PassModal — оформление разового пропуска в два шага.
 *
 * Шаг 1: выбираем учеников (поиск, «выбрать всех», занятые и отсутствующие помечены).
 * Шаг 2: вводим время выхода — поле стоит прямо над кнопкой «Оформить пропуск»,
 * по умолчанию 13:00. Так меньше шансов пропустить время в длинной форме и
 * случайно оформить пропуск «на сейчас».
 *
 * Скроллится только список учеников: шапка, поле времени и кнопки остаются на месте
 * (это важно на телефоне, где окно превращается в шторку).
 */

interface Student {
    id: string | number;
    name: string;
}

interface PassModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    /** Бросает исключение при ошибке — модалка останется открытой */
    onSubmit: (data: {
        date: string;
        students: Student[];
        exitTime: string;
        reason: string;
    }) => Promise<void>;
    existingPasses: Array<{ students?: Student[] }>;
    absentStudentsOnDate: Array<string | number>;
    studentsList: Student[] | string | { students?: Student[] | string } | unknown;
}

const DEFAULT_TIME = "13:00";
const DEFAULT_REASON = "По заявлению родителей";

/** Приводим список учеников к массиву: с сервера он может прийти массивом, строкой JSON или объектом. */
function normalizeStudents(input: PassModalProps["studentsList"]): Student[] {
    const fromString = (value: string): Student[] => {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    if (!input) return [];
    if (Array.isArray(input)) return input as Student[];
    if (typeof input === "string") return fromString(input);

    if (typeof input === "object") {
        const holder = input as { students?: Student[] | string };
        if (holder.students) {
            return Array.isArray(holder.students) ? holder.students : fromString(holder.students);
        }
    }

    return [];
}

export default function PassModal({
    isOpen,
    onClose,
    selectedDate,
    onSubmit,
    existingPasses,
    absentStudentsOnDate,
    studentsList,
}: PassModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [selected, setSelected] = useState<string[]>([]);
    const [exitTime, setExitTime] = useState(DEFAULT_TIME);
    const [searchQuery, setSearchQuery] = useState("");

    const students = useMemo(() => normalizeStudents(studentsList), [studentsList]);
    const { submitting, error, run } = useSubmit(() => {
        reset();
        onClose();
    });

    const reset = () => {
        setSelected([]);
        setSearchQuery("");
        setExitTime(DEFAULT_TIME);
        setStep(1);
    };

    // Сбрасываем состояние при каждом открытии, чтобы не тянуть прошлый выбор
    useEffect(() => {
        if (isOpen) {
            setSelected([]);
            setSearchQuery("");
            setExitTime(DEFAULT_TIME);
            setStep(1);
        }
    }, [isOpen]);

    const hasPass = (id: string | number) =>
        existingPasses.some(pass => (pass.students ?? []).some(s => String(s.id) === String(id)));

    const isAbsent = (id: string | number) =>
        (absentStudentsOnDate ?? []).some(value => String(value) === String(id));

    const isBlocked = (id: string | number) => hasPass(id) || isAbsent(id);

    const filtered = students.filter(student =>
        student.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    );

    const available = filtered.filter(student => !isBlocked(student.id));

    const chosenStudents = useMemo(
        () => students.filter(student => selected.includes(String(student.id))),
        [students, selected],
    );

    const toggle = (id: string | number) => {
        if (isBlocked(id)) return;
        const key = String(id);
        setSelected(prev => (prev.includes(key) ? prev.filter(value => value !== key) : [...prev, key]));
    };

    const selectAllAvailable = () => {
        setSelected(available.map(student => String(student.id)));
    };

    const handleSubmit = () => {
        if (chosenStudents.length === 0) return;

        void run(async () => {
            await onSubmit({
                date: toLocalISODate(selectedDate),
                students: chosenStudents,
                exitTime: exitTime || DEFAULT_TIME,
                reason: DEFAULT_REASON,
            });
        });
    };

    const stepLabel = step === 1 ? "Шаг 1 из 2 · выберите учеников" : "Шаг 2 из 2 · время выхода";

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Пропуск"
            description={`${formatDateRu(selectedDate, { day: "numeric", month: "long", year: "numeric" })} · ${stepLabel}`}
            size="md"
            confirmOnClose
            isDirty={selected.length > 0 || exitTime !== DEFAULT_TIME}
            footer={
                step === 1 ? (
                    <ModalFooter
                        onCancel={onClose}
                        onSubmit={() => setStep(2)}
                        submitLabel={selected.length > 0 ? `Далее · выбрано ${selected.length}` : "Далее"}
                        disabled={selected.length === 0}
                    />
                ) : (
                    <ModalFooter
                        onCancel={() => setStep(1)}
                        onSubmit={handleSubmit}
                        submitLabel={`Оформить пропуск (${selected.length})`}
                        loading={submitting}
                        disabled={selected.length === 0}
                        cancelLabel="Назад"
                    />
                )
            }
        >
            <div className="space-y-4">
                <FormError message={error} />

                {step === 1 ? (
                    <>
                        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Поиск ученика по имени" />

                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-fg-subtle">
                                Доступно: {available.length} из {students.length}
                            </p>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={selectAllAvailable} disabled={available.length === 0}>
                                    Выбрать всех
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setSelected([])} disabled={selected.length === 0}>
                                    Снять выбор
                                </Button>
                            </div>
                        </div>

                        {/* Скроллится только список учеников */}
                        <div className="max-h-72 overflow-y-auto rounded-card border border-border">
                            {filtered.length === 0 ? (
                                <p className="px-4 py-6 text-center text-sm text-fg-muted">
                                    {students.length === 0 ? "В классе нет учеников" : "Ничего не найдено"}
                                </p>
                            ) : (
                                <ul role="list" className="divide-y divide-border">
                                    {filtered.map(student => {
                                        const blocked = isBlocked(student.id);
                                        const blockedLabel = hasPass(student.id)
                                            ? "уже есть пропуск"
                                            : isAbsent(student.id)
                                                ? "отсутствует"
                                                : undefined;

                                        return (
                                            <li key={student.id}>
                                                <Checkbox
                                                    checked={selected.includes(String(student.id))}
                                                    onChange={() => toggle(student.id)}
                                                    label={student.name}
                                                    description={blockedLabel}
                                                    disabled={blocked}
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Выбранные ученики · {chosenStudents.length}
                            </p>
                            <div className="max-h-40 overflow-y-auto rounded-card border border-border">
                                <ul role="list" className="divide-y divide-border">
                                    {chosenStudents.map(student => (
                                        <li key={student.id} className="px-4 py-2 text-sm text-fg">
                                            {student.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Время — прямо над кнопкой «Оформить пропуск» */}
                        <div className="rounded-card border border-dashed border-border p-3">
                            <Input
                                label="Время выхода"
                                type="time"
                                value={exitTime}
                                onChange={event => setExitTime(event.target.value)}
                                hint="По умолчанию 13:00 — можно изменить"
                            />
                            <p className="mt-2 flex items-center gap-1.5 text-xs text-fg-subtle">
                                <Clock size={12} aria-hidden />
                                Причина: {DEFAULT_REASON.toLowerCase()}
                            </p>
                        </div>

                        <Button
                            variant="ghost"
                            leftIcon={ArrowLeft}
                            onClick={() => setStep(1)}
                            className="w-full sm:w-auto"
                        >
                            Изменить выбор
                        </Button>
                    </>
                )}
            </div>
        </Modal>
    );
}

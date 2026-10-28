"use client";

// components/ui/SelfExitModal.tsx
import { useEffect, useMemo } from "react";
import { useState } from "react";
import { FormError, Input, Modal, ModalFooter, Select, Textarea, useSubmit } from "@/components/ui/kit";
import { toLocalISODate } from "@/lib/date";

/**
 * SelfExitModal — самовыход ученика по заявлению (1–4 классы).
 *
 * Переведён на общий Modal (шторка на мобильном) и на поля UI Kit: шрифт 16px,
 * высота 48px, нативный picker даты. Отправка ждёт ответ сервера, ошибка
 * показывается в окне и не приводит к потере введённых данных.
 */

interface Student {
    id: string | number;
    name: string;
}

interface SelfExitModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Бросает исключение при ошибке */
    onSubmit: (data: {
        studentId: string | number;
        studentName: string;
        startDate: string;
        endDate: string;
        reason: string;
    }) => Promise<void>;
    studentsList: Student[] | string | unknown;
}

function normalizeStudents(input: SelfExitModalProps["studentsList"]): Student[] {
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

export default function SelfExitModal({ isOpen, onClose, onSubmit, studentsList }: SelfExitModalProps) {
    const students = useMemo(() => normalizeStudents(studentsList), [studentsList]);

    const [studentId, setStudentId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [reason, setReason] = useState("");

    const today = toLocalISODate();
    const { submitting, error, run } = useSubmit(() => {
        reset();
        onClose();
    });

    const reset = () => {
        setStudentId("");
        setStartDate("");
        setEndDate("");
        setReason("");
    };

    useEffect(() => {
        if (!isOpen) return;
        const todayValue = toLocalISODate();
        setStudentId("");
        setStartDate(todayValue);
        setEndDate(todayValue);
        setReason("");
    }, [isOpen]);

    const selectedStudent = students.find(student => String(student.id) === studentId);
    const datesInvalid = Boolean(startDate && endDate && endDate < startDate);
    const canSubmit = Boolean(selectedStudent && startDate && endDate && !datesInvalid);

    const handleSubmit = () => {
        if (!selectedStudent || !canSubmit) return;

        void run(async () => {
            await onSubmit({
                studentId: selectedStudent.id,
                studentName: selectedStudent.name,
                startDate,
                endDate,
                reason: reason.trim(),
            });
        });
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Самовыход ученика"
            description="Разрешение уходить домой самостоятельно"
            size="md"
            confirmOnClose
            isDirty={Boolean(reason.trim() || studentId)}
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={handleSubmit}
                    submitLabel="Сохранить"
                    loading={submitting}
                    disabled={!canSubmit}
                />
            }
        >
            <div className="space-y-4">
                <FormError message={error} />

                <Select
                    label="Ученик"
                    placeholder="Выберите ученика"
                    value={studentId}
                    onChange={setStudentId}
                    options={students.map(student => ({
                        value: String(student.id),
                        label: student.name,
                    }))}
                />

                <div className="grid grid-cols-2 gap-3">
                    <Input
                        label="С"
                        type="date"
                        value={startDate}
                        min={today}
                        onChange={e => {
                            setStartDate(e.target.value);
                            if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                        }}
                    />
                    <Input
                        label="По"
                        type="date"
                        value={endDate}
                        min={startDate || today}
                        error={datesInvalid ? "Дата окончания раньше начала" : undefined}
                        onChange={e => setEndDate(e.target.value)}
                    />
                </div>

                <Textarea
                    label="Причина"
                    placeholder="Необязательно: например, по заявлению родителей"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={2}
                />
            </div>
        </Modal>
    );
}

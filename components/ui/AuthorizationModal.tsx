"use client";

// components/ui/AuthorizationModal.tsx
import { useEffect, useMemo, useState } from "react";
import { FormError, Input, Modal, ModalFooter, Select, Textarea, useSubmit } from "@/components/ui/kit";

/**
 * AuthorizationModal — доверенность: кто имеет право забрать ребёнка из школы.
 *
 * Без эмодзи в списке родственников (как было): подписи текстом, выбор — через Select
 * с крупным тап-таргетом. Отправка ждёт ответ сервера, ошибка остаётся в окне.
 */

const RELATION_OPTIONS = [
    { id: "mother", label: "Мама" },
    { id: "father", label: "Папа" },
    { id: "grandmother", label: "Бабушка" },
    { id: "grandfather", label: "Дедушка" },
    { id: "aunt", label: "Тётя" },
    { id: "uncle", label: "Дядя" },
    { id: "sister", label: "Сестра" },
    { id: "brother", label: "Брат" },
    { id: "nanny", label: "Няня" },
    { id: "driver", label: "Водитель" },
    { id: "other", label: "Другое (указать)" },
];

interface Student {
    aisId?: string | number;
    id?: string | number;
    name: string;
    className?: string;
}

interface AuthorizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Бросает исключение при ошибке */
    onSubmit: (data: {
        studentId: string | number;
        studentName: string;
        className: string;
        trustedName: string;
        relation: string;
        phone: string | null;
        comment: string | null;
    }) => Promise<void>;
    studentsList: Student[];
}

export default function AuthorizationModal({
    isOpen,
    onClose,
    onSubmit,
    studentsList,
}: AuthorizationModalProps) {
    const [studentId, setStudentId] = useState("");
    const [trustedName, setTrustedName] = useState("");
    const [relation, setRelation] = useState("");
    const [customRelation, setCustomRelation] = useState("");
    const [phone, setPhone] = useState("");
    const [comment, setComment] = useState("");

    const students = useMemo(() => (Array.isArray(studentsList) ? studentsList : []), [studentsList]);
    const { submitting, error, run } = useSubmit(() => {
        reset();
        onClose();
    });

    const reset = () => {
        setStudentId("");
        setTrustedName("");
        setRelation("");
        setCustomRelation("");
        setPhone("");
        setComment("");
    };

    useEffect(() => {
        if (!isOpen) return;
        reset();
    }, [isOpen]);

    const selectedStudent = students.find(student => String(student.aisId ?? student.id) === studentId);
    const relationLabel =
        relation === "other"
            ? customRelation.trim()
            : RELATION_OPTIONS.find(item => item.id === relation)?.label ?? "";

    const canSubmit = Boolean(
        selectedStudent && trustedName.trim() && relationLabel,
    );

    const handleSubmit = () => {
        if (!selectedStudent || !canSubmit) return;

        void run(async () => {
            await onSubmit({
                studentId: selectedStudent.aisId ?? selectedStudent.id ?? "",
                studentName: selectedStudent.name,
                className: selectedStudent.className ?? "",
                trustedName: trustedName.trim(),
                relation: relationLabel,
                phone: phone.trim() || null,
                comment: comment.trim() || null,
            });
        });
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Доверенность"
            description="Кому можно передать ребёнка"
            size="md"
            confirmOnClose
            isDirty={Boolean(trustedName.trim() || relation || comment.trim() || phone.trim())}
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={handleSubmit}
                    submitLabel="Добавить доверенность"
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
                        value: String(student.aisId ?? student.id),
                        label: student.className ? `${student.name} · ${student.className}` : student.name,
                    }))}
                />

                <Input
                    label="ФИО доверенного лица"
                    placeholder="Кому можно передать ребёнка"
                    value={trustedName}
                    onChange={e => setTrustedName(e.target.value)}
                    required
                />

                <Select
                    label="Кем приходится"
                    placeholder="Выберите"
                    value={relation}
                    onChange={value => {
                        setRelation(value);
                        if (value !== "other") setCustomRelation("");
                    }}
                    options={RELATION_OPTIONS.map(item => ({ value: item.id, label: item.label }))}
                />

                {relation === "other" && (
                    <Input
                        label="Кем приходится (уточните)"
                        placeholder="Например, соседка"
                        value={customRelation}
                        onChange={e => setCustomRelation(e.target.value)}
                        required
                    />
                )}

                <Input
                    label="Телефон"
                    type="tel"
                    inputMode="tel"
                    placeholder="+7 900 000-00-00"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    hint="Необязательно"
                />

                <Textarea
                    label="Комментарий"
                    placeholder="Необязательно"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={2}
                />
            </div>
        </Modal>
    );
}

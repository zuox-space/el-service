"use client";

// components/ui/SchoolRecordModal.tsx
import { useEffect, useMemo, useState } from "react";
import { FormError, Input, Modal, ModalFooter, Textarea, useSubmit } from "@/components/ui/kit";
import { addMonths, formatDateRu, toLocalISODate } from "@/lib/date";
import { cn } from "@/lib/cn";

/**
 * SchoolRecordModal — постановка на внутришкольный учёт и снятие с него.
 *
 * Плановая дата снятия считается через addMonths: 31 января + 1 месяц = 28/29 февраля.
 * Раньше использовался setMonth, и дата уезжала на начало марта.
 */

const PERIOD_OPTIONS = [
    { id: "1m", label: "1 месяц", months: 1 },
    { id: "3m", label: "3 месяца", months: 3 },
    { id: "6m", label: "6 месяцев", months: 6 },
    { id: "1y", label: "1 год", months: 12 },
    { id: "custom", label: "Другая дата", months: 0 },
] as const;

type PeriodId = (typeof PERIOD_OPTIONS)[number]["id"];

interface SchoolRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Бросает исключение при ошибке */
    onSubmit: (data: {
        date: string;
        reason: string;
        plannedReleaseAt: string | null;
    }) => Promise<void>;
    mode: "register" | "release";
    studentName: string;
    existingReason?: string;
}

export default function SchoolRecordModal({
    isOpen,
    onClose,
    onSubmit,
    mode,
    studentName,
    existingReason,
}: SchoolRecordModalProps) {
    const [date, setDate] = useState(toLocalISODate());
    const [period, setPeriod] = useState<PeriodId>("3m");
    const [customDate, setCustomDate] = useState("");
    const [reason, setReason] = useState("");

    const isRegister = mode === "register";
    const { submitting, error, run } = useSubmit(onClose);

    useEffect(() => {
        if (!isOpen) return;
        setDate(toLocalISODate());
        setPeriod("3m");
        setCustomDate("");
        setReason("");
    }, [isOpen]);

    const plannedRelease = useMemo(() => {
        if (!isRegister) return null;
        if (period === "custom") return customDate || null;

        const option = PERIOD_OPTIONS.find(item => item.id === period);
        if (!option || option.months === 0) return null;
        return toLocalISODate(addMonths(date, option.months));
    }, [isRegister, period, customDate, date]);

    const canSubmit = Boolean(reason.trim() && (!isRegister || period !== "custom" || customDate));

    const handleSubmit = () => {
        if (!canSubmit) return;

        void run(async () => {
            await onSubmit({
                date,
                reason: reason.trim(),
                plannedReleaseAt: plannedRelease,
            });
        });
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={isRegister ? "Постановка на учёт" : "Снятие с учёта"}
            description={studentName}
            size="md"
            confirmOnClose
            isDirty={Boolean(reason.trim())}
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={handleSubmit}
                    submitLabel={isRegister ? "Поставить на учёт" : "Снять с учёта"}
                    loading={submitting}
                    disabled={!canSubmit}
                    tone="primary"
                />
            }
        >
            <div className="space-y-4">
                <FormError message={error} />

                {!isRegister && existingReason && (
                    <div className="rounded-card border border-warning/30 bg-warning-soft px-3 py-2">
                        <p className="text-xs font-medium text-warning">Причина постановки на учёт</p>
                        <p className="mt-0.5 text-sm text-fg">{existingReason}</p>
                    </div>
                )}

                <Input
                    label={isRegister ? "Дата постановки" : "Дата снятия"}
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />

                {isRegister && (
                    <div>
                        <p className="mb-1.5 text-sm font-medium text-fg">Предполагаемый период</p>
                        <div className="flex flex-wrap gap-1.5">
                            {PERIOD_OPTIONS.map(option => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setPeriod(option.id)}
                                    aria-pressed={period === option.id}
                                    className={cn(
                                        "h-10 rounded-control border px-3 text-sm transition-colors active:scale-[0.99]",
                                        period === option.id
                                            ? "border-accent/40 bg-accent-soft text-accent-text"
                                            : "border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg",
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {period === "custom" && (
                            <Input
                                wrapperClassName="mt-3"
                                label="Предполагаемая дата снятия"
                                type="date"
                                value={customDate}
                                min={date}
                                onChange={e => setCustomDate(e.target.value)}
                            />
                        )}

                        {plannedRelease && (
                            <p className="mt-2 rounded-control border border-info/30 bg-info-soft px-3 py-2 text-sm text-fg">
                                Планируемая дата снятия:{" "}
                                <span className="font-medium">{formatDateRu(plannedRelease, { day: "numeric", month: "long", year: "numeric" })}</span>
                            </p>
                        )}
                    </div>
                )}

                <Textarea
                    label={isRegister ? "Причина постановки" : "Причина снятия"}
                    placeholder={
                        isRegister
                            ? "Опишите причину постановки на внутришкольный учёт"
                            : "Опишите причину снятия с учёта"
                    }
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                />

                <p className="text-xs text-fg-subtle">
                    {isRegister
                        ? "Ученик будет поставлен на внутришкольный учёт."
                        : "Ученик будет снят с внутришкольного учёта."}
                </p>
            </div>
        </Modal>
    );
}

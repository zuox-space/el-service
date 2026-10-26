"use client";

// components/ui/ResolveViolationModal.tsx
import { useEffect, useState } from "react";
import { CheckCheck, RotateCcw, Share2 } from "lucide-react";
import {
    Button,
    FormError,
    ModalFooter,
    Sheet,
    Textarea,
    useToast,
} from "@/components/ui/kit";
import { getViolationType } from "@/lib/violations";
import { buildParentViolationMessage, shareViolationMessage } from "@/lib/violation-message";
import { formatDateTimeMoscow } from "@/lib/date";

/**
 * Отработка нарушения: комментарий о проделанной работе.
 *
 * Работает и для одного нарушения, и для группы — поэтому принимает список.
 * Если всё выбранное уже отработано, окно показывает комментарий и позволяет
 * снять отметку (например, поставили по ошибке).
 */

const COMMENT_PRESETS = [
    "Поговорил с ребёнком",
    "Замечание отработано с родителями",
    "Передано в работу соц. педагогу",
];

export interface ResolvableViolation {
    id: string;
    studentName: string;
    className?: string;
    violationType: string;
    comment?: string | null;
    teacherName?: string | null;
    date?: string;
    resolvedAt?: string | null;
    resolvedByName?: string | null;
    resolutionComment?: string | null;
}

interface ResolveViolationModalProps {
    open: boolean;
    onClose: () => void;
    violations: ResolvableViolation[];
    /** Вызывается после успешного сохранения — родитель обновляет список */
    onDone: () => void;
    /** class_teacher — отметку ставит классный руководитель со своего экрана */
    source?: "class_teacher";
}

export function ResolveViolationModal({ open, onClose, violations, onDone, source }: ResolveViolationModalProps) {
    const [comment, setComment] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [shareError, setShareError] = useState<string | null>(null);
    const [sharing, setSharing] = useState(false);
    const [busy, setBusy] = useState<"resolve" | "unresolve" | null>(null);
    const toast = useToast();

    const allResolved = violations.length > 0 && violations.every(item => Boolean(item.resolvedAt));
    const single = violations.length === 1 ? violations[0] : null;
    const canShare = source === "class_teacher" && single !== null;
    const sharePayload = single
        ? buildParentViolationMessage({
              studentName: single.studentName,
              violationType: single.violationType,
              teacherName: single.teacherName,
              comment: single.comment,
          })
        : null;

    useEffect(() => {
        if (!open) return;

        setError(null);
        setShareError(null);
        setComment(single?.resolutionComment ?? "");
    }, [open, single?.id, single?.resolutionComment]);

    const shareToParent = async () => {
        if (!sharePayload) return;

        setShareError(null);
        setSharing(true);
        try {
            const result = await shareViolationMessage(sharePayload);
            if (result === "copied") {
                toast.show({
                    title: "Сообщение скопировано",
                    description: "Вставьте его в MAX, Telegram, WhatsApp или другой мессенджер",
                    tone: "success",
                });
            }
        } catch (e) {
            setShareError(e instanceof Error ? e.message : "Не удалось поделиться сообщением");
        } finally {
            setSharing(false);
        }
    };

    const submit = async (resolved: boolean) => {
        setError(null);

        const text = comment.trim();
        if (resolved && text.length < 3) {
            setError("Опишите, что сделано — хотя бы 3 символа");
            return;
        }

        setBusy(resolved ? "resolve" : "unresolve");
        try {
            const response = await fetch("/api/violations/resolve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: violations.map(item => item.id), comment: text, resolved, source }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось сохранить отработку");

            onDone();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось сохранить отработку");
        } finally {
            setBusy(null);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={allResolved ? "Отработка нарушения" : "Отметить отработку"}
            description={
                violations.length === 1
                    ? single?.studentName
                    : `Выбрано нарушений: ${violations.length}`
            }
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={() => void submit(true)}
                    submitLabel={allResolved ? "Сохранить комментарий" : "Отметить отработку"}
                    loading={busy === "resolve"}
                    disabled={busy !== null}
                />
            }
        >
            <div className="space-y-3">
                <FormError message={error} />

                {violations.length > 1 && (
                    <ul className="scroll-row max-h-32 space-y-1 overflow-y-auto rounded-control border border-dashed border-border p-2">
                        {violations.map(item => {
                            const type = getViolationType(item.violationType);

                            return (
                                <li key={item.id} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="min-w-0 truncate text-fg">{item.studentName}</span>
                                    <span className={`shrink-0 ${type.color}`}>{type.shortLabel}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {allResolved && single?.resolvedAt && (
                    <div className="rounded-control border border-dashed border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
                        Отработано: <span className="text-fg">{single.resolvedByName || "администратор"}</span> ·{" "}
                        {formatDateTimeMoscow(single.resolvedAt)}
                    </div>
                )}

                <Textarea
                    label="Что сделано"
                    value={comment}
                    onChange={event => setComment(event.target.value)}
                    placeholder="Например: поговорили с учеником и родителями, замечание снято"
                    rows={4}
                    hint="Комментарий увидит сотрудник, который зафиксировал нарушение"
                    required
                />

                <div>
                    <p className="mb-1.5 text-xs text-fg-subtle">Быстрые формулировки</p>
                    <div className="flex flex-wrap gap-1.5">
                        {COMMENT_PRESETS.map(preset => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                    setComment(current => (current.trim() ? `${current.trim()}\n${preset}` : preset))
                                }
                                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-left text-xs text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </div>

                {canShare && sharePayload && (
                    <div className="rounded-control border border-accent/25 bg-accent-soft/30 p-3">
                        <div className="flex items-start gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                                <Share2 size={15} aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-fg">Сообщение родителю</p>
                                <p className="mt-0.5 text-[11px] text-fg-subtle">
                                    Готовый текст откроется в меню мессенджеров или скопируется.
                                </p>
                            </div>
                        </div>

                        <details className="mt-2 rounded-control border border-border/70 bg-surface px-2.5 py-2">
                            <summary className="cursor-pointer text-[11px] font-medium text-fg-muted">
                                Показать текст
                            </summary>
                            <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-fg-muted">
                                {sharePayload.text}
                            </p>
                        </details>

                        <Button
                            fullWidth
                            size="sm"
                            variant="secondary"
                            leftIcon={Share2}
                            className="mt-2"
                            onClick={() => void shareToParent()}
                            loading={sharing}
                            disabled={sharing}
                        >
                            Поделиться в мессенджере
                        </Button>
                        <FormError message={shareError} />
                    </div>
                )}

                {allResolved && (
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={RotateCcw}
                        onClick={() => void submit(false)}
                        loading={busy === "unresolve"}
                        disabled={busy !== null}
                        className="text-danger"
                    >
                        Снять отметку об отработке
                    </Button>
                )}

                {!allResolved && (
                    <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                        <CheckCheck size={14} aria-hidden />
                        Отметка сохранит ваше имя и время — это увидит автор нарушения.
                    </p>
                )}
            </div>
        </Sheet>
    );
}

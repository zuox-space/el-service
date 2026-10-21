// components/ui/ViolationModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, User } from "lucide-react";
import {
    Badge,
    Button,
    FormError,
    Modal,
    ModalFooter,
    SearchInput,
    Textarea,
    useSubmit,
} from "@/components/ui/kit";
import { VIOLATION_TYPES, getViolationType } from "@/lib/violations";
import { toLocalISODate } from "@/lib/date";
import { cn } from "@/lib/cn";

/**
 * ViolationModal — фиксация нарушения.
 *
 * Что изменено по сравнению со старой версией:
 *  • общий Modal: шторка на мобильном, окно на десктопе; фиксированные шапка и кнопки;
 *  • поиск ученика больше не выпадающий список с overflow:hidden (он обрезал
 *    результаты — часть учеников была недоступна), а список в потоке документа;
 *  • типы нарушений — кнопки с иконками Lucide вместо эмодзи;
 *  • отправка ждёт сервер: окно закрывается только при успехе, ошибка видна на экране;
 *  • проверка дубликата показывает предупреждение вместо блокирующего confirm().
 */

interface Student {
    aisId: string;
    name: string;
    className: string;
}

interface ExistingViolation {
    id: string;
    violationType: string;
    comment?: string | null;
    date: string;
    teacherName: string;
}

interface ViolationModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Бросает исключение при ошибке */
    onSubmit: (data: {
        studentId: string;
        studentName: string;
        className: string;
        violationType: string;
        comment: string;
    }) => Promise<void>;
}

export default function ViolationModal({ isOpen, onClose, onSubmit }: ViolationModalProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Student[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    const [violationType, setViolationType] = useState("");
    const [comment, setComment] = useState("");

    const [existing, setExisting] = useState<ExistingViolation[]>([]);
    const [isLoadingExisting, setIsLoadingExisting] = useState(false);

    const today = toLocalISODate();
    const { submitting, error, run } = useSubmit(() => {
        reset();
        onClose();
    });

    const reset = () => {
        setSearchQuery("");
        setSearchResults([]);
        setSelectedStudent(null);
        setViolationType("");
        setComment("");
        setExisting([]);
    };

    useEffect(() => {
        if (isOpen) reset();
    }, [isOpen]);

    /* Поиск ученика на сервере: в школе больше 250 учеников, локальный поиск по одному классу не подходит */
    useEffect(() => {
        if (!isOpen) return;

        const query = searchQuery.trim();
        if (query.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        let cancelled = false;
        setIsSearching(true);

        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(`/api/students/search?q=${encodeURIComponent(query)}&limit=20`);
                const data = await response.json();
                if (!cancelled) setSearchResults(Array.isArray(data) ? data : []);
            } catch {
                if (!cancelled) setSearchResults([]);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [searchQuery, isOpen]);

    /* Уже зафиксированные нарушения ученика за сегодня — чтобы не дублировать */
    useEffect(() => {
        if (!selectedStudent) {
            setExisting([]);
            return;
        }

        let cancelled = false;
        setIsLoadingExisting(true);

        fetch(`/api/violations?studentId=${selectedStudent.aisId}&date=${today}&pageSize=50`)
            .then(response => response.json())
            .then(data => {
                if (cancelled) return;
                const rows = Array.isArray(data) ? data : Array.isArray(data?.violations) ? data.violations : [];
                setExisting(rows);
            })
            .catch(() => {
                if (!cancelled) setExisting([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingExisting(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedStudent, today]);

    const duplicateTypes = useMemo(
        () => new Set(existing.map(item => item.violationType)),
        [existing],
    );

    const canSubmit = Boolean(selectedStudent && violationType);

    const handleSubmit = () => {
        if (!selectedStudent || !violationType) return;

        void run(async () => {
            await onSubmit({
                studentId: selectedStudent.aisId,
                studentName: selectedStudent.name,
                className: selectedStudent.className,
                violationType,
                comment: comment.trim(),
            });
        });
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Нарушение"
            description={selectedStudent ? `${selectedStudent.name} · ${selectedStudent.className}` : "Выберите ученика и тип"}
            size="md"
            confirmOnClose
            isDirty={Boolean(violationType || comment.trim())}
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={handleSubmit}
                    submitLabel="Зафиксировать"
                    loading={submitting}
                    disabled={!canSubmit}
                />
            }
        >
            <div className="space-y-4">
                <FormError message={error} />

                {/* --- ученик --- */}
                {selectedStudent ? (
                    <div className="flex items-center gap-3 rounded-card border border-border bg-surface-2 px-3 py-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                            <User size={18} strokeWidth={1.75} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">{selectedStudent.name}</p>
                            <p className="text-xs text-fg-muted">{selectedStudent.className}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedStudent(null)}>
                            Изменить
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <SearchInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            label="Ученик"
                            placeholder="Введите минимум 2 символа"
                        />

                        {searchQuery.trim().length >= 2 && (
                            <div className="max-h-60 overflow-y-auto rounded-card border border-border">
                                {isSearching ? (
                                    <p className="px-3 py-4 text-center text-sm text-fg-muted">Поиск…</p>
                                ) : searchResults.length === 0 ? (
                                    <p className="px-3 py-4 text-center text-sm text-fg-muted">Ничего не найдено</p>
                                ) : (
                                    <ul role="list" className="divide-y divide-border">
                                        {searchResults.map(student => (
                                            <li key={student.aisId}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedStudent(student);
                                                        setSearchQuery("");
                                                        setSearchResults([]);
                                                    }}
                                                    className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
                                                >
                                                    <span className="truncate text-sm text-fg">{student.name}</span>
                                                    <Badge tone="neutral">{student.className}</Badge>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}

                        {searchQuery.trim().length >= 2 && searchResults.length >= 20 && (
                            <p className="text-xs text-fg-subtle">
                                Показаны первые 20 результатов — уточните запрос.
                            </p>
                        )}
                    </div>
                )}

                {/* --- уже зафиксировано сегодня --- */}
                {selectedStudent && isLoadingExisting && (
                    <p className="text-xs text-fg-muted">Проверяем нарушения за сегодня…</p>
                )}

                {selectedStudent && !isLoadingExisting && existing.length > 0 && (
                    <div className="rounded-card border border-warning/30 bg-warning-soft px-3 py-2">
                        <p className="text-xs font-medium text-warning">
                            Уже зафиксировано сегодня: {existing.length}
                        </p>
                        <ul className="mt-1 space-y-1">
                            {existing.map(item => {
                                const type = getViolationType(item.violationType);
                                return (
                                    <li key={item.id} className="flex items-center gap-2 text-xs text-fg-muted">
                                        <Clock size={12} strokeWidth={1.75} aria-hidden />
                                        <span className="truncate">
                                            {type.shortLabel}
                                            {item.comment ? ` · ${item.comment}` : ""}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* --- тип нарушения --- */}
                <div>
                    <p className="mb-1.5 text-sm font-medium text-fg">Тип нарушения</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        {VIOLATION_TYPES.map(type => {
                            const active = violationType === type.id;
                            const duplicate = duplicateTypes.has(type.id);
                            const Icon = type.Icon;

                            return (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => setViolationType(type.id)}
                                    aria-pressed={active}
                                    className={cn(
                                        "flex min-h-11 items-center gap-2 rounded-control border px-2.5 py-2 text-left text-xs transition-colors",
                                        "active:scale-[0.99]",
                                        active
                                            ? "border-accent/40 bg-accent-soft text-accent-text"
                                            : "border-border bg-surface-2 text-fg-muted hover:border-border-strong hover:text-fg",
                                    )}
                                >
                                    <Icon size={16} strokeWidth={1.75} className={active ? "text-accent-text" : type.color} aria-hidden />
                                    <span className="truncate">{type.label}</span>
                                    {duplicate && (
                                        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-warning" title="Уже есть сегодня" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {violationType && duplicateTypes.has(violationType) && (
                        <p className="mt-1.5 text-xs text-warning">
                            Такое нарушение у ученика уже есть сегодня. Можно зафиксировать ещё одно.
                        </p>
                    )}
                </div>

                <Textarea
                    label="Комментарий"
                    placeholder="Что произошло"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                />
            </div>
        </Modal>
    );
}

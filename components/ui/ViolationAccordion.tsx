"use client";

// components/ui/ViolationAccordion.tsx
import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { Badge, Button, Card, EmptyState } from "@/components/ui/kit";
import { formatDateTimeMoscow } from "@/lib/date";
import { getViolationType, resolverLabel } from "@/lib/violations";

/**
 * Раскрывающиеся карточки нарушений.
 *
 * Один компонент для двух задач: сотрудник смотрит свои фиксации, а классный
 * руководитель — нарушения класса. В карточке видно свой комментарий, кто и
 * когда отработал и что сделано. Если нарушение ещё не отработано и есть право
 * отработки — внутри есть кнопка «Отработать». Отработанные повторно не
 * редактируются: у классного руководителя это только просмотр.
 */

export interface AccordionViolation {
    id: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string | null;
    date: string;
    teacherName?: string | null;
    resolvedAt?: string | null;
    resolvedByName?: string | null;
    resolutionComment?: string | null;
    resolvedSource?: string | null;
}

interface ViolationAccordionProps {
    items: AccordionViolation[];
    isLoading?: boolean;
    /** Показывать ученика (для «Моих фиксаций» и дня класса) */
    showStudent?: boolean;
    /** Показывать автора фиксации (в истории сотрудника он лишний) */
    showTeacher?: boolean;
    /** Можно ли отмечать отработку неотработанных нарушений */
    canResolve?: boolean;
    onResolve?: (item: AccordionViolation) => void;
    emptyTitle?: string;
    emptyDescription?: string;
}

export function ViolationAccordion({
    items,
    isLoading = false,
    showStudent = true,
    showTeacher = false,
    canResolve = false,
    onResolve,
    emptyTitle = "Нарушений нет",
    emptyDescription,
}: ViolationAccordionProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="space-y-2">
                <Card padding="none" className="h-20 animate-pulse" />
                <Card padding="none" className="h-20 animate-pulse" />
            </div>
        );
    }

    if (items.length === 0) {
        return <EmptyState icon={History} title={emptyTitle} description={emptyDescription} />;
    }

    return (
        <ul role="list" className="space-y-2">
            {items.map(item => {
                const type = getViolationType(item.violationType);
                const Icon = type.Icon;
                const resolved = Boolean(item.resolvedAt);
                const expanded = expandedId === item.id;

                return (
                    <li key={item.id}>
                        <Card padding="none" className="overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : item.id)}
                                aria-expanded={expanded}
                                className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-hover"
                            >
                                <span
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${type.bgColor}`}
                                    aria-hidden
                                >
                                    <Icon size={18} strokeWidth={1.75} className={type.color} />
                                </span>

                                <span className="min-w-0 flex-1">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        {showStudent && (
                                            <span className="truncate text-sm font-medium text-fg">
                                                {item.studentName}
                                            </span>
                                        )}
                                        <span className={`shrink-0 text-xs ${type.color}`}>{type.shortLabel}</span>
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                                        {formatDateTimeMoscow(item.date)}
                                        {item.className ? ` · ${item.className}` : ""}
                                        {showTeacher && item.teacherName ? ` · ${item.teacherName}` : ""}
                                    </span>
                                    {item.comment && (
                                        <span
                                            className={`mt-1 block text-xs text-fg-muted ${expanded ? "" : "truncate"}`}
                                        >
                                            {item.comment}
                                        </span>
                                    )}
                                </span>

                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <Badge tone={resolved ? "success" : "warning"}>
                                        {resolved ? "Отработано" : "Не отработано"}
                                    </Badge>
                                    <ChevronDown
                                        size={16}
                                        className={`text-fg-subtle transition-transform ${expanded ? "rotate-180" : ""}`}
                                        aria-hidden
                                    />
                                </span>
                            </button>

                            {expanded && (
                                <div className="space-y-1.5 border-t border-border bg-surface-2 px-3 py-2.5 text-xs">
                                    <p className="text-fg-muted">
                                        <span className="text-fg-subtle">Комментарий: </span>
                                        {item.comment?.trim() ? item.comment : "—"}
                                    </p>

                                    {resolved ? (
                                        <>
                                            <p className="text-fg-muted">
                                                <span className="text-fg-subtle">Отработано: </span>
                                                {resolverLabel(item.resolvedByName, item.resolvedSource)}
                                                {item.resolvedAt
                                                    ? ` · ${formatDateTimeMoscow(item.resolvedAt)}`
                                                    : ""}
                                            </p>
                                            <p className="text-fg-muted">
                                                <span className="text-fg-subtle">Что сделано: </span>
                                                {item.resolutionComment || "—"}
                                            </p>
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-warning">Ждёт отработки.</p>
                                            {canResolve && onResolve && (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="ml-auto shrink-0"
                                                    onClick={() => onResolve(item)}
                                                >
                                                    Отработать
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </Card>
                    </li>
                );
            })}
        </ul>
    );
}

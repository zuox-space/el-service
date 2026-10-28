"use client";

// components/ui/ViolationsAdminList.tsx
import { CheckCheck, Trash2 } from "lucide-react";
import { Badge, Checkbox, EmptyState, IconButton, List, ListItem } from "@/components/ui/kit";
import { getViolationType, resolverLabel } from "@/lib/violations";
import { formatDateTimeMoscow } from "@/lib/date";

/**
 * Список нарушений для администратора.
 *
 * Отличается от учительского списка тем, что здесь есть отработка:
 * чекбокс для групповых действий, статус «отработано / не отработано»,
 * кто и когда разобрал замечание, и кнопка «Отработать» у каждой строки.
 */

export interface AdminViolation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string | null;
    teacherName: string;
    date: string;
    resolvedAt?: string | null;
    resolvedByName?: string | null;
    resolutionComment?: string | null;
    resolvedSource?: string | null;
}

interface ViolationsAdminListProps {
    violations: AdminViolation[];
    isLoading?: boolean;
    selected?: Set<string>;
    onToggleSelect?: (id: string) => void;
    /** Если не передан — кнопки отработки нет (только просмотр) */
    onResolve?: (violation: AdminViolation) => void;
    /** Если не передан — кнопки удаления нет (например, у классного руководителя) */
    onDelete?: (violation: AdminViolation) => void;
    /** Чекбоксы выбора для групповых действий */
    selectable?: boolean;
    emptyMessage?: string;
}

export function ViolationsAdminList({
    violations,
    isLoading = false,
    selected = new Set<string>(),
    onToggleSelect,
    onResolve,
    onDelete,
    selectable = Boolean(onToggleSelect),
    emptyMessage = "Нет нарушений",
}: ViolationsAdminListProps) {
    if (isLoading) {
        return (
            <List>
                {Array.from({ length: 3 }).map((_, index) => (
                    <li key={index}>
                        <ListItem loading title="" />
                    </li>
                ))}
            </List>
        );
    }

    if (violations.length === 0) {
        return <EmptyState title={emptyMessage} compact />;
    }

    return (
        <List>
            {violations.map(violation => {
                const type = getViolationType(violation.violationType);
                const Icon = type.Icon;
                const resolved = Boolean(violation.resolvedAt);
                const isSelected = selected.has(violation.id);

                return (
                    <li key={violation.id} className={isSelected ? "bg-surface-2" : undefined}>
                        <ListItem
                            leading={
                                <span className="flex items-center gap-2">
                                    {selectable && !resolved && (
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={() => onToggleSelect?.(violation.id)}
                                            label={`Выбрать: ${violation.studentName}`}
                                            compact
                                        />
                                    )}
                                    <span
                                        className={`flex h-9 w-9 items-center justify-center rounded-control ${type.bgColor}`}
                                        aria-hidden
                                    >
                                        <Icon size={18} strokeWidth={1.75} className={type.color} />
                                    </span>
                                </span>
                            }
                            title={
                                <span className="flex flex-wrap items-center gap-1.5">
                                    <span className="truncate">{violation.studentName}</span>
                                    <Badge tone={resolved ? "success" : "warning"}>
                                        {resolved ? "Отработано" : "Не отработано"}
                                    </Badge>
                                </span>
                            }
                            subtitle={
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <span className={`shrink-0 ${type.color}`}>{type.shortLabel}</span>
                                        {violation.comment && (
                                            <span className="min-w-0 truncate text-fg-muted">· {violation.comment}</span>
                                        )}
                                    </span>
                                    {resolved && violation.resolutionComment && (
                                        <span className="line-clamp-2 text-xs text-fg-muted">
                                            {resolverLabel(violation.resolvedByName, violation.resolvedSource)}: {violation.resolutionComment}
                                        </span>
                                    )}
                                </span>
                            }
                            meta={[
                                formatDateTimeMoscow(violation.date),
                                violation.className,
                                violation.teacherName,
                                resolved && violation.resolvedAt
                                    ? `отработано ${formatDateTimeMoscow(violation.resolvedAt)}`
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                            trailing="badge"
                            trailingContent={
                                <span className="flex items-center gap-1">
                                    {onResolve && !resolved && (
                                        <IconButton
                                            icon={CheckCheck}
                                            variant="ghost"
                                            label={`Отработать нарушение: ${violation.studentName}`}
                                            onClick={() => onResolve(violation)}
                                        />
                                    )}
                                    {onDelete && (
                                        <IconButton
                                            icon={Trash2}
                                            variant="danger"
                                            label={`Удалить нарушение: ${violation.studentName}`}
                                            onClick={() => onDelete(violation)}
                                        />
                                    )}
                                </span>
                            }
                        />
                    </li>
                );
            })}
        </List>
    );
}

"use client";

// components/ui/ViolationsList.tsx
import { Trash2 } from "lucide-react";
import { getViolationType } from "@/lib/violations";
import { formatDateTimeMoscow } from "@/lib/date";
import { Badge, EmptyState, List, ListItem } from "@/components/ui/kit";

/**
 * ViolationsList — список нарушений.
 *
 * Собран из ListItem: одинаковая плотность, нажатие и доступность с остальными
 * списками приложения. Иконка типа — Lucide в семантическом цвете (раньше были эмодзи),
 * дата показывается в московском времени, поэтому не «съезжает» у сотрудников
 * из других часовых поясов.
 */

interface Violation {
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
}

interface ViolationsListProps {
    violations: Violation[];
    isLoading?: boolean;
    onDelete?: (id: string) => void;
    showClassName?: boolean;
    showTeacher?: boolean;
    /** Показывать статус отработки (для «Моих нарушений» и экрана учителя) */
    showResolution?: boolean;
    emptyMessage?: string;
}

export default function ViolationsList({
    violations,
    isLoading = false,
    onDelete,
    showClassName = true,
    showTeacher = true,
    showResolution = false,
    emptyMessage = "Нет нарушений",
}: ViolationsListProps) {
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

                const metaParts = [formatDateTimeMoscow(violation.date)];
                if (showClassName && violation.className) metaParts.push(violation.className);
                if (showTeacher && violation.teacherName) metaParts.push(violation.teacherName);
                if (showResolution && violation.resolvedAt) {
                    metaParts.push(`отработано ${formatDateTimeMoscow(violation.resolvedAt)}`);
                }

                return (
                    <li key={violation.id}>
                        <ListItem
                            leading={
                                <span
                                    className={`flex h-9 w-9 items-center justify-center rounded-control ${type.bgColor}`}
                                    aria-hidden
                                >
                                    <Icon size={18} strokeWidth={1.75} className={type.color} />
                                </span>
                            }
                            title={
                                showResolution ? (
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <span className="truncate">{violation.studentName}</span>
                                        <Badge tone={violation.resolvedAt ? "success" : "warning"}>
                                            {violation.resolvedAt ? "Отработано" : "Не отработано"}
                                        </Badge>
                                    </span>
                                ) : (
                                    violation.studentName
                                )
                            }
                            subtitle={
                                // Без flex-wrap и с min-w-0: длинный комментарий не выталкивал
                                // кнопку удаления за пределы строки на телефоне
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className={`shrink-0 ${type.color}`}>{type.shortLabel}</span>
                                    {violation.comment && (
                                        <span className="min-w-0 truncate text-fg-muted">· {violation.comment}</span>
                                    )}
                                    {showResolution && violation.resolvedAt && violation.resolutionComment && (
                                        <span className="min-w-0 truncate text-success">
                                            · {violation.resolvedByName || "Администратор"}: {violation.resolutionComment}
                                        </span>
                                    )}
                                </span>
                            }
                            meta={metaParts.join(" · ")}
                            trailing={onDelete ? "action" : "none"}
                            actionIcon={Trash2}
                            actionTone="danger"
                            actionLabel={`Удалить нарушение: ${violation.studentName}, ${type.shortLabel}`}
                            onActionClick={() => onDelete?.(violation.id)}
                        />
                    </li>
                );
            })}
        </List>
    );
}

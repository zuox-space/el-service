"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";

/**
 * DataTable — таблица на десктопе, карточки-строки на мобильном.
 *
 * Одна декларация колонок обслуживает оба режима: на узком экране те же данные
 * показываются как список, и не нужно дублировать разметку. Плотность и
 * типографика одинаковые во всех разделах.
 */
export interface Column<T> {
    key: string;
    header: string;
    /** CSS-ширина колонки на десктопе, например "120px" или "20%" */
    width?: string;
    align?: "left" | "right" | "center";
    sortable?: boolean;
    /** Скрыть колонку на мобильном в карточке */
    hideOnMobile?: boolean;
    render?: (row: T) => ReactNode;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
    key: string;
    direction: SortDirection;
}

export interface DataTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    onRowClick?: (row: T) => void;
    rowAction?: (row: T) => ReactNode;
    sort?: SortState;
    onSortChange?: (sort: SortState) => void;
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    /** Заголовок и подпись карточки на мобильном; по умолчанию — первые две колонки */
    mobileTitle?: (row: T) => ReactNode;
    mobileSubtitle?: (row: T) => ReactNode;
    /** Дополнительные пары «подпись/значение» в мобильной карточке */
    mobileDetailKeys?: string[];
    caption?: string;
    className?: string;
}

const alignClasses = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
};

export function DataTable<T>({
    columns,
    rows,
    rowKey,
    onRowClick,
    rowAction,
    sort,
    onSortChange,
    loading = false,
    emptyTitle = "Нет данных",
    emptyDescription,
    mobileTitle,
    mobileSubtitle,
    mobileDetailKeys = [],
    caption,
    className,
}: DataTableProps<T>) {
    const interactive = Boolean(onRowClick);

    const toggleSort = (column: Column<T>) => {
        if (!column.sortable || !onSortChange) return;
        const isCurrent = sort?.key === column.key;
        onSortChange({
            key: column.key,
            direction: isCurrent && sort?.direction === "asc" ? "desc" : "asc",
        });
    };

    if (loading) {
        return (
            <div className={cn("overflow-hidden rounded-card border border-border bg-surface", className)} aria-busy>
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
                        <Skeleton height={12} width="30%" />
                        <Skeleton height={12} width="20%" />
                        <Skeleton height={12} width="25%" />
                    </div>
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className={cn("rounded-card border border-border bg-surface", className)}>
                <EmptyState title={emptyTitle} description={emptyDescription} compact />
            </div>
        );
    }

    return (
        <div className={cn("overflow-hidden rounded-card border border-border bg-surface", className)}>
            {/* ---------------------------- Десктоп ---------------------------- */}
            <table className="hidden w-full border-collapse md:table" aria-label={caption}>
                {caption && <caption className="sr-only">{caption}</caption>}
                <thead>
                    <tr className="border-b border-border bg-surface-2">
                        {columns.map(column => {
                            const isSorted = sort?.key === column.key;
                            const SortIcon = !isSorted ? ChevronsUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;

                            return (
                                <th
                                    key={column.key}
                                    scope="col"
                                    style={{ width: column.width }}
                                    aria-sort={isSorted ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
                                    className={cn(
                                        "h-10 px-4 text-xs font-medium uppercase tracking-wide text-fg-subtle",
                                        alignClasses[column.align ?? "left"],
                                    )}
                                >
                                    {column.sortable ? (
                                        <button
                                            type="button"
                                            onClick={() => toggleSort(column)}
                                            className={cn(
                                                "inline-flex items-center gap-1 rounded-control px-1 py-0.5",
                                                "hover:text-fg-muted",
                                                isSorted && "text-fg-muted",
                                            )}
                                        >
                                            {column.header}
                                            <SortIcon size={12} aria-hidden />
                                        </button>
                                    ) : (
                                        column.header
                                    )}
                                </th>
                            );
                        })}
                        {rowAction && <th scope="col" className="w-12 px-2"><span className="sr-only">Действия</span></th>}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => (
                        <tr
                            key={rowKey(row)}
                            className={cn(
                                "border-b border-border last:border-0",
                                interactive && "cursor-pointer hover:bg-surface-2 active:bg-surface-3",
                            )}
                            onClick={interactive ? () => onRowClick?.(row) : undefined}
                            tabIndex={interactive ? 0 : undefined}
                            role={interactive ? "button" : undefined}
                            onKeyDown={
                                interactive
                                    ? event => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            onRowClick?.(row);
                                        }
                                    }
                                    : undefined
                            }
                        >
                            {columns.map(column => (
                                <td
                                    key={column.key}
                                    className={cn(
                                        "px-4 py-3 text-sm text-fg",
                                        alignClasses[column.align ?? "left"],
                                        column.align === "right" && "tabular-nums",
                                    )}
                                >
                                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "—")}
                                </td>
                            ))}
                            {rowAction && (
                                <td className="px-2 py-1 text-right" onClick={event => event.stopPropagation()}>
                                    {rowAction(row)}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* --------------------------- Мобильный --------------------------- */}
            <ul role="list" className="divide-y divide-border md:hidden">
                {rows.map(row => {
                    const title = mobileTitle
                        ? mobileTitle(row)
                        : columns[0]?.render
                            ? columns[0].render(row)
                            : String((row as Record<string, unknown>)[columns[0]?.key ?? ""] ?? "—");
                    const subtitle = mobileSubtitle ? mobileSubtitle(row) : undefined;
                    const details = mobileDetailKeys
                        .map(key => ({ column: columns.find(c => c.key === key), key }))
                        .filter((entry): entry is { column: Column<T>; key: string } => Boolean(entry.column) && !entry.column?.hideOnMobile);

                    const body = (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium text-fg">{title}</div>
                                    {subtitle && <div className="truncate text-xs text-fg-muted">{subtitle}</div>}
                                </div>
                                {rowAction && <div onClick={event => event.stopPropagation()}>{rowAction(row)}</div>}
                                {interactive && !rowAction && (
                                    <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-fg-subtle" aria-hidden />
                                )}
                            </div>

                            {details.length > 0 && (
                                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                                    {details.map(({ column, key }) => (
                                        <div key={key} className="min-w-0">
                                            <dt className="text-xs text-fg-subtle">{column.header}</dt>
                                            <dd className="truncate text-sm text-fg">
                                                {column.render ? column.render(row) : String((row as Record<string, unknown>)[key] ?? "—")}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                        </>
                    );

                    return (
                        <li key={rowKey(row)}>
                            {interactive ? (
                                <button
                                    type="button"
                                    onClick={() => onRowClick?.(row)}
                                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
                                >
                                    {body}
                                </button>
                            ) : (
                                <div className="px-4 py-3">{body}</div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

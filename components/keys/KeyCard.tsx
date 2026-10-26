"use client";

// components/keys/KeyCard.tsx
import { useState } from "react";
import { History as HistoryIcon, KeyRound, Lock, Send, Star, Undo2, X } from "lucide-react";
import { Badge, Checkbox, Modal } from "@/components/ui/kit";
import type { KeyItemDto, KeyRequestDto } from "@/lib/keys/queries";
import { ColleaguePicker } from "./ColleaguePicker";

const TYPE_LABEL: Record<string, string> = { ISSUE: "Выдача", RETURN: "Сдача", TRANSFER: "Передача" };

function formatDateTime(value: string | null | undefined): string {
    if (!value) return "";
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function KeyCard({
    keyItem,
    currentUserId,
    variant = "view",
    showBuilding = false,
    selectMode = false,
    selected = false,
    onToggleSelect,
    busy = false,
    onRequest,
    onReturn,
    onTransfer,
    onCancelPending,
    onToggleFavorite,
    onShowHistory,
}: {
    keyItem: KeyItemDto;
    currentUserId?: string;
    variant?: "view" | "cabinet";
    showBuilding?: boolean;
    selectMode?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
    busy?: boolean;
    onRequest?: (key: KeyItemDto) => void;
    onReturn?: (key: KeyItemDto) => void;
    onTransfer?: (key: KeyItemDto, targetUserId: string) => void;
    onCancelPending?: (request: KeyRequestDto) => void;
    onToggleFavorite?: (key: KeyItemDto) => void;
    onShowHistory?: (key: KeyItemDto) => void;
}) {
    const [transferOpen, setTransferOpen] = useState(false);

    const isMine = Boolean(currentUserId && keyItem.holderId === currentUserId);
    const pendingByMe = Boolean(keyItem.pending && keyItem.pending.requestedById === currentUserId);
    const selectable = !keyItem.pending && (keyItem.status === "FREE" || isMine);

    const statusTone = keyItem.pending ? "warning" : keyItem.status === "FREE" ? "success" : "info";
    const statusLabel = keyItem.pending ? "заявка" : keyItem.status === "FREE" ? "свободен" : "выдан";

    const pendingNote = keyItem.pending ? (
        <div className="mt-2 rounded-control border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-xs leading-4 text-fg">
            <span className="font-medium">{TYPE_LABEL[keyItem.pending.type]}:</span>{" "}
            {keyItem.pending.requestedByName}
            {keyItem.pending.targetUserName ? ` → ${keyItem.pending.targetUserName}` : ""}
            <span className="text-fg-subtle"> · {formatDateTime(keyItem.pending.createdAt)}</span>
        </div>
    ) : null;

    const cabinetActions = () => {
        if (variant !== "cabinet" || !currentUserId) return null;

        if (keyItem.status === "FREE" && !keyItem.pending) {
            return (
                <CardAction
                    icon={KeyRound}
                    label="Запросить ключ"
                    disabled={busy}
                    onClick={() => onRequest?.(keyItem)}
                    className="border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/20"
                />
            );
        }

        if (keyItem.pending && pendingByMe) {
            return (
                <div className="flex items-center gap-2">
                    <p className="max-w-[11rem] text-[11px] leading-4 text-warning">
                        {keyItem.pending.type === "ISSUE"
                            ? "Ждём подтверждения охраны…"
                            : keyItem.pending.type === "RETURN"
                                ? "Охрана принимает…"
                                : "Получатель подтверждает…"}
                    </p>
                    <CardAction
                        icon={X}
                        label="Отменить заявку"
                        disabled={busy}
                        onClick={() => keyItem.pending && onCancelPending?.(keyItem.pending)}
                        className="border-danger/40 bg-danger-soft text-danger hover:bg-danger/20"
                    />
                </div>
            );
        }

        if (keyItem.status === "FREE" && keyItem.pending) {
            return (
                <p className="text-[11px] leading-4 text-warning">
                    {keyItem.pending.targetUserName
                        ? `Передача → ${keyItem.pending.targetUserName}`
                        : `Запрошен: ${keyItem.pending.requestedByName}`}
                </p>
            );
        }

        if (isMine && !keyItem.pending) {
            return (
                <div className="flex items-center gap-1.5">
                    <CardAction
                        icon={Undo2}
                        label="Сдать ключ"
                        disabled={busy}
                        onClick={() => onReturn?.(keyItem)}
                        className="border-success/40 bg-success-soft text-success hover:bg-success/20"
                    />
                    <CardAction
                        icon={Send}
                        label="Передать ключ"
                        disabled={busy}
                        onClick={() => setTransferOpen(true)}
                        className="border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                    />
                </div>
            );
        }

        if (isMine && keyItem.pending) {
            return <p className="text-xs leading-4 text-warning">Передача — ждём получателя…</p>;
        }

        return null;
    };

    return (
        <article
            className={`relative flex flex-col overflow-hidden rounded-card border bg-surface p-3 pl-4 transition-colors ${
                selected ? "border-accent ring-1 ring-accent/30" : "border-border hover:border-accent/40"
            }`}
        >
            <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-[3px] ${
                    keyItem.status === "FREE" ? "bg-success" : keyItem.pending ? "bg-warning" : "bg-info"
                }`}
            />

            <div className="flex items-start gap-2">
                {selectMode && (
                    <span className="pt-0.5">
                        <Checkbox
                            checked={selected}
                            disabled={!selectable}
                            onChange={() => onToggleSelect?.()}
                            label={`Отметить ключ ${keyItem.roomNumber}`}
                            compact
                        />
                    </span>
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-base font-semibold text-fg">{keyItem.roomNumber}</p>
                        <Badge tone={statusTone}>{statusLabel}</Badge>
                        {keyItem.accessScope === "RESTRICTED" && (
                            <span title="Ограниченный доступ" className="text-fg-subtle">
                                <Lock size={13} aria-hidden />
                            </span>
                        )}
                        {onToggleFavorite && (
                            <button
                                type="button"
                                onClick={() => onToggleFavorite(keyItem)}
                                aria-pressed={keyItem.favorite}
                                aria-label={keyItem.favorite ? "Убрать из избранного" : "Добавить в избранное"}
                                title={keyItem.favorite ? "Убрать из избранного" : "Добавить в избранное"}
                                className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-control transition-colors hover:bg-surface-hover"
                            >
                                <Star
                                    size={15}
                                    className={keyItem.favorite ? "fill-warning text-warning" : "text-fg-subtle"}
                                    aria-hidden
                                />
                            </button>
                        )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-fg-muted">
                        {keyItem.roomName || "Кабинет"} · {keyItem.floor} этаж
                        {showBuilding ? ` · ${keyItem.buildingName}` : ""}
                    </p>
                </div>
            </div>

            {keyItem.status === "ISSUED" && keyItem.holderName && (
                <p className="mt-2 truncate text-xs leading-4 text-fg-muted">
                    На руках: <span className="font-medium text-fg">{keyItem.holderName}</span>
                    {keyItem.issuedAt ? <span className="text-fg-subtle"> · с {formatDateTime(keyItem.issuedAt)}</span> : null}
                </p>
            )}

            {pendingNote}

            {!selectMode && (
                <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        {onShowHistory && (
                            <button
                                type="button"
                                onClick={() => onShowHistory(keyItem)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-accent-text underline-offset-2 hover:underline"
                            >
                                <HistoryIcon size={14} aria-hidden />
                                История
                            </button>
                        )}
                    </div>
                    <div className="-mr-3 flex shrink-0 items-center gap-1.5 sm:mr-0">
                        {cabinetActions()}
                    </div>
                </div>
            )}

            {selectMode && !selectable && keyItem.status === "ISSUED" && !isMine && (
                <p className="mt-2 text-[11px] text-fg-subtle">Выдан другому сотруднику</p>
            )}

            <Modal
                open={transferOpen}
                onClose={() => setTransferOpen(false)}
                title={`Передать ключ ${keyItem.roomNumber}`}
                description="Получатель подтвердит получение — ключ останется за ним."
                size="sm"
            >
                <ColleaguePicker
                    disabled={busy}
                    onSelect={user => {
                        setTransferOpen(false);
                        onTransfer?.(keyItem, user.id);
                    }}
                />
            </Modal>
        </article>
    );
}

function CardAction({
    icon: Icon,
    label,
    onClick,
    className,
    disabled,
}: {
    icon: typeof KeyRound;
    label: string;
    onClick: () => void;
    className: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            <Icon size={16} aria-hidden />
        </button>
    );
}

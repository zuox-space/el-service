"use client";

// components/keys/RequestCard.tsx
import { Clock } from "lucide-react";
import { Badge, Button } from "@/components/ui/kit";
import type { KeyRequestDto } from "@/lib/keys/queries";

const TYPE_LABEL: Record<string, string> = { ISSUE: "Выдача", RETURN: "Сдача", TRANSFER: "Передача" };
const TYPE_TONE: Record<string, "info" | "success" | "warning"> = {
    ISSUE: "info",
    RETURN: "success",
    TRANSFER: "warning",
};

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Карточка заявки — как RequestCard в keys-app, для охраны и получателя. */
export function RequestCard({
    item,
    mode,
    busy = false,
    onDecide,
}: {
    item: KeyRequestDto;
    mode: "security" | "recipient";
    busy?: boolean;
    onDecide: (requestId: string, action: "confirm" | "cancel") => void;
}) {
    const confirmLabel =
        mode === "recipient"
            ? "Принять ключи"
            : item.type === "ISSUE"
                ? "Подтвердить выдачу"
                : "Подтвердить приём";
    const cancelLabel = mode === "recipient" ? "Отклонить" : "Отменить";
    const keysLabel = item.keys.length > 1 ? `${item.keys.length} ключа` : `${item.keys[0]?.roomNumber ?? ""}`;

    return (
        <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3.5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-fg">
                        {keysLabel}
                        <span className="ml-1.5 text-xs font-normal text-fg-muted">
                            {item.keys.map(key => key.roomName).filter(Boolean).join(", ")}
                        </span>
                    </p>
                    <p className="mt-1 text-xs leading-4 text-fg-muted">
                        {mode === "recipient" ? (
                            <>
                                От: <span className="font-medium text-fg">{item.requestedByName}</span>
                            </>
                        ) : (
                            <>
                                <span className="font-medium text-fg">{item.requestedByName}</span>
                                {item.type === "TRANSFER" && item.targetUserName
                                    ? ` → ${item.targetUserName}`
                                    : ""}
                            </>
                        )}
                    </p>
                </div>
                <Badge tone={TYPE_TONE[item.type]}>{TYPE_LABEL[item.type]}</Badge>
            </div>

            <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                <Clock size={12} aria-hidden />
                {formatDateTime(item.createdAt)}
            </p>

            <div className="mt-auto flex flex-wrap gap-2">
                <Button
                    size="sm"
                    disabled={busy}
                    loading={busy}
                    onClick={() => onDecide(item.id, "confirm")}
                >
                    {confirmLabel}
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => onDecide(item.id, "cancel")}
                >
                    {cancelLabel}
                </Button>
            </div>
        </article>
    );
}

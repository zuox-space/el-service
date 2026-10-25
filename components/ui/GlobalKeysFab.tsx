"use client";

// components/ui/GlobalKeysFab.tsx
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
    ArrowDownToLine,
    ChevronRight,
    Inbox,
    KeyRound,
    Send,
    X,
} from "lucide-react";
import { useAccess } from "@/components/access/AccessProvider";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";
import {
    EmployeeActionsModal,
    type EmployeeActionMode,
} from "@/components/keys/EmployeeActionsModal";

/**
 * Кнопка ключей на главной: раскрывается вниз списком действий со стрелками.
 * Взять — поиск по зданию/кабинету; Сдать/Передать — мои ключи; Принять —
 * входящие передачи (показывается только если есть что принимать).
 */
export function GlobalKeysFab() {
    const pathname = usePathname() ?? "/";
    const { can, loading } = useAccess();

    const hidden =
        pathname.startsWith("/login") ||
        pathname.startsWith("/offline") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/guard");

    if (loading || hidden || !can("keys")) return null;

    return (
        <KeysProvider>
            <KeysFabInner />
        </KeysProvider>
    );
}

function KeysFabInner() {
    const { state } = useKeys();
    const [expanded, setExpanded] = useState(false);
    const [mode, setMode] = useState<EmployeeActionMode | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const incoming = (state?.requests ?? []).filter(
        item => item.type === "TRANSFER" && item.status === "PENDING" && item.targetUserId === state?.me.id,
    );

    useEffect(() => {
        if (!expanded) return;
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setExpanded(false);
            }
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [expanded]);

    if (!state?.canRequest) return null;

    const openMode = (next: EmployeeActionMode) => {
        setExpanded(false);
        setMode(next);
    };

    return (
        <>
            <div
                ref={rootRef}
                className="fixed bottom-[4.5rem] left-4 z-40 flex flex-col items-start gap-2 sm:bottom-6 sm:left-6"
            >
                {expanded && (
                    <div className="flex flex-col gap-1.5 rounded-card border border-border bg-surface p-1.5 shadow-raised">
                        <ActionButton icon={KeyRound} label="Взять" onClick={() => openMode("take")} />
                        <ActionButton icon={ArrowDownToLine} label="Сдать" onClick={() => openMode("my")} />
                        <ActionButton icon={Send} label="Передать" onClick={() => openMode("transfer")} />
                        {incoming.length > 0 && (
                            <ActionButton
                                icon={Inbox}
                                label={`Принять${incoming.length > 1 ? ` · ${incoming.length}` : ""}`}
                                onClick={() => openMode("incoming")}
                            />
                        )}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setExpanded(open => !open)}
                    aria-label={expanded ? "Свернуть меню ключей" : "Ключи: взять, сдать, передать, принять"}
                    aria-expanded={expanded}
                    title={expanded ? "Свернуть" : "Ключи"}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent-soft text-accent-text shadow-raised transition-all hover:scale-105 hover:bg-accent/20 active:scale-95"
                >
                    {expanded ? <X size={24} aria-hidden /> : <KeyRound size={24} aria-hidden />}
                </button>
            </div>

            <EmployeeActionsModal
                open={mode !== null}
                mode={mode ?? "take"}
                onClose={() => setMode(null)}
            />
        </>
    );
}

function ActionButton({
    icon: Icon,
    label,
    onClick,
}: {
    icon: typeof KeyRound;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-44 items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-hover"
        >
            <Icon size={16} className="shrink-0 text-accent-text" aria-hidden />
            <span className="flex-1">{label}</span>
            <ChevronRight size={14} className="shrink-0 text-fg-subtle" aria-hidden />
        </button>
    );
}

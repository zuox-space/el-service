"use client";

// components/ui/GlobalKeysFab.tsx
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Inbox, KeyRound, Undo2, X } from "lucide-react";
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
                    <div className="flex flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-raised">
                        <IconAction
                            icon={KeyRound}
                            label="Взять ключ"
                            onClick={() => openMode("take")}
                            className="border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/20"
                        />
                        <IconAction
                            icon={Undo2}
                            label="Сдать ключ"
                            onClick={() => openMode("my")}
                            className="border-success/40 bg-success-soft text-success hover:bg-success/20"
                        />
                        {incoming.length > 0 && (
                            <IconAction
                                icon={Inbox}
                                label="Принять переданный ключ"
                                badge={incoming.length}
                                onClick={() => openMode("incoming")}
                                className="border-warning/40 bg-warning-soft text-warning hover:bg-warning/20"
                            />
                        )}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setExpanded(open => !open)}
                    aria-label={expanded ? "Свернуть меню ключей" : "Ключи: взять, сдать, принять"}
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

function IconAction({
    icon: Icon,
    label,
    onClick,
    className,
    badge,
}: {
    icon: typeof KeyRound;
    label: string;
    onClick: () => void;
    className: string;
    badge?: number;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            title={label}
            className={`relative flex h-12 w-12 items-center justify-center rounded-full border transition-colors active:scale-95 ${className}`}
        >
            <Icon size={21} aria-hidden />
            {badge && badge > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                    {badge}
                </span>
            ) : null}
        </button>
    );
}

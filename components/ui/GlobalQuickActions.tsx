"use client";

// components/ui/GlobalQuickActions.tsx
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CircleAlert, History, Inbox, KeyRound, Undo2 } from "lucide-react";
import { useAccess } from "@/components/access/AccessProvider";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";
import {
    EmployeeActionsModal,
    type EmployeeActionMode,
} from "@/components/keys/EmployeeActionsModal";
import ViolationModal from "@/components/ui/ViolationModal";
import { useToast } from "@/components/ui/kit";

type Menu = "keys" | "violations";

/**
 * Две кнопки в нижнем овальном блоке: «Ключи» и «Нарушения».
 * По нажатию над блоком раскрываются соответствующие действия.
 * Под блоком есть распорка, чтобы он не перекрывал конец страницы.
 */
export function GlobalQuickActions() {
    const { status } = useSession();
    const pathname = usePathname() ?? "/";
    const { can, loading } = useAccess();

    const hidden =
        pathname.startsWith("/login") ||
        pathname.startsWith("/offline") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/guard");

    const canKeys = !loading && can("keys");
    const canViolations =
        status === "authenticated" &&
        !loading &&
        (can("myClass") || can("violations"));

    if (loading || hidden || (!canKeys && !canViolations)) return null;

    return (
        <KeysProvider enabled={canKeys}>
            <QuickActionsInner canKeys={canKeys} canViolations={canViolations} />
        </KeysProvider>
    );
}

function QuickActionsInner({
    canKeys,
    canViolations,
}: {
    canKeys: boolean;
    canViolations: boolean;
}) {
    const { state } = useKeys();
    const router = useRouter();
    const toast = useToast();
    const [menu, setMenu] = useState<Menu | null>(null);
    const [mode, setMode] = useState<EmployeeActionMode | null>(null);
    const [violationOpen, setViolationOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const showKeys = canKeys && Boolean(state?.canRequest);
    const incoming = (state?.requests ?? []).filter(
        item => item.type === "TRANSFER" && item.status === "PENDING" && item.targetUserId === state?.me.id,
    );

    useEffect(() => {
        if (!menu) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setMenu(null);
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [menu]);

    const openMode = (next: EmployeeActionMode) => {
        setMenu(null);
        setMode(next);
    };

    const handleSubmitViolation = async (data: {
        studentId: string;
        studentName: string;
        className: string;
        violationType: string;
        comment: string;
    }) => {
        const response = await fetch("/api/violations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error("Не удалось сохранить нарушение. Попробуйте ещё раз.");
        }

        toast.show({
            title: "Нарушение зафиксировано",
            description: data.studentName,
            tone: "success",
        });
    };

    if (!showKeys && !canViolations) return null;

    return (
        <>
            {/* Распорка: фиксированный блок не перекрывает конец страницы. */}
            <div className="h-20 sm:h-16" aria-hidden />

            <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6">
                <div ref={rootRef} className="relative">
                    {menu === "keys" && (
                        <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-raised">
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

                    {menu === "violations" && (
                        <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-raised">
                            <IconAction
                                icon={CircleAlert}
                                label="Зафиксировать нарушение"
                                onClick={() => {
                                    setMenu(null);
                                    setViolationOpen(true);
                                }}
                                className="border-danger/40 bg-danger-soft text-danger hover:bg-danger/20"
                            />
                            <IconAction
                                icon={History}
                                label="История моих фиксаций"
                                onClick={() => {
                                    setMenu(null);
                                    router.push("/my-violations");
                                }}
                                className="border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface p-1.5 shadow-raised">
                        {showKeys && (
                            <MainAction
                                icon={KeyRound}
                                label="Ключи: взять, сдать, принять"
                                active={menu === "keys"}
                                hasBadge={incoming.length > 0}
                                onClick={() => setMenu(current => (current === "keys" ? null : "keys"))}
                                className="border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/20"
                            />
                        )}
                        {canViolations && (
                            <MainAction
                                icon={CircleAlert}
                                label="Нарушения: зафиксировать или история"
                                active={menu === "violations"}
                                onClick={() =>
                                    setMenu(current => (current === "violations" ? null : "violations"))
                                }
                                className="border-danger/40 bg-danger-soft text-danger hover:bg-danger/20"
                            />
                        )}
                    </div>
                </div>
            </div>

            <EmployeeActionsModal
                open={mode !== null}
                mode={mode ?? "take"}
                onClose={() => setMode(null)}
            />

            <ViolationModal
                isOpen={violationOpen}
                onClose={() => setViolationOpen(false)}
                onSubmit={handleSubmitViolation}
            />
        </>
    );
}

function MainAction({
    icon: Icon,
    label,
    onClick,
    className,
    active,
    hasBadge,
}: {
    icon: typeof KeyRound;
    label: string;
    onClick: () => void;
    className: string;
    active: boolean;
    hasBadge?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-expanded={active}
            title={label}
            className={`relative flex h-12 w-12 items-center justify-center rounded-full border transition-all active:scale-95 ${
                active ? "ring-2 ring-accent/35" : ""
            } ${className}`}
        >
            <Icon size={22} aria-hidden />
            {hasBadge ? (
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-danger" />
            ) : null}
        </button>
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
            className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors active:scale-95 ${className}`}
        >
            <Icon size={20} aria-hidden />
            {badge && badge > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                    {badge}
                </span>
            ) : null}
        </button>
    );
}

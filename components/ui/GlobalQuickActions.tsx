"use client";

// components/ui/GlobalQuickActions.tsx
import { useState } from "react";
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

/**
 * Один нижний блок быстрых действий вместо двух отдельных FAB.
 *
 * Показывает только то, что доступно сотруднику: ключи (взять/сдать/принять)
 * и фиксации нарушений. Блок закреплён снизу, но под контентом остаётся
 * распорка, поэтому последние карточки не перекрываются.
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
    const [mode, setMode] = useState<EmployeeActionMode | null>(null);
    const [violationOpen, setViolationOpen] = useState(false);

    const showKeys = canKeys && Boolean(state?.canRequest);
    const incoming = (state?.requests ?? []).filter(
        item => item.type === "TRANSFER" && item.status === "PENDING" && item.targetUserId === state?.me.id,
    );

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
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface p-1.5 shadow-raised">
                    {showKeys && (
                        <>
                            <IconAction
                                icon={KeyRound}
                                label="Взять ключ"
                                onClick={() => setMode("take")}
                                className="border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/20"
                            />
                            <IconAction
                                icon={Undo2}
                                label="Сдать ключ"
                                onClick={() => setMode("my")}
                                className="border-success/40 bg-success-soft text-success hover:bg-success/20"
                            />
                            {incoming.length > 0 && (
                                <IconAction
                                    icon={Inbox}
                                    label="Принять переданный ключ"
                                    badge={incoming.length}
                                    onClick={() => setMode("incoming")}
                                    className="border-warning/40 bg-warning-soft text-warning hover:bg-warning/20"
                                />
                            )}
                        </>
                    )}

                    {canViolations && (
                        <>
                            <IconAction
                                icon={CircleAlert}
                                label="Зафиксировать нарушение"
                                onClick={() => setViolationOpen(true)}
                                className="border-danger/40 bg-danger-soft text-danger hover:bg-danger/20"
                            />
                            <IconAction
                                icon={History}
                                label="История моих фиксаций"
                                onClick={() => router.push("/my-violations")}
                                className="border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg"
                            />
                        </>
                    )}
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

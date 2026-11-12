"use client";

// components/ui/GlobalQuickActions.tsx
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    CircleAlert,
    History,
    Inbox,
    Key,
    KeyRound,
    Printer,
    RotateCcw,
    Sparkles,
    Ticket,
    UserCheck,
} from "lucide-react";
import { useAccess } from "@/components/access/AccessProvider";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";
import {
    EmployeeActionsModal,
    type EmployeeActionMode,
} from "@/components/keys/EmployeeActionsModal";
import ViolationModal from "@/components/ui/ViolationModal";
import PassModal from "@/components/ui/PassModal";
import AttendanceModal from "@/components/ui/AttendanceModal";
import { PrinterModal } from "@/components/ui/PrinterModal";
import { useToast } from "@/components/ui/kit";
import { toLocalISODate } from "@/lib/date";

type Menu = "open";
type QuickAction = "pass" | "attendance";

interface QuickClass {
    id: string;
    name: string;
    students: Array<{ id: string | number; name: string }>;
}

/**
 * Нижний овальный блок быстрых действий: ключи, нарушения и быстрые
 * пропуск/посещаемость. Функции раскрываются вверх над блоком.
 */
export function GlobalQuickActions() {
    const { status } = useSession();
    const pathname = usePathname() ?? "/";
    const { can, loading } = useAccess();

    const hidden =
        pathname !== "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/offline") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/guard");

    const canKeys = !loading && can("keys");
    // Фиксация нарушения доступна любому сотруднику независимо от разделов.
    const canViolations = status === "authenticated";
    const canMyClass = !loading && can("myClass");

    if (loading || hidden || (!canKeys && !canViolations && !canMyClass)) return null;

    return (
        <KeysProvider enabled={canKeys}>
            <QuickActionsInner
                canKeys={canKeys}
                canViolations={canViolations}
                canMyClass={canMyClass}
            />
        </KeysProvider>
    );
}

function QuickActionsInner({
    canKeys,
    canViolations,
    canMyClass,
}: {
    canKeys: boolean;
    canViolations: boolean;
    canMyClass: boolean;
}) {
    const { state } = useKeys();
    const router = useRouter();
    const toast = useToast();
    const [menu, setMenu] = useState<Menu | null>(null);
    const [mode, setMode] = useState<EmployeeActionMode | null>(null);
    const [violationOpen, setViolationOpen] = useState(false);
    const [printerOpen, setPrinterOpen] = useState(false);
    const [classes, setClasses] = useState<QuickClass[]>([]);
    const [quickClassId, setQuickClassId] = useState("");
    const [attendanceMarked, setAttendanceMarked] = useState<boolean | null>(null);
    const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
    const [quickData, setQuickData] = useState<{
        students: Array<{ id: string | number; name: string }>;
        existingPasses: Array<{ students?: Array<{ id: string | number; name: string }> }>;
        existingAttendance: {
            presentStudents?: Array<string | number>;
            absentStudents?: Array<string | number>;
            absentReasons?: Record<string, string>;
        } | null;
    } | null>(null);

    const showKeys = canKeys && Boolean(state?.canRequest);
    const myKeys = (state?.keys ?? []).filter(key => key.holderId === state?.me.id);
    const showReturn = showKeys && myKeys.length > 0;
    const incoming = (state?.requests ?? []).filter(
        item => item.type === "TRANSFER" && item.status === "PENDING" && item.targetUserId === state?.me.id,
    );
    const quickClass =
        classes.find(item => item.id === quickClassId) ??
        classes[0] ??
        null;
    // Быстрые пропуск/посещаемость — только если реально есть доступный класс.
    const showClassActions = canMyClass && Boolean(quickClass);

    useEffect(() => {
        if (!canMyClass) return;
        let cancelled = false;

        fetch("/api/classes", { cache: "no-store" })
            .then(response => response.json())
            .then(data => {
                if (cancelled || !Array.isArray(data)) return;
                const next = data as QuickClass[];
                setClasses(next);
                const stored = window.localStorage.getItem("my-class-id");
                setQuickClassId(
                    next.some(item => item.id === stored)
                        ? (stored as string)
                        : next[0]?.id ?? "",
                );
            })
            .catch(() => {
                if (!cancelled) setClasses([]);
            });

        return () => {
            cancelled = true;
        };
    }, [canMyClass]);

    useEffect(() => {
        if (!quickClass) {
            setAttendanceMarked(null);
            return;
        }

        let cancelled = false;
        const date = toLocalISODate();
        fetch(`/api/attendance?classId=${encodeURIComponent(quickClass.id)}&date=${date}`, {
            cache: "no-store",
        })
            .then(response => response.json())
            .then(data => {
                if (!cancelled) setAttendanceMarked(Boolean(data));
            })
            .catch(() => {
                if (!cancelled) setAttendanceMarked(null);
            });

        return () => {
            cancelled = true;
        };
    }, [quickClass]);


    const openMode = (next: EmployeeActionMode) => {
        setMenu(null);
        setMode(next);
    };

    const openQuickAction = async (next: QuickAction) => {
        setMenu(null);
        if (!quickClass) {
            router.push("/my-class");
            return;
        }

        const date = toLocalISODate();
        const students = quickClass.students ?? [];

        try {
            const [attendanceResponse, passesResponse] = await Promise.all([
                fetch(`/api/attendance?classId=${encodeURIComponent(quickClass.id)}&date=${date}`, {
                    cache: "no-store",
                }),
                fetch(`/api/passes?classId=${encodeURIComponent(quickClass.id)}&date=${date}`, {
                    cache: "no-store",
                }),
            ]);
            const [attendance, passes] = await Promise.all([
                attendanceResponse.json().catch(() => null),
                passesResponse.json().catch(() => []),
            ]);

            setQuickData({
                students,
                existingPasses: Array.isArray(passes) ? passes : [],
                existingAttendance: attendance ?? null,
            });
            setQuickAction(next);
        } catch {
            toast.show({
                title: "Не удалось открыть быстрые действия",
                description: "Проверьте соединение и повторите",
                tone: "danger",
            });
        }
    };

    const submitQuickPass = async (data: {
        date: string;
        students: Array<{ id: string | number; name: string }>;
        exitTime: string;
        reason: string;
    }) => {
        if (!quickClass) throw new Error("Класс не выбран");

        const response = await fetch("/api/passes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, classId: quickClass.id }),
        });
        if (!response.ok) throw new Error("Не удалось оформить пропуск");
        toast.show({ title: "Пропуск оформлен", tone: "success" });
    };

    const submitQuickAttendance = async (data: {
        date: string;
        presentStudents: string[];
        absentStudents: string[];
        absentReasons: Record<string, string>;
    }) => {
        if (!quickClass) throw new Error("Класс не выбран");

        const response = await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, classId: quickClass.id }),
        });
        if (!response.ok) throw new Error("Не удалось сохранить отметку");
        setAttendanceMarked(true);
        toast.show({ title: "Присутствие отмечено", tone: "success" });
    };

    const closeQuick = () => {
        setQuickAction(null);
        setQuickData(null);
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

    if (!showKeys && !canViolations && !showClassActions) return null;

    const actions: Array<{
        id: string;
        label: string;
        icon: typeof KeyRound;
        onClick: () => void;
        className: string;
        badge?: number;
        alert?: boolean;
    }> = [];

    if (showClassActions) {
        actions.push({
            id: "pass",
            label: "Выписать пропуск",
            icon: Ticket,
            onClick: () => void openQuickAction("pass"),
            className: "border-warning/40 bg-warning-soft text-warning hover:bg-warning/20",
        });
        actions.push({
            id: "attendance",
            label: "Отметить присутствие",
            icon: UserCheck,
            onClick: () => void openQuickAction("attendance"),
            className: "border-success/40 bg-success-soft text-success hover:bg-success/20",
            alert: attendanceMarked === false,
        });
    }

    if (canViolations) {
        actions.push({
            id: "violation",
            label: "Зафиксировать нарушение",
            icon: CircleAlert,
            onClick: () => {
                setMenu(null);
                setViolationOpen(true);
            },
            className: "border-danger/40 bg-danger-soft text-danger hover:bg-danger/20",
        });
        actions.push({
            id: "violation-history",
            label: "История фиксаций",
            icon: History,
            onClick: () => {
                setMenu(null);
                router.push("/my-violations");
            },
            className: "border-border bg-surface-2 text-fg-muted hover:bg-surface-3 hover:text-fg",
        });
    }

    if (showKeys) {
        actions.push({
            id: "key-take",
            label: "Взять ключ",
            icon: Key,
            onClick: () => openMode("take"),
            className: "border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/20",
        });
        if (showReturn) {
            actions.push({
                id: "key-return",
                label: "Сдать ключ",
                icon: RotateCcw,
                onClick: () => openMode("my"),
                className: "border-success/40 bg-success-soft text-success hover:bg-success/20",
            });
        }
        if (incoming.length > 0) {
            actions.push({
                id: "key-incoming",
                label: "Принять ключ",
                icon: Inbox,
                onClick: () => openMode("incoming"),
                className: "border-warning/40 bg-warning-soft text-warning hover:bg-warning/20",
                badge: incoming.length,
            });
        }
    }

    if (canViolations) {
        actions.push({
            id: "printer",
            label: "Отправить на компьютер",
            icon: Printer,
            onClick: () => {
                setMenu(null);
                setPrinterOpen(true);
            },
            className: "border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/20",
        });
    }

    return (
        <>
            <div className="h-20 sm:h-16" aria-hidden />

            {menu !== null && (
                <div
                    className="fixed inset-0 z-30 bg-backdrop animate-[fadeIn_150ms_ease-out]"
                    onClick={() => setMenu(null)}
                    aria-hidden
                />
            )}

            {menu !== null && (
                <div className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-3 z-40 flex max-h-[calc(100dvh-9rem)] flex-col-reverse items-end gap-2 overflow-y-auto pb-1 sm:bottom-20">
                    {actions.map(action => (
                        <QuickActionButton key={action.id} {...action} />
                    ))}
                </div>
            )}

            <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6">
                <MainAction
                    icon={Sparkles}
                    label={menu ? "Закрыть быстрые команды" : "Быстрые команды"}
                    active={menu !== null}
                    hasBadge={attendanceMarked === false || incoming.length > 0}
                    onClick={() => setMenu(current => (current ? null : "open"))}
                    className="border-accent/50 bg-accent-soft text-accent-text hover:bg-accent/20"
                />
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

            <PrinterModal open={printerOpen} onClose={() => setPrinterOpen(false)} />

            <PassModal
                isOpen={quickAction === "pass" && quickData !== null}
                onClose={closeQuick}
                selectedDate={new Date()}
                onSubmit={submitQuickPass}
                existingPasses={quickData?.existingPasses ?? []}
                absentStudentsOnDate={quickData?.existingAttendance?.absentStudents ?? []}
                studentsList={quickData?.students ?? []}
            />

            <AttendanceModal
                isOpen={quickAction === "attendance" && quickData !== null}
                onClose={closeQuick}
                selectedDate={new Date()}
                onSubmit={submitQuickAttendance}
                existingAttendance={quickData?.existingAttendance ?? null}
                studentsList={quickData?.students ?? []}
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

function QuickActionButton({
    icon: Icon,
    label,
    onClick,
    className,
    badge,
    alert,
}: {
    icon: typeof KeyRound;
    label: string;
    onClick: () => void;
    className: string;
    badge?: number;
    alert?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="flex max-w-[85vw] items-center justify-end gap-2 rounded-full text-right transition-transform active:scale-[0.98]"
        >
            <span className="rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-medium text-fg shadow-card backdrop-blur-sm">
                {label}
            </span>
            <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border shadow-raised transition-colors ${className}`}>
                <Icon size={21} aria-hidden />
                {alert ? (
                    <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold leading-none text-white">
                        !
                    </span>
                ) : null}
                {badge && badge > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                        {badge}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

"use client";

// components/ui/GlobalQuickActions.tsx
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    CircleAlert,
    ClipboardCheck,
    History,
    Inbox,
    KeyRound,
    Sparkles,
    Ticket,
    Undo2,
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
import { useToast } from "@/components/ui/kit";
import { toLocalISODate } from "@/lib/date";

type Menu = "root" | "keys" | "violations" | "quick";
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
    const canViolations =
        status === "authenticated" &&
        !loading &&
        (can("myClass") || can("violations"));
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
    const rootRef = useRef<HTMLDivElement | null>(null);

    const showKeys = canKeys && Boolean(state?.canRequest);
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
        if (menu !== "quick" || classes.length === 0) return;
        const stored = window.localStorage.getItem("my-class-id");
        if (stored && classes.some(item => item.id === stored)) {
            setQuickClassId(stored);
        }
    }, [menu, classes]);

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

    return (
        <>
            {/* Распорка: фиксированный блок не перекрывает конец страницы. */}
            <div className="h-20 sm:h-16" aria-hidden />

            {menu !== null && (
                <div
                    className="fixed inset-0 z-30 bg-backdrop animate-[fadeIn_150ms_ease-out]"
                    onClick={() => setMenu(null)}
                    aria-hidden
                />
            )}

            <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6">
                <div ref={rootRef} className="relative">
                    {menu !== null && (
                        <div className="absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col items-center gap-2">
                            {menu === "keys" && (
                                <div className="flex animate-[quickIn_180ms_ease-out] flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-raised">
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
                                <div className="flex animate-[quickIn_180ms_ease-out] flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-raised">
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

                            {menu === "quick" && quickClass && (
                                <div className="flex min-w-40 animate-[quickIn_180ms_ease-out] flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-raised">
                                    <p className="px-2 pt-1 text-[11px] font-medium text-fg-subtle">
                                        {quickClass.name}
                                    </p>
                                    <IconAction
                                        icon={Ticket}
                                        label="Выписать пропуск"
                                        onClick={() => void openQuickAction("pass")}
                                        className="border-warning/40 bg-warning-soft text-warning hover:bg-warning/20"
                                    />
                                    <IconAction
                                        icon={UserCheck}
                                        label="Отметить присутствие"
                                        alert={attendanceMarked === false}
                                        onClick={() => void openQuickAction("attendance")}
                                        className="border-success/40 bg-success-soft text-success hover:bg-success/20"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {menu !== null && (showKeys || canViolations) && (
                        <div className="absolute right-full top-1/2 mr-2 -translate-y-1/2">
                            <div className="flex animate-[quickIn_220ms_ease-out] items-center gap-1.5 rounded-full border border-border bg-surface p-1.5 shadow-raised">
                                {showKeys && (
                                    <IconAction
                                        icon={KeyRound}
                                        label="Ключи"
                                        onClick={() => setMenu(current => (current === "keys" ? "root" : "keys"))}
                                        className={`border-accent/40 bg-accent-soft text-accent-text hover:bg-accent/20 ${
                                            menu === "keys" ? "ring-2 ring-accent/35" : ""
                                        }`}
                                    />
                                )}
                                {canViolations && (
                                    <IconAction
                                        icon={CircleAlert}
                                        label="Нарушения"
                                        onClick={() => setMenu(current => (current === "violations" ? "root" : "violations"))}
                                        className={`border-danger/40 bg-danger-soft text-danger hover:bg-danger/20 ${
                                            menu === "violations" ? "ring-2 ring-accent/35" : ""
                                        }`}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {menu !== null && showClassActions && (
                        <div className="absolute left-full top-1/2 ml-2 -translate-y-1/2">
                            <div className="flex animate-[quickIn_220ms_ease-out] items-center rounded-full border border-border bg-surface p-1.5 shadow-raised">
                                <IconAction
                                    icon={ClipboardCheck}
                                    label="Пропуск и присутствие"
                                    alert={attendanceMarked === false}
                                    onClick={() => setMenu(current => (current === "quick" ? "root" : "quick"))}
                                    className={`border-info/40 bg-info-soft text-info hover:bg-info/20 ${
                                        menu === "quick" ? "ring-2 ring-accent/35" : ""
                                    }`}
                                />
                            </div>
                        </div>
                    )}

                    <MainAction
                        icon={Sparkles}
                        label={menu ? "Закрыть быстрые команды" : "Быстрые команды"}
                        active={menu !== null}
                        hasBadge={attendanceMarked === false || incoming.length > 0}
                        onClick={() => setMenu(current => (current ? null : "root"))}
                        className="border-accent/50 bg-accent-soft text-accent-text hover:bg-accent/20"
                    />
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

function IconAction({
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
            title={label}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors active:scale-95 ${className}`}
        >
            <Icon size={20} aria-hidden />
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
        </button>
    );
}

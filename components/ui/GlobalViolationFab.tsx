"use client";

// components/ui/GlobalViolationFab.tsx
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CircleAlert, History, X } from "lucide-react";
import ViolationModal from "@/components/ui/ViolationModal";
import { useAccess } from "@/components/access/AccessProvider";
import { useToast } from "@/components/ui/kit";

/**
 * Глобальная кнопка сотрудника — «фиксация и история».
 *
 * Свёрнутая — круглая кнопка в цвете нарушения (красный), по нажатию
 * раскрывается вертикальная скруглённая панель из двух иконок без подписей:
 * зафиксировать нарушение и открыть историю своих фиксаций. Живёт поверх всех
 * страниц у тех, кому это действительно доступно.
 */
export function GlobalViolationFab() {
    const { status } = useSession();
    const pathname = usePathname() ?? "/";
    const router = useRouter();
    const { can, loading } = useAccess();
    const toast = useToast();

    const [expanded, setExpanded] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const canReport = can("myClass") || can("violations");
    const hiddenRoute = pathname.startsWith("/login") || pathname.startsWith("/offline");

    // Закрыть раскрытую панель по клику мимо
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

    if (status !== "authenticated" || loading || !canReport || hiddenRoute) return null;

    const handleSubmit = async (data: {
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

    return (
        <>
            <div
                ref={rootRef}
                className="fixed bottom-20 right-4 z-40 flex flex-col items-center gap-2 sm:bottom-6 sm:right-6"
            >
                {expanded && (
                    <div className="flex flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-raised">
                        <button
                            type="button"
                            onClick={() => {
                                setExpanded(false);
                                setIsOpen(true);
                            }}
                            aria-label="Зафиксировать нарушение"
                            title="Зафиксировать нарушение"
                            className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/40 bg-danger-soft text-danger transition-colors hover:bg-danger/20 active:scale-95"
                        >
                            <CircleAlert size={22} aria-hidden />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setExpanded(false);
                                router.push("/my-violations");
                            }}
                            aria-label="История моих фиксаций"
                            title="История моих фиксаций"
                            className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border bg-surface-2 text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg active:scale-95"
                        >
                            <History size={20} aria-hidden />
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setExpanded(open => !open)}
                    aria-label={expanded ? "Свернуть меню" : "Фиксации: нарушение или история"}
                    aria-expanded={expanded}
                    title={expanded ? "Свернуть" : "Зафиксировать нарушение"}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-danger/50 bg-danger-soft text-danger shadow-raised transition-all hover:bg-danger/20 hover:scale-105 active:scale-95"
                >
                    {expanded ? <X size={24} aria-hidden /> : <CircleAlert size={26} aria-hidden />}
                </button>
            </div>

            <ViolationModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onSubmit={handleSubmit}
            />
        </>
    );
}

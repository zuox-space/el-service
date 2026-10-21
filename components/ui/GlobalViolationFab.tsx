"use client";

// components/ui/GlobalViolationFab.tsx
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { History, ThumbsDown, X } from "lucide-react";
import ViolationModal from "@/components/ui/ViolationModal";
import { useAccess } from "@/components/access/AccessProvider";
import { useToast } from "@/components/ui/kit";

/**
 * Глобальная кнопка сотрудника — «нарушение и история».
 *
 * Свёрнутая — круглая кнопка с дизлайком; по нажатию раскрывается в вертикальную
 * скруглённую панель из двух действий: зафиксировать нарушение и открыть историю
 * своих замечаний с их отработкой. Живёт поверх всех страниц у тех, кому это
 * действительно доступно.
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
                className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6"
            >
                {expanded && (
                    <div className="flex flex-col items-stretch gap-2 rounded-3xl border border-border bg-surface p-2 shadow-raised">
                        <button
                            type="button"
                            onClick={() => {
                                setExpanded(false);
                                setIsOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-full bg-accent-solid px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-solid-hover"
                        >
                            <ThumbsDown size={18} aria-hidden />
                            Нарушение
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setExpanded(false);
                                router.push("/my-violations");
                            }}
                            className="flex items-center gap-2 rounded-full border border-dashed border-border px-4 py-2.5 text-sm text-fg transition-colors hover:bg-surface-hover"
                        >
                            <History size={18} aria-hidden />
                            История
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setExpanded(open => !open)}
                    aria-label={expanded ? "Свернуть меню нарушений" : "Нарушения: зафиксировать или история"}
                    aria-expanded={expanded}
                    title={expanded ? "Свернуть" : "Зафиксировать нарушение"}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent-solid text-accent-fg shadow-raised transition-transform hover:scale-105 active:scale-95"
                >
                    {expanded ? <X size={24} aria-hidden /> : <ThumbsDown size={24} aria-hidden />}
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

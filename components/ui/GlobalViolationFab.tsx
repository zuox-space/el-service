"use client";

// components/ui/GlobalViolationFab.tsx
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ThumbsDown } from "lucide-react";
import ViolationModal from "@/components/ui/ViolationModal";
import { useAccess } from "@/components/access/AccessProvider";
import { useToast } from "@/components/ui/kit";

/**
 * Глобальная кнопка «зафиксировать нарушение».
 *
 * Живёт поверх всех страниц у авторизованного сотрудника, чтобы замечание
 * можно было записать с любого экрана, а не только с рабочего стола класса.
 * Показывается тем, кто действительно может фиксировать нарушения
 * («Мой класс» или раздел «Нарушения») — остальным кнопка не нужна.
 */
export function GlobalViolationFab() {
    const { status } = useSession();
    const pathname = usePathname() ?? "/";
    const { can, loading } = useAccess();
    const toast = useToast();

    const [isOpen, setIsOpen] = useState(false);

    const canReport = can("myClass") || can("violations");
    const hiddenRoute = pathname.startsWith("/login") || pathname.startsWith("/offline");

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
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label="Зафиксировать нарушение"
                title="Зафиксировать нарушение"
                className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent-solid text-accent-fg shadow-raised transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
            >
                <ThumbsDown size={24} aria-hidden />
            </button>

            <ViolationModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onSubmit={handleSubmit}
            />
        </>
    );
}

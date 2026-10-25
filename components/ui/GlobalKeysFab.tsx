"use client";

// components/ui/GlobalKeysFab.tsx
import { useState } from "react";
import { usePathname } from "next/navigation";
import { KeyRound } from "lucide-react";
import { useAccess } from "@/components/access/AccessProvider";
import { KeysModal } from "@/components/keys/KeysModal";
import { KeysProvider, useKeys } from "@/components/keys/KeysProvider";

/**
 * Кнопка ключницы слева снизу — как FAB нарушений, но для сотрудников.
 * Видна только тем, у кого есть раздел «Ключи» и кто может создавать заявки.
 */
export function GlobalKeysFab() {
    const pathname = usePathname() ?? "/";
    const { can, loading } = useAccess();

    const hidden = pathname.startsWith("/login") || pathname.startsWith("/offline");
    if (loading || hidden || !can("keys")) return null;

    return (
        <KeysProvider>
            <KeysFabInner />
        </KeysProvider>
    );
}

function KeysFabInner() {
    const { state } = useKeys();
    const [open, setOpen] = useState(false);

    // Охрана без админки ключей только подтверждает заявки — кнопка ей не нужна
    if (!state?.canRequest) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Ключи: взять, сдать или передать"
                title="Ключи"
                className="fixed bottom-[4.5rem] left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent-soft text-accent-text shadow-raised transition-all hover:scale-105 hover:bg-accent/20 active:scale-95 sm:bottom-6 sm:left-6"
            >
                <KeyRound size={24} aria-hidden />
            </button>

            <KeysModal open={open} onClose={() => setOpen(false)} />
        </>
    );
}

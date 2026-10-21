"use client";

// components/access/NoAccess.tsx
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, EmptyState } from "@/components/ui/kit";

/** Экран «нет доступа»: раздел скрыт, но пользователь не остаётся в пустоте. */
export function NoAccess({ title = "Нет доступа" }: { title?: string }) {
    const router = useRouter();

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-10">
            <EmptyState
                icon={Lock}
                variant="forbidden"
                title={title}
                description="Этот раздел не открыт для вашей учётной записи. Попросите администратора выдать доступ."
                action={{ label: "На главную", onClick: () => router.push("/") }}
            />
            <div className="mt-4 text-center">
                <Button variant="ghost" onClick={() => router.back()}>
                    Назад
                </Button>
            </div>
        </div>
    );
}

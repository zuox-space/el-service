"use client";

// components/shell/ProfileMenu.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Shield, Sun, UserRound } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button, Sheet } from "@/components/ui/kit";
import { cn } from "@/lib/cn";

/**
 * Профиль = настройки.
 *
 * Нажатие на аватар открывает панель настроек: тема, переход в расширенный режим
 * (для администраторов) и выход. Работает одинаково на телефоне и на десктопе,
 * поэтому тема доступна на любом экране — раньше на мобильном её не было видно.
 */
export function ProfileMenu({
    userName,
    userEmail,
    isAdmin,
    onLogout,
    variant = "compact",
    className,
}: {
    userName?: string | null;
    userEmail?: string | null;
    isAdmin: boolean;
    onLogout: () => void;
    /** compact — только аватар (шапка), full — аватар + имя (главная) */
    variant?: "compact" | "full";
    className?: string;
}) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [open, setOpen] = useState(false);

    const initial = (userName ?? "?").trim().charAt(0).toUpperCase();

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Настройки профиля"
                className={cn(
                    "flex items-center gap-2 rounded-control text-left transition-colors",
                    variant === "compact" ? "h-8 w-8 justify-center" : "px-1 py-0.5 hover:bg-surface-2",
                    className,
                )}
            >
                <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full surface-accent bg-accent-solid text-xs font-semibold text-accent-fg"
                    aria-hidden
                >
                    {initial || <UserRound size={16} />}
                </span>
                {variant === "full" && (
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-fg">
                            {userName ?? "Сотрудник"}
                        </span>
                        <span className="block truncate text-xs text-fg-subtle">
                            {userEmail ?? "Настройки профиля"}
                        </span>
                    </span>
                )}
            </button>

            <Sheet open={open} onClose={() => setOpen(false)} title="Настройки" description={userName ?? undefined}>
                <div className="space-y-4">
                    <div>
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">Тема</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setTheme("light")}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-control border px-3 py-3 text-sm transition-colors",
                                    theme === "light"
                                        ? "border-accent/60 bg-accent-soft text-accent-text"
                                        : "border-border bg-surface-2 text-fg-muted hover:text-fg",
                                )}
                            >
                                <Sun size={16} aria-hidden />
                                Светлая
                            </button>
                            <button
                                type="button"
                                onClick={() => setTheme("dark")}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-control border px-3 py-3 text-sm transition-colors",
                                    theme === "dark"
                                        ? "border-accent/60 bg-accent-soft text-accent-text"
                                        : "border-border bg-surface-2 text-fg-muted hover:text-fg",
                                )}
                            >
                                <Moon size={16} aria-hidden />
                                Тёмная
                            </button>
                        </div>
                    </div>

                    {isAdmin && (
                        <div>
                            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                                Режим
                            </p>
                            <Button
                                fullWidth
                                variant="secondary"
                                leftIcon={Shield}
                                onClick={() => {
                                    setOpen(false);
                                    router.push("/admin");
                                }}
                            >
                                Расширенный режим
                            </Button>
                            <p className="mt-1.5 text-xs text-fg-subtle">
                                Аналитика, классы, ВШУ, прогульщики и управление сотрудниками
                            </p>
                        </div>
                    )}

                    {userEmail && <p className="truncate text-xs text-fg-subtle">{userEmail}</p>}

                    <Button fullWidth variant="danger" leftIcon={LogOut} onClick={onLogout}>
                        Выйти
                    </Button>
                </div>
            </Sheet>
        </>
    );
}

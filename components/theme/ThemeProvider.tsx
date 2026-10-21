"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
    DEFAULT_THEME,
    THEME_BAR_COLORS,
    THEME_STORAGE_KEY,
    isTheme,
    type Theme,
} from "@/lib/theme";

interface ThemeContextValue {
    theme: Theme;
    /** false до первого эффекта: нужно, чтобы иконка переключателя не мигала */
    mounted: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_BAR_COLORS[theme]);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
    const [mounted, setMounted] = useState(false);

    // Значение уже выставлено инлайновым скриптом в <head> — синхронизируемся с ним,
    // а не выставляем повторно, чтобы не перезаписать выбор пользователя.
    useEffect(() => {
        const current = document.documentElement.getAttribute("data-theme");
        if (isTheme(current)) {
            setThemeState(current);
        } else {
            applyTheme(DEFAULT_THEME);
        }
        setMounted(true);
    }, []);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
        applyTheme(next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
            // приватный режим / отключённое хранилище — не критично
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }, [setTheme, theme]);

    const value = useMemo<ThemeContextValue>(
        () => ({ theme, mounted, setTheme, toggleTheme }),
        [theme, mounted, setTheme, toggleTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Доступ к теме. Бросает, если компонент вне ThemeProvider — так ошибка видна сразу. */
export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme должен использоваться внутри <ThemeProvider>");
    }
    return ctx;
}

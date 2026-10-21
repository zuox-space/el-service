"use client";

import { useEffect, useState } from "react";

/**
 * useIsMobile — SSR-безопасный медиазапрос.
 *
 * Нужен, чтобы один и тот же компонент оверлея на мобильном показывался как
 * BottomSheet, а на десктопе — как центрированная модалка: так задаёт дизайн-система.
 * На сервере возвращает false (десктопная разметка), затем синхронизируется после mount.
 */
export function useIsMobile(breakpointPx = 768): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const query = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
        const apply = () => setIsMobile(query.matches);

        apply();
        query.addEventListener("change", apply);
        return () => query.removeEventListener("change", apply);
    }, [breakpointPx]);

    return isMobile;
}

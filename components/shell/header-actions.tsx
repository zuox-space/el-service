"use client";

// components/shell/header-actions.tsx
import { createContext, useContext, useEffect, type DependencyList, type ReactNode } from "react";

/**
 * Действия в шапке каркаса.
 *
 * Шапка принадлежит AppShell, а кнопки — конкретной странице (например,
 * «Обновить» на панели). Чтобы не держать состояние дашборда в каркасе,
 * страница регистрирует свои действия через этот контекст.
 *
 *   useHeaderActions(() => <Button onClick={...}>Обновить</Button>, [handler]);
 *
 * При размонтировании страницы actions очищаются — в шапке не остаётся
 * кнопок от предыдущего экрана.
 */
export const HeaderActionsContext = createContext<((node: ReactNode) => void) | null>(null);

export function useHeaderActions(factory: () => ReactNode, deps: DependencyList) {
    const setActions = useContext(HeaderActionsContext);

    useEffect(() => {
        if (!setActions) return;

        setActions(factory());
        return () => setActions(null);
        // deps передаёт вызывающая сторона: фабрика создаёт новый узел каждый раз
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
}

"use client";

// components/access/AccessProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { AccessSectionId } from "@/lib/access/registry";

/**
 * Доступы текущего пользователя для интерфейса.
 *
 * Источник — /api/access/me (там же логика ролей и индивидуальных настроек).
 * Провайдер нужен только для навигации и показа «нет доступа»: сами данные
 * защищены на сервере, поэтому подделать состояние в браузере бесполезно.
 */
interface AccessState {
    loading: boolean;
    isAdmin: boolean;
    sections: AccessSectionId[];
    can: (section: AccessSectionId) => boolean;
}

const defaultState: AccessState = {
    loading: true,
    isAdmin: false,
    sections: [],
    can: () => false,
};

const AccessContext = createContext<AccessState>(defaultState);

export function AccessProvider({ children }: { children: React.ReactNode }) {
    const { status } = useSession();
    const [state, setState] = useState<{ loading: boolean; isAdmin: boolean; sections: AccessSectionId[] }>({
        loading: true,
        isAdmin: false,
        sections: [],
    });

    useEffect(() => {
        if (status === "loading") return;

        if (status !== "authenticated") {
            setState({ loading: false, isAdmin: false, sections: [] });
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch("/api/access/me");
                if (!response.ok) throw new Error("no access");

                const data = await response.json();
                if (cancelled) return;

                setState({
                    loading: false,
                    isAdmin: Boolean(data.isAdmin),
                    sections: Array.isArray(data.sections) ? data.sections : [],
                });
            } catch {
                if (!cancelled) setState({ loading: false, isAdmin: false, sections: [] });
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [status]);

    const value = useMemo<AccessState>(
        () => ({
            ...state,
            can: (section: AccessSectionId) => state.isAdmin || state.sections.includes(section),
        }),
        [state],
    );

    return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessState {
    return useContext(AccessContext);
}

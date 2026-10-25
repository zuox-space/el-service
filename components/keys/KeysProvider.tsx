"use client";

// components/keys/KeysProvider.tsx
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import type { KeysState } from "@/lib/keys/queries";

export interface KeysUser {
    id: string;
    name: string;
    email: string;
    roles: string[];
}

interface KeysContextValue {
    state: KeysState | null;
    users: KeysUser[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    loadUsers: () => Promise<void>;
    submitRequest: (input: {
        type: "ISSUE" | "RETURN" | "TRANSFER";
        keyIds: string[];
        targetUserId?: string | null;
    }) => Promise<void>;
    requestWithId: (input: {
        type: "ISSUE" | "RETURN" | "TRANSFER";
        keyIds: string[];
        targetUserId?: string | null;
    }) => Promise<string>;
    decide: (requestId: string, action: "confirm" | "cancel") => Promise<void>;
    toggleFavorite: (keyId: string) => Promise<void>;
}

const KeysContext = createContext<KeysContextValue | null>(null);

export function KeysProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<KeysState | null>(null);
    const [users, setUsers] = useState<KeysUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const sourceRef = useRef<EventSource | null>(null);

    const refresh = useCallback(async () => {
        try {
            const response = await fetch("/api/keys/state", { cache: "no-store" });
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);
            const data = await response.json();
            setState(data.state);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось загрузить ключи");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadUsers = useCallback(async () => {
        if (users.length > 0) return;
        const response = await fetch("/api/keys/users", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setUsers(Array.isArray(data.users) ? data.users : []);
    }, [users.length]);

    useEffect(() => {
        void refresh();

        const source = new EventSource("/api/keys/events");
        sourceRef.current = source;
        const onUpdate = () => void refresh();
        source.addEventListener("update", onUpdate);
        // Страховка на истечение заявки: SSE не присылает событие при отмене по TTL.
        const poll = setInterval(() => void refresh(), 15_000);

        return () => {
            clearInterval(poll);
            source.removeEventListener("update", onUpdate);
            source.close();
            sourceRef.current = null;
        };
    }, [refresh]);

    const requestWithId = useCallback<KeysContextValue["requestWithId"]>(
        async input => {
            const response = await fetch("/api/keys/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось создать заявку");
            await refresh();
            return String(data.requestId ?? "");
        },
        [refresh],
    );

    const submitRequest = useCallback<KeysContextValue["submitRequest"]>(
        async input => {
            await requestWithId(input);
        },
        [requestWithId],
    );

    const decide = useCallback<KeysContextValue["decide"]>(
        async (requestId, action) => {
            const response = await fetch(`/api/keys/requests/${requestId}/decision`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось обработать заявку");
            await refresh();
        },
        [refresh],
    );

    const toggleFavorite = useCallback<KeysContextValue["toggleFavorite"]>(
        async keyId => {
            await fetch("/api/keys/favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyId }),
            });
            await refresh();
        },
        [refresh],
    );

    const value = useMemo(
        () => ({ state, users, loading, error, refresh, loadUsers, submitRequest, requestWithId, decide, toggleFavorite }),
        [state, users, loading, error, refresh, loadUsers, submitRequest, requestWithId, decide, toggleFavorite],
    );

    return <KeysContext.Provider value={value}>{children}</KeysContext.Provider>;
}

export function useKeys(): KeysContextValue {
    const value = useContext(KeysContext);
    if (!value) throw new Error("useKeys должен использоваться внутри KeysProvider");
    return value;
}

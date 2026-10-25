"use client";

// components/keys/KeysModal.tsx
import { useEffect, useMemo, useState } from "react";
import { KeyRound, Send } from "lucide-react";
import {
    Badge,
    Button,
    Checkbox,
    EmptyState,
    Modal,
    ModalFooter,
    SearchInput,
    Select,
    Tabs,
    useToast,
} from "@/components/ui/kit";
import { useKeys } from "./KeysProvider";

type RequestType = "ISSUE" | "RETURN" | "TRANSFER";

const TYPE_LABEL: Record<RequestType, string> = {
    ISSUE: "Взять",
    RETURN: "Сдать",
    TRANSFER: "Передать",
};

export function KeysModal({
    open,
    onClose,
    initialType = "ISSUE",
    initialKeyId,
}: {
    open: boolean;
    onClose: () => void;
    initialType?: RequestType;
    initialKeyId?: string | null;
}) {
    const { state, users, submitRequest, loadUsers } = useKeys();
    const toast = useToast();

    const [type, setType] = useState<RequestType>(initialType);
    const [buildingId, setBuildingId] = useState("");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [targetUserId, setTargetUserId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) return;
        setType(initialType);
        setSelected(initialKeyId ? [initialKeyId] : []);
        setBuildingId("");
        setQuery("");
        setTargetUserId("");
        void loadUsers();
    }, [open, initialType, initialKeyId, loadUsers]);

    const keys = useMemo(() => {
        if (!state) return [];
        const q = query.trim().toLowerCase();
        return state.keys.filter(key => {
            if (type === "ISSUE" && key.status !== "FREE") return false;
            if (type !== "ISSUE" && key.holderId !== state.me.id) return false;
            if (buildingId && key.buildingId !== buildingId) return false;
            if (q) {
                const haystack = `${key.roomNumber} ${key.roomName} ${key.buildingName}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [state, type, buildingId, query]);

    const colleagues = useMemo(
        () => users.filter(user => user.id !== state?.me.id && !user.roles.includes("SECURITY")),
        [users, state?.me.id],
    );

    const toggle = (id: string) => {
        setSelected(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]));
    };

    const submit = async () => {
        if (selected.length === 0) {
            toast.show({ title: "Выберите хотя бы один ключ", tone: "warning" });
            return;
        }
        if (type === "TRANSFER" && !targetUserId) {
            toast.show({ title: "Выберите коллегу, кому передаёте", tone: "warning" });
            return;
        }

        setSubmitting(true);
        try {
            await submitRequest({ type, keyIds: selected, targetUserId: type === "TRANSFER" ? targetUserId : null });
            toast.show({
                title: type === "TRANSFER" ? "Заявка на передачу отправлена" : "Заявка отправлена",
                description: "Охрана подтвердит операцию",
                tone: "success",
            });
            onClose();
        } catch (error) {
            toast.show({
                title: "Не удалось отправить заявку",
                description: error instanceof Error ? error.message : undefined,
                tone: "danger",
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Ключи"
            description="Выберите действие и ключи"
            size="lg"
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={() => void submit()}
                    submitLabel={`${TYPE_LABEL[type]}${selected.length > 0 ? ` · ${selected.length}` : ""}`}
                    loading={submitting}
                />
            }
        >
            <div className="space-y-3">
                <Tabs
                    value={type}
                    onChange={id => {
                        setType(id as RequestType);
                        setSelected([]);
                    }}
                    items={[
                        { id: "ISSUE", label: "Взять" },
                        { id: "RETURN", label: "Сдать" },
                        { id: "TRANSFER", label: "Передать" },
                    ]}
                    ariaLabel="Действие с ключом"
                />

                <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                        label="Здание"
                        placeholder="Все здания"
                        value={buildingId}
                        onChange={setBuildingId}
                        options={(state?.buildings ?? []).map(building => ({
                            value: building.id,
                            label: building.name,
                        }))}
                    />
                    <SearchInput
                        label="Поиск"
                        placeholder="Номер или кабинет"
                        value={query}
                        onChange={setQuery}
                    />
                </div>

                {type === "TRANSFER" && (
                    <Select
                        label="Кому передать"
                        placeholder="Выберите коллегу"
                        value={targetUserId}
                        onChange={setTargetUserId}
                        options={colleagues.map(user => ({
                            value: user.id,
                            label: user.name,
                        }))}
                    />
                )}

                {keys.length === 0 ? (
                    <EmptyState
                        icon={KeyRound}
                        title="Ключей нет"
                        description={
                            type === "ISSUE"
                                ? "Нет свободных ключей по выбранным условиям"
                                : "У вас нет ключей для этого действия"
                        }
                        compact
                    />
                ) : (
                    <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-card border border-border">
                        {keys.map(key => (
                            <li key={key.id} className="px-3 py-2">
                                <div className="flex items-start gap-2">
                                    <Checkbox
                                        checked={selected.includes(key.id)}
                                        onChange={() => toggle(key.id)}
                                        label={`${key.roomNumber}${key.roomName ? ` · ${key.roomName}` : ""}`}
                                        description={`${key.buildingName} · ${key.floor} этаж${
                                            key.holderName ? ` · у ${key.holderName}` : ""
                                        }`}
                                    />
                                    <Badge tone={key.pending ? "warning" : key.status === "FREE" ? "success" : "info"}>
                                        {key.pending ? "заявка" : key.status === "FREE" ? "свободен" : "выдан"}
                                    </Badge>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                    <Send size={12} aria-hidden />
                    Заявку подтвердит охрана или администратор ключей.
                </p>
            </div>
        </Modal>
    );
}

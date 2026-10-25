"use client";

// components/keys/KeyHistoryDrawer.tsx
import { Modal } from "@/components/ui/kit";
import { HistoryPanel } from "./HistoryPanel";

/** История одного ключа — как KeyHistoryDrawer в keys-app. */
export function KeyHistoryDrawer({
    keyId,
    onClose,
    limit = 20,
    endpoint = "/api/keys/history",
}: {
    keyId: string | null;
    onClose: () => void;
    limit?: number;
    endpoint?: string;
}) {
    return (
        <Modal
            open={Boolean(keyId)}
            onClose={onClose}
            title="История ключа"
            description="Выдачи, сдачи и передачи"
            size="lg"
        >
            {keyId && <HistoryPanel type="key" keyId={keyId} pageSize={limit} endpoint={endpoint} />}
        </Modal>
    );
}

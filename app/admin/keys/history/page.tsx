"use client";

// app/admin/keys/history/page.tsx
import { useState } from "react";
import { PageHeader } from "@/components/ui/kit";
import { KeysProvider } from "@/components/keys/KeysProvider";
import { HistoryPanel } from "@/components/keys/HistoryPanel";
import { KeyHistoryDrawer } from "@/components/keys/KeyHistoryDrawer";

export default function AdminKeysHistoryPage() {
    return (
        <KeysProvider>
            <AdminHistoryScreen />
        </KeysProvider>
    );
}

function AdminHistoryScreen() {
    const [keyId, setKeyId] = useState<string | null>(null);

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="История операций"
                subtitle="Кто, кому и когда выдавал, сдавал и передавал ключи."
                onBack={() => (window.location.href = "/admin")}
            />
            <main className="mx-auto w-full max-w-[1200px] space-y-3 px-4 py-4">
                <HistoryPanel type="all" pageSize={50} onOpenKey={setKeyId} />
            </main>
            <KeyHistoryDrawer keyId={keyId} onClose={() => setKeyId(null)} />
        </div>
    );
}

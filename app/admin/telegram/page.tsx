// app/admin/telegram/page.tsx
'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowLeft, Send, Loader2, LogOut } from "lucide-react";

export default function TelegramPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (status === "loading") return;
        if (!session) router.replace("/login");
    }, [session, status, router]);

    const send = async () => {
        setSending(true);
        try {
            await fetch("/api/telegram/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chatId: "ВАШ_CHAT_ID", // замените на ваш
                    text: "✅ Тест от бота!"
                })
            });
            setDone(true);
            setTimeout(() => setDone(false), 3000);
        } catch (e) {
            alert("Ошибка");
        }
        setSending(false);
    };

    if (!session) return null;

    return (
        <div className="min-h-screen bg-[#1a2332] flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center max-w-sm w-full">
                <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                    <Send size={36} className="text-blue-400" />
                </div>

                <h2 className="text-white text-xl font-bold mb-2">Telegram</h2>
                <p className="text-gray-400 text-sm mb-6">Отправить тестовое сообщение</p>

                <button
                    onClick={send}
                    disabled={sending}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    {sending ? "Отправка..." : done ? "✅ Отправлено!" : "📨 Отправить"}
                </button>

                <button
                    onClick={() => router.push("/admin")}
                    className="mt-4 text-gray-500 text-sm hover:text-gray-300 transition-all flex items-center justify-center gap-1"
                >
                    <ArrowLeft size={14} /> Назад
                </button>
            </div>
        </div>
    );
}
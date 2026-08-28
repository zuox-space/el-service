"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
    LogOut, ArrowLeft, Send, Bot, User, Loader2,
    School, Users, UserX, Calendar, Clock, AlertCircle,
    ChevronDown, ChevronUp, Download, Search
} from "lucide-react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
    data?: any;
}

export default function ChatPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "👋 Привет! Я ваш AI-помощник по управлению школой.\n\nЯ могу:\n• 📊 Показать статистику по пропускам и отсутствиям\n• 👨‍🎓 Найти информацию о конкретном ученике\n• 📚 Показать информацию о классе\n• 🔍 Найти прогульщиков\n• 📅 Показать пропуски за период\n\nЧто вас интересует?",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Примеры быстрых запросов
    const quickQuestions = [
        { label: "📊 Статистика", query: "Покажи общую статистику по пропускам" },
        { label: "⚠️ Прогульщики", query: "Кто больше всего прогуливает?" },
        { label: "📚 Класс 7-А", query: "Покажи информацию о классе 7-А" },
        { label: "📅 За неделю", query: "Покажи пропуски за последнюю неделю" },
    ];

    useEffect(() => {
        setMounted(true);
        scrollToBottom();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Проверка прав доступа
    useEffect(() => {
        if (status === "loading") return;
        if (!session) {
            router.replace("/login");
            return;
        }
        const roles = (session?.user?.roles as string[]) || [];
        if (!roles.includes("ADMIN")) {
            router.replace("/");
            return;
        }
    }, [session, status, router]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input.trim() })
            });

            const data = await response.json();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.response || "Извините, я не смог обработать ваш запрос.",
                timestamp: new Date(),
                data: data.data
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "❌ Произошла ошибка. Пожалуйста, попробуйте позже.",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858] flex flex-col">
            {/* Шапка */}
            <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-20">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push("/admin")}
                                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <Bot size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">AI-помощник</p>
                                <p className="text-xs text-gray-400">Управление школой</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                await fetch("/api/auth/signout", { method: "POST" });
                                router.push("/login");
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${message.role === "user"
                                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                                    : "bg-white/10 backdrop-blur-lg border border-white/20 text-white"
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                {message.role === "assistant" ? (
                                    <Bot size={16} className="text-green-400" />
                                ) : (
                                    <User size={16} className="text-blue-300" />
                                )}
                                <span className="text-xs opacity-70">
                                    {message.role === "assistant" ? "AI-помощник" : "Вы"}
                                </span>
                                <span className="text-[10px] opacity-50 ml-auto">
                                    {message.timestamp.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                            <div className="text-sm whitespace-pre-wrap break-words">
                                {message.content}
                            </div>

                            {/* Дополнительные данные (таблицы, статистика) */}
                            {message.data && (
                                <div className="mt-3 pt-3 border-t border-white/10">
                                    {message.data.type === "table" && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="text-gray-400 border-b border-white/10">
                                                        {message.data.columns?.map((col: string) => (
                                                            <th key={col} className="px-2 py-1 text-left">{col}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {message.data.rows?.map((row: any[], idx: number) => (
                                                        <tr key={idx} className="border-b border-white/5">
                                                            {row.map((cell, cellIdx) => (
                                                                <td key={cellIdx} className="px-2 py-1">{cell}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    {message.data.type === "stats" && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {Object.entries(message.data.values || {}).map(([key, value]) => (
                                                <div key={key} className="bg-white/5 rounded-lg p-2 text-center">
                                                    <div className="text-lg font-bold text-white">{String(value)}</div>
                                                    <div className="text-[10px] text-gray-400">{key}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin text-green-400" />
                                <span className="text-sm text-gray-300">Думаю...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Быстрые запросы */}
            <div className="px-4 py-2 bg-white/5 border-t border-white/10">
                <div className="flex flex-wrap gap-2 max-w-4xl mx-auto">
                    {quickQuestions.map((q, idx) => (
                        <button
                            key={idx}
                            onClick={() => setInput(q.query)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-xs text-gray-300 transition-all whitespace-nowrap"
                        >
                            {q.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Поле ввода */}
            <div className="p-4 bg-white/5 border-t border-white/10">
                <div className="flex gap-2 max-w-4xl mx-auto">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Задайте вопрос..."
                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all disabled:opacity-50"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
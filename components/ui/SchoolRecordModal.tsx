"use client";

import { useState } from "react";
import { X, ShieldAlert, Loader2, Calendar } from "lucide-react";

interface SchoolRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    mode: "register" | "release";
    studentName: string;
    existingReason?: string;
}

export default function SchoolRecordModal({
    isOpen,
    onClose,
    onSubmit,
    mode,
    studentName,
    existingReason,
}: SchoolRecordModalProps) {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [reason, setReason] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!reason.trim()) {
            alert(mode === "register" ? "Укажите причину постановки на учёт" : "Укажите причину снятия с учёта");
            return;
        }

        setIsLoading(true);
        try {
            await onSubmit({ date, reason });
            setReason("");
            setDate(today);
            onClose();
        } catch (error) {
            console.error("Submit error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setReason("");
        setDate(today);
        onClose();
    };

    if (!isOpen) return null;

    const isRegister = mode === "register";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
            <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden">
                {/* Заголовок */}
                <div className={`px-4 py-3 ${isRegister
                        ? "bg-gradient-to-r from-orange-600 to-red-600"
                        : "bg-gradient-to-r from-green-600 to-emerald-600"
                    }`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={18} className="text-white" />
                            <h3 className="text-lg font-bold text-white">
                                {isRegister ? "Постановка на учёт" : "Снятие с учёта"}
                            </h3>
                        </div>
                        <button onClick={handleClose} className="text-white/70 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Информация об ученике */}
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                        <p className="text-xs text-gray-400 mb-1">Ученик</p>
                        <p className="text-white font-medium">{studentName}</p>
                    </div>

                    {/* Если снятие — показываем причину постановки */}
                    {!isRegister && existingReason && (
                        <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/30">
                            <p className="text-xs text-orange-400 mb-1">Причина постановки на учёт</p>
                            <p className="text-white text-sm">{existingReason}</p>
                        </div>
                    )}

                    {/* Дата */}
                    <div>
                        <label className="block text-white text-sm mb-1">
                            {isRegister ? "Дата постановки" : "Дата снятия"} *
                        </label>
                        <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Причина */}
                    <div>
                        <label className="block text-white text-sm mb-1">
                            {isRegister ? "Причина постановки" : "Причина снятия"} *
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={
                                isRegister
                                    ? "Опишите причину постановки на внутришкольный учёт..."
                                    : "Опишите причину снятия с учёта..."
                            }
                            rows={4}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                        />
                    </div>

                    {/* Предупреждение */}
                    <div className={`rounded-lg p-3 border ${isRegister
                            ? "bg-orange-500/10 border-orange-500/30"
                            : "bg-green-500/10 border-green-500/30"
                        }`}>
                        <p className={`text-xs ${isRegister ? "text-orange-300" : "text-green-300"}`}>
                            {isRegister
                                ? "⚠️ Ученик будет поставлен на внутришкольный учёт"
                                : "✅ Ученик будет снят с внутришкольного учёта"
                            }
                        </p>
                    </div>
                </div>

                {/* Кнопки */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex gap-2">
                    <button
                        onClick={handleClose}
                        className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all text-sm"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className={`flex-1 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2 ${isRegister
                                ? "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                                : "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            isRegister ? "Поставить на учёт" : "Снять с учёта"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
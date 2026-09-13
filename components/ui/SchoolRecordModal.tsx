"use client";

import { useState, useEffect } from "react";
import { X, ShieldAlert, Loader2, Calendar, Clock } from "lucide-react";

interface SchoolRecordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    mode: "register" | "release";
    studentName: string;
    existingReason?: string;
}

// 🔥 Варианты периода
const PERIOD_OPTIONS = [
    { id: "1m", label: "1 месяц", months: 1, color: "text-green-400", bg: "bg-green-500/20" },
    { id: "3m", label: "3 месяца", months: 3, color: "text-blue-400", bg: "bg-blue-500/20" },
    { id: "6m", label: "6 месяцев", months: 6, color: "text-yellow-400", bg: "bg-yellow-500/20" },
    { id: "1y", label: "1 год", months: 12, color: "text-orange-400", bg: "bg-orange-500/20" },
    { id: "custom", label: "Другая дата", months: 0, color: "text-purple-400", bg: "bg-purple-500/20" },
];

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
    const [selectedPeriod, setSelectedPeriod] = useState("3m");
    const [customDate, setCustomDate] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Сброс формы при открытии
    useEffect(() => {
        if (isOpen) {
            const todayStr = new Date().toISOString().split('T')[0];
            setDate(todayStr);
            setReason("");
            setSelectedPeriod("3m");
            setCustomDate("");
        }
    }, [isOpen]);

    // 🔥 Функция расчета предполагаемой даты снятия
    const calculatePlannedRelease = (): string | null => {
        if (mode === "release") return null;

        if (selectedPeriod === "custom") {
            return customDate || null;
        }

        const option = PERIOD_OPTIONS.find(p => p.id === selectedPeriod);
        if (!option || option.months === 0) return null;

        const startDate = new Date(date);
        const plannedDate = new Date(startDate);
        plannedDate.setMonth(plannedDate.getMonth() + option.months);
        return plannedDate.toISOString().split('T')[0];
    };

    const handleSubmit = async () => {
        if (!reason.trim()) {
            alert(mode === "register" ? "Укажите причину постановки на учёт" : "Укажите причину снятия с учёта");
            return;
        }

        if (mode === "register" && selectedPeriod === "custom" && !customDate) {
            alert("Укажите предполагаемую дату снятия");
            return;
        }

        setIsLoading(true);
        try {
            await onSubmit({
                date,
                reason,
                plannedReleaseAt: calculatePlannedRelease(),
            });
            onClose();
        } catch (error) {
            console.error("Submit error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
    };

    if (!isOpen) return null;

    const isRegister = mode === "register";
    const plannedDate = calculatePlannedRelease();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
            <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Заголовок */}
                <div className={`px-4 py-3 sticky top-0 z-10 ${isRegister
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

                    {/* Дата постановки/снятия */}
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

                    {/* 🔥 Период постановки (только при постановке) */}
                    {isRegister && (
                        <div>
                            <label className="block text-white text-sm mb-2">
                                Предполагаемый период
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {PERIOD_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setSelectedPeriod(option.id)}
                                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${selectedPeriod === option.id
                                                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20"
                                                : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                                            }`}
                                    >
                                        <Clock size={12} />
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {/* Кастомная дата */}
                            {selectedPeriod === "custom" && (
                                <div className="mt-3">
                                    <label className="block text-white text-xs mb-1">
                                        Предполагаемая дата снятия *
                                    </label>
                                    <div className="relative">
                                        <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="date"
                                            value={customDate}
                                            onChange={(e) => setCustomDate(e.target.value)}
                                            min={date}
                                            className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Показываем рассчитанную дату */}
                            {plannedDate && (
                                <div className="mt-3 bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                                    <p className="text-[10px] text-blue-400 mb-0.5">
                                        Планируемая дата снятия с учёта
                                    </p>
                                    <p className="text-white text-sm font-medium">
                                        {new Date(plannedDate).toLocaleDateString('ru-RU', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Период: {PERIOD_OPTIONS.find(p => p.id === selectedPeriod)?.label}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

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
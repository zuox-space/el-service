"use client";

import { useState, useEffect, useRef } from "react";
import {
    X, Shield, User, Search, ChevronDown, Loader2,
    Phone, Users, Info
} from "lucide-react";

interface AuthorizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    studentsList: any[];
}

const RELATION_OPTIONS = [
    { id: "mother", label: "Мама", icon: "👩" },
    { id: "father", label: "Папа", icon: "👨" },
    { id: "grandmother", label: "Бабушка", icon: "👵" },
    { id: "grandfather", label: "Дедушка", icon: "👴" },
    { id: "aunt", label: "Тётя", icon: "👩‍🦰" },
    { id: "uncle", label: "Дядя", icon: "👨‍🦱" },
    { id: "sister", label: "Сестра", icon: "👧" },
    { id: "brother", label: "Брат", icon: "👦" },
    { id: "nanny", label: "Няня", icon: "👩‍🍼" },
    { id: "driver", label: "Водитель", icon: "🚗" },
    { id: "other", label: "Другое", icon: "👤" },
];

export default function AuthorizationModal({
    isOpen,
    onClose,
    onSubmit,
    studentsList,
}: AuthorizationModalProps) {
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [trustedName, setTrustedName] = useState("");
    const [relation, setRelation] = useState("");
    const [customRelation, setCustomRelation] = useState("");
    const [phone, setPhone] = useState("");
    const [comment, setComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Поиск ученика
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Фильтрация учеников
    const filteredStudents = studentsList.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Закрытие дропдауна при клике вне
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Сброс при открытии
    useEffect(() => {
        if (isOpen) {
            setSelectedStudent(null);
            setTrustedName("");
            setRelation("");
            setCustomRelation("");
            setPhone("");
            setComment("");
            setSearchQuery("");
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!selectedStudent) {
            alert("Выберите ученика");
            return;
        }
        if (!trustedName.trim()) {
            alert("Укажите ФИО доверенного лица");
            return;
        }
        if (!relation) {
            alert("Укажите кем приходится ребёнку");
            return;
        }
        if (relation === "other" && !customRelation.trim()) {
            alert("Укажите кем приходится ребёнку");
            return;
        }

        setIsLoading(true);
        try {
            await onSubmit({
                studentId: selectedStudent.aisId || selectedStudent.id,
                studentName: selectedStudent.name,
                className: selectedStudent.className || "",
                trustedName: trustedName.trim(),
                relation:
                    relation === "other"
                        ? customRelation.trim()
                        : RELATION_OPTIONS.find(r => r.id === relation)?.label || relation,
                phone: phone.trim() || null,
                comment: comment.trim() || null,
            });
            onClose();
        } catch (error) {
            console.error("Submit error:", error);
            alert("Ошибка при сохранении");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
            <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Заголовок */}
                <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 sticky top-0 z-10">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Shield size={18} className="text-white" />
                            <h3 className="text-lg font-bold text-white">Новая доверенность</h3>
                        </div>
                        <button onClick={onClose} className="text-white/70 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Выбор ученика */}
                    <div>
                        <label className="block text-white text-sm mb-1">Ученик *</label>
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                                <span className={selectedStudent ? "text-white" : "text-gray-400"}>
                                    {selectedStudent ? (
                                        <span className="flex items-center gap-2">
                                            <User size={14} className="text-cyan-400" />
                                            {selectedStudent.name}
                                        </span>
                                    ) : (
                                        "Выберите ученика"
                                    )}
                                </span>
                                <ChevronDown
                                    size={16}
                                    className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                                />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2332] border border-white/20 rounded-lg shadow-lg z-20 max-h-72 overflow-hidden">
                                    <div className="p-2 border-b border-white/10">
                                        <div className="relative">
                                            <Search
                                                size={14}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                                            />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Поиск ученика..."
                                                autoFocus
                                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                        {filteredStudents.length === 0 ? (
                                            <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                                Ничего не найдено
                                            </div>
                                        ) : (
                                            filteredStudents.map((student) => (
                                                <button
                                                    key={student.aisId || student.id}
                                                    onClick={() => {
                                                        setSelectedStudent(student);
                                                        setIsDropdownOpen(false);
                                                        setSearchQuery("");
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors text-sm text-white"
                                                >
                                                    {student.name}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ФИО доверенного лица */}
                    <div>
                        <label className="block text-white text-sm mb-1">
                            ФИО доверенного лица *
                        </label>
                        <input
                            type="text"
                            value={trustedName}
                            onChange={(e) => setTrustedName(e.target.value)}
                            placeholder="Иванова Мария Петровна"
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                    </div>

                    {/* Кем приходится */}
                    <div>
                        <label className="block text-white text-sm mb-1">
                            Кем приходится ребёнку *
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                            {RELATION_OPTIONS.map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setRelation(opt.id)}
                                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs transition-all ${relation === opt.id
                                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                                            : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                                        }`}
                                >
                                    <span className="text-base mb-0.5">{opt.icon}</span>
                                    <span className="truncate w-full text-center">{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Кастомное значение */}
                        {relation === "other" && (
                            <input
                                type="text"
                                value={customRelation}
                                onChange={(e) => setCustomRelation(e.target.value)}
                                placeholder="Укажите кем приходится..."
                                className="mt-2 w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                            />
                        )}
                    </div>

                    {/* Телефон */}
                    <div>
                        <label className="block text-white text-sm mb-1">
                            Телефон (необязательно)
                        </label>
                        <div className="relative">
                            <Phone
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+7 (___) ___-__-__"
                                className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                            />
                        </div>
                    </div>

                    {/* Комментарий */}
                    <div>
                        <label className="block text-white text-sm mb-1">
                            Комментарий
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Например: доверенность до конца учебного года"
                            rows={2}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none text-sm"
                        />
                    </div>

                    {/* Инфо */}
                    <div className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/30">
                        <div className="flex items-start gap-2">
                            <Info size={12} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-cyan-300">
                                Доверенность будет закреплена за ребёнком. Если понадобится отозвать —
                                используйте кнопку «Отозвать» в списке.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Кнопки */}
                <div className="p-4 border-t border-white/10 bg-white/5 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all text-sm"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex-1 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            <>
                                <Shield size={16} />
                                Добавить
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
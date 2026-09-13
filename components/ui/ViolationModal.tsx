// components/ui/ViolationModal.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { X, AlertTriangle, Search, ChevronDown, Loader2, User, Clock } from "lucide-react";
import { VIOLATION_TYPES, getViolationType } from "@/lib/violations";

interface ViolationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

interface Student {
    aisId: string;
    name: string;
    className: string;
}

interface ExistingViolation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string | null;
    teacherName: string;
    date: string;
}

export default function ViolationModal({ isOpen, onClose, onSubmit }: ViolationModalProps) {
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [violationType, setViolationType] = useState("");
    const [comment, setComment] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Поиск студентов
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Student[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Существующие нарушения выбранного ученика за сегодня
    const [existingViolations, setExistingViolations] = useState<ExistingViolation[]>([]);
    const [isLoadingViolations, setIsLoadingViolations] = useState(false);

    // Сегодняшняя дата в формате YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    // Поиск студентов с debounce
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/students/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await response.json();
                setSearchResults(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Search error:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // 🔥 Загрузка существующих нарушений ученика за сегодня
    useEffect(() => {
        if (!selectedStudent) {
            setExistingViolations([]);
            return;
        }

        const fetchViolations = async () => {
            setIsLoadingViolations(true);
            try {
                const response = await fetch(
                    `/api/violations?studentId=${selectedStudent.aisId}&date=${today}`
                );
                const data = await response.json();
                setExistingViolations(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Error fetching violations:", error);
                setExistingViolations([]);
            } finally {
                setIsLoadingViolations(false);
            }
        };

        fetchViolations();
    }, [selectedStudent, today]);

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

    const handleSubmit = async () => {
        if (!selectedStudent) {
            alert("Выберите ученика");
            return;
        }
        if (!violationType) {
            alert("Выберите тип нарушения");
            return;
        }

        // 🔥 Проверка на дубликат
        const duplicate = existingViolations.find(v => v.violationType === violationType);
        if (duplicate) {
            const type = getViolationType(violationType);
            const confirmed = confirm(
                `⚠️ У ученика уже есть нарушение "${type.label}" сегодня.\n\nЗафиксировать ещё одно?`
            );
            if (!confirmed) return;
        }

        setIsLoading(true);

        try {
            await onSubmit({
                studentId: selectedStudent.aisId,
                studentName: selectedStudent.name,
                className: selectedStudent.className,
                violationType,
                comment,
            });

            resetForm();
            onClose();
        } catch (error) {
            console.error("Submit error:", error);
            alert("Ошибка при сохранении");
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedStudent(null);
        setViolationType("");
        setComment("");
        setSearchQuery("");
        setSearchResults([]);
        setExistingViolations([]);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
            <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Заголовок */}
                <div className="bg-gradient-to-r from-rose-600 to-orange-600 px-4 py-3 sticky top-0 z-10">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={18} className="text-white" />
                            <h3 className="text-lg font-bold text-white">Нарушение</h3>
                        </div>
                        <button onClick={handleClose} className="text-white/70 hover:text-white">
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
                                className="w-full flex items-center justify-between px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                            >
                                <span className={selectedStudent ? "text-white" : "text-gray-400"}>
                                    {selectedStudent ? (
                                        <span className="flex items-center gap-2">
                                            <User size={14} className="text-rose-400" />
                                            {selectedStudent.name}
                                            <span className="text-xs text-gray-400">({selectedStudent.className})</span>
                                        </span>
                                    ) : (
                                        "Начните вводить имя ученика..."
                                    )}
                                </span>
                                <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                            </button>

                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2332] border border-white/20 rounded-lg shadow-lg z-20 max-h-72 overflow-hidden">
                                    <div className="p-2 border-b border-white/10">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Поиск по фамилии или имени..."
                                                autoFocus
                                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto">
                                        {isSearching ? (
                                            <div className="flex items-center justify-center py-4 text-gray-400">
                                                <Loader2 size={16} className="animate-spin mr-2" />
                                                <span className="text-sm">Поиск...</span>
                                            </div>
                                        ) : searchQuery.length < 2 ? (
                                            <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                                Введите минимум 2 символа
                                            </div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                                Ничего не найдено
                                            </div>
                                        ) : (
                                            searchResults.map((student) => (
                                                <button
                                                    key={student.aisId}
                                                    onClick={() => {
                                                        setSelectedStudent(student);
                                                        setIsDropdownOpen(false);
                                                        setSearchQuery("");
                                                        setSearchResults([]);
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors flex items-center justify-between gap-2"
                                                >
                                                    <span className="text-white text-sm truncate">{student.name}</span>
                                                    <span className="text-xs text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                                                        {student.className}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 🔥 Существующие нарушения ученика за сегодня */}
                    {selectedStudent && (
                        <>
                            {isLoadingViolations ? (
                                <div className="flex items-center justify-center py-2 text-gray-400 text-xs">
                                    <Loader2 size={12} className="animate-spin mr-1" />
                                    Проверка нарушений...
                                </div>
                            ) : existingViolations.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={12} className="text-amber-400" />
                                        <span className="text-xs font-semibold text-amber-400">
                                            Уже зафиксировано сегодня ({existingViolations.length})
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {existingViolations.map((v) => {
                                            const type = getViolationType(v.violationType);
                                            return (
                                                <div
                                                    key={v.id}
                                                    className="flex items-start gap-2 p-2 bg-white/5 rounded-lg"
                                                >
                                                    <span className="text-sm flex-shrink-0">{type.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1">
                                                            <span className={`text-xs font-medium ${type.color}`}>
                                                                {type.label}
                                                            </span>
                                                        </div>
                                                        {v.comment && (
                                                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                                                                {v.comment}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <Clock size={9} className="text-gray-500" />
                                                            <span className="text-[10px] text-gray-500">
                                                                {new Date(v.date).toLocaleTimeString('ru-RU', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500">
                                                                · {v.teacherName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Тип нарушения */}
                    <div>
                        <label className="block text-white text-sm mb-1">Тип нарушения *</label>
                        <div className="grid grid-cols-2 gap-2">
                            {VIOLATION_TYPES.map((type) => {
                                const isDuplicate = existingViolations.some(v => v.violationType === type.id);
                                return (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setViolationType(type.id)}
                                        className={`relative flex items-center gap-2 p-2 rounded-lg text-xs transition-all text-left ${violationType === type.id
                                                ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/20"
                                                : "bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10"
                                            }`}
                                    >
                                        <span className="text-base">{type.icon}</span>
                                        <span className="truncate">{type.label}</span>
                                        {isDuplicate && (
                                            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" title="Уже зафиксировано сегодня" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Комментарий */}
                    <div>
                        <label className="block text-white text-sm mb-1">Комментарий</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Опишите подробности нарушения..."
                            rows={3}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none text-sm"
                        />
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
                        disabled={isLoading || !selectedStudent || !violationType}
                        className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={16} />
                                Зафиксировать
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
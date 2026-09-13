// app/admin/violations/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
    ArrowLeft, AlertTriangle, Search, Filter, Calendar,
    Download, Loader2, X, ChevronDown, ChevronUp,
    TrendingUp, User, FileText, BarChart3
} from "lucide-react";
import ViolationsList from "@/components/ui/ViolationsList";
import { VIOLATION_TYPES, getViolationType } from "@/lib/violations";

interface Violation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string | null;
    teacherName: string;
    date: string;
}

export default function AdminViolationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [violations, setViolations] = useState<Violation[]>([]);
    const [filteredViolations, setFilteredViolations] = useState<Violation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Фильтры
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [selectedType, setSelectedType] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Статистика
    const [stats, setStats] = useState({
        total: 0,
        byType: {} as Record<string, number>,
        byClass: {} as Record<string, number>,
        uniqueStudents: 0,
        uniqueClasses: 0,
    });

    // Проверка прав
    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) {
                router.replace("/");
            }
        }
    }, [session, status, router]);

    // Загрузка нарушений
    const fetchViolations = async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams({
                startDate,
                endDate,
            });

            const response = await fetch(`/api/violations?${params}`);
            const data = await response.json();

            setViolations(Array.isArray(data) ? data : []);
            setFilteredViolations(Array.isArray(data) ? data : []);

            // Подсчет статистики
            const byType: Record<string, number> = {};
            const byClass: Record<string, number> = {};
            const students = new Set<string>();

            (data as Violation[]).forEach(v => {
                byType[v.violationType] = (byType[v.violationType] || 0) + 1;
                if (v.className) {
                    byClass[v.className] = (byClass[v.className] || 0) + 1;
                }
                students.add(v.studentId);
            });

            setStats({
                total: data.length,
                byType,
                byClass,
                uniqueStudents: students.size,
                uniqueClasses: Object.keys(byClass).length,
            });

        } catch (error) {
            console.error("Error fetching violations:", error);
            setViolations([]);
            setFilteredViolations([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            fetchViolations();
        }
    }, [session, startDate, endDate]);

    // Фильтрация
    useEffect(() => {
        let result = [...violations];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(v =>
                v.studentName.toLowerCase().includes(query) ||
                v.teacherName?.toLowerCase().includes(query) ||
                v.comment?.toLowerCase().includes(query)
            );
        }

        if (selectedType) {
            result = result.filter(v => v.violationType === selectedType);
        }

        if (selectedClass) {
            result = result.filter(v => v.className === selectedClass);
        }

        setFilteredViolations(result);
    }, [violations, searchQuery, selectedType, selectedClass]);

    const handleDelete = async (id: string) => {
        if (!confirm("Удалить это нарушение?")) return;

        try {
            const response = await fetch(`/api/violations?id=${id}`, {
                method: "DELETE"
            });

            if (response.ok) {
                setViolations(prev => prev.filter(v => v.id !== id));
                alert("Нарушение удалено");
            }
        } catch (error) {
            console.error("Error deleting violation:", error);
            alert("Ошибка при удалении");
        }
    };

    const exportToExcel = () => {
        let html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Нарушения</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>⚠️ Нарушения</h1>
        <p>Период: ${new Date(startDate).toLocaleDateString('ru-RU')} - ${new Date(endDate).toLocaleDateString('ru-RU')}</p>
        <p>Всего: ${filteredViolations.length}</p>
        
        <table>
          <tr>
            <th>#</th>
            <th>Дата</th>
            <th>Ученик</th>
            <th>Класс</th>
            <th>Нарушение</th>
            <th>Комментарий</th>
            <th>Учитель</th>
          </tr>
    `;

        filteredViolations.forEach((v, i) => {
            const type = getViolationType(v.violationType);
            html += `
        <tr>
          <td>${i + 1}</td>
          <td>${new Date(v.date).toLocaleString('ru-RU')}</td>
          <td>${v.studentName}</td>
          <td>${v.className}</td>
          <td>${type.label}</td>
          <td>${v.comment || ''}</td>
          <td>${v.teacherName}</td>
        </tr>
      `;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `нарушения_${startDate}_${endDate}.xls`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const uniqueClasses = useMemo(() => {
        return [...new Set(violations.map(v => v.className).filter(Boolean))].sort();
    }, [violations]);

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto"></div>
                    <p className="mt-4 text-gray-300">Загрузка...</p>
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
            {/* Шапка */}
            <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-20">
                <div className="px-3 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push("/admin")}
                                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center">
                                <AlertTriangle size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Нарушения</p>
                                <p className="text-xs text-gray-400">Все нарушения</p>
                            </div>
                        </div>
                        <button
                            onClick={exportToExcel}
                            className="w-8 h-8 flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all"
                        >
                            <Download size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-3 max-w-7xl mx-auto">
                {/* Статистика */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] text-gray-400">Всего нарушений</p>
                        <p className="text-xl font-bold text-rose-400">{stats.total}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] text-gray-400">Учеников</p>
                        <p className="text-xl font-bold text-amber-400">{stats.uniqueStudents}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] text-gray-400">Классов</p>
                        <p className="text-xl font-bold text-blue-400">{stats.uniqueClasses}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] text-gray-400">Показано</p>
                        <p className="text-xl font-bold text-green-400">{filteredViolations.length}</p>
                    </div>
                </div>

                {/* Фильтры */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full flex items-center justify-between text-gray-300 hover:text-white transition-colors sm:hidden"
                    >
                        <div className="flex items-center gap-2">
                            <Filter size={16} />
                            <span className="text-sm font-medium">Фильтры</span>
                        </div>
                        {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    <div className={`${showFilters ? "block" : "hidden sm:block"} mt-2 sm:mt-0 space-y-3`}>
                        {/* Поиск */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Поиск по ученику, учителю, комментарию..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-rose-500/50"
                            />
                        </div>

                        {/* Даты и фильтры */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="relative">
                                <Calendar size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-8 pr-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500/50"
                                />
                            </div>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full pl-8 pr-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-rose-500/50"
                                />
                            </div>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="px-2 py-2 bg-[#1a2332] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            >
                                <option value="">Все классы</option>
                                {uniqueClasses.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="px-2 py-2 bg-[#1a2332] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                            >
                                <option value="">Все типы</option>
                                {VIOLATION_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>
                                        {type.icon} {type.shortLabel}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Быстрые фильтры по дате */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => {
                                    const today = new Date().toISOString().split('T')[0];
                                    setStartDate(today);
                                    setEndDate(today);
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-xs text-gray-300 rounded-lg border border-white/10"
                            >
                                Сегодня
                            </button>
                            <button
                                onClick={() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - 7);
                                    setStartDate(d.toISOString().split('T')[0]);
                                    setEndDate(new Date().toISOString().split('T')[0]);
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-xs text-gray-300 rounded-lg border border-white/10"
                            >
                                7 дней
                            </button>
                            <button
                                onClick={() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() - 30);
                                    setStartDate(d.toISOString().split('T')[0]);
                                    setEndDate(new Date().toISOString().split('T')[0]);
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-xs text-gray-300 rounded-lg border border-white/10"
                            >
                                30 дней
                            </button>
                            <button
                                onClick={() => {
                                    const d = new Date();
                                    d.setMonth(0, 1);
                                    setStartDate(d.toISOString().split('T')[0]);
                                    setEndDate(new Date().toISOString().split('T')[0]);
                                }}
                                className="px-2 py-1 bg-white/5 hover:bg-white/10 text-xs text-gray-300 rounded-lg border border-white/10"
                            >
                                С начала года
                            </button>
                        </div>
                    </div>
                </div>

                {/* Топ нарушений */}
                {Object.keys(stats.byType).length > 0 && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
                        <div className="flex items-center gap-2 mb-2">
                            <BarChart3 size={14} className="text-rose-400" />
                            <span className="text-xs font-medium text-gray-300">По типам нарушений</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {Object.entries(stats.byType)
                                .sort(([, a], [, b]) => b - a)
                                .map(([typeId, count]) => {
                                    const type = getViolationType(typeId);
                                    return (
                                        <button
                                            key={typeId}
                                            onClick={() => setSelectedType(selectedType === typeId ? "" : typeId)}
                                            className={`px-2 py-1 rounded-lg text-xs transition-all ${selectedType === typeId
                                                    ? "bg-rose-500/30 text-rose-200 border border-rose-500/50"
                                                    : `${type.bgColor} ${type.color} hover:opacity-80`
                                                }`}
                                        >
                                            {type.icon} {type.shortLabel}: <span className="font-bold">{count}</span>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {/* Список нарушений */}
                <ViolationsList
                    violations={filteredViolations}
                    isLoading={isLoading}
                    onDelete={handleDelete}
                    showClassName={true}
                    showTeacher={true}
                    emptyMessage="Нарушений за выбранный период нет"
                />
            </div>
        </div>
    );
}
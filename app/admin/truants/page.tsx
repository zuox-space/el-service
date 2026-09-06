"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    LogOut, ArrowLeft, UserX, Download, Search, Filter, Calendar,
    SortAsc, SortDesc, ChevronDown, ChevronUp, School, PieChart
} from "lucide-react";
import React from "react";

// ============ ТИПЫ ============

interface TruantStudent {
    id: number;
    name: string;
    className: string;
    grade: number;
    totalAbsences: number;
    absences: {
        date: string;
        reason: string;
        className: string;
        classId: string;
    }[];
    reasons: Record<string, number>;
    _meta?: {
        uniqueClasses?: string[];
    };
}

interface ApiResponse {
    success: boolean;
    truants: TruantStudent[];
    stats: {
        totalTruants: number;
        totalAbsences: number;
        period: { start: string; end: string };
        byReason: Record<string, number>;
    };
    meta: {
        source: string;
        attendanceRecords: number;
        studentsInMySQL: number;
        studentsWithAbsences: number;
    };
}

interface GradeGroup {
    id: string;
    name: string;
    grades: number[];
}

// ============ КОНСТАНТЫ ============

const absenceReasons = [
    { id: "sick", label: "Болен", icon: "🤒", color: "text-red-400" },
    { id: "family", label: "Заявление родителей", icon: "📝", color: "text-orange-400" },
    { id: "other", label: "Без уважительной причины", icon: "⚠️", color: "text-yellow-400" },
    { id: "vacation", label: "Отпуск/каникулы", icon: "✈️", color: "text-blue-400" },
    { id: "competition", label: "Соревнования", icon: "🏆", color: "text-purple-400" },
];

const gradeGroups: GradeGroup[] = [
    { id: "1-3", name: "Начальная школа (1-3)", grades: [1, 2, 3] },
    { id: "4-6", name: "Средняя школа (4-6)", grades: [4, 5, 6] },
    { id: "7-9", name: "Старшая школа (7-9)", grades: [7, 8, 9] },
    { id: "10-11", name: "Выпускные классы (10-11)", grades: [10, 11] },
];

const alphabet = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

// ============ КОМПОНЕНТ ============

export default function TruantsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [truants, setTruants] = useState<TruantStudent[]>([]);
    const [filteredTruants, setFilteredTruants] = useState<TruantStudent[]>([]);
    const [stats, setStats] = useState<ApiResponse['stats'] | null>(null);
    const [meta, setMeta] = useState<ApiResponse['meta'] | null>(null);
    const [classes, setClasses] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGradeGroup, setSelectedGradeGroup] = useState<string>("");
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedLetter, setSelectedLetter] = useState<string>("");
    const [minAbsences, setMinAbsences] = useState<number>(1);
    const [selectedReasons, setSelectedReasons] = useState<string[]>(
        absenceReasons.map(r => r.id)
    );
    const [showFilters, setShowFilters] = useState(false);

    const [sortField, setSortField] = useState<"name" | "totalAbsences" | "className">("totalAbsences");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [expandedStudent, setExpandedStudent] = useState<number | null>(null);

    // 🔥 ДАТЫ - ИСПРАВЛЕНО
    const today = new Date().toISOString().split('T')[0];



    // Используем одну и ту же дату для начала и конца
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);

    // Или используем useMemo для вычисления один раз
    const [dates, setDates] = useState(() => {
        const today = new Date().toISOString().split('T')[0];
        return { startDate: today, endDate: today };
    });

    // ============ ХУКИ ============

    useEffect(() => {
        setMounted(true);
    }, []);

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

    // 🔥 ЗАГРУЗКА ДАННЫХ - ИСПРАВЛЕНО
    useEffect(() => {
        const fetchTruants = async () => {
            try {
                setIsLoading(true);

                // Передаем даты в формате YYYY-MM-DD без преобразований
                const startStr = startDate;
                const endStr = endDate;

                console.log('📅 Fetching truants:', { start: startStr, end: endStr });

                const response = await fetch(
                    `/api/admin/truants?startDate=${startStr}&endDate=${endStr}`
                );

                const data: ApiResponse = await response.json();

                if (!data.success) {
                    console.error("Error:", data);
                    return;
                }

                setTruants(data.truants || []);
                setStats(data.stats || null);
                setMeta(data.meta || null);
                setFilteredTruants(data.truants || []);

                const classSet = new Set<string>();
                (data.truants || []).forEach((student: TruantStudent) => {
                    if (student.className) {
                        classSet.add(student.className);
                    }
                });
                setClasses(Array.from(classSet).sort());

            } catch (error) {
                console.error("Error fetching truants:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (session && session?.user?.roles?.includes("ADMIN")) {
            fetchTruants();
        }
    }, [session, startDate, endDate]);

    // Фильтрация и сортировка
    useEffect(() => {
        let result = [...truants];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(student =>
                student.name.toLowerCase().includes(query)
            );
        }

        if (selectedGradeGroup) {
            const group = gradeGroups.find(g => g.id === selectedGradeGroup);
            if (group) {
                result = result.filter(student => group.grades.includes(student.grade));
            }
        }

        if (selectedClass) {
            result = result.filter(student => student.className === selectedClass);
        }

        if (selectedLetter) {
            result = result.filter(student =>
                student.name.charAt(0).toUpperCase() === selectedLetter
            );
        }

        result = result.filter(student => student.totalAbsences >= minAbsences);

        if (selectedReasons.length === 0) {
            result = [];
        } else {
            result = result.filter(student => {
                return student.absences.some(absence => selectedReasons.includes(absence.reason));
            });
        }

        result.sort((a, b) => {
            let compareA: string | number;
            let compareB: string | number;

            switch (sortField) {
                case "name":
                    compareA = a.name;
                    compareB = b.name;
                    break;
                case "totalAbsences":
                    compareA = a.totalAbsences;
                    compareB = b.totalAbsences;
                    break;
                case "className":
                    compareA = a.className;
                    compareB = b.className;
                    break;
                default:
                    compareA = a.totalAbsences;
                    compareB = b.totalAbsences;
            }

            if (typeof compareA === "string" && typeof compareB === "string") {
                return sortOrder === "asc"
                    ? compareA.localeCompare(compareB)
                    : compareB.localeCompare(compareA);
            }

            if (typeof compareA === "number" && typeof compareB === "number") {
                return sortOrder === "asc" ? compareA - compareB : compareB - compareA;
            }

            return 0;
        });

        setFilteredTruants(result);
    }, [truants, searchQuery, selectedGradeGroup, selectedClass, selectedLetter, minAbsences, selectedReasons, sortField, sortOrder]);

    // ============ ФУНКЦИИ ============

    const toggleSort = (field: "name" | "totalAbsences" | "className") => {
        if (sortField === field) {
            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

    const getSortIcon = (field: "name" | "totalAbsences" | "className") => {
        if (sortField !== field) return null;
        return sortOrder === "asc" ? <SortAsc size={14} /> : <SortDesc size={14} />;
    };

    const toggleExpand = (studentId: number) => {
        setExpandedStudent(expandedStudent === studentId ? null : studentId);
    };

    const handleLogout = async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/login");
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    };

    const formatDateShort = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    };

    const toggleReason = (reasonId: string) => {
        setSelectedReasons(prev =>
            prev.includes(reasonId)
                ? prev.filter(id => id !== reasonId)
                : [...prev, reasonId]
        );
    };

    const selectAllReasons = () => {
        setSelectedReasons(absenceReasons.map(r => r.id));
    };

    const deselectAllReasons = () => {
        setSelectedReasons([]);
    };

    const getReasonLabel = (reasonId: string) => {
        const reason = absenceReasons.find(r => r.id === reasonId);
        return reason ? `${reason.icon} ${reason.label}` : reasonId;
    };

    const getReasonColor = (reasonId: string) => {
        const reason = absenceReasons.find(r => r.id === reasonId);
        return reason?.color || "text-gray-400";
    };



    const exportToExcel = () => {
        let html = `
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Прогульщики</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            h2 { color: #555; margin-top: 20px; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .total { font-weight: bold; color: #e74c3c; }
            .meta { color: #666; font-size: 12px; margin-top: 10px; }
            .stats-grid { display: flex; gap: 20px; margin: 10px 0; }
            .stat-box { background: #f5f5f5; padding: 10px 15px; border-radius: 4px; }
            .stat-label { font-size: 12px; color: #666; }
            .stat-value { font-size: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>📊 Прогульщики</h1>
          <p>Период: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
          <p>Фильтр: от ${minAbsences} пропусков</p>
          
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-label">Всего учеников</div>
              <div class="stat-value">${truants.length}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">С пропусками</div>
              <div class="stat-value">${filteredTruants.length}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Всего пропусков</div>
              <div class="stat-value">${filteredTruants.reduce((sum, s) => sum + s.totalAbsences, 0)}</div>
            </div>
          </div>

          <h2>Список учеников</h2>
          <table>
            <tr>
              <th>#</th>
              <th>Ученик</th>
              <th>Класс</th>
              <th>Пропусков</th>
              <th>Причины</th>
            </tr>
        `;

        filteredTruants.forEach((student, index) => {
            const reasonsStr = Object.entries(student.reasons || {})
                .map(([reason, count]) => `${getReasonLabel(reason)}: ${count}`)
                .join(", ");

            html += `
            <tr>
              <td>${index + 1}</td>
              <td>${student.name}</td>
              <td>${student.className}</td>
              <td class="total">${student.totalAbsences}</td>
              <td>${reasonsStr}</td>
            </tr>
          `;
        });

        html += `
          </table>
        </body>
        </html>
        `;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `прогульщики_${new Date().toISOString().split("T")[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ============ РЕНДЕР ============

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-gray-300">Загрузка данных...</p>
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) {
        return null;
    }

    const totalAbsences = filteredTruants.reduce((sum, s) => sum + s.totalAbsences, 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
            {/* Шапка */}
            <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-20">
                <div className="px-3 sm:px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => router.push("/admin")}
                                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                                <UserX size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Прогульщики</p>
                                <p className="text-xs text-gray-400 hidden sm:block">Статистика пропусков</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {meta && (
                                <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-lg">
                                    <span className="text-[10px] text-green-400">
                                        📊 {meta.studentsWithAbsences} учеников
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={exportToExcel}
                                className="w-8 h-8 flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all"
                            >
                                <Download size={16} />
                            </button>
                            <button
                                onClick={handleLogout}
                                className="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 sm:p-4 max-w-7xl mx-auto">
                {/* Статистика */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] sm:text-xs text-gray-400">Всего учеников</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{truants.length}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] sm:text-xs text-gray-400">С пропусками</p>
                        <p className="text-lg sm:text-2xl font-bold text-yellow-400">
                            {filteredTruants.length}
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] sm:text-xs text-gray-400">Всего пропусков</p>
                        <p className="text-lg sm:text-2xl font-bold text-orange-400">
                            {totalAbsences}
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <p className="text-[10px] sm:text-xs text-gray-400">Среднее</p>
                        <p className="text-lg sm:text-2xl font-bold text-blue-400">
                            {filteredTruants.length > 0
                                ? (totalAbsences / filteredTruants.length).toFixed(1)
                                : '0'
                            }
                        </p>
                    </div>
                </div>

                {/* Фильтры */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3 sm:mb-4">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full flex items-center justify-between sm:hidden text-gray-300 hover:text-white transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Filter size={16} />
                            <span className="text-sm font-medium">Фильтры</span>
                            <span className="text-xs text-gray-400">
                                ({filteredTruants.length} учеников)
                            </span>
                        </div>
                        <ChevronDown
                            size={18}
                            className={`transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`}
                        />
                    </button>

                    <div className={`${showFilters ? "block" : "hidden sm:block"} mt-2 sm:mt-0`}>
                        <div className="flex flex-col gap-3">
                            {/* Поиск и даты */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Поиск по фамилии..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <div className="relative flex-1 sm:flex-none">
                                        <Calendar size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full sm:w-36 pl-8 pr-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <span className="text-gray-400 self-center hidden sm:inline">—</span>
                                    <div className="relative flex-1 sm:flex-none">
                                        <Calendar size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full sm:w-36 pl-8 pr-2 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Фильтры */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                                <div className="flex items-center gap-2">
                                    <School size={14} className="text-blue-400 hidden sm:block" />
                                    <span className="text-xs text-gray-300">Параллель:</span>
                                    <select
                                        value={selectedGradeGroup}
                                        onChange={(e) => {
                                            setSelectedGradeGroup(e.target.value);
                                            setSelectedClass("");
                                        }}
                                        className="px-2 py-1 bg-[#1a2332] border border-white/20 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="" className="bg-[#1a2332]">Все</option>
                                        {gradeGroups.map((group) => (
                                            <option key={group.id} value={group.id} className="bg-[#1a2332]">
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {classes.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-300 hidden sm:inline">Класс:</span>
                                        <select
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            className="px-2 py-1 bg-[#1a2332] border border-white/20 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="" className="bg-[#1a2332]">Все</option>
                                            {classes.map((cls) => (
                                                <option key={cls} value={cls} className="bg-[#1a2332]">
                                                    {cls}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-300">От:</span>
                                    <select
                                        value={minAbsences}
                                        onChange={(e) => setMinAbsences(Number(e.target.value))}
                                        className="px-2 py-1 bg-[#1a2332] border border-white/20 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value={1} className="bg-[#1a2332] text-white">1</option>
                                        <option value={2} className="bg-[#1a2332] text-white">2</option>
                                        <option value={3} className="bg-[#1a2332] text-white">3</option>
                                        <option value={4} className="bg-[#1a2332] text-white">4</option>
                                        <option value={5} className="bg-[#1a2332] text-white">5</option>
                                        <option value={10} className="bg-[#1a2332] text-white">10</option>
                                        <option value={15} className="bg-[#1a2332] text-white">15</option>
                                        <option value={20} className="bg-[#1a2332] text-white">20</option>
                                    </select>
                                    <span className="text-xs text-gray-400 hidden sm:inline">пропусков</span>
                                </div>
                            </div>

                            {/* Фильтр по причинам */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                                <span className="text-xs text-gray-300">Причины:</span>
                                <button
                                    onClick={selectAllReasons}
                                    className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded bg-blue-500/20"
                                >
                                    Все
                                </button>
                                <button
                                    onClick={deselectAllReasons}
                                    className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded bg-white/10"
                                >
                                    Сбросить
                                </button>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                                    {absenceReasons.map((reason) => (
                                        <label
                                            key={reason.id}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer transition-all ${selectedReasons.includes(reason.id)
                                                ? "bg-white/20 text-white"
                                                : "bg-white/5 text-gray-500"
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedReasons.includes(reason.id)}
                                                onChange={() => toggleReason(reason.id)}
                                                className="w-3 h-3 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 flex-shrink-0"
                                            />
                                            <span className="text-sm sm:text-xs">{reason.icon}</span>
                                            <span className="text-[11px] sm:text-xs whitespace-nowrap">{reason.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Буквы */}
                            <div className="flex flex-wrap gap-1 pt-2 border-t border-white/10">
                                <span className="text-xs text-gray-300 mr-1">А-Я:</span>
                                <button
                                    onClick={() => setSelectedLetter("")}
                                    className={`px-1.5 py-0.5 rounded text-xs transition-all ${!selectedLetter
                                        ? "bg-blue-500/30 text-blue-300"
                                        : "text-gray-400 hover:text-white"
                                        }`}
                                >
                                    Все
                                </button>
                                {alphabet.map((letter) => (
                                    <button
                                        key={letter}
                                        onClick={() => setSelectedLetter(selectedLetter === letter ? "" : letter)}
                                        className={`px-1.5 py-0.5 rounded text-xs transition-all ${selectedLetter === letter
                                            ? "bg-blue-500/30 text-blue-300"
                                            : "text-gray-400 hover:text-white"
                                            }`}
                                    >
                                        {letter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Статистика по причинам */}
                {stats?.byReason && Object.keys(stats.byReason).length > 0 && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <PieChart size={16} className="text-blue-400" />
                            <span className="text-xs font-medium text-gray-300">Статистика по причинам</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(stats.byReason).map(([reason, count]) => (
                                <div
                                    key={reason}
                                    className={`px-2 py-1 rounded-lg text-xs ${getReasonColor(reason)} bg-white/5`}
                                >
                                    {getReasonLabel(reason)}: <span className="font-bold">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Таблица */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        #
                                    </th>
                                    <th
                                        className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                                        onClick={() => toggleSort("name")}
                                    >
                                        <div className="flex items-center gap-1">
                                            Ученик {getSortIcon("name")}
                                        </div>
                                    </th>
                                    <th
                                        className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white hidden sm:table-cell"
                                        onClick={() => toggleSort("className")}
                                    >
                                        <div className="flex items-center gap-1">
                                            Класс {getSortIcon("className")}
                                        </div>
                                    </th>
                                    <th
                                        className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
                                        onClick={() => toggleSort("totalAbsences")}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            <span className="hidden sm:inline">Пропусков</span>
                                            <span className="sm:hidden">Проп.</span>
                                            {getSortIcon("totalAbsences")}
                                        </div>
                                    </th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                                        Причины
                                    </th>
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Детали
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredTruants.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                            <UserX size={32} className="mx-auto mb-2 text-gray-500" />
                                            Нет учеников с пропусками
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTruants.map((student, index) => {
                                        return (
                                            <React.Fragment key={student.id}>
                                                <tr
                                                    className="hover:bg-white/5 transition-colors cursor-pointer"
                                                    onClick={() => toggleExpand(student.id)}
                                                >
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-400">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white font-medium">
                                                        <div className="flex items-center gap-1 sm:gap-2">
                                                            <span className="truncate max-w-[80px] sm:max-w-none">
                                                                {student.name}
                                                            </span>

                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-300 hidden sm:table-cell">
                                                        {student.className}
                                                        {student._meta?.uniqueClasses && student._meta.uniqueClasses.length > 1 && (
                                                            <span className="text-[10px] text-gray-500 ml-1">
                                                                (был в {student._meta.uniqueClasses.length} классах)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-center">

                                                    </td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm hidden sm:table-cell">
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(student.reasons || {}).map(([reason, count]) => (
                                                                <span
                                                                    key={reason}
                                                                    className={`text-[10px] ${getReasonColor(reason)} bg-white/5 px-1.5 py-0.5 rounded`}
                                                                >
                                                                    {count}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                                                        <button className="text-gray-400 hover:text-white">
                                                            {expandedStudent === student.id ? (
                                                                <ChevronUp size={16} className="sm:w-4 sm:h-4" />
                                                            ) : (
                                                                <ChevronDown size={16} className="sm:w-4 sm:h-4" />
                                                            )}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {expandedStudent === student.id && (
                                                    <tr>
                                                        <td colSpan={6} className="px-2 sm:px-4 py-2 sm:py-3 bg-white/5">
                                                            <div className="space-y-2">
                                                                <div className="flex flex-wrap gap-3 text-[10px] sm:text-xs">
                                                                    <span className="text-gray-400">
                                                                        Класс: <span className="text-white">{student.className}</span>
                                                                    </span>
                                                                    {student._meta?.uniqueClasses && student._meta.uniqueClasses.length > 1 && (
                                                                        <span className="text-gray-400">
                                                                            Был в классах: <span className="text-white">
                                                                                {student._meta.uniqueClasses.join(", ")}
                                                                            </span>
                                                                        </span>
                                                                    )}
                                                                    <span className="text-gray-400">
                                                                        Всего пропусков: <span className="text-orange-400 font-bold">
                                                                            {student.totalAbsences}
                                                                        </span>
                                                                    </span>
                                                                </div>

                                                                <div className="text-[10px] sm:text-xs font-semibold text-gray-400">
                                                                    История пропусков ({student.absences.length}):
                                                                </div>
                                                                {student.absences.length === 0 ? (
                                                                    <div className="text-xs sm:text-sm text-gray-500">Нет деталей</div>
                                                                ) : (
                                                                    <div className="space-y-1 max-h-40 sm:max-h-60 overflow-y-auto">
                                                                        {student.absences.map((absence, idx) => {
                                                                            const reason = absenceReasons.find(r => r.id === absence.reason);
                                                                            return (
                                                                                <div
                                                                                    key={`${student.id}-absence-${idx}`}
                                                                                    className="flex flex-col xs:flex-row xs:items-center justify-between gap-1 xs:gap-2 p-2 bg-white/5 rounded-lg text-xs sm:text-sm"
                                                                                >
                                                                                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                                                                        <span className="text-gray-400 text-[10px] sm:text-xs">
                                                                                            {formatDateShort(absence.date)}
                                                                                        </span>
                                                                                        <span className="text-red-400 text-[10px] sm:text-xs">
                                                                                            Отсутствие
                                                                                        </span>
                                                                                        <span className="text-gray-500 text-[10px] sm:text-xs">
                                                                                            {absence.className}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className={`text-[10px] sm:text-xs font-medium ${reason?.color || "text-gray-400"}`}>
                                                                                        {reason ? `${reason.icon} ${reason.label}` : absence.reason}
                                                                                    </span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Meta-информация */}
                {/* {meta && (
                    <div className="mt-3 text-[10px] text-gray-500 text-center">
                        Источник данных: {meta.source} |
                        Записей посещаемости: {meta.attendanceRecords} |
                        Всего студентов в базе: {meta.studentsInMySQL} |
                        Учеников с пропусками: {meta.studentsWithAbsences}
                    </div>
                )} */}
            </div>
        </div>
    );
}
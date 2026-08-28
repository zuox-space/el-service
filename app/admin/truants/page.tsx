"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    LogOut, ArrowLeft, Users, UserX, AlertCircle,
    Download, Search, Filter, Calendar, Clock,
    SortAsc, SortDesc, Eye, ChevronDown, ChevronUp,
    School, User, CalendarDays, FileText, X, ChevronRight
} from "lucide-react";
import React from "react";

interface TruantStudent {
    id: number;
    name: string;
    className: string;
    grade: number;
    totalAbsences: number;
    absences: {
        date: string;
        reason: string;
        type: "attendance";
    }[];
}

interface GradeGroup {
    id: string;
    name: string;
    grades: number[];
}

const absenceReasons = [
    { id: "sick", label: "Болен", icon: "🤒", color: "text-red-400", respectful: true },
    { id: "family", label: "Заявление родителей", icon: "📝", color: "text-orange-400", respectful: false },
    { id: "other", label: "Без уважительной причины", icon: "⚠️", color: "text-yellow-400", respectful: false },
    { id: "vacation", label: "Отпуск/каникулы", icon: "✈️", color: "text-blue-400", respectful: false },
    { id: "competition", label: "Соревнования", icon: "🏆", color: "text-purple-400", respectful: true },
];

export default function TruantsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [truants, setTruants] = useState<TruantStudent[]>([]);
    const [filteredTruants, setFilteredTruants] = useState<TruantStudent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGradeGroup, setSelectedGradeGroup] = useState<string>("");
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [selectedLetter, setSelectedLetter] = useState<string>("");
    const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
    const [sortField, setSortField] = useState<"name" | "totalAbsences" | "className">("totalAbsences");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [classes, setClasses] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    // Даты
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Фильтр по количеству пропусков (от)
    const [minAbsences, setMinAbsences] = useState<number>(1);

    // Фильтр по причинам (чеклист)
    const [selectedReasons, setSelectedReasons] = useState<string[]>(
        absenceReasons.map(r => r.id)
    );

    // Группы классов
    const gradeGroups: GradeGroup[] = [
        { id: "1-3", name: "Начальная школа (1-3)", grades: [1, 2, 3] },
        { id: "4-6", name: "Средняя школа (4-6)", grades: [4, 5, 6] },
        { id: "7-9", name: "Старшая школа (7-9)", grades: [7, 8, 9] },
        { id: "10-11", name: "Выпускные классы (10-11)", grades: [10, 11] },
    ];

    // Алфавит
    const alphabet = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

    useEffect(() => {
        setMounted(true);
    }, []);

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

    // Загрузка данных
    useEffect(() => {
        const fetchTruants = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(
                    `/api/admin/truants?startDate=${new Date(startDate).toISOString()}&endDate=${new Date(endDate).toISOString()}`
                );
                const data = await response.json();
                if (data.error) {
                    console.error("Error:", data.error);
                    return;
                }

                const truantsData = data.truants || [];
                setTruants(truantsData);
                setFilteredTruants(truantsData);

                const classSet = new Set<string>();
                truantsData.forEach((student: TruantStudent) => {
                    if (student.className) {
                        classSet.add(student.className);
                    }
                });
                const classList = Array.from(classSet).sort();
                setClasses(classList);
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

    const exportToExcel = () => {
        let html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Прогульщики</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .total { font-weight: bold; color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>Прогульщики</h1>
        <p>Период: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
        <p>Фильтр: от ${minAbsences} пропусков</p>
        <p>Всего учеников: ${filteredTruants.length}</p>
        
        <table>
          <tr>
            <th>#</th>
            <th>Ученик</th>
            <th>Класс</th>
            <th>Пропусков</th>
          </tr>
    `;

        filteredTruants.forEach((student, index) => {
            html += `
        <tr>
          <td>${index + 1}</td>
          <td>${student.name}</td>
          <td>${student.className}</td>
          <td class="total">${student.totalAbsences}</td>
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
                        <div className="flex gap-1">
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
                {/* Статистика - адаптивная */}


                {/* Фильтры - мобильная версия со сворачиванием */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3 sm:mb-4">
                    {/* Кнопка показа/скрытия фильтров на мобильных */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full flex items-center justify-between sm:hidden text-gray-300 hover:text-white transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Filter size={16} />
                            <span className="text-sm font-medium">Фильтры</span>
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

                        </div>
                    </div>
                </div>

                {/* Таблица - адаптивная */}
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
                                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">
                                        Детали
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredTruants.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                            <UserX size={32} className="mx-auto mb-2 text-gray-500" />
                                            Нет учеников с пропусками
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTruants.map((student, index) => (
                                        <React.Fragment key={student.id}>
                                            <tr
                                                className="hover:bg-white/5 transition-colors cursor-pointer"
                                                onClick={() => toggleExpand(student.id)}
                                            >
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-400">{index + 1}</td>
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white font-medium">
                                                    <div className="flex items-center gap-1 sm:gap-2">
                                                        <span className="truncate max-w-[80px] sm:max-w-none">{student.name}</span>
                                                        {student.totalAbsences >= 10 && (
                                                            <span className="text-[10px] bg-red-500/20 text-red-300 px-1 py-0.5 rounded-full flex-shrink-0">
                                                                ⚠️
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-300 hidden sm:table-cell">
                                                    {student.className}
                                                </td>
                                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-center">
                                                    <span className={`font-bold text-sm sm:text-base ${student.totalAbsences >= 10
                                                        ? "text-red-400"
                                                        : student.totalAbsences >= 5
                                                            ? "text-orange-400"
                                                            : "text-yellow-400"
                                                        }`}>
                                                        {student.totalAbsences}
                                                    </span>
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
                                                    <td colSpan={5} className="px-2 sm:px-4 py-2 sm:py-3 bg-white/5">
                                                        <div className="space-y-2">
                                                            <div className="text-[10px] sm:text-xs font-semibold text-gray-400 mb-2">
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
                                                                                <div className="flex items-center gap-2 sm:gap-3">
                                                                                    <span className="text-gray-400 text-[10px] sm:text-xs">
                                                                                        {formatDate(absence.date)}
                                                                                    </span>
                                                                                    <span className="text-red-400 text-[10px] sm:text-xs">
                                                                                        Отсутствие
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
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
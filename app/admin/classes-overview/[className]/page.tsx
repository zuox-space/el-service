// app/admin/classes-overview/[className]/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
    ArrowLeft, School, User, Users, Shield, UserCheck,
    Search, Loader2, CheckCircle, XCircle, Calendar,
    Phone, AlertCircle, Download, Clock, Eye
} from "lucide-react";

interface StudentRow {
    aisId: string;
    name: string;
    className: string;
    hasActiveSelfExit: boolean;
    activeSelfExit: any;
    selfExitsCount: number;
    hasActiveAuthorization: boolean;
    authorizationsCount: number;
    authorizations: any[];
    totalAuthorizationsCount: number;
}

export default function ClassDetailsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const rawClassName = params?.className as string;

    // Безопасно декодируем (если уже декодировано — не сломает)
    const className = (() => {
        try {
            // Проверяем, есть ли в строке %XX
            if (rawClassName && /%[0-9A-Fa-f]{2}/.test(rawClassName)) {
                return decodeURIComponent(rawClassName);
            }
            return rawClassName;
        } catch (e) {
            console.error('Error decoding className:', e);
            return rawClassName;
        }
    })();

    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "selfExit" | "auth" | "none">("all");
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") {
            router.replace("/login");
        }
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) {
                router.replace("/");
            }
        }
    }, [session, status, router]);

    useEffect(() => {
        if (!className || !session?.user?.roles?.includes("ADMIN")) return;

        const fetchData = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(
                    `/api/admin/classes-stats/${encodeURIComponent(className)}`
                );
                const result = await response.json();

                if (result.error) {
                    console.error("Error:", result.error);
                    setData(null);
                    return;
                }

                setData(result);
            } catch (error) {
                console.error("Error fetching class details:", error);
                setData(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [className, session]);

    // Фильтрация
    const filteredStudents = useMemo(() => {
        if (!data?.students) return [];

        let result = [...data.students];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter((s: StudentRow) =>
                s.name.toLowerCase().includes(q)
            );
        }

        if (filter === "selfExit") {
            result = result.filter((s: StudentRow) => s.hasActiveSelfExit);
        } else if (filter === "auth") {
            result = result.filter((s: StudentRow) => s.hasActiveAuthorization);
        } else if (filter === "none") {
            result = result.filter((s: StudentRow) =>
                !s.hasActiveSelfExit && !s.hasActiveAuthorization
            );
        }

        return result;
    }, [data, searchQuery, filter]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const exportToExcel = () => {
        if (!data) return;

        let html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${className} — Разрешения</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Класс ${className}</h1>
        <p>Всего учеников: ${data.stats.totalStudents}</p>
        <p>Самовыводы: ${data.stats.activeSelfExits}</p>
        <p>Доверенности: ${data.stats.activeAuthorizations}</p>
        
        <table>
          <tr>
            <th>#</th>
            <th>Ученик</th>
            <th>Самовывод</th>
            <th>Доверенности</th>
          </tr>
    `;

        filteredStudents.forEach((s: StudentRow, i: number) => {
            html += `
        <tr>
          <td>${i + 1}</td>
          <td>${s.name}</td>
          <td>${s.hasActiveSelfExit ? 'Да (' + formatDate(s.activeSelfExit?.startDate) + ' — ' + formatDate(s.activeSelfExit?.endDate) + ')' : 'Нет'}</td>
          <td>${s.hasActiveAuthorization ? s.authorizations.map((a: any) => a.trustedName).join(', ') : 'Нет'}</td>
        </tr>
      `;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `класс_${className}_${new Date().toISOString().split('T')[0]}.xls`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
                    <Loader2 size={32} className="animate-spin text-cyan-400 mx-auto" />
                    <p className="mt-4 text-gray-300">Загрузка...</p>
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) {
        return null;
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858] p-4">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20 max-w-md">
                    <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Класс не найден</h2>
                    <button
                        onClick={() => router.push("/admin/classes-overview")}
                        className="mt-4 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm transition-all"
                    >
                        Вернуться к списку
                    </button>
                </div>
            </div>
        );
    }

    const { class: classData, stats } = data;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
            {/* Шапка */}
            <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-20">
                <div className="px-3 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                                onClick={() => router.push("/admin/classes-overview")}
                                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex-shrink-0"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                <School size={16} className="text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">
                                    Класс {classData.name}
                                </p>
                                <p className="text-xs text-gray-400 hidden sm:block truncate">
                                    {classData.owner?.name || "Классный руководитель не назначен"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={exportToExcel}
                            className="w-8 h-8 flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all flex-shrink-0"
                            title="Экспорт в Excel"
                        >
                            <Download size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-3 max-w-7xl mx-auto space-y-3">

                {/* 🔥 Статистика класса */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Users size={12} className="text-blue-400" />
                            <span className="text-[10px] text-gray-400">Всего</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-400">{stats.totalStudents}</p>
                        <p className="text-[10px] text-gray-500">учеников</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-indigo-500/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <UserCheck size={12} className="text-indigo-400" />
                            <span className="text-[10px] text-gray-400">Самовыводы</span>
                        </div>
                        <p className="text-2xl font-bold text-indigo-400">{stats.activeSelfExits}</p>
                        <p className="text-[10px] text-gray-500">
                            {stats.studentsWithSelfExit} учеников
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-cyan-500/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Shield size={12} className="text-cyan-400" />
                            <span className="text-[10px] text-gray-400">Доверенности</span>
                        </div>
                        <p className="text-2xl font-bold text-cyan-400">{stats.activeAuthorizations}</p>
                        <p className="text-[10px] text-gray-500">
                            {stats.studentsWithAuth} учеников
                        </p>
                    </div>


                </div>

                {/* Фильтры */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 space-y-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Поиск ученика..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>

                    <div className="flex flex-wrap gap-1">
                        {[
                            { id: "all", label: "Все", count: stats.totalStudents, color: "blue" },
                            { id: "selfExit", label: "Самовывод", count: stats.studentsWithSelfExit, color: "indigo" },
                            { id: "auth", label: "Доверенность", count: stats.studentsWithAuth, color: "cyan" },
                        ].map((f: any) => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f.id
                                    ? `bg-${f.color}-500/30 text-${f.color}-300 border border-${f.color}-500/50`
                                    : "bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent"
                                    }`}
                                style={
                                    filter === f.id
                                        ? { backgroundColor: `${f.color === 'blue' ? '#3b82f6' : f.color === 'indigo' ? '#6366f1' : f.color === 'cyan' ? '#06b6d4' : '#22c55e'}33` }
                                        : {}
                                }
                            >
                                {f.label}
                                <span className="text-[10px] opacity-70">({f.count})</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 🔥 Таблица учеников */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5">
                                <tr>
                                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                        #
                                    </th>
                                    <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                        ФИО
                                    </th>
                                    <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                        Самовывод
                                    </th>
                                    <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                        Доверенности
                                    </th>

                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                                            <User size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">Ученики не найдены</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((s: StudentRow, idx: number) => {
                                        const isExpanded = expandedStudent === s.aisId;
                                        const hasAnyPermission = s.hasActiveSelfExit || s.hasActiveAuthorization;

                                        return (
                                            <>
                                                <tr
                                                    key={s.aisId}
                                                    className="hover:bg-white/5 transition-colors cursor-pointer"
                                                    onClick={() =>
                                                        setExpandedStudent(isExpanded ? null : s.aisId)
                                                    }
                                                >
                                                    <td className="px-3 py-2 text-xs text-gray-400">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-white font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                                                {s.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="truncate">{s.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {s.hasActiveSelfExit ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                                                <CheckCircle size={9} />
                                                                Да
                                                            </span>
                                                        ) : s.selfExitsCount > 0 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-gray-500/20 text-gray-400">
                                                                {s.selfExitsCount} в архиве
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-gray-500">
                                                                <XCircle size={9} />
                                                                Нет
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {s.hasActiveAuthorization ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                                                <CheckCircle size={9} />
                                                                {s.authorizationsCount}
                                                            </span>
                                                        ) : s.totalAuthorizationsCount > 0 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-gray-500/20 text-gray-400">
                                                                {s.totalAuthorizationsCount} в архиве
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-gray-500">
                                                                <XCircle size={9} />
                                                                Нет
                                                            </span>
                                                        )}
                                                    </td>

                                                </tr>
                                                {isExpanded && (
                                                    <tr key={`${s.aisId}-details`}>
                                                        <td colSpan={5} className="px-3 py-3 bg-white/5">
                                                            <div className="space-y-3">
                                                                {/* Самовывод */}
                                                                {s.hasActiveSelfExit && s.activeSelfExit && (
                                                                    <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/30">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <UserCheck size={12} className="text-indigo-400" />
                                                                            <span className="text-xs font-semibold text-indigo-400">
                                                                                Активный самовывод
                                                                            </span>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                            <div>
                                                                                <p className="text-gray-500">С</p>
                                                                                <p className="text-white">
                                                                                    {formatDate(s.activeSelfExit.startDate)}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-gray-500">По</p>
                                                                                <p className="text-white">
                                                                                    {formatDate(s.activeSelfExit.endDate)}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        {s.activeSelfExit.reason && (
                                                                            <div className="mt-2 text-[10px]">
                                                                                <p className="text-gray-500">Причина</p>
                                                                                <p className="text-white">
                                                                                    {s.activeSelfExit.reason}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Доверенности */}
                                                                {s.hasActiveAuthorization && s.authorizations.length > 0 && (
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Shield size={12} className="text-cyan-400" />
                                                                            <span className="text-xs font-semibold text-cyan-400">
                                                                                Доверенности ({s.authorizations.length})
                                                                            </span>
                                                                        </div>
                                                                        {s.authorizations.map((auth: any) => (
                                                                            <div
                                                                                key={auth.id}
                                                                                className="bg-cyan-500/10 rounded-lg p-3 border border-cyan-500/30"
                                                                            >
                                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="text-white font-medium text-xs truncate">
                                                                                            {auth.trustedName}
                                                                                        </p>
                                                                                        <p className="text-[10px] text-cyan-300">
                                                                                            {auth.relation}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                                                    {auth.phone && (
                                                                                        <div>
                                                                                            <p className="text-gray-500 flex items-center gap-1">
                                                                                                <Phone size={9} /> Телефон
                                                                                            </p>
                                                                                            <p className="text-white">{auth.phone}</p>
                                                                                        </div>
                                                                                    )}
                                                                                    <div>
                                                                                        <p className="text-gray-500 flex items-center gap-1">
                                                                                            <Calendar size={9} /> Добавлено
                                                                                        </p>
                                                                                        <p className="text-white">
                                                                                            {formatDate(auth.createdAt)}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                {auth.comment && (
                                                                                    <div className="mt-2 text-[10px]">
                                                                                        <p className="text-gray-500">Комментарий</p>
                                                                                        <p className="text-gray-300">{auth.comment}</p>
                                                                                    </div>
                                                                                )}
                                                                                <p className="text-[9px] text-gray-500 mt-2">
                                                                                    Добавил: {auth.teacherName}
                                                                                </p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Если ничего нет */}
                                                                {!s.hasActiveSelfExit && !s.hasActiveAuthorization && (
                                                                    <div className="text-center py-3">
                                                                        <p className="text-xs text-gray-400">
                                                                            Нет активных разрешений
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
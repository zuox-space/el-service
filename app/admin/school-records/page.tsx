// app/admin/school-records/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
    ArrowLeft, ShieldAlert, ShieldCheck, Search, Calendar,
    Filter, AlertTriangle, Clock, Users, TrendingUp, TrendingDown,
    Bell, BarChart3, Loader2, User, CheckCircle, XCircle,
    Download, ChevronDown, ChevronUp, AlertCircle
} from "lucide-react";

interface SchoolRecord {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    registeredAt: string;
    registeredByName: string;
    reason: string;
    plannedReleaseAt: string | null;
    releasedAt: string | null;
    releasedByName: string | null;
    releaseReason: string | null;
    isActive: boolean;
}

interface Stats {
    total: number;
    active: number;
    released: number;
    expiringIn7Days: number;
    expiringIn14Days: number;
    expiringIn30Days: number;
    overdue: number;
    uniqueClasses: number;
    periodRegistered: number;
    periodReleased: number;
    byClass: Record<string, { active: number; total: number }>;
    byMonth: Record<string, { registered: number; released: number }>;
}

type TabType = "overview" | "active" | "expiring" | "released";

export default function AdminSchoolRecordsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [records, setRecords] = useState<SchoolRecord[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [uniqueClasses, setUniqueClasses] = useState<string[]>([]);
    const [expiringIn7Days, setExpiringIn7Days] = useState<SchoolRecord[]>([]);
    const [expiringIn14Days, setExpiringIn14Days] = useState<SchoolRecord[]>([]);
    const [expiringIn30Days, setExpiringIn30Days] = useState<SchoolRecord[]>([]);
    const [overdue, setOverdue] = useState<SchoolRecord[]>([]);
    const [periodRegistered, setPeriodRegistered] = useState<SchoolRecord[]>([]);
    const [periodReleased, setPeriodReleased] = useState<SchoolRecord[]>([]);

    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [showFilters, setShowFilters] = useState(false);

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

    const fetchRecords = async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams({
                startDate,
                endDate,
            });
            const response = await fetch(`/api/admin/school-records?${params}`);
            const data = await response.json();

            if (data.error) {
                console.error("Error:", data.error);
                return;
            }

            setRecords(data.records || []);
            setStats(data.stats || null);
            setUniqueClasses(data.uniqueClasses || []);
            setExpiringIn7Days(data.expiringIn7Days || []);
            setExpiringIn14Days(data.expiringIn14Days || []);
            setExpiringIn30Days(data.expiringIn30Days || []);
            setOverdue(data.overdue || []);
            setPeriodRegistered(data.periodRegistered || []);
            setPeriodReleased(data.periodReleased || []);
        } catch (error) {
            console.error("Error fetching records:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) {
            fetchRecords();
        }
    }, [session, startDate, endDate]);

    // Фильтрация
    const filteredRecords = useMemo(() => {
        let result = [...records];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.studentName.toLowerCase().includes(q) ||
                r.className.toLowerCase().includes(q) ||
                r.reason.toLowerCase().includes(q) ||
                r.registeredByName.toLowerCase().includes(q)
            );
        }

        if (selectedClass) {
            result = result.filter(r => r.className === selectedClass);
        }

        return result;
    }, [records, searchQuery, selectedClass]);

    const activeRecords = useMemo(() => filteredRecords.filter(r => r.isActive), [filteredRecords]);
    const releasedRecords = useMemo(() => filteredRecords.filter(r => !r.isActive), [filteredRecords]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const getDaysUntil = (dateStr: string) => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);
        const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const exportToExcel = () => {
        let html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Внутришкольный учёт</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🛡️ Внутришкольный учёт</h1>
        <p>Всего записей: ${filteredRecords.length}</p>
        
        <table>
          <tr>
            <th>#</th>
            <th>Ученик</th>
            <th>Класс</th>
            <th>Дата постановки</th>
            <th>Кто поставил</th>
            <th>Причина</th>
            <th>План. снятие</th>
            <th>Статус</th>
            <th>Дата снятия</th>
          </tr>
    `;

        filteredRecords.forEach((r, i) => {
            html += `
        <tr>
          <td>${i + 1}</td>
          <td>${r.studentName}</td>
          <td>${r.className}</td>
          <td>${formatDate(r.registeredAt)}</td>
          <td>${r.registeredByName}</td>
          <td>${r.reason}</td>
          <td>${formatDate(r.plannedReleaseAt)}</td>
          <td>${r.isActive ? "На учёте" : "Снят"}</td>
          <td>${formatDate(r.releasedAt)}</td>
        </tr>
      `;
        });

        html += `</table></body></html>`;

        const blob = new Blob([html], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `вшу_${startDate}_${endDate}.xls`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
                    <Loader2 size={32} className="animate-spin text-orange-400 mx-auto" />
                    <p className="mt-4 text-gray-300">Загрузка данных ВШУ...</p>
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
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                                <ShieldAlert size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">Внутришкольный учёт</p>
                                <p className="text-xs text-gray-400 hidden sm:block">
                                    Дашборд ВШУ
                                </p>
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

            <div className="p-3 max-w-7xl mx-auto space-y-3">

                {/* 🔥 ОСНОВНАЯ СТАТИСТИКА */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Users size={12} className="text-blue-400" />
                            <span className="text-[10px] text-gray-400">Всего</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-400">{stats?.total || 0}</p>
                        <p className="text-[10px] text-gray-500">записей ВШУ</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-orange-500/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <ShieldAlert size={12} className="text-orange-400" />
                            <span className="text-[10px] text-gray-400">На учёте</span>
                        </div>
                        <p className="text-2xl font-bold text-orange-400">{stats?.active || 0}</p>
                        <p className="text-[10px] text-gray-500">учеников сейчас</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-green-500/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <ShieldCheck size={12} className="text-green-400" />
                            <span className="text-[10px] text-gray-400">Снято</span>
                        </div>
                        <p className="text-2xl font-bold text-green-400">{stats?.released || 0}</p>
                        <p className="text-[10px] text-gray-500">за всё время</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-purple-500/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Users size={12} className="text-purple-400" />
                            <span className="text-[10px] text-gray-400">Классов</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-400">{stats?.uniqueClasses || 0}</p>
                        <p className="text-[10px] text-gray-500">затронуто</p>
                    </div>
                </div>

                {/* 🔥 УВЕДОМЛЕНИЯ О СРОКАХ */}
                {(stats?.overdue || 0) > 0 && (
                    <div className="bg-red-500/10 backdrop-blur-lg rounded-xl p-3 border border-red-500/40 animate-pulse">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle size={16} className="text-red-400" />
                            <span className="text-sm font-bold text-red-400">
                                Просрочено снятие ({stats?.overdue})
                            </span>
                        </div>
                        <p className="text-xs text-red-300">
                            У {stats?.overdue} учеников срок ВШУ истёк, но они всё ещё на учёте.
                            Требуется снять или продлить.
                        </p>
                        <button
                            onClick={() => setActiveTab("expiring")}
                            className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
                        >
                            Посмотреть список →
                        </button>
                    </div>
                )}

                {(stats?.expiringIn7Days || 0) > 0 && (
                    <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-3 border border-yellow-500/40">
                        <div className="flex items-center gap-2 mb-2">
                            <Bell size={16} className="text-yellow-400" />
                            <span className="text-sm font-bold text-yellow-400">
                                Приближается срок снятия ({stats?.expiringIn7Days} за 7 дней)
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-yellow-500/20 rounded-lg text-yellow-300">
                                7 дней: {stats?.expiringIn7Days}
                            </span>
                            <span className="px-2 py-1 bg-orange-500/20 rounded-lg text-orange-300">
                                14 дней: {stats?.expiringIn14Days}
                            </span>
                            <span className="px-2 py-1 bg-blue-500/20 rounded-lg text-blue-300">
                                30 дней: {stats?.expiringIn30Days}
                            </span>
                        </div>
                    </div>
                )}

                {/* 🔥 СТАТИСТИКА ЗА ПЕРИОД */}
                <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                        <BarChart3 size={14} className="text-blue-400" />
                        <span className="text-xs font-medium text-white">
                            Статистика за период
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <TrendingUp size={10} className="text-orange-400" />
                                <span className="text-[10px] text-gray-400">Поставлено</span>
                            </div>
                            <p className="text-lg font-bold text-orange-400">
                                {stats?.periodRegistered || 0}
                            </p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 text-center">
                            <div className="flex items-center justify-center gap-1 mb-1">
                                <TrendingDown size={10} className="text-green-400" />
                                <span className="text-[10px] text-gray-400">Снято</span>
                            </div>
                            <p className="text-lg font-bold text-green-400">
                                {stats?.periodReleased || 0}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 🔥 ТАБЫ */}
                <div className="bg-white/5 rounded-xl p-1">
                    <div className="grid grid-cols-4 gap-1">
                        {[
                            { id: "overview", name: "Обзор", count: stats?.total || 0 },
                            { id: "active", name: "На учёте", count: stats?.active || 0 },
                            { id: "expiring", name: "Срок", count: (stats?.expiringIn30Days || 0) + (stats?.overdue || 0) },
                            { id: "released", name: "Снято", count: stats?.released || 0 },
                        ].map((tab: any) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all text-[11px] font-medium ${activeTab === tab.id
                                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/10"
                                    }`}
                            >
                                <span>{tab.name}</span>
                                <span className={`text-[10px] mt-0.5 ${activeTab === tab.id ? "text-white/80" : "text-gray-500"
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 🔥 ФИЛЬТРЫ И ПОИСК */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 space-y-3">
                    {/* Поиск */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Поиск по ФИО, классу, причине, учителю..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-orange-500/50"
                        />
                    </div>

                    {/* Фильтр по классу */}
                    {uniqueClasses.length > 0 && (
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full px-2 py-2 bg-[#1a2332] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                            <option value="">Все классы ({uniqueClasses.length})</option>
                            {uniqueClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    )}

                    {/* Даты для статистики */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-2 flex-1">
                            <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                            <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Быстрые кнопки */}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => {
                                const d = new Date();
                                d.setMonth(d.getMonth() - 1);
                                setStartDate(d.toISOString().split('T')[0]);
                                setEndDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10"
                        >
                            Месяц
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date();
                                d.setMonth(d.getMonth() - 3);
                                setStartDate(d.toISOString().split('T')[0]);
                                setEndDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10"
                        >
                            3 месяца
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date();
                                d.setMonth(d.getMonth() - 6);
                                setStartDate(d.toISOString().split('T')[0]);
                                setEndDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10"
                        >
                            6 месяцев
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date();
                                d.setFullYear(d.getFullYear() - 1);
                                setStartDate(d.toISOString().split('T')[0]);
                                setEndDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10"
                        >
                            Год
                        </button>
                        <button
                            onClick={() => {
                                const d = new Date();
                                d.setMonth(0, 1);
                                setStartDate(d.toISOString().split('T')[0]);
                                setEndDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 rounded border border-white/10"
                        >
                            С начала года
                        </button>
                    </div>
                </div>

                {/* 🔥 КОНТЕНТ ПО ТАБАМ */}
                {activeTab === "overview" && (
                    <OverviewTab
                        stats={stats}
                        activeRecords={activeRecords}
                        releasedRecords={releasedRecords}
                        overdue={overdue}
                        expiringIn7Days={expiringIn7Days}
                        expiringIn14Days={expiringIn14Days}
                        expiringIn30Days={expiringIn30Days}
                        formatDate={formatDate}
                        getDaysUntil={getDaysUntil}
                        onTabChange={setActiveTab}
                    />
                )}

                {activeTab === "active" && (
                    <ActiveTab records={activeRecords} formatDate={formatDate} getDaysUntil={getDaysUntil} />
                )}

                {activeTab === "expiring" && (
                    <ExpiringTab
                        overdue={overdue}
                        in7Days={expiringIn7Days}
                        in14Days={expiringIn14Days}
                        in30Days={expiringIn30Days}
                        formatDate={formatDate}
                        getDaysUntil={getDaysUntil}
                    />
                )}

                {activeTab === "released" && (
                    <ReleasedTab records={releasedRecords} formatDate={formatDate} />
                )}

                {/* Пустая выборка */}
                {filteredRecords.length === 0 && !isLoading && (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
                        <ShieldAlert size={40} className="text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Нет записей ВШУ</p>
                        <p className="text-gray-500 text-xs mt-1">
                            Попробуйте изменить фильтры или период
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============ ТАБ: ОБЗОР ============
function OverviewTab({
    stats, activeRecords, releasedRecords, overdue, expiringIn7Days,
    expiringIn14Days, expiringIn30Days, formatDate, getDaysUntil, onTabChange
}: any) {
    return (
        <div className="space-y-3">
            {/* Топ классов */}
            {stats?.byClass && Object.keys(stats.byClass).length > 0 && (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                        <Users size={14} className="text-blue-400" />
                        <span className="text-sm font-medium text-white">
                            По классам (на учёте)
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {Object.entries(stats.byClass)
                            .sort(([, a]: any, [, b]: any) => b.active - a.active)
                            .slice(0, 8)
                            .map(([className, data]: any) => (
                                <div key={className} className="flex items-center gap-2">
                                    <span className="text-xs text-white w-12">{className}</span>
                                    <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full"
                                            style={{ width: `${Math.min((data.active / Math.max(...Object.values(stats.byClass).map((c: any) => c.active))) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-orange-400 w-6 text-right">
                                        {data.active}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Просроченные */}
            {overdue?.length > 0 && (
                <div className="bg-red-500/10 backdrop-blur-lg rounded-xl p-3 border border-red-500/30">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle size={14} className="text-red-400" />
                        <span className="text-sm font-medium text-red-400">
                            Просрочено снятие ({overdue.length})
                        </span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {overdue.slice(0, 5).map((r: SchoolRecord) => {
                            const days = Math.abs(getDaysUntil(r.plannedReleaseAt!));
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => onTabChange("expiring")}
                                    className="w-full text-left p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-white font-medium truncate">{r.studentName}</p>
                                            <p className="text-[10px] text-gray-400">
                                                {r.className} · срок {formatDate(r.plannedReleaseAt)}
                                            </p>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/30 text-red-300 font-bold flex-shrink-0">
                                            {days} дн. назад
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                        {overdue.length > 5 && (
                            <p className="text-[10px] text-gray-500 text-center pt-1">
                                и ещё {overdue.length - 5}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Приближается срок */}
            {expiringIn30Days?.length > 0 && (
                <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-3 border border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock size={14} className="text-yellow-400" />
                        <span className="text-sm font-medium text-yellow-400">
                            Приближается срок (до 30 дней)
                        </span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {expiringIn30Days.slice(0, 5).map((r: SchoolRecord) => {
                            const days = getDaysUntil(r.plannedReleaseAt!);
                            const color = days <= 7 ? "text-red-400 bg-red-500/20"
                                : days <= 14 ? "text-orange-400 bg-orange-500/20"
                                    : "text-yellow-400 bg-yellow-500/20";
                            return (
                                <button
                                    key={r.id}
                                    onClick={() => onTabChange("expiring")}
                                    className="w-full text-left p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs text-white font-medium truncate">{r.studentName}</p>
                                            <p className="text-[10px] text-gray-400">
                                                {r.className} · {formatDate(r.plannedReleaseAt)}
                                            </p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex-shrink-0 ${color}`}>
                                            {days} дн.
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Динамика по месяцам */}
            {stats?.byMonth && (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 size={14} className="text-purple-400" />
                        <span className="text-sm font-medium text-white">
                            Динамика (12 месяцев)
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {Object.entries(stats.byMonth).map(([month, data]: any) => {
                            const [year, m] = month.split('-');
                            const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('ru-RU', { month: 'short' });
                            const maxVal = Math.max(...Object.values(stats.byMonth).map((d: any) => Math.max(d.registered, d.released)), 1);
                            return (
                                <div key={month} className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400 w-12">
                                        {monthName} {year.slice(2)}
                                    </span>
                                    <div className="flex-1 flex gap-1">
                                        {data.registered > 0 && (
                                            <div
                                                className="bg-orange-500/60 h-3 rounded-sm flex items-center justify-center text-[8px] text-white font-bold"
                                                style={{ width: `${(data.registered / maxVal) * 100}%`, minWidth: '16px' }}
                                            >
                                                {data.registered}
                                            </div>
                                        )}
                                        {data.released > 0 && (
                                            <div
                                                className="bg-green-500/60 h-3 rounded-sm flex items-center justify-center text-[8px] text-white font-bold"
                                                style={{ width: `${(data.released / maxVal) * 100}%`, minWidth: '16px' }}
                                            >
                                                {data.released}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/10 text-[10px]">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-orange-500/60 rounded-sm" />
                                <span className="text-gray-400">Поставлено</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-500/60 rounded-sm" />
                                <span className="text-gray-400">Снято</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============ ТАБ: НА УЧЁТЕ ============
function ActiveTab({ records, formatDate, getDaysUntil }: any) {
    if (records.length === 0) {
        return (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
                <ShieldCheck size={32} className="text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Никто не состоит на учёте</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {records.map((r: SchoolRecord) => {
                const days = r.plannedReleaseAt ? getDaysUntil(r.plannedReleaseAt) : null;
                const isOverdue = days !== null && days < 0;
                const isSoon = days !== null && days >= 0 && days <= 7;

                return (
                    <div
                        key={r.id}
                        className={`bg-white/10 backdrop-blur-lg rounded-xl p-3 border ${isOverdue ? "border-red-500/50"
                                : isSoon ? "border-yellow-500/50"
                                    : "border-orange-500/30"
                            }`}
                    >
                        <div className="flex items-start gap-2 mb-2">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isOverdue ? "bg-gradient-to-br from-red-500 to-red-700"
                                    : isSoon ? "bg-gradient-to-br from-yellow-500 to-orange-600"
                                        : "bg-gradient-to-br from-orange-500 to-red-600"
                                }`}>
                                <ShieldAlert size={16} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-white text-sm truncate">
                                    {r.studentName}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                        {r.className}
                                    </span>
                                    <span>· Поставлен {formatDate(r.registeredAt)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Причина */}
                        <div className="bg-orange-500/10 rounded-lg p-2 border border-orange-500/20 mb-2">
                            <p className="text-[10px] text-orange-400 mb-0.5">Причина</p>
                            <p className="text-xs text-white line-clamp-2">{r.reason}</p>
                            <p className="text-[10px] text-gray-500 mt-1">
                                👤 {r.registeredByName}
                            </p>
                        </div>

                        {/* Планируемое снятие */}
                        {r.plannedReleaseAt && (
                            <div className={`rounded-lg p-2 border ${isOverdue ? "bg-red-500/10 border-red-500/30"
                                    : isSoon ? "bg-yellow-500/10 border-yellow-500/30"
                                        : "bg-blue-500/10 border-blue-500/30"
                                }`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <Clock size={10} className={
                                            isOverdue ? "text-red-400"
                                                : isSoon ? "text-yellow-400"
                                                    : "text-blue-400"
                                        } />
                                        <span className={`text-[10px] ${isOverdue ? "text-red-400"
                                                : isSoon ? "text-yellow-400"
                                                    : "text-blue-400"
                                            }`}>
                                            План. снятие
                                        </span>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isOverdue ? "bg-red-500/30 text-red-300"
                                            : isSoon ? "bg-yellow-500/30 text-yellow-300"
                                                : "bg-blue-500/30 text-blue-300"
                                        }`}>
                                        {isOverdue
                                            ? `${Math.abs(days!)} дн. назад`
                                            : days === 0
                                                ? "Сегодня"
                                                : `через ${days} дн.`}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">
                                    {formatDate(r.plannedReleaseAt)}
                                </p>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ============ ТАБ: СРОК ============
function ExpiringTab({ overdue, in7Days, in14Days, in30Days, formatDate, getDaysUntil }: any) {
    const hasAny = overdue.length > 0 || in7Days.length > 0 || in14Days.length > 0 || in30Days.length > 0;

    if (!hasAny) {
        return (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
                <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Нет приближающихся сроков</p>
            </div>
        );
    }

    const renderSection = (title: string, records: SchoolRecord[], color: string, borderColor: string) => {
        if (records.length === 0) return null;
        return (
            <div className={`bg-white/10 backdrop-blur-lg rounded-xl p-3 border ${borderColor}`}>
                <div className="flex items-center gap-2 mb-2">
                    <Bell size={14} className={color} />
                    <span className={`text-sm font-medium ${color}`}>
                        {title} ({records.length})
                    </span>
                </div>
                <div className="space-y-1.5">
                    {records.map((r) => {
                        const days = r.plannedReleaseAt ? getDaysUntil(r.plannedReleaseAt) : null;
                        return (
                            <div key={r.id} className="p-2 bg-white/5 rounded-lg">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs text-white font-medium truncate">{r.studentName}</p>
                                        <p className="text-[10px] text-gray-400">
                                            {r.className} · {formatDate(r.plannedReleaseAt)}
                                        </p>
                                    </div>
                                    {days !== null && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold flex-shrink-0 ${days < 0 ? "bg-red-500/30 text-red-300"
                                                : days <= 7 ? "bg-yellow-500/30 text-yellow-300"
                                                    : days <= 14 ? "bg-orange-500/30 text-orange-300"
                                                        : "bg-blue-500/30 text-blue-300"
                                            }`}>
                                            {days < 0 ? `${Math.abs(days)} дн. назад` : `через ${days} дн.`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-3">
            {renderSection("⚠️ Просрочено", overdue, "text-red-400", "border-red-500/40")}
            {renderSection("🔴 На этой неделе (7 дней)", in7Days, "text-yellow-400", "border-yellow-500/40")}
            {renderSection("🟠 Через 2 недели", in14Days, "text-orange-400", "border-orange-500/40")}
            {renderSection("🔵 В течение месяца", in30Days, "text-blue-400", "border-blue-500/40")}
        </div>
    );
}

// ============ ТАБ: СНЯТО ============
function ReleasedTab({ records, formatDate }: any) {
    if (records.length === 0) {
        return (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
                <ShieldCheck size={32} className="text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Нет снятых с учёта</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {records.map((r: SchoolRecord) => (
                <div
                    key={r.id}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-green-500/30"
                >
                    <div className="flex items-start gap-2 mb-2">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-white text-sm truncate">
                                {r.studentName}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                    {r.className}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Период */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                        <div className="bg-orange-500/10 rounded-lg p-2 border border-orange-500/20">
                            <p className="text-orange-400 mb-0.5">Поставлен</p>
                            <p className="text-white font-medium">{formatDate(r.registeredAt)}</p>
                        </div>
                        <div className="bg-green-500/10 rounded-lg p-2 border border-green-500/20">
                            <p className="text-green-400 mb-0.5">Снят</p>
                            <p className="text-white font-medium">{formatDate(r.releasedAt)}</p>
                        </div>
                    </div>

                    {/* Причины */}
                    <div className="space-y-1.5">
                        <div className="bg-white/5 rounded-lg p-2">
                            <p className="text-[10px] text-orange-400 mb-0.5">
                                Причина постановки
                            </p>
                            <p className="text-xs text-white line-clamp-2">{r.reason}</p>
                            <p className="text-[9px] text-gray-500 mt-0.5">
                                {r.registeredByName}
                            </p>
                        </div>
                        {r.releaseReason && (
                            <div className="bg-white/5 rounded-lg p-2">
                                <p className="text-[10px] text-green-400 mb-0.5">
                                    Причина снятия
                                </p>
                                <p className="text-xs text-white line-clamp-2">
                                    {r.releaseReason}
                                </p>
                                {r.releasedByName && (
                                    <p className="text-[9px] text-gray-500 mt-0.5">
                                        {r.releasedByName}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
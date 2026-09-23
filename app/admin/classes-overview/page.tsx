// app/admin/classes-overview/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
    ArrowLeft, School, User, Users, Shield, UserCheck,
    Search, Loader2, TrendingUp, BarChart3, ArrowRight,
    AlertCircle, Download, CheckCircle
} from "lucide-react";

interface ClassStats {
    classId: string;
    className: string;
    grade: number;
    letter: string;
    ownerId: string;
    totalStudents: number;
    activeSelfExits: number;
    studentsWithSelfExit: number;
    activeAuthorizations: number;
    studentsWithAuth: number;
}

interface Totals {
    totalClasses: number;
    totalStudents: number;
    totalActiveSelfExits: number;
    totalStudentsWithSelfExit: number;
    totalActiveAuthorizations: number;
    totalStudentsWithAuth: number;
}

export default function ClassesOverviewPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [classes, setClasses] = useState<ClassStats[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGrade, setSelectedGrade] = useState<number | "">("");
    const [sortBy, setSortBy] = useState<"name" | "students" | "selfExits" | "auths">("name");

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
        if (!session?.user?.roles?.includes("ADMIN")) return;

        const fetchData = async () => {
            try {
                setIsLoading(true);
                const response = await fetch("/api/admin/classes-stats");
                const data = await response.json();

                if (data.error) {
                    console.error("Error:", data.error);
                    return;
                }

                setClasses(data.classes || []);
                setTotals(data.totals || null);
            } catch (error) {
                console.error("Error fetching classes stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [session]);

    // Фильтрация и сортировка
    const filteredClasses = useMemo(() => {
        let result = [...classes];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(c => c.className.toLowerCase().includes(q));
        }

        if (selectedGrade !== "") {
            result = result.filter(c => c.grade === selectedGrade);
        }

        result.sort((a, b) => {
            switch (sortBy) {
                case "students":
                    return b.totalStudents - a.totalStudents;
                case "selfExits":
                    return b.activeSelfExits - a.activeSelfExits;
                case "auths":
                    return b.activeAuthorizations - a.activeAuthorizations;
                case "name":
                default:
                    if (a.grade !== b.grade) return a.grade - b.grade;
                    return a.letter.localeCompare(b.letter);
            }
        });

        return result;
    }, [classes, searchQuery, selectedGrade, sortBy]);

    // Уникальные параллели
    const uniqueGrades = useMemo(() => {
        return [...new Set(classes.map(c => c.grade))].filter(Boolean).sort((a, b) => a - b);
    }, [classes]);

    const handleClassClick = (className: string) => {
        router.push(`/admin/classes-overview/${encodeURIComponent(className)}`);
    };

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
                    <Loader2 size={32} className="animate-spin text-blue-400 mx-auto" />
                    <p className="mt-4 text-gray-300">Загрузка классов...</p>
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
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                                onClick={() => router.push("/admin")}
                                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex-shrink-0"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                <School size={16} className="text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">Обзор классов</p>
                                <p className="text-xs text-gray-400 hidden sm:block">
                                    Самовыводы и доверенности
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 max-w-7xl mx-auto space-y-3">

                {/* 🔥 Общая статистика */}
                {totals && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                            <div className="flex items-center gap-1.5 mb-1">
                                <School size={12} className="text-purple-400" />
                                <span className="text-[10px] text-gray-400">Классов</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-400">{totals.totalClasses}</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Users size={12} className="text-blue-400" />
                                <span className="text-[10px] text-gray-400">Учеников</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-400">{totals.totalStudents}</p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-indigo-500/30">
                            <div className="flex items-center gap-1.5 mb-1">
                                <UserCheck size={12} className="text-indigo-400" />
                                <span className="text-[10px] text-gray-400">Самовыводы</span>
                            </div>
                            <p className="text-2xl font-bold text-indigo-400">
                                {totals.totalActiveSelfExits}
                            </p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-indigo-500/30">
                            <div className="flex items-center gap-1.5 mb-1">
                                <User size={12} className="text-indigo-300" />
                                <span className="text-[10px] text-gray-400">Детей с СВ</span>
                            </div>
                            <p className="text-2xl font-bold text-indigo-300">
                                {totals.totalStudentsWithSelfExit}
                            </p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-cyan-500/30">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Shield size={12} className="text-cyan-400" />
                                <span className="text-[10px] text-gray-400">Доверенности</span>
                            </div>
                            <p className="text-2xl font-bold text-cyan-400">
                                {totals.totalActiveAuthorizations}
                            </p>
                        </div>

                        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-cyan-500/30">
                            <div className="flex items-center gap-1.5 mb-1">
                                <User size={12} className="text-cyan-300" />
                                <span className="text-[10px] text-gray-400">Детей с дов.</span>
                            </div>
                            <p className="text-2xl font-bold text-cyan-300">
                                {totals.totalStudentsWithAuth}
                            </p>
                        </div>
                    </div>
                )}

                {/* Фильтры */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 space-y-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Поиск класса..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {/* Выбор параллели */}
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-xs text-gray-400 mr-1">Параллель:</span>
                            <button
                                onClick={() => setSelectedGrade("")}
                                className={`px-2 py-1 rounded-lg text-xs transition-all ${selectedGrade === ""
                                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                                    }`}
                            >
                                Все
                            </button>
                            {uniqueGrades.map(grade => (
                                <button
                                    key={grade}
                                    onClick={() => setSelectedGrade(grade)}
                                    className={`px-2 py-1 rounded-lg text-xs transition-all ${selectedGrade === grade
                                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                                            : "bg-white/5 text-gray-400 hover:bg-white/10"
                                        }`}
                                >
                                    {grade}
                                </button>
                            ))}
                        </div>

                        {/* Сортировка */}
                        <div className="flex items-center gap-1 ml-auto">
                            <span className="text-xs text-gray-400 mr-1">Сортировка:</span>
                            {[
                                { id: "name", label: "По названию" },
                                { id: "students", label: "По ученикам" },
                                { id: "selfExits", label: "По СВ" },
                                { id: "auths", label: "По дов." },
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setSortBy(opt.id as any)}
                                    className={`px-2 py-1 rounded-lg text-[10px] transition-all ${sortBy === opt.id
                                            ? "bg-white/20 text-white"
                                            : "bg-white/5 text-gray-400 hover:bg-white/10"
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Список классов */}
                {filteredClasses.length === 0 ? (
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
                        <School size={40} className="text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Классы не найдены</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {filteredClasses.map((cls) => {
                            const hasActivity = cls.activeSelfExits > 0 || cls.activeAuthorizations > 0;
                            return (
                                <button
                                    key={cls.classId}
                                    onClick={() => handleClassClick(cls.className)}
                                    className={`w-full text-left bg-white/10 backdrop-blur-lg rounded-xl p-3 border transition-all hover:bg-white/20 ${hasActivity
                                            ? "border-cyan-500/30 hover:border-cyan-500/50"
                                            : "border-white/20 hover:border-white/40"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                                <School size={18} className="text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-white font-bold text-base truncate">
                                                    {cls.className}
                                                </h3>
                                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                                                    <Users size={10} />
                                                    <span>{cls.totalStudents} учеников</span>
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowRight
                                            size={16}
                                            className="text-gray-400 flex-shrink-0 mt-1"
                                        />
                                    </div>

                                    {/* Мини-статистика */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className={`rounded-lg p-2 ${cls.activeSelfExits > 0
                                                ? "bg-indigo-500/20 border border-indigo-500/30"
                                                : "bg-white/5 border border-white/10"
                                            }`}>
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <UserCheck size={10} className={
                                                    cls.activeSelfExits > 0 ? "text-indigo-400" : "text-gray-500"
                                                } />
                                                <span className="text-[9px] text-gray-400">Самовыводы</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-lg font-bold ${cls.activeSelfExits > 0 ? "text-indigo-400" : "text-gray-500"
                                                    }`}>
                                                    {cls.activeSelfExits}
                                                </span>
                                                {cls.studentsWithSelfExit > 0 && (
                                                    <span className="text-[9px] text-gray-400">
                                                        ({cls.studentsWithSelfExit} уч.)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className={`rounded-lg p-2 ${cls.activeAuthorizations > 0
                                                ? "bg-cyan-500/20 border border-cyan-500/30"
                                                : "bg-white/5 border border-white/10"
                                            }`}>
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <Shield size={10} className={
                                                    cls.activeAuthorizations > 0 ? "text-cyan-400" : "text-gray-500"
                                                } />
                                                <span className="text-[9px] text-gray-400">Доверенности</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-lg font-bold ${cls.activeAuthorizations > 0 ? "text-cyan-400" : "text-gray-500"
                                                    }`}>
                                                    {cls.activeAuthorizations}
                                                </span>
                                                {cls.studentsWithAuth > 0 && (
                                                    <span className="text-[9px] text-gray-400">
                                                        ({cls.studentsWithAuth} уч.)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
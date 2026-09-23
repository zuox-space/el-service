// app/admin/students/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
    ArrowLeft, Search, User, Loader2, Users, TrendingUp
} from "lucide-react";

interface Student {
    aisId: string;
    name: string;
    className: string;
}

export default function StudentsSearchPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState<Student[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentSearches, setRecentSearches] = useState<Student[]>([]);

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

    // Загрузка недавних поисков из localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('recentStudentSearches');
            if (saved) {
                setRecentSearches(JSON.parse(saved).slice(0, 5));
            }
        } catch (e) { }
    }, []);

    // Поиск
    useEffect(() => {
        if (searchQuery.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/students/search?q=${encodeURIComponent(searchQuery)}&limit=30`);
                const data = await response.json();
                setResults(Array.isArray(data) ? data : []);
            } catch (error) {
                console.error("Search error:", error);
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectStudent = (student: Student) => {
        // Сохраняем в недавние
        try {
            const saved = [student, ...recentSearches.filter(s => s.aisId !== student.aisId)].slice(0, 5);
            localStorage.setItem('recentStudentSearches', JSON.stringify(saved));
        } catch (e) { }

        router.push(`/admin/students/${student.aisId}`);
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <Loader2 size={32} className="animate-spin text-blue-400" />
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
                <div className="px-3 py-3 max-w-2xl mx-auto">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push("/admin")}
                            className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex-shrink-0"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <Users size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Профиль ученика</p>
                            <p className="text-xs text-gray-400">Полная информация</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 max-w-2xl mx-auto space-y-3">
                {/* Поиск */}
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            autoFocus
                            placeholder="Начните вводить фамилию или имя ученика..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                    </div>
                </div>

                {/* Результаты поиска */}
                {searchQuery.length >= 2 && (
                    <div className="space-y-2">
                        {isSearching ? (
                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center border border-white/20">
                                <Loader2 size={24} className="animate-spin text-cyan-400 mx-auto" />
                                <p className="text-gray-400 text-sm mt-2">Поиск...</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-center border border-white/20">
                                <User size={32} className="text-gray-600 mx-auto mb-2" />
                                <p className="text-gray-400 text-sm">Ученики не найдены</p>
                            </div>
                        ) : (
                            <>
                                <div className="text-xs text-gray-400 px-1">
                                    Найдено: {results.length}
                                </div>
                                {results.map((student) => (
                                    <button
                                        key={student.aisId}
                                        onClick={() => handleSelectStudent(student)}
                                        className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-lg rounded-xl p-3 border border-white/20 transition-all text-left flex items-center gap-3"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-bold text-white">
                                                {student.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                                {student.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full">
                                                    {student.className}
                                                </span>
                                                <span className="text-[10px] text-gray-500">
                                                    ID: {student.aisId}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* Недавние поиски */}
                {searchQuery.length < 2 && recentSearches.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                            <TrendingUp size={12} className="text-gray-400" />
                            <span className="text-xs text-gray-400">Недавние</span>
                        </div>
                        {recentSearches.map((student) => (
                            <button
                                key={student.aisId}
                                onClick={() => handleSelectStudent(student)}
                                className="w-full bg-white/5 hover:bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/10 transition-all text-left flex items-center gap-3"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-white">
                                        {student.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{student.name}</p>
                                    <p className="text-[10px] text-gray-500">{student.className}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Подсказка */}
                {searchQuery.length < 2 && recentSearches.length === 0 && (
                    <div className="bg-gradient-to-br from-cyan-600/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 text-center border border-white/20">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-cyan-500/30">
                            <User size={24} className="text-white" />
                        </div>
                        <h2 className="text-base font-bold text-white mb-2">Профиль ученика</h2>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            Введите фамилию или имя ученика для просмотра полной информации:
                            пропуска, самовыходы, нарушения, пропуски уроков
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
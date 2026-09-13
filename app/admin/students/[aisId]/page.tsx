// app/admin/students/[aisId]/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
    ArrowLeft, User, FileText, UserCheck, AlertTriangle,
    Clock, Calendar, CheckCircle, XCircle, TrendingUp,
    Loader2, Shield, Download, Award, BookOpen, Activity,
    BarChart3, AlertCircle, Phone, Info
} from "lucide-react";
import { getViolationType } from "@/lib/violations";

interface StudentInfo {
    aisId: string;
    name: string;
    firstName: string;
    lastName: string;
    className: string;
}

interface Pass {
    id: string;
    date: string;
    exitTime: string;
    reason: string;
    used: boolean;
    usedAt: string | null;
    className: string;
}

interface SelfExit {
    id: string;
    studentId: string;
    studentName: string;
    startDate: string;
    endDate: string;
    photoUrl: string;
    reason: string;
    classId: string;
}

interface Violation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string;
    teacherName: string;
    date: string;
}

interface Absence {
    id: string;
    date: string;
    reason: string;
    className: string;
}

interface StudentProfile {
    student: StudentInfo;
    passes: Pass[];
    selfExits: SelfExit[];
    violations: Violation[];
    absences: Absence[];
    stats: {
        passes: { total: number; used: number; notUsed: number };
        selfExits: { total: number; active: number };
        violations: { total: number; byType: Record<string, number> };
        absences: { total: number; byReason: Record<string, number> };
    };
}

const ABSENCE_REASON_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    sick: { label: "Болен", icon: "🤒", color: "text-red-400" },
    family: { label: "По заявлению", icon: "📝", color: "text-orange-400" },
    other: { label: "Без уважительной", icon: "⚠️", color: "text-yellow-400" },
    vacation: { label: "Отпуск", icon: "✈️", color: "text-blue-400" },
    competition: { label: "Соревнования", icon: "🏆", color: "text-purple-400" },
};

export default function StudentProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const params = useParams();
    const aisId = params?.aisId as string;

    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "passes" | "selfExits" | "violations" | "absences">("overview");

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

    useEffect(() => {
        if (!aisId || !session?.user?.roles?.includes("ADMIN")) return;

        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`/api/students/${aisId}`);
                const data = await response.json();

                if (data.error) {
                    console.error("Error:", data.error);
                    setProfile(null);
                    return;
                }

                setProfile(data);
            } catch (error) {
                console.error("Error fetching profile:", error);
                setProfile(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [aisId, session]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!mounted || status === "loading" || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
                    <Loader2 size={32} className="animate-spin text-blue-400 mx-auto" />
                    <p className="mt-4 text-gray-300">Загрузка профиля...</p>
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) {
        return null;
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858] p-4">
                <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20 max-w-md">
                    <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Ученик не найден</h2>
                    <p className="text-gray-400 text-sm mb-4">
                        Не удалось загрузить информацию об ученике
                    </p>
                    <button
                        onClick={() => router.push("/admin/students")}
                        className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm transition-all"
                    >
                        Вернуться к поиску
                    </button>
                </div>
            </div>
        );
    }

    const { student, stats } = profile;

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
            {/* Шапка */}
            <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-20">
                <div className="px-3 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                                onClick={() => router.push("/admin/students")}
                                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex-shrink-0"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                                <User size={16} className="text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-white truncate">{student.name}</p>
                                <p className="text-xs text-gray-400">{student.className}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 rounded-lg flex-shrink-0">
                            <span className="text-[10px] text-cyan-300">ID: {student.aisId}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3 max-w-4xl mx-auto space-y-3">
                {/* Карточка ученика */}
                <div className="bg-gradient-to-br from-cyan-600/20 via-blue-600/15 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
                    <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/30">
                            <span className="text-2xl font-bold text-white">
                                {student.firstName?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-bold text-white truncate">{student.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                                    {student.className}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                    ID: {student.aisId}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Статистика */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <div className="flex items-center gap-1.5 mb-1">
                            <FileText size={12} className="text-blue-400" />
                            <span className="text-[10px] text-gray-400">Пропуска</span>
                        </div>
                        <p className="text-xl font-bold text-blue-400">{stats.passes.total}</p>
                        <p className="text-[10px] text-gray-500">
                            {stats.passes.used} использовано
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <div className="flex items-center gap-1.5 mb-1">
                            <UserCheck size={12} className="text-indigo-400" />
                            <span className="text-[10px] text-gray-400">Самовыводы</span>
                        </div>
                        <p className="text-xl font-bold text-indigo-400">{stats.selfExits.total}</p>
                        <p className="text-[10px] text-gray-500">
                            {stats.selfExits.active} активных
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle size={12} className="text-rose-400" />
                            <span className="text-[10px] text-gray-400">Нарушения</span>
                        </div>
                        <p className="text-xl font-bold text-rose-400">{stats.violations.total}</p>
                        <p className="text-[10px] text-gray-500">
                            {Object.keys(stats.violations.byType).length} типов
                        </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                        <div className="flex items-center gap-1.5 mb-1">
                            <XCircle size={12} className="text-amber-400" />
                            <span className="text-[10px] text-gray-400">Пропуски</span>
                        </div>
                        <p className="text-xl font-bold text-amber-400">{stats.absences.total}</p>
                        <p className="text-[10px] text-gray-500">уроков пропущено</p>
                    </div>
                </div>

                {/* Табы */}
                <div className="bg-white/5 rounded-xl p-1 overflow-x-auto">
                    <div className="flex gap-1 min-w-max">
                        {[
                            { id: "overview", name: "Обзор", icon: <BarChart3 size={14} /> },
                            { id: "passes", name: "Пропуска", icon: <FileText size={14} />, count: stats.passes.total },
                            { id: "selfExits", name: "Самовыводы", icon: <UserCheck size={14} />, count: stats.selfExits.total },
                            { id: "violations", name: "Нарушения", icon: <AlertTriangle size={14} />, count: stats.violations.total },
                            { id: "absences", name: "Пропуски", icon: <XCircle size={14} />, count: stats.absences.total },
                        ].map((tab: any) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/10"
                                    }`}
                            >
                                {tab.icon}
                                <span>{tab.name}</span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20" : "bg-white/10"
                                        }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Контент таба */}
                <div className="space-y-2">
                    {activeTab === "overview" && (
                        <OverviewTab profile={profile} />
                    )}

                    {activeTab === "passes" && (
                        <PassesTab passes={profile.passes} formatDateTime={formatDateTime} />
                    )}

                    {activeTab === "selfExits" && (
                        <SelfExitsTab selfExits={profile.selfExits} formatDate={formatDate} />
                    )}

                    {activeTab === "violations" && (
                        <ViolationsTab violations={profile.violations} formatDateTime={formatDateTime} />
                    )}

                    {activeTab === "absences" && (
                        <AbsencesTab absences={profile.absences} formatDate={formatDate} />
                    )}
                </div>
            </div>
        </div>
    );
}

// ============ ТАБ: ОБЗОР ============
function OverviewTab({ profile }: { profile: StudentProfile }) {
    const { stats, passes, selfExits, violations, absences } = profile;

    return (
        <div className="space-y-3">
            {/* Последняя активность */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                <div className="flex items-center gap-2 mb-3">
                    <Activity size={14} className="text-cyan-400" />
                    <h3 className="text-sm font-medium text-white">Последние события</h3>
                </div>

                <div className="space-y-2">
                    {/* Последний пропуск */}
                    {passes[0] && (
                        <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                <FileText size={13} className="text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium">Пропуск</p>
                                <p className="text-[10px] text-gray-400 truncate">
                                    {new Date(passes[0].date).toLocaleDateString('ru-RU')} · {passes[0].exitTime}
                                </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${passes[0].used ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                                }`}>
                                {passes[0].used ? "Использован" : "Активен"}
                            </span>
                        </div>
                    )}

                    {/* Последний самовывод */}
                    {selfExits[0] && (
                        <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <UserCheck size={13} className="text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium">Самовывод</p>
                                <p className="text-[10px] text-gray-400 truncate">
                                    {new Date(selfExits[0].startDate).toLocaleDateString('ru-RU')} - {new Date(selfExits[0].endDate).toLocaleDateString('ru-RU')}
                                </p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${new Date(selfExits[0].endDate) >= new Date()
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-gray-500/20 text-gray-400"
                                }`}>
                                {new Date(selfExits[0].endDate) >= new Date() ? "Активен" : "Завершён"}
                            </span>
                        </div>
                    )}

                    {/* Последнее нарушение */}
                    {violations[0] && (
                        <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                            <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle size={13} className="text-rose-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium">
                                    {getViolationType(violations[0].violationType).label}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate">
                                    {new Date(violations[0].date).toLocaleDateString('ru-RU')} · {violations[0].teacherName}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Последний пропуск урока */}
                    {absences[0] && (
                        <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <XCircle size={13} className="text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-white font-medium">
                                    Пропуск урока: {ABSENCE_REASON_LABELS[absences[0].reason]?.label || absences[0].reason}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                    {new Date(absences[0].date).toLocaleDateString('ru-RU')}
                                </p>
                            </div>
                        </div>
                    )}

                    {passes.length === 0 && selfExits.length === 0 && violations.length === 0 && absences.length === 0 && (
                        <div className="text-center py-6">
                            <Info size={24} className="text-gray-600 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Нет данных для отображения</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Нарушения по типам */}
            {Object.keys(stats.violations.byType).length > 0 && (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-rose-400" />
                        <h3 className="text-sm font-medium text-white">Нарушения по типам</h3>
                    </div>
                    <div className="space-y-1.5">
                        {Object.entries(stats.violations.byType)
                            .sort(([, a], [, b]) => b - a)
                            .map(([typeId, count]) => {
                                const type = getViolationType(typeId);
                                return (
                                    <div key={typeId} className="flex items-center gap-2">
                                        <span className="text-sm">{type.icon}</span>
                                        <span className={`text-xs flex-1 ${type.color}`}>{type.label}</span>
                                        <span className="text-xs font-bold text-white">{count}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* Пропуски по причинам */}
            {Object.keys(stats.absences.byReason).length > 0 && (
                <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
                    <div className="flex items-center gap-2 mb-2">
                        <XCircle size={14} className="text-amber-400" />
                        <h3 className="text-sm font-medium text-white">Пропуски по причинам</h3>
                    </div>
                    <div className="space-y-1.5">
                        {Object.entries(stats.absences.byReason)
                            .sort(([, a], [, b]) => b - a)
                            .map(([reasonId, count]) => {
                                const reason = ABSENCE_REASON_LABELS[reasonId] || { label: reasonId, icon: "❓", color: "text-gray-400" };
                                return (
                                    <div key={reasonId} className="flex items-center gap-2">
                                        <span className="text-sm">{reason.icon}</span>
                                        <span className={`text-xs flex-1 ${reason.color}`}>{reason.label}</span>
                                        <span className="text-xs font-bold text-white">{count}</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============ ТАБ: ПРОПУСКА ============
function PassesTab({ passes, formatDateTime }: { passes: Pass[]; formatDateTime: (d: string) => string }) {
    if (passes.length === 0) {
        return (
            <EmptyState
                icon={<FileText size={28} className="text-gray-600" />}
                message="Пропусков нет"
            />
        );
    }

    return (
        <div className="space-y-2">
            {passes.map((pass) => (
                <div
                    key={pass.id}
                    className={`bg-white/10 backdrop-blur-lg rounded-xl p-3 border ${pass.used ? "border-blue-500/30" : "border-green-500/30"
                        }`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-lg ${pass.used ? "bg-blue-500/20" : "bg-green-500/20"
                                } flex items-center justify-center flex-shrink-0`}>
                                <FileText size={14} className={pass.used ? "text-blue-400" : "text-green-400"} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium text-white">
                                        Выход в {pass.exitTime}
                                    </span>
                                    {pass.used ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                            Использован
                                        </span>
                                    ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                            Активен
                                        </span>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    <Calendar size={9} className="inline mr-1" />
                                    {formatDateTime(pass.date)}
                                </p>
                                {pass.reason && (
                                    <p className="text-xs text-gray-300 mt-1 line-clamp-2">
                                        {pass.reason}
                                    </p>
                                )}
                                {pass.usedAt && (
                                    <p className="text-[10px] text-blue-400 mt-1">
                                        <CheckCircle size={9} className="inline mr-1" />
                                        Отмечен: {formatDateTime(pass.usedAt)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============ ТАБ: САМОВЫВОДЫ ============
function SelfExitsTab({ selfExits, formatDate }: { selfExits: SelfExit[]; formatDate: (d: string) => string }) {
    if (selfExits.length === 0) {
        return (
            <EmptyState
                icon={<UserCheck size={28} className="text-gray-600" />}
                message="Самовыводов нет"
            />
        );
    }

    return (
        <div className="space-y-2">
            {selfExits.map((exit) => {
                const isActive = new Date(exit.endDate) >= new Date();
                return (
                    <div
                        key={exit.id}
                        className={`bg-white/10 backdrop-blur-lg rounded-xl p-3 border ${isActive ? "border-green-500/30" : "border-white/20"
                            }`}
                    >
                        <div className="flex items-start gap-2">
                            <div className={`w-8 h-8 rounded-lg ${isActive ? "bg-green-500/20" : "bg-indigo-500/20"
                                } flex items-center justify-center flex-shrink-0`}>
                                <UserCheck size={14} className={isActive ? "text-green-400" : "text-indigo-400"} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-white">
                                        {formatDate(exit.startDate)} — {formatDate(exit.endDate)}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-gray-500/20 text-gray-400"
                                        }`}>
                                        {isActive ? "Активен" : "Завершён"}
                                    </span>
                                </div>
                                {exit.reason && (
                                    <p className="text-xs text-gray-300 mt-1">{exit.reason}</p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============ ТАБ: НАРУШЕНИЯ ============
function ViolationsTab({ violations, formatDateTime }: { violations: Violation[]; formatDateTime: (d: string) => string }) {
    if (violations.length === 0) {
        return (
            <EmptyState
                icon={<AlertTriangle size={28} className="text-gray-600" />}
                message="Нарушений нет"
            />
        );
    }

    return (
        <div className="space-y-2">
            {violations.map((v) => {
                const type = getViolationType(v.violationType);
                return (
                    <div
                        key={v.id}
                        className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20"
                    >
                        <div className="flex items-start gap-2">
                            <div className={`w-8 h-8 rounded-lg ${type.bgColor} flex items-center justify-center flex-shrink-0`}>
                                <span className="text-base">{type.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <span className={`text-xs font-medium ${type.color}`}>
                                        {type.label}
                                    </span>
                                </div>
                                {v.comment && (
                                    <p className="text-xs text-gray-300 mt-1">{v.comment}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                                    <Calendar size={9} />
                                    <span>{formatDateTime(v.date)}</span>
                                    {v.teacherName && (
                                        <>
                                            <span>·</span>
                                            <span>{v.teacherName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============ ТАБ: ПРОПУСКИ УРОКОВ ============
function AbsencesTab({ absences, formatDate }: { absences: Absence[]; formatDate: (d: string) => string }) {
    if (absences.length === 0) {
        return (
            <EmptyState
                icon={<XCircle size={28} className="text-gray-600" />}
                message="Пропусков уроков нет"
            />
        );
    }

    return (
        <div className="space-y-2">
            {absences.map((a) => {
                const reason = ABSENCE_REASON_LABELS[a.reason] || { label: a.reason, icon: "❓", color: "text-gray-400" };
                return (
                    <div
                        key={a.id}
                        className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-base">{reason.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className={`text-xs font-medium ${reason.color}`}>
                                    {reason.label}
                                </span>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    <Calendar size={9} className="inline mr-1" />
                                    {formatDate(a.date)}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ============ ПУСТОЕ СОСТОЯНИЕ ============
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
            <div className="mx-auto mb-2">{icon}</div>
            <p className="text-gray-400 text-sm">{message}</p>
        </div>
    );
}
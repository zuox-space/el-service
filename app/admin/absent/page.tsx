"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LogOut, ArrowLeft, School, Users, UserX, AlertCircle, 
  ChevronDown, ChevronUp, CheckCircle, XCircle,
  BarChart3, Download, Building2, Calendar, Menu, X
} from "lucide-react";

interface Student {
  id: number;
  name: string;
}

interface AbsentStudent {
  id: number;
  name: string;
  reason: string;
}

interface ClassAttendance {
  id: string;
  name: string;
  totalStudents: number;
  presentStudents: number[];
  absentStudents: AbsentStudent[];
  isMarked: boolean;
  grade: number;
}

interface Statistics {
  totalStudents: number;
  totalPresent: number;
  totalAbsent: number;
  byReason: {
    sick: number;
    family: number;
    other: number;
    vacation: number;
    competition: number;
  };
  byBuilding: {
    tiger: { total: number; present: number; absent: number };
    turtle: { total: number; present: number; absent: number };
    crocodile: { total: number; present: number; absent: number };
  };
}

const reasonLabels: Record<string, string> = {
  sick: "🤒 Болен",
  family: "📝 По заявлению родителей",
  other: "⚠️ Без уважительной причины",
  vacation: "✈️ Отпуск/каникулы",
  competition: "🏆 Соревнования/олимпиада"
};

const buildingLabels: Record<string, { name: string; icon: string; grades: number[] }> = {
  tiger: { name: "Тигрёнок", icon: "🐯", grades: [1, 2, 3] },
  turtle: { name: "Черепаха", icon: "🐢", grades: [4, 5, 6] },
  crocodile: { name: "Крокодил", icon: "🐊", grades: [7, 8, 9, 10, 11] }
};

export default function AdminAbsentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassAttendance[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<ClassAttendance[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [statistics, setStatistics] = useState<Statistics>({
    totalStudents: 0,
    totalPresent: 0,
    totalAbsent: 0,
    byReason: { sick: 0, family: 0, other: 0, vacation: 0, competition: 0 },
    byBuilding: {
      tiger: { total: 0, present: 0, absent: 0 },
      turtle: { total: 0, present: 0, absent: 0 },
      crocodile: { total: 0, present: 0, absent: 0 }
    }
  });
  const [filteredStatistics, setFilteredStatistics] = useState<Statistics>({
    totalStudents: 0,
    totalPresent: 0,
    totalAbsent: 0,
    byReason: { sick: 0, family: 0, other: 0, vacation: 0, competition: 0 },
    byBuilding: {
      tiger: { total: 0, present: 0, absent: 0 },
      turtle: { total: 0, present: 0, absent: 0 },
      crocodile: { total: 0, present: 0, absent: 0 }
    }
  });
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
    const fetchData = async () => {
      try {
        const today = new Date().toISOString();
        
        const classesRes = await fetch("/api/classes");
        const classesData = await classesRes.json();
        
        let allClasses: ClassAttendance[] = [];
        let stats: Statistics = {
          totalStudents: 0,
          totalPresent: 0,
          totalAbsent: 0,
          byReason: { sick: 0, family: 0, other: 0, vacation: 0, competition: 0 },
          byBuilding: {
            tiger: { total: 0, present: 0, absent: 0 },
            turtle: { total: 0, present: 0, absent: 0 },
            crocodile: { total: 0, present: 0, absent: 0 }
          }
        };
        
        for (const cls of classesData) {
          const gradeMatch = cls.name.match(/(\d+)/);
          const grade = gradeMatch ? parseInt(gradeMatch[1]) : 0;
          
          let building = "crocodile";
          if (grade <= 3) building = "tiger";
          else if (grade <= 6) building = "turtle";
          
          const attendanceRes = await fetch(`/api/attendance?classId=${cls.id}&date=${today}`);
          const attendance = await attendanceRes.json();
          
          let students: Student[] = [];
          if (typeof cls.students === 'string') {
            students = JSON.parse(cls.students);
          } else if (Array.isArray(cls.students)) {
            students = cls.students;
          }
          
          const totalStudents = students.length;
          stats.totalStudents += totalStudents;
          stats.byBuilding[building as keyof typeof stats.byBuilding].total += totalStudents;
          
          let presentStudents: number[] = [];
          let absentStudentsList: AbsentStudent[] = [];
          let isMarked = false;
          
          if (attendance && attendance.presentStudents) {
            isMarked = true;
            presentStudents = attendance.presentStudents;
            const absentIds = attendance.absentStudents || [];
            const absentReasons = attendance.absentReasons || {};
            
            absentStudentsList = absentIds.map((id: number) => {
              const student = students.find(s => s.id === id);
              const reason = absentReasons[id] || "other";
              return {
                id,
                name: student?.name || "Неизвестно",
                reason
              };
            });
            
            stats.totalPresent += presentStudents.length;
            stats.totalAbsent += absentIds.length;
            stats.byBuilding[building as keyof typeof stats.byBuilding].present += presentStudents.length;
            stats.byBuilding[building as keyof typeof stats.byBuilding].absent += absentIds.length;
            
            absentIds.forEach((id: number) => {
              const reason = absentReasons[id] || "other";
              if (stats.byReason[reason as keyof typeof stats.byReason] !== undefined) {
                stats.byReason[reason as keyof typeof stats.byReason]++;
              }
            });
          }
          
          allClasses.push({
            id: cls.id,
            name: cls.name,
            totalStudents,
            presentStudents,
            absentStudents: absentStudentsList,
            isMarked,
            grade
          });
        }
        
        setClasses(allClasses);
        setFilteredClasses(allClasses);
        setStatistics(stats);
        setFilteredStatistics(stats);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (session && session?.user?.roles?.includes("ADMIN")) {
      fetchData();
    }
  }, [session]);

  // Фильтрация по корпусу и обновление статистики
  useEffect(() => {
    if (selectedBuilding === "all") {
      setFilteredClasses(classes);
      setFilteredStatistics(statistics);
    } else {
      const buildingGrades = buildingLabels[selectedBuilding as keyof typeof buildingLabels]?.grades || [];
      const filtered = classes.filter(cls => buildingGrades.includes(cls.grade));
      setFilteredClasses(filtered);
      
      const newStats: Statistics = {
        totalStudents: 0,
        totalPresent: 0,
        totalAbsent: 0,
        byReason: { sick: 0, family: 0, other: 0, vacation: 0, competition: 0 },
        byBuilding: {
          tiger: { total: 0, present: 0, absent: 0 },
          turtle: { total: 0, present: 0, absent: 0 },
          crocodile: { total: 0, present: 0, absent: 0 }
        }
      };
      
      for (const cls of filtered) {
        newStats.totalStudents += cls.totalStudents;
        newStats.totalPresent += cls.presentStudents.length;
        newStats.totalAbsent += cls.absentStudents.length;
        
        for (const student of cls.absentStudents) {
          if (newStats.byReason[student.reason as keyof typeof newStats.byReason] !== undefined) {
            newStats.byReason[student.reason as keyof typeof newStats.byReason]++;
          }
        }
      }
      
      setFilteredStatistics(newStats);
    }
  }, [selectedBuilding, classes, statistics]);

  const toggleExpand = (classId: string) => {
    setExpandedClass(expandedClass === classId ? null : classId);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  };

  const exportToYandex = async () => {
    setIsExporting(true);
    
    let html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Отсутствующие ${new Date().toLocaleDateString("ru-RU")}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; font-size: 24px; }
          h2 { color: #666; margin-top: 20px; font-size: 18px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Отчет по отсутствующим</h1>
        <p>Дата: ${new Date().toLocaleDateString("ru-RU")}</p>
        
        <h2>Общая статистика</h2>
        <table>
          <tr><th>Показатель</th><th>Значение</th></tr>
          <tr><td>Всего учеников</td><td>${filteredStatistics.totalStudents}</td></tr>
          <tr><td>Присутствуют</td><td>${filteredStatistics.totalPresent}</td></tr>
          <tr><td>Отсутствуют</td><td>${filteredStatistics.totalAbsent}</td></tr>
        </table>
        
        <h2>Статистика по причинам</h2>
        <table>
          <tr><th>Причина</th><th>Количество</th></tr>
          <tr><td>🤒 Болеют</td><td>${filteredStatistics.byReason.sick}</td></tr>
          <tr><td>📝 По заявлению родителей</td><td>${filteredStatistics.byReason.family}</td></tr>
          <tr><td>⚠️ Без уважительной причины</td><td>${filteredStatistics.byReason.other}</td></tr>
          <tr><td>✈️ Отпуск/каникулы</td><td>${filteredStatistics.byReason.vacation}</td></tr>
          <tr><td>🏆 Соревнования</td><td>${filteredStatistics.byReason.competition}</td></tr>
        </table>
        
        <h2>Отсутствующие по классам</h2>
    `;
    
    for (const cls of filteredClasses) {
      html += `<h3>${cls.name}</h3><table><tr><th>Ученик</th><th>Причина отсутствия</th></tr>`;
      
      if (!cls.isMarked) {
        html += `<tr><td colspan="2" style="text-align: center; color: orange;">Отметка не произведена</td></tr>`;
      } else if (cls.absentStudents.length === 0) {
        html += `<tr><td colspan="2" style="text-align: center; color: green;">Все присутствуют</td></tr>`;
      } else {
        for (const student of cls.absentStudents) {
          html += `<tr><td>${student.name}</td><td>${reasonLabels[student.reason] || student.reason}</td></tr>`;
        }
      }
      
      html += `</table>`;
    }
    
    html += `</body></html>`;
    
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `otchet_ot_sutstvuyushchie_${new Date().toISOString().split("T")[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setIsExporting(false);
    alert("Отчет сформирован. Файл будет скачан автоматически.");
  };

  if (!mounted || status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
        <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl text-center border border-white/20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-300 text-sm">Загрузка данных...</p>
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <UserX size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Отсутствующие</p>
                <p className="text-xs text-gray-400">{new Date().toLocaleDateString("ru-RU", { day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
              >
                <Building2 size={16} />
              </button>
              <button
                onClick={exportToYandex}
                disabled={isExporting}
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

      <div className="p-3 max-w-full">
        {/* Статистика - компактная для мобильных */}
        <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <Users size={18} className="text-blue-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-white">{filteredStatistics.totalStudents}</div>
              <div className="text-[10px] text-gray-400">Всего</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <CheckCircle size={18} className="text-green-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-green-400">{filteredStatistics.totalPresent}</div>
              <div className="text-[10px] text-gray-400">Присутствуют</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <XCircle size={18} className="text-red-400 mx-auto mb-1" />
              <div className="text-lg font-bold text-red-400">{filteredStatistics.totalAbsent}</div>
              <div className="text-[10px] text-gray-400">Отсутствуют</div>
            </div>
          </div>
          
          <div className="flex flex-wrap justify-between gap-1">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-base">🤒</span>
              <span className="font-bold text-white">{filteredStatistics.byReason.sick}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-base">📝</span>
              <span className="font-bold text-white">{filteredStatistics.byReason.family}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-base">⚠️</span>
              <span className="font-bold text-white">{filteredStatistics.byReason.other}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-base">✈️</span>
              <span className="font-bold text-white">{filteredStatistics.byReason.vacation}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-base">🏆</span>
              <span className="font-bold text-white">{filteredStatistics.byReason.competition}</span>
            </div>
          </div>
        </div>

        {/* Фильтр по корпусам - выезжающий */}
        {showFilters && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-2 border border-white/20 mb-3">
            <div className="grid grid-cols-4 gap-1">
              <button
                onClick={() => setSelectedBuilding("all")}
                className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedBuilding === "all"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setSelectedBuilding("tiger")}
                className={`py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  selectedBuilding === "tiger"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="text-sm">🐯</span>
                <span className="hidden sm:inline">Тигрёнок</span>
              </button>
              <button
                onClick={() => setSelectedBuilding("turtle")}
                className={`py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  selectedBuilding === "turtle"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="text-sm">🐢</span>
                <span className="hidden sm:inline">Черепаха</span>
              </button>
              <button
                onClick={() => setSelectedBuilding("crocodile")}
                className={`py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                  selectedBuilding === "crocodile"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="text-sm">🐊</span>
                <span className="hidden sm:inline">Крокодил</span>
              </button>
            </div>
          </div>
        )}

        {/* Список классов */}
        <div className="space-y-2">
          {filteredClasses.map((cls) => (
            <div 
              key={cls.id} 
              className={`bg-white/10 backdrop-blur-lg rounded-xl border transition-all ${
                cls.isMarked ? "border-green-500/30" : "border-yellow-500/30"
              }`}
            >
              <button
                onClick={() => toggleExpand(cls.id)}
                className="w-full p-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <School size={16} className="text-blue-400 flex-shrink-0" />
                    <span className="font-bold text-white text-base">{cls.name}</span>
                    {!cls.isMarked && (
                      <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        <AlertCircle size={10} />
                      </span>
                    )}
                    {cls.isMarked && cls.absentStudents.length === 0 && (
                      <span className="text-xs bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        ✅
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">👥{cls.totalStudents}</span>
                    <span className="text-green-400">✅{cls.presentStudents.length}</span>
                    <span className="text-red-400">❌{cls.absentStudents.length}</span>
                    {expandedClass === cls.id ? (
                      <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400" />
                    )}
                  </div>
                </div>
              </button>
              
              {expandedClass === cls.id && (
                <div className="px-3 pb-3 pt-2 border-t border-white/10">
                  {!cls.isMarked ? (
                    <div className="text-center text-orange-400 py-4 text-sm">
                      <AlertCircle size={24} className="mx-auto mb-1" />
                      Отметка не произведена
                    </div>
                  ) : cls.absentStudents.length === 0 ? (
                    <div className="text-center text-green-400 py-4 text-sm">
                      <CheckCircle size={24} className="mx-auto mb-1" />
                      Все присутствуют
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-gray-300 mb-1">
                        Отсутствуют ({cls.absentStudents.length}):
                      </div>
                      {cls.absentStudents.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                          <span className="text-white text-sm">{student.name}</span>
                          <span className="text-xs text-orange-400">
                            {reasonLabels[student.reason] || student.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
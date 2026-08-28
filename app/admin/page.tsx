"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LogOut, DoorOpen, UserCheck, FileText, Clock, CalendarDays,
  Filter, School, Search, Shield,
  CheckCircle, Users, Undo2,
  UserX, Menu, X as XClose, Home, Download, Eye,
  Bot
} from "lucide-react";

interface Pass {
  id: string;
  studentName: string;
  exitTime: string;
  reason: string;
  date: string;
  type: "single" | "self-exit";
  className?: string;
  grade?: number;
  startDate?: string;
  endDate?: string;
  used?: boolean;
  usedAt?: string;
  photoUrl?: string; // Добавляем поле для фото
}

interface GradeGroup {
  id: string;
  name: string;
  grades: number[];
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"single" | "self-exit" | "departed">("single");
  const [passes, setPasses] = useState<Pass[]>([]);
  const [filteredPasses, setFilteredPasses] = useState<Pass[]>([]);
  const [selfExits, setSelfExits] = useState<Pass[]>([]);
  const [filteredSelfExits, setFilteredSelfExits] = useState<Pass[]>([]);
  const [departedPasses, setDepartedPasses] = useState<Pass[]>([]);
  const [filteredDeparted, setFilteredDeparted] = useState<Pass[]>([]);
  const [selectedLetter, setSelectedLetter] = useState<string>("");
  const [selectedGradeGroup, setSelectedGradeGroup] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selfExitSearchQuery, setSelfExitSearchQuery] = useState("");
  const [departedSearchQuery, setDepartedSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isFiltersVisible, setIsFiltersVisible] = useState(true);
  const [isSelfExitFiltersVisible, setIsSelfExitFiltersVisible] = useState(true);
  const [isDepartedFiltersVisible, setIsDepartedFiltersVisible] = useState(true);
  const [departedSelectedLetter, setDepartedSelectedLetter] = useState<string>("");
  const [departedSelectedGradeGroup, setDepartedSelectedGradeGroup] = useState<string>("");
  const [selfExitSelectedLetter, setSelfExitSelectedLetter] = useState<string>("");
  const [selfExitSelectedGradeGroup, setSelfExitSelectedGradeGroup] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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

  // Загрузка данных - ОДИН ЗАПРОС
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/dashboard-data?tab=${activeTab}`);
      const data = await response.json();

      if (data.error) {
        console.error("Error:", data.error);
        return;
      }

      // Сохраняем все данные
      setPasses(data.passes || []);
      setFilteredPasses(data.passes || []);

      setSelfExits(data.selfExits || []);
      setFilteredSelfExits(data.selfExits || []);

      setDepartedPasses(data.departed || []);
      setFilteredDeparted(data.departed || []);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузка данных при изменении вкладки
  useEffect(() => {
    if (session && session?.user?.roles?.includes("ADMIN")) {
      fetchDashboardData();
    }
  }, [session, activeTab]);

  // Фильтрация активных пропусков
  useEffect(() => {
    let filtered = passes;

    if (searchQuery) {
      filtered = filtered.filter(pass =>
        pass.studentName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedLetter) {
      filtered = filtered.filter(pass =>
        pass.studentName.charAt(0).toUpperCase() === selectedLetter
      );
    }

    if (selectedGradeGroup) {
      const group = gradeGroups.find(g => g.id === selectedGradeGroup);
      if (group) {
        filtered = filtered.filter(pass => group.grades.includes(pass.grade || 0));
      }
    }

    setFilteredPasses(filtered);
  }, [searchQuery, selectedLetter, selectedGradeGroup, passes]);

  // Фильтрация самовыводов
  useEffect(() => {
    let filtered = selfExits;

    if (selfExitSearchQuery) {
      filtered = filtered.filter(pass =>
        pass.studentName.toLowerCase().includes(selfExitSearchQuery.toLowerCase())
      );
    }

    if (selfExitSelectedLetter) {
      filtered = filtered.filter(pass =>
        pass.studentName.charAt(0).toUpperCase() === selfExitSelectedLetter
      );
    }

    if (selfExitSelectedGradeGroup) {
      const group = gradeGroups.find(g => g.id === selfExitSelectedGradeGroup);
      if (group) {
        filtered = filtered.filter(pass => group.grades.includes(pass.grade || 0));
      }
    }

    setFilteredSelfExits(filtered);
  }, [selfExitSearchQuery, selfExitSelectedLetter, selfExitSelectedGradeGroup, selfExits]);

  // Фильтрация ушедших
  useEffect(() => {
    let filtered = departedPasses;

    if (departedSearchQuery) {
      filtered = filtered.filter(pass =>
        pass.studentName.toLowerCase().includes(departedSearchQuery.toLowerCase())
      );
    }

    if (departedSelectedLetter) {
      filtered = filtered.filter(pass =>
        pass.studentName.charAt(0).toUpperCase() === departedSelectedLetter
      );
    }

    if (departedSelectedGradeGroup) {
      const group = gradeGroups.find(g => g.id === departedSelectedGradeGroup);
      if (group) {
        filtered = filtered.filter(pass => group.grades.includes(pass.grade || 0));
      }
    }

    setFilteredDeparted(filtered);
  }, [departedSearchQuery, departedSelectedLetter, departedSelectedGradeGroup, departedPasses]);

  const markAsUsed = async (passId: string) => {
    try {
      const response = await fetch(`/api/passes?id=${passId}`, { method: "PUT" });
      if (response.ok) {
        await fetchDashboardData();
      }
    } catch (error) {
      console.error("Error marking pass as used:", error);
    }
  };

  const undoMarkAsUsed = async (passId: string) => {
    try {
      const response = await fetch(`/api/passes/${passId}/undo`, { method: "PUT" });
      if (response.ok) {
        await fetchDashboardData();
      }
    } catch (error) {
      console.error("Error undoing mark:", error);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  // Функция для скачивания заявления
  const downloadPhoto = async (photoUrl: string, studentName: string) => {
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `заявление_${studentName}_${new Date().toISOString().split('T')[0]}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading photo:", error);
      alert("Ошибка при скачивании файла");
    }
  };

  const menuItems = [
    { id: "dashboard", name: "Пропуски", icon: <DoorOpen size={18} />, action: () => setActiveTab("single") },
    { id: "self-exit", name: "Самовывод", icon: <UserCheck size={18} />, action: () => setActiveTab("self-exit") },
    { id: "departed", name: "Ушедшие", icon: <Users size={18} />, action: () => setActiveTab("departed") },
    { id: "classes", name: "Классы", icon: <School size={18} />, action: () => router.push("/admin/classes") },
    { id: "users", name: "Персонал", icon: <Users size={18} />, action: () => router.push("/admin/users") },
    { id: "absent", name: "Отсутствия", icon: <UserX size={18} />, action: () => router.push("/admin/absent") },
    { id: "home", name: "На главную", icon: <Home size={18} />, action: () => router.push("/") },
    { id: "chat", name: "AI-помощник", icon: <Bot size={18} />, action: () => router.push("/admin/chat") },
    { id: "truants", name: "Прогульщики", icon: <UserX size={18} />, action: () => router.push("/admin/truants") },

  ];

  const renderSingleTab = () => (
    <div className="space-y-2">
      {filteredPasses.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <FileText size={32} className="text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">Нет разовых пропусков на сегодня</p>
        </div>
      ) : (
        filteredPasses.map((pass) => (
          <div key={pass.id} className="bg-green-500/10 backdrop-blur-lg rounded-xl p-3 border border-green-500/30 hover:bg-green-500/20 transition-all">
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <DoorOpen size={14} className="text-green-400" />
                  <h4 className="font-semibold text-white text-sm truncate">{pass.studentName}</h4>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{pass.className}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-blue-400" />
                  <span className="text-xs text-blue-400">{pass.exitTime}</span>
                </div>
                <div className="flex items-center gap-1 min-w-0">
                  <FileText size={10} className="text-gray-400" />
                  <span className="text-xs text-gray-400 truncate">{pass.reason}</span>
                </div>
              </div>
              <button onClick={() => markAsUsed(pass.id)} className="mt-2 w-full py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm transition-all flex items-center justify-center gap-1">
                <CheckCircle size={12} />
                Отметить выход
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderSelfExitTab = () => (
    <div className="space-y-2">
      {/* Фильтры для самовыводов */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={selfExitSearchQuery}
              onChange={(e) => setSelfExitSearchQuery(e.target.value)}
              placeholder="Поиск по ФИО..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={() => setIsSelfExitFiltersVisible(!isSelfExitFiltersVisible)} className="flex items-center justify-center gap-2 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <Filter size={14} />
            {isSelfExitFiltersVisible ? "Скрыть фильтры" : "Показать фильтры"}
          </button>
          {isSelfExitFiltersVisible && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <School size={14} className="text-blue-400" />
                <span className="text-sm text-gray-300">Параллель:</span>
                <select
                  value={selfExitSelectedGradeGroup}
                  onChange={(e) => setSelfExitSelectedGradeGroup(e.target.value)}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-[#1a2332]">Все классы</option>
                  {gradeGroups.map((group) => (
                    <option key={group.id} value={group.id} className="bg-[#1a2332]">{group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Filter size={14} className="text-blue-400" />
                  <span className="text-sm text-gray-300">Фильтр по первой букве:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelfExitSelectedLetter("")}
                    className={`px-2 py-1 rounded-lg text-xs transition-all ${selfExitSelectedLetter === "" ? "bg-blue-500/30 text-blue-300" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}
                  >
                    Все
                  </button>
                  {alphabet.map((letter) => (
                    <button
                      key={letter}
                      onClick={() => setSelfExitSelectedLetter(letter)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${selfExitSelectedLetter === letter ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Список самовыводов */}
      {filteredSelfExits.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <UserCheck size={32} className="text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">Нет активных самовыводов</p>
        </div>
      ) : (
        filteredSelfExits.map((pass) => (
          <div key={pass.id} className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <UserCheck size={14} className="text-indigo-400" />
                <h4 className="font-semibold text-white text-sm truncate">{pass.studentName}</h4>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{pass.className}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="flex items-center gap-1">
                <CalendarDays size={10} className="text-green-400" />
                <span className="text-xs text-green-400">
                  {pass.startDate && pass.endDate ? `${formatDate(pass.startDate)} - ${formatDate(pass.endDate)}` : "Постоянно"}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-1 truncate">{pass.reason}</div>

            {/* Кнопки для скачивания заявления */}
            {pass.photoUrl && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => downloadPhoto(pass.photoUrl!, pass.studentName)}
                  className="flex-1 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm transition-all flex items-center justify-center gap-1"
                >
                  <Download size={14} />
                  Скачать заявление
                </button>
                <button
                  onClick={() => setPreviewImage(pass.photoUrl!)}
                  className="py-1.5 px-3 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm transition-all flex items-center justify-center gap-1"
                >
                  <Eye size={14} />
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {/* Модальное окно для предпросмотра фото */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-[#1a2332] rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-all"
            >
              <XClose size={18} />
            </button>
            <img
              src={previewImage}
              alt="Заявление"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderDepartedTab = () => (
    <div className="space-y-2">
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={departedSearchQuery}
              onChange={(e) => setDepartedSearchQuery(e.target.value)}
              placeholder="Поиск по ФИО..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={() => setIsDepartedFiltersVisible(!isDepartedFiltersVisible)} className="flex items-center justify-center gap-2 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            <Filter size={14} />
            {isDepartedFiltersVisible ? "Скрыть фильтры" : "Показать фильтры"}
          </button>
          {isDepartedFiltersVisible && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <School size={14} className="text-blue-400" />
                <span className="text-sm text-gray-300">Параллель:</span>
                <select
                  value={departedSelectedGradeGroup}
                  onChange={(e) => setDepartedSelectedGradeGroup(e.target.value)}
                  className="px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-[#1a2332]">Все классы</option>
                  {gradeGroups.map((group) => (
                    <option key={group.id} value={group.id} className="bg-[#1a2332]">{group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Filter size={14} className="text-blue-400" />
                  <span className="text-sm text-gray-300">Фильтр по первой букве:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setDepartedSelectedLetter("")}
                    className={`px-2 py-1 rounded-lg text-xs transition-all ${departedSelectedLetter === "" ? "bg-blue-500/30 text-blue-300" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}
                  >
                    Все
                  </button>
                  {alphabet.map((letter) => (
                    <button
                      key={letter}
                      onClick={() => setDepartedSelectedLetter(letter)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${departedSelectedLetter === letter ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {filteredDeparted.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <Users size={32} className="text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">Сегодня никто не уходил</p>
        </div>
      ) : (
        filteredDeparted.map((pass) => (
          <div key={pass.id} className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-3 border border-blue-500/30">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CheckCircle size={14} className="text-blue-400" />
                <h4 className="font-semibold text-white text-sm truncate">{pass.studentName}</h4>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300">{pass.className}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-green-400" />
                <span className="text-xs text-green-400">Выход: {pass.exitTime}</span>
              </div>
              {pass.usedAt && (
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-blue-400" />
                  <span className="text-xs text-blue-400">Отмечен: {new Date(pass.usedAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1 truncate">Причина: {pass.reason}</div>
            <button
              onClick={() => undoMarkAsUsed(pass.id)}
              className="mt-2 w-full py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-sm transition-all flex items-center justify-center gap-1"
            >
              <Undo2 size={12} />
              Отменить выход
            </button>
          </div>
        ))
      )}
    </div>
  );

  if (!mounted || status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!session || !session?.user?.roles?.includes("ADMIN")) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858] pb-16 lg:pb-0">
      {/* Хедер */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg hover:bg-white/20 transition-all"
              >
                {mobileMenuOpen ? <XClose size={18} className="text-white" /> : <Menu size={18} className="text-white" />}
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Shield size={16} className="text-white" />
              </div>
              <h1 className="text-base font-bold text-white">Админ панель</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300 hidden sm:block">{session.user?.name}</span>
              <button onClick={handleLogout} className="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Мобильное меню */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-14 left-0 right-0 bg-[#1a2332] border-b border-white/20 p-2" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-4 gap-1 text-white">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    setMobileMenuOpen(false);
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                >
                  {item.icon}
                  <span className="text-[10px] text-gray-300">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Десктопное меню */}
      <div className="hidden lg:flex bg-white/5 border-b border-white/10 px-4">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("single")}
            className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "single" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-white"}`}
          >
            <DoorOpen size={16} />
            Разовый
          </button>
          <button
            onClick={() => setActiveTab("self-exit")}
            className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "self-exit" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-white"}`}
          >
            <UserCheck size={16} />
            Самовывод
          </button>
          <button
            onClick={() => setActiveTab("departed")}
            className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 ${activeTab === "departed" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-400 hover:text-white"}`}
          >
            <Users size={16} />
            Ушедшие
          </button>
          <div className="w-px h-6 bg-white/10 mx-2 self-center" />
          <button onClick={() => router.push("/admin/classes")} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-all flex items-center gap-2">
            <School size={16} />
            Классы
          </button>
          <button onClick={() => router.push("/admin/users")} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-all flex items-center gap-2">
            <Users size={16} />
            Персонал
          </button>
          <button onClick={() => router.push("/admin/absent")} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-all flex items-center gap-2">
            <UserX size={16} />
            Отсутствия
          </button>
          <button onClick={() => router.push("/admin/truants")} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-all flex items-center gap-2">
            <UserX size={16} /> {/* ✅ ДОБАВЛЕНО */}
            Прогульщики
          </button>
          <button onClick={() => router.push("/")} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-all flex items-center gap-2">
            <Home size={16} />
            На главную
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Поиск и фильтры для разовых пропусков */}
          {activeTab === "single" && (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по ФИО..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setIsFiltersVisible(!isFiltersVisible)}
                className="flex items-center justify-center gap-2 py-1.5 mt-2 text-sm text-gray-400 hover:text-white transition-colors w-full"
              >
                <Filter size={14} />
                {isFiltersVisible ? "Скрыть фильтры" : "Показать фильтры"}
              </button>
              {isFiltersVisible && (
                <div className="space-y-3 pt-2 border-t border-white/10 mt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <School size={14} className="text-blue-400" />
                    <span className="text-sm text-gray-300">Параллель:</span>
                    <select
                      value={selectedGradeGroup}
                      onChange={(e) => setSelectedGradeGroup(e.target.value)}
                      className="px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" className="bg-[#1a2332]">Все классы</option>
                      {gradeGroups.map((group) => (
                        <option key={group.id} value={group.id} className="bg-[#1a2332]">{group.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Filter size={14} className="text-blue-400" />
                      <span className="text-sm text-gray-300">Фильтр по первой букве:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setSelectedLetter("")}
                        className={`px-2 py-1 rounded-lg text-xs transition-all ${selectedLetter === "" ? "bg-blue-500/30 text-blue-300" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}
                      >
                        Все
                      </button>
                      {alphabet.map((letter) => (
                        <button
                          key={letter}
                          onClick={() => setSelectedLetter(letter)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${selectedLetter === letter ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "bg-white/10 text-gray-400 hover:bg-white/20"}`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Статистика */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {activeTab === "departed" ? "Ушедших сегодня:" :
                  activeTab === "self-exit" ? "Активных самовыводов:" :
                    "Всего пропусков:"}
              </span>
              <span className="text-white font-bold">
                {activeTab === "departed" ? filteredDeparted.length :
                  activeTab === "self-exit" ? filteredSelfExits.length :
                    filteredPasses.length}
              </span>
            </div>
          </div>

          {/* Контент */}
          {activeTab === "single" && renderSingleTab()}
          {activeTab === "self-exit" && renderSelfExitTab()}
          {activeTab === "departed" && renderDepartedTab()}
        </div>
      </div>
    </div>
  );
}
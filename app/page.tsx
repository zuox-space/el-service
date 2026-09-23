"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LogOut, Calendar, FileText, CheckCircle, Clock, UserRound,
  PenSquare, XCircle, BookMarked, CheckSquare, Plus, UserCheck,
  Shield, School, AlertTriangle, ClipboardList, Users, Bell,
  Info, Sparkles, TrendingUp, Award, Loader2
} from "lucide-react";
import WeekListScrollable from "@/components/ui/WeekListScrollable";
import PassModal from "@/components/ui/PassModal";
import AttendanceModal from "@/components/ui/AttendanceModal";
import ClassSelector from "@/components/ui/ClassSelector";
import NewsModal from "@/components/ui/NewsModal";
import NotesModal from "@/components/ui/NotesModal";
import SelfExitModal from "@/components/ui/SelfExitModal";
import ViolationModal from "@/components/ui/ViolationModal";
import ViolationsList from "@/components/ui/ViolationsList";
import { safeFormatShortName } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import AuthorizationModal from "@/components/ui/AuthorizationModal";
import { Archive, Trash2, User } from "lucide-react";

interface TabType {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Инициализация с текущей датой в локальном времени
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  // 🔥 Состояния для ВШУ
  const [schoolRecords, setSchoolRecords] = useState<any[]>([]);
  const [isLoadingSchoolRecords, setIsLoadingSchoolRecords] = useState(false);
  const [isViolationModalOpen, setIsViolationModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("attendance");
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isSelfExitModalOpen, setIsSelfExitModalOpen] = useState(false);
  const [passesHistory, setPassesHistory] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [selfExits, setSelfExits] = useState<any[]>([]);
  const [todayViolations, setTodayViolations] = useState<any[]>([]);
  const [isLoadingViolations, setIsLoadingViolations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  // Доверенности
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [archivedAuthorizations, setArchivedAuthorizations] = useState<any[]>([]);
  const [isLoadingAuthorizations, setIsLoadingAuthorizations] = useState(false);
  const [isAuthorizationModalOpen, setIsAuthorizationModalOpen] = useState(false);
  const [authorizationTab, setAuthorizationTab] = useState<"active" | "archive">("active");
  // Функция для очистки времени у даты
  const clearTime = (date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Функция для сравнения дат (без учета времени)
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  };
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const roles = (session?.user?.roles as string[]) || [];
  const isAdmin = roles.includes("ADMIN");
  const isClassTeacher = roles.includes("CLASS_TEACHER");
  const isTeacher = roles.includes("TEACHER");
  const isJuniorClass = useMemo(() => {
    if (!selectedClass) return false;

    // Берём grade из класса, либо парсим из названия
    const grade = selectedClass.grade ||
      parseInt(selectedClass.name?.match(/^(\d+)/)?.[1] || "0");

    return grade >= 1 && grade <= 4;
  }, [selectedClass]);
  const showJuniorFeatures = isJuniorClass;

  // Проверяем, есть ли у пользователя классы
  const hasClasses = classes.length > 0;

  // Показываем рабочий интерфейс только если есть классы или права классного руководителя
  const showWorkInterface = hasClasses || isClassTeacher;

  const tabs: TabType[] = useMemo(() => {
    const baseTabs: TabType[] = [
      { id: "attendance", name: "Пропуски", icon: <FileText size={16} /> },
      { id: "violations", name: "Нарушения", icon: <AlertTriangle size={16} /> },
      { id: "schoolRecord", name: "ВШУ", icon: <ShieldAlert size={16} /> },
    ];

    // 🔥 Самовыход и Доверенности — только для младших классов или админов
    if (showJuniorFeatures) {
      baseTabs.splice(1, 0,
        { id: "self-exit", name: "Самовыход", icon: <UserCheck size={16} /> }
      );
      baseTabs.push(
        { id: "authorizations", name: "Доверенности", icon: <Shield size={16} /> }
      );
    }

    return baseTabs;
  }, [showJuniorFeatures]);
  {/* Состояния для отслеживания скролла */ }
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // 🔥 Проверка скролла
  const checkScroll = () => {
    if (!tabsContainerRef.current) return;
    const el = tabsContainerRef.current;

    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  // Проверяем при монтировании, скролле и изменении размера
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;

    checkScroll();

    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    // Небольшая задержка для правильного расчёта
    const timer = setTimeout(checkScroll, 100);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      clearTimeout(timer);
    };
  }, [tabs]);

  // Проверяем после смены вкладки
  useEffect(() => {
    checkScroll();

    // Автоскролл к активному табу
    if (tabsContainerRef.current) {
      const activeButton = tabsContainerRef.current.querySelector(
        `[data-tab-id="${activeTab}"]`
      ) as HTMLElement;

      if (activeButton) {
        activeButton.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeTab]);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/login" });
  };

  // Функция для получения списка учеников из класса
  const getStudentsFromClass = useCallback((classData: any) => {
    if (!classData) return [];

    let students = classData.students;
    if (typeof students === 'string') {
      try {
        students = JSON.parse(students);
      } catch (e) {
        students = [];
      }
    }
    if (!Array.isArray(students)) {
      students = [];
    }
    return students;
  }, []);

  // Загрузка классов
  useEffect(() => {
    const fetchClasses = async () => {
      if (!session) return;

      try {
        const response = await fetch("/api/classes");
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          setClasses(data);
          const firstClass = data[0];
          setSelectedClass(firstClass);
          const students = getStudentsFromClass(firstClass);
          setStudentsList(students);
        } else {
          setClasses([]);
          setSelectedClass(null);
          setStudentsList([]);
        }
      } catch (error) {
        console.error("Error fetching classes:", error);
        setClasses([]);
        setSelectedClass(null);
        setStudentsList([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) {
      fetchClasses();
    }
  }, [session, getStudentsFromClass]);

  // Обработчик смены класса
  const handleClassChange = useCallback((classData: any) => {
    setSelectedClass(classData);
    const students = getStudentsFromClass(classData);
    setStudentsList(students);
  }, [getStudentsFromClass]);

  // Загрузка данных для выбранной даты и класса
  useEffect(() => {
    if (!selectedClass) return;

    const fetchData = async () => {
      try {
        const dateStr = formatDateLocal(selectedDate);

        const [attendanceRes, passesRes, newsRes, notesRes, selfExitRes] = await Promise.all([
          fetch(`/api/attendance?classId=${selectedClass.id}&date=${dateStr}`),
          fetch(`/api/passes?classId=${selectedClass.id}&date=${dateStr}`),
          fetch(`/api/news?classId=${selectedClass.id}&date=${dateStr}`),
          fetch(`/api/notes?classId=${selectedClass.id}&date=${dateStr}`),
          fetch(`/api/self-exit?classId=${selectedClass.id}&date=${dateStr}`)
        ]);

        const attendance = await attendanceRes.json();
        const passes = await passesRes.json();
        const newsData = await newsRes.json();
        const notesData = await notesRes.json();
        const selfExitData = await selfExitRes.json();

        setAttendanceHistory(attendance ? [attendance] : []);
        setPassesHistory(Array.isArray(passes) ? passes : []);
        setNews(Array.isArray(newsData) ? newsData : []);
        setNotes(Array.isArray(notesData) ? notesData : []);
        setSelfExits(Array.isArray(selfExitData) ? selfExitData : []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setAttendanceHistory([]);
        setPassesHistory([]);
        setNews([]);
        setNotes([]);
        setSelfExits([]);
      }
    };

    fetchData();
  }, [selectedClass, selectedDate]);

  // 🔥 Загрузка нарушений за выбранную дату и класс
  useEffect(() => {
    if (!selectedClass || activeTab !== "violations") return;

    const fetchViolations = async () => {
      setIsLoadingViolations(true);
      try {
        const dateStr = formatDateLocal(selectedDate);
        const response = await fetch(
          `/api/violations?className=${encodeURIComponent(selectedClass.name)}&date=${dateStr}`
        );
        const data = await response.json();
        setTodayViolations(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching violations:", error);
        setTodayViolations([]);
      } finally {
        setIsLoadingViolations(false);
      }
    };

    fetchViolations();
  }, [selectedClass, selectedDate, activeTab]);
  // 🔥 Сброс вкладки при смене класса на старший
  useEffect(() => {
    if (!showJuniorFeatures &&
      (activeTab === "self-exit" || activeTab === "authorizations")) {
      setActiveTab("attendance");
    }
  }, [showJuniorFeatures, activeTab]);
  useEffect(() => {
    if (!selectedClass || activeTab !== "schoolRecord") return;

    const fetchSchoolRecords = async () => {
      setIsLoadingSchoolRecords(true);
      try {
        const response = await fetch(
          `/api/school-records/class?className=${encodeURIComponent(selectedClass.name)}`
        );
        const data = await response.json();
        setSchoolRecords(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching school records:", error);
        setSchoolRecords([]);
      } finally {
        setIsLoadingSchoolRecords(false);
      }
    };

    fetchSchoolRecords();
  }, [selectedClass, activeTab]);
  const handleSubmitPass = async (passData: any) => {
    if (!selectedClass) {
      alert("Класс не выбран");
      return;
    }

    const payload = {
      date: passData.date,
      classId: selectedClass.id,
      students: passData.students,
      exitTime: passData.exitTime,
      reason: passData.reason,
    };

    try {
      const response = await fetch("/api/passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to create pass");

      const newPass = await response.json();
      setPassesHistory(prev => [newPass, ...prev]);
      alert("Пропуск успешно оформлен!");
    } catch (error) {
      console.error("Error creating pass:", error);
      alert("Ошибка при создании пропуска");
    }
  };
  const handleSubmitAuthorization = async (data: any) => {
    if (!selectedClass) {
      alert("Класс не выбран");
      return;
    }

    try {
      const response = await fetch("/api/authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          className: selectedClass.name, // 🔥 Принудительно из выбранного класса
        }),
      });

      if (!response.ok) throw new Error("Failed");

      const newAuth = await response.json();
      setAuthorizations(prev => [newAuth, ...prev]);
      alert("Доверенность добавлена!");
    } catch (error) {
      console.error("Error:", error);
      alert("Ошибка при сохранении");
      throw error;
    }
  };

  const handleRevokeAuthorization = async (id: string) => {
    if (!confirm("Отозвать доверенность? Она переместится в архив.")) return;

    try {
      const response = await fetch("/api/authorizations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error("Failed");

      const revoked = await response.json();

      setAuthorizations(prev => prev.filter(a => a.id !== id));
      setArchivedAuthorizations(prev => [revoked, ...prev]);

      alert("Доверенность отозвана");
    } catch (error) {
      console.error("Error:", error);
      alert("Ошибка при отзыве");
    }
  };
  // 🔥 Загрузка доверенностей
  useEffect(() => {
    if (!selectedClass || activeTab !== "authorizations") return;

    const fetchAuthorizations = async () => {
      setIsLoadingAuthorizations(true);
      try {
        const [activeRes, archiveRes] = await Promise.all([
          fetch(`/api/authorizations?className=${encodeURIComponent(selectedClass.name)}&active=true`),
          fetch(`/api/authorizations?className=${encodeURIComponent(selectedClass.name)}&active=false`),
        ]);

        const activeData = await activeRes.json();
        const archiveData = await archiveRes.json();

        setAuthorizations(Array.isArray(activeData) ? activeData : []);
        setArchivedAuthorizations(Array.isArray(archiveData) ? archiveData : []);
      } catch (error) {
        console.error("Error fetching authorizations:", error);
        setAuthorizations([]);
        setArchivedAuthorizations([]);
      } finally {
        setIsLoadingAuthorizations(false);
      }
    };

    fetchAuthorizations();
  }, [selectedClass, activeTab]);
  const renderAuthorizationsTab = () => {
    const studentsWithAuth = new Set(authorizations.map(a => a.studentId));

    return (
      <div className="space-y-3">
        {/* Кнопка добавить */}
        <button
          onClick={() => setIsAuthorizationModalOpen(true)}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-cyan-500/20"
        >
          <Plus size={16} />
          <span>Добавить доверенность</span>
        </button>

        {/* Статистика */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-cyan-400" />
              <span className="text-[10px] text-gray-400">Учеников в классе</span>
            </div>
            <p className="text-xl font-bold text-cyan-400">{studentsList.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={12} className="text-green-400" />
              <span className="text-[10px] text-gray-400">С доверенностью</span>
            </div>
            <p className="text-xl font-bold text-green-400">{studentsWithAuth.size}</p>
          </div>
        </div>

        {/* Табы Активные / Архив */}
        <div className="grid grid-cols-2 gap-1 bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setAuthorizationTab("active")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${authorizationTab === "active"
              ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <Shield size={12} />
            Активные
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${authorizationTab === "active" ? "bg-white/20" : "bg-white/10"
              }`}>
              {authorizations.length}
            </span>
          </button>
          <button
            onClick={() => setAuthorizationTab("archive")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${authorizationTab === "archive"
              ? "bg-gradient-to-r from-gray-500 to-slate-500 text-white shadow-md"
              : "text-gray-400 hover:text-white"
              }`}
          >
            <Archive size={12} />
            Архив
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${authorizationTab === "archive" ? "bg-white/20" : "bg-white/10"
              }`}>
              {archivedAuthorizations.length}
            </span>
          </button>
        </div>

        {/* Список */}
        {isLoadingAuthorizations ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
            <Loader2 size={28} className="animate-spin text-cyan-400 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Загрузка...</p>
          </div>
        ) : authorizationTab === "active" ? (
          authorizations.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
              <Shield size={32} className="text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Нет активных доверенностей</p>
              <p className="text-gray-500 text-xs mt-1">
                Нажмите «Добавить доверенность» чтобы создать
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {authorizations.map((auth) => (
                <div
                  key={auth.id}
                  className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-cyan-500/30"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <Shield size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-white text-sm truncate">
                        {auth.studentName}
                      </h4>
                      <p className="text-[10px] text-gray-400">
                        Забирает: <span className="text-cyan-300">{auth.trustedName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    <div className="bg-white/5 rounded-lg p-2">
                      <p className="text-gray-500 mb-0.5">Кем приходится</p>
                      <p className="text-white font-medium">{auth.relation}</p>
                    </div>
                    {auth.phone && (
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-gray-500 mb-0.5">Телефон</p>
                        <p className="text-white font-medium">{auth.phone}</p>
                      </div>
                    )}
                  </div>

                  {auth.comment && (
                    <div className="bg-white/5 rounded-lg p-2 mb-2 text-[10px]">
                      <p className="text-gray-500 mb-0.5">Комментарий</p>
                      <p className="text-gray-300">{auth.comment}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-gray-500">
                      Добавил: {auth.teacherName} ·{' '}
                      {new Date(auth.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                    <button
                      onClick={() => handleRevokeAuthorization(auth.id)}
                      className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-[10px] transition-all flex items-center gap-1"
                    >
                      <Trash2 size={10} />
                      Отозвать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          archivedAuthorizations.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
              <Archive size={32} className="text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Архив пуст</p>
            </div>
          ) : (
            <div className="space-y-2">
              {archivedAuthorizations.map((auth) => (
                <div
                  key={auth.id}
                  className="bg-white/5 backdrop-blur-lg rounded-xl p-3 border border-white/10 opacity-75"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-500 to-slate-600 flex items-center justify-center flex-shrink-0">
                      <Archive size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-300 text-sm truncate">
                        {auth.studentName}
                      </h4>
                      <p className="text-[10px] text-gray-500">
                        Забирал: {auth.trustedName}
                      </p>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-500 space-y-0.5">
                    <p>Кем приходится: {auth.relation}</p>
                    <p>
                      Отозвана: {auth.revokedAt
                        ? new Date(auth.revokedAt).toLocaleDateString('ru-RU')
                        : '—'}
                      {auth.revokedByName && ` · ${auth.revokedByName}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    );
  };
  const handleSubmitAttendance = async (attendanceData: any) => {
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...attendanceData, classId: selectedClass.id })
      });

      if (!response.ok) throw new Error("Failed to save attendance");

      const newAttendance = await response.json();
      setAttendanceHistory([newAttendance]);
      alert("Отметка успешно сохранена!");
    } catch (error) {
      console.error("Error saving attendance:", error);
      alert("Ошибка при сохранении отметки");
    }
  };

  const handleSubmitNews = async (newsData: any) => {
    try {
      const response = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newsData, classId: selectedClass.id, date: formatDateLocal(selectedDate) })
      });

      if (!response.ok) throw new Error("Failed to create news");

      const newNews = await response.json();
      setNews(prev => [newNews, ...prev]);
      alert("Новость добавлена!");
    } catch (error) {
      console.error("Error creating news:", error);
      alert("Ошибка при добавлении новости");
    }
  };

  const handleSubmitNote = async (noteData: any) => {
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...noteData, classId: selectedClass.id, date: formatDateLocal(selectedDate) })
      });

      if (!response.ok) throw new Error("Failed to create note");

      const newNote = await response.json();
      setNotes(prev => [newNote, ...prev]);
      alert("Заметка добавлена!");
    } catch (error) {
      console.error("Error creating note:", error);
      alert("Ошибка при добавлении заметки");
    }
  };

  const handleSubmitSelfExit = async (data: any) => {
    try {
      const response = await fetch("/api/self-exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, classId: selectedClass.id })
      });

      if (!response.ok) throw new Error("Failed to create self-exit");

      const newSelfExit = await response.json();
      setSelfExits(prev => [newSelfExit, ...prev]);
      alert("Самовыход добавлен!");
    } catch (error) {
      console.error("Error creating self-exit:", error);
      alert("Ошибка при добавлении самовыхода");
    }
  };

  const handleSubmitViolation = async (data: any) => {
    try {
      const response = await fetch("/api/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to create violation");

      const newViolation = await response.json();
      alert("Нарушение зафиксировано!");

      // 🔥 Обновляем список, если открыт таб нарушений
      if (activeTab === "violations" && selectedClass) {
        const dateStr = formatDateLocal(selectedDate);
        const violationsRes = await fetch(
          `/api/violations?className=${encodeURIComponent(selectedClass.name)}&date=${dateStr}`
        );
        const violationsData = await violationsRes.json();
        setTodayViolations(Array.isArray(violationsData) ? violationsData : []);
      }

      return newViolation;
    } catch (error) {
      console.error("Error creating violation:", error);
      alert("Ошибка при сохранении нарушения");
      throw error;
    }
  };

  const toggleNoteStatus = async (noteId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: noteId, completed: !completed })
      });

      if (response.ok) {
        setNotes(prev => prev.map(note =>
          note.id === noteId ? { ...note, completed: !completed } : note
        ));
      }
    } catch (error) {
      console.error("Error updating note:", error);
    }
  };

  const deletePass = async (passId: string, passDate: Date) => {
    const now = new Date();
    const today = clearTime(new Date());
    const passDateOnly = clearTime(new Date(passDate));

    if (passDateOnly < today) {
      alert("Нельзя удалить пропуск за прошедшую дату");
      return;
    }

    if (isSameDay(passDateOnly, today)) {
      const currentHour = now.getHours();
      if (currentHour >= 15) {
        alert("Пропуск за сегодня нельзя удалить после 15:00");
        return;
      }
    }

    try {
      await fetch(`/api/passes?id=${passId}`, { method: "DELETE" });
      setPassesHistory(prev => prev.filter(pass => pass.id !== passId));
      alert("Пропуск удален");
    } catch (error) {
      console.error("Error deleting pass:", error);
      alert("Ошибка при удалении пропуска");
    }
  };

  const canIssuePass = (date: Date) => {
    const today = clearTime(new Date());
    const selectedDateOnly = clearTime(new Date(date));
    return selectedDateOnly >= today;
  };

  const canDeletePass = (passDate: Date) => {
    const today = clearTime(new Date());
    const passDateOnly = clearTime(new Date(passDate));
    return passDateOnly >= today;
  };

  // Мемоизация данных
  const passesForSelectedDate = useMemo(() => Array.isArray(passesHistory) ? passesHistory : [], [passesHistory]);
  const attendanceForSelectedDate = useMemo(() => attendanceHistory && attendanceHistory.length > 0 ? attendanceHistory[0] : null, [attendanceHistory]);
  const absentStudentsOnSelectedDate = useMemo(() => attendanceForSelectedDate?.absentStudents || [], [attendanceForSelectedDate]);

  const isSelectedDateToday = useMemo(() => {
    const today = clearTime(new Date());
    return isSameDay(selectedDate, today);
  }, [selectedDate]);

  const isTodayAttendanceMarked = useMemo(() => {
    const today = clearTime(new Date());
    return attendanceHistory.some(a => {
      if (!a || !a.date) return false;
      const aDate = new Date(a.date);
      return isSameDay(aDate, today);
    });
  }, [attendanceHistory]);

  const canIssue = useMemo(() => canIssuePass(selectedDate), [selectedDate]);

  const absentStudentsList = useMemo(() => (attendanceForSelectedDate?.absentStudents || []).map((id: number) => {
    const student = studentsList.find((s: any) => s.id === id);
    const reasonId = attendanceForSelectedDate?.absentReasons?.[id];
    const reasonLabels: Record<string, string> = {
      sick: "🤒 Болен",
      family: "📝 По заявлению родителей",
      other: "⚠️ Причина неясна или неизвестна",
      vacation: "✈️ Отпуск",
      competition: "🏆 Соревнования"
    };
    return {
      name: student?.name || "Неизвестно",
      reason: reasonId ? reasonLabels[reasonId] : "Причина не указана"
    };
  }), [attendanceForSelectedDate, studentsList]);

  if (!mounted || status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a2332 0%, #2b3858 100%)" }}>
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // 🔥 ИНФОРМАЦИОННАЯ СТРАНИЦА для пользователей без классного руководства
  if (!showWorkInterface) {
    return (
      <div className="min-h-screen p-3 pb-24" style={{ background: "linear-gradient(135deg, #1a2332 0%, #2b3858 100%)" }}>
        <div className="max-w-md mx-auto space-y-3">
          {/* Карточка пользователя */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <UserRound size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-white">{safeFormatShortName(session.user.name)}</p>
                  <p className="text-xs text-gray-400">
                    {isAdmin ? "Администратор" : isTeacher ? "Преподаватель" : "Сотрудник"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => router.push("/admin")}
                    className="w-8 h-8 flex items-center justify-center bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all border border-purple-500/30"
                    title="Админ-панель"
                  >
                    <Shield size={16} />
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all border border-red-500/30"
                  title="Выйти"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Главная карточка */}
          <div className="bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-6 text-center border border-white/20">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
              <Sparkles size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              Электронные сервисы школы
            </h1>
            <p className="text-gray-300 text-sm leading-relaxed">
              Единая система для работы с пропусками, формой одежды и нарушениями внутреннего распорядка
            </p>
          </div>

          {/* Функционал системы */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <ClipboardList size={14} className="text-blue-400" />
              </div>
              <h2 className="font-semibold text-white text-sm">Возможности системы</h2>
            </div>

            <div className="space-y-3">
              {/* Пропуска */}
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium">Пропуска</h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Оформление пропусков для учеников с указанием причины и времени выхода
                  </p>
                </div>
              </div>

              {/* Самовыход */}
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <UserCheck size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium">Самовыход</h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Фиксация заявлений на самостоятельный уход учеников с приложением фото
                  </p>
                </div>
              </div>

              {/* Нарушения */}
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium">Нарушения</h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Учёт нарушений формы одежды, опозданий, порчи имущества и других проступков
                  </p>
                </div>
              </div>

              {/* Посещаемость */}
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium">Посещаемость</h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Ежедневная отметка присутствия учеников с указанием причин отсутствия
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Назначение */}
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Info size={14} className="text-amber-400" />
              </div>
              <h2 className="font-semibold text-white text-sm">Назначение</h2>
            </div>
            <p className="text-gray-300 text-xs leading-relaxed">
              Приложение создано для сбора и систематизации общей информации об обучающихся:
              контроля посещаемости, учёта уважительных причин отсутствия, фиксации нарушений
              внутреннего распорядка и организации самостоятельного ухода учеников.
            </p>
            <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <TrendingUp size={12} className="text-green-400" />
                <span>Оперативный сбор данных</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Users size={12} className="text-blue-400" />
                <span>Работа с учениками из базы MySQL</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Award size={12} className="text-yellow-400" />
                <span>Формирование отчётности</span>
              </div>
            </div>
          </div>

          {/* Контакт администратора */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 border border-white/10 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Bell size={14} className="text-blue-400" />
              <p className="text-xs text-gray-400">Для получения доступа к рабочему интерфейсу</p>
            </div>
            <p className="text-sm text-white font-medium">обратитесь к администратору системы</p>
          </div>
        </div>

        {/* 🔥 Круглая кнопка для фиксации нарушений */}
        <button
          onClick={() => setIsViolationModalOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-2xl shadow-rose-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          title="Зафиксировать нарушение"
        >
          <AlertTriangle size={24} />
        </button>

        {/* Модальное окно нарушения */}
        <ViolationModal
          isOpen={isViolationModalOpen}
          onClose={() => setIsViolationModalOpen(false)}
          onSubmit={handleSubmitViolation}
        />
      </div>
    );
  }
  // 🔥 Рендер таба ВШУ
  const renderSchoolRecordTab = () => (
    <div className="space-y-3">
      {/* Заголовок с количеством */}
      <div className="bg-orange-500/10 backdrop-blur-lg rounded-xl p-3 border border-orange-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-orange-400" />
            <span className="text-sm text-white font-medium">
              Ученики на внутришкольном учёте
            </span>
          </div>
          <span className="text-sm font-bold text-orange-400">
            {schoolRecords.length}
          </span>
        </div>
      </div>

      {/* Список учеников на ВШУ */}
      {isLoadingSchoolRecords ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <Loader2 size={28} className="animate-spin text-orange-400 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Загрузка...</p>
        </div>
      ) : schoolRecords.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <ShieldAlert size={32} className="text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">
            Нет учеников на внутришкольном учёте
          </p>
          <p className="text-gray-500 text-xs mt-1">
            В классе {selectedClass?.name} никто не состоит на учёте
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {schoolRecords.map((record) => (
            <div
              key={record.id}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-orange-500/30"
            >
              {/* Заголовок с именем */}
              <div className="flex items-start gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm truncate">
                    {record.studentName}
                  </h4>
                  <p className="text-[10px] text-gray-400">
                    <Calendar size={9} className="inline mr-1" />
                    Поставлен {new Date(record.registeredAt).toLocaleDateString('ru-RU')}
                    {' · '}
                    {record.registeredByName}
                  </p>
                </div>
              </div>

              {/* Причина */}
              <div className="bg-orange-500/10 rounded-lg p-2 border border-orange-500/20">
                <p className="text-[10px] text-orange-400 mb-0.5">
                  Причина постановки
                </p>
                <p className="text-xs text-white">
                  {record.reason}
                </p>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-2 border border-orange-500/20 mb-2">
                <p className="text-[10px] text-orange-400 mb-0.5">
                  Причина постановки
                </p>
                <p className="text-xs text-white">
                  {record.reason}
                </p>

                {/* 🔥 ДОБАВЛЕНО: Планируемая дата снятия */}
                {record.plannedReleaseAt && (
                  <p className="text-[10px] text-blue-400 mt-1 pt-1 border-t border-orange-500/20 flex items-center gap-1">
                    <Clock size={9} />
                    План. снятие: {new Date(record.plannedReleaseAt).toLocaleDateString('ru-RU')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  // Рендер таба пропусков
  const renderAttendanceTab = () => (
    <div className="space-y-3">

      {/* Кнопки */}
      <div className="flex flex-col gap-2">
        {isSelectedDateToday && (
          <button
            onClick={() => setIsAttendanceModalOpen(true)}
            className="flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-medium rounded-xl transition-all text-sm shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
          >
            <CheckCircle size={16} />
            <span>Отметить присутствие</span>
            {!isTodayAttendanceMarked && (
              <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center text-[10px] font-bold animate-pulse">
                !
              </div>
            )}
          </button>
        )}

        {canIssue && (
          <button
            onClick={() => setIsPassModalOpen(true)}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium rounded-xl transition-all text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 ${!isSelectedDateToday ? 'w-full' : ''}`}
          >
            <PenSquare size={16} />
            <span>Выписать пропуск</span>
          </button>
        )}
      </div>

      {absentStudentsList.length > 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border-l-4 border-red-500 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={12} className="text-red-400" />
            <span className="text-sm font-semibold text-red-400">
              Отсутствуют ({absentStudentsList.length})
            </span>
          </div>
          <div className="space-y-1 pl-6">
            {absentStudentsList.slice(0, 5).map((student: { name: string }, idx: number) => (
              <div key={idx} className="text-sm text-gray-300 flex justify-between">
                <span className="truncate pr-2">{student.name}</span>
              </div>
            ))}
            {absentStudentsList.length > 5 && (
              <div className="text-gray-500 text-sm">+{absentStudentsList.length - 5}</div>
            )}
          </div>
        </div>
      ) : (
        attendanceForSelectedDate && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border-l-4 border-green-500 border border-white/20">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-400" />
              <span className="text-base text-green-400">Все присутствуют</span>
            </div>
          </div>
        )
      )}

      {passesForSelectedDate.length > 0 && (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={12} className="text-blue-400" />
            <h3 className="font-semibold text-white text-sm">Пропуска</h3>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {passesForSelectedDate.map((pass: any) => {
              const canDelete = canDeletePass(new Date(pass.date));
              return (
                <div key={pass.id} className="bg-white/5 rounded-lg p-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <Clock size={9} className="text-blue-400" />
                        <span className="text-sm font-semibold text-blue-400">{pass.exitTime}</span>
                      </div>
                      <div className="text-sm text-gray-400">
                        {pass.students?.map((s: any) => s.name).slice(0, 2).join(", ")}
                        {pass.students?.length > 2 && ` +${pass.students.length - 2}`}
                      </div>
                    </div>
                    {canDelete && (
                      <button onClick={() => deletePass(pass.id, pass.date)} className="text-red-400 text-base p-2">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Рендер таба самовыхода
  const renderSelfExitTab = () => (
    <div className="space-y-2">
      {showJuniorFeatures && (<button
        onClick={() => setIsSelfExitModalOpen(true)}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
      >
        <Plus size={16} />
        <span>Добавить самовыход</span>
      </button>)}

      {selfExits.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <UserCheck size={32} className="text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">Нет активных самовыходов</p>
        </div>
      ) : (
        selfExits.map((item) => (
          <div key={item.id} className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2 flex-1">
                <UserCheck size={16} className="text-indigo-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-base">{item.studentName}</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    📅 {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
                  </p>
                  {item.reason && (
                    <p className="text-sm text-gray-300 mt-1">Причина: {item.reason}</p>
                  )}
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/self-exit?id=${item.id}`, {
                      method: "DELETE"
                    });
                    if (response.ok) {
                      setSelfExits(prev => prev.filter(exit => exit.id !== item.id));
                    }
                  } catch (error) {
                    console.error("Error deleting self-exit:", error);
                  }
                }}
                className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                title="Отменить самовыход"
              >
                ✕
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // 🔥 Рендер таба нарушений
  const renderViolationsTab = () => (
    <div className="space-y-3">
      {/* Кнопка добавить нарушение */}
      <button
        onClick={() => setIsViolationModalOpen(true)}
        className="w-full bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30"
      >
        <Plus size={16} />
        <span>Добавить нарушение</span>
      </button>

      {/* Заголовок с количеством */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-400" />
            <span className="text-sm text-white font-medium">
              Нарушения за {new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </span>
          </div>
          <span className="text-sm font-bold text-rose-400">
            {todayViolations.length}
          </span>
        </div>
      </div>

      {/* Список нарушений */}
      <ViolationsList
        violations={todayViolations}
        isLoading={isLoadingViolations}
        showClassName={false}
        emptyMessage="Сегодня нарушений нет"
      />
    </div>
  );

  return (
    <div className="min-h-screen p-3 pb-24" style={{ background: "linear-gradient(135deg, #1a2332 0%, #2b3858 100%)" }}>
      <div className="max-w-md mx-auto space-y-3">
        {/* Карточка преподавателя */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <UserRound size={18} className="text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-white">{safeFormatShortName(session.user.name)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => router.push("/admin")}
                  className="w-8 h-8 flex items-center justify-center bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-all border border-purple-500/30"
                  title="Админ-панель"
                >
                  <Shield size={16} />
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all border border-red-500/30"
                title="Выйти"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Выбор класса */}
        <ClassSelector
          selectedClass={selectedClass}
          onClassChange={handleClassChange}
          classes={classes}
          currentTeacherId={session.user?.id}
        />

        {/* Календарь */}
        {activeTab !== "self-exit" && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Calendar size={14} className="text-blue-400" />
              </div>
              <h3 className="font-semibold text-white text-base">Календарь</h3>
            </div>
            <WeekListScrollable selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
          </div>
        )}

        {/* Табы */}
        {/* Табы со скроллом */}
        <div className="bg-white/5 rounded-xl p-1 relative">

          {/* 🔥 Стрелка влево */}
          {canScrollLeft && (
            <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
              <div className="w-6 h-6 rounded-full bg-blue-500/80 flex items-center justify-center shadow-lg animate-pulse">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            </div>
          )}

          {/* 🔥 Стрелка вправо */}
          {canScrollRight && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
              <div className="w-6 h-6 rounded-full bg-blue-500/80 flex items-center justify-center shadow-lg animate-pulse">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )}

          {/* Градиенты слева/справа */}
          {canScrollLeft && (
            <div className="absolute left-1 top-1 bottom-1 w-8 bg-gradient-to-r from-[#1a2332] to-transparent pointer-events-none z-10 rounded-l-lg" />
          )}
          {canScrollRight && (
            <div className="absolute right-1 top-1 bottom-1 w-8 bg-gradient-to-l from-[#1a2332] to-transparent pointer-events-none z-10 rounded-r-lg" />
          )}

          <div
            ref={tabsContainerRef}
            className="flex gap-1 overflow-x-auto scrollbar-hide"
          >
            {tabs.map((tab) => {
              // 🔥 Защита: если фича не разрешена, не рендерим эту вкладку
              const isRestricted =
                (tab.id === "self-exit" || tab.id === "authorizations") &&
                !showJuniorFeatures;

              if (isRestricted) return null;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${activeTab === tab.id
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                    }`}
                >
                  {tab.icon}
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Контент активного таба */}
        {activeTab === "attendance" && renderAttendanceTab()}
        {activeTab === "self-exit" && showJuniorFeatures && renderSelfExitTab()}
        {activeTab === "violations" && renderViolationsTab()}
        {activeTab === "schoolRecord" && renderSchoolRecordTab()}
        {activeTab === "authorizations" && showJuniorFeatures && renderAuthorizationsTab()}


      </div>

      {/* Модальные окна */}
      <PassModal
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        selectedDate={selectedDate}
        onSubmit={handleSubmitPass}
        existingPasses={passesForSelectedDate}
        absentStudentsOnDate={absentStudentsOnSelectedDate}
        studentsList={studentsList}
      />

      <AttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        selectedDate={selectedDate}
        onSubmit={handleSubmitAttendance}
        existingAttendance={attendanceForSelectedDate}
        studentsList={studentsList}
      />

      <NewsModal
        isOpen={isNewsModalOpen}
        onClose={() => setIsNewsModalOpen(false)}
        onSubmit={handleSubmitNews}
      />

      <NotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        onSubmit={handleSubmitNote}
      />



      {/* 🔥 Круглая кнопка для фиксации нарушений */}
      <button
        onClick={() => setIsViolationModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-2xl shadow-rose-500/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Зафиксировать нарушение"
      >
        <AlertTriangle size={24} />
      </button>

      {/* Модальное окно нарушения */}
      <ViolationModal
        isOpen={isViolationModalOpen}
        onClose={() => setIsViolationModalOpen(false)}
        onSubmit={handleSubmitViolation}
      />
      {showJuniorFeatures && (
        <>
          <SelfExitModal
            isOpen={isSelfExitModalOpen}
            onClose={() => setIsSelfExitModalOpen(false)}
            onSubmit={handleSubmitSelfExit}
            studentsList={studentsList}
          />

          <AuthorizationModal
            isOpen={isAuthorizationModalOpen}
            onClose={() => setIsAuthorizationModalOpen(false)}
            onSubmit={handleSubmitAuthorization}
            studentsList={studentsList}
          />
        </>
      )}
    </div>
  );
}
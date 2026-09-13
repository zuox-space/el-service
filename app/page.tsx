"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LogOut, Calendar, FileText, CheckCircle, Clock, UserRound,
  PenSquare, XCircle, Newspaper, BookMarked, CheckSquare, Plus, UserCheck,
  Settings,
  Shield,
  School,
  ArrowRight,
  AlertTriangle,
  ClipboardList,
  Users,
  Bell,
  BookOpen,
  Info,
  Sparkles,
  TrendingUp,
  Award
} from "lucide-react";
import WeekListScrollable from "@/components/ui/WeekListScrollable";
import PassModal from "@/components/ui/PassModal";
import AttendanceModal from "@/components/ui/AttendanceModal";
import ClassSelector from "@/components/ui/ClassSelector";
import NewsModal from "@/components/ui/NewsModal";
import NotesModal from "@/components/ui/NotesModal";
import SelfExitModal from "@/components/ui/SelfExitModal";
import ViolationModal from "@/components/ui/ViolationModal";
import { formatShortName, safeFormatShortName, formatDateLocal } from "@/lib/utils"

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
  const [isLoading, setIsLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Вспомогательная функция для форматирования даты в YYYY-MM-DD (локальное время)
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  const roles = (session?.user?.roles as string[]) || [];
  const isAdmin = roles.includes("ADMIN");
  const isClassTeacher = roles.includes("CLASS_TEACHER");
  const isTeacher = roles.includes("TEACHER");
  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    });
  };
  // Проверяем, есть ли у пользователя классы
  const hasClasses = classes.length > 0;

  // Показываем рабочий интерфейс только если есть классы или права классного руководителя
  const showWorkInterface = hasClasses || isClassTeacher;

  const tabs: TabType[] = [
    { id: "attendance", name: "Пропуски", icon: <FileText size={16} /> },
    { id: "self-exit", name: "Самовыход", icon: <UserCheck size={16} /> },
  ];

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
          // Выбираем первый класс
          const firstClass = data[0];
          setSelectedClass(firstClass);

          // Устанавливаем список учеников для первого класса
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
    // Обновляем список учеников при смене класса
    const students = getStudentsFromClass(classData);
    setStudentsList(students);
    console.log('Класс изменен:', classData?.name, 'Учеников:', students.length);
  }, [getStudentsFromClass]);

  // Загрузка данных для выбранной даты и класса
  useEffect(() => {
    if (!selectedClass) return;

    const fetchData = async () => {
      try {
        // Используем локальное форматирование даты
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

      if (!response.ok) {
        throw new Error("Failed to create pass");
      }

      const newPass = await response.json();
      setPassesHistory(prev => [newPass, ...prev]);
      alert("Пропуск успешно оформлен!");

    } catch (error) {
      console.error("Error creating pass:", error);
      alert("Ошибка при создании пропуска");
    }
  };

  const handleSubmitAttendance = async (attendanceData: any) => {
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...attendanceData, classId: selectedClass.id })
      });

      if (!response.ok) {
        throw new Error("Failed to save attendance");
      }

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

      if (!response.ok) {
        throw new Error("Failed to create news");
      }

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

      if (!response.ok) {
        throw new Error("Failed to create note");
      }

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
      alert("Ошибка при добавлении самовыxода");
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

              {/* Самовывод */}
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <UserCheck size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white text-sm font-medium">Самовывод</h3>
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
            <button
              onClick={() => router.push("/")}
              className="mt-3 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs transition-all"
            >
              Обновить страницу
            </button>
          </div>
        </div>

        {/* 🔥 Круглая кнопка для фиксации нарушений - доступна всем */}
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

      {/* Остальной контент без изменений */}
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
            <h3 className="font-semibold text-white text-sm">
              Пропуска
            </h3>
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

  // Рендер таба самовывода
  const renderSelfExitTab = () => (
    <div className="space-y-2">
      <button
        onClick={() => setIsSelfExitModalOpen(true)}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
      >
        <Plus size={16} />
        <span>Добавить самовывод</span>
      </button>

      {selfExits.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <UserCheck size={32} className="text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">Нет активных самовыводов</p>
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
                title="Отменить самовывод"
              >
                ✕
              </button>
            </div>
          </div>
        ))
      )}
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
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-sm font-medium ${activeTab === tab.id
                ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/10"
                }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>

        {/* Контент активного таба */}
        {activeTab === "attendance" && renderAttendanceTab()}
        {activeTab === "self-exit" && renderSelfExitTab()}
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

      <SelfExitModal
        isOpen={isSelfExitModalOpen}
        onClose={() => setIsSelfExitModalOpen(false)}
        onSubmit={handleSubmitSelfExit}
        studentsList={studentsList}
      />

      {/* 🔥 Круглая кнопка для фиксации нарушений - доступна всем */}
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
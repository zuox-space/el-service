"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LogOut, Calendar, FileText, CheckCircle, Clock, UserRound,
  PenSquare, XCircle, Newspaper, BookMarked, CheckSquare, Plus, UserCheck,
  Settings,
  Shield,
  School
} from "lucide-react";
import WeekListScrollable from "@/components/ui/WeekListScrollable";
import PassModal from "@/components/ui/PassModal";
import AttendanceModal from "@/components/ui/AttendanceModal";
import ClassSelector from "@/components/ui/ClassSelector";
import NewsModal from "@/components/ui/NewsModal";
import NotesModal from "@/components/ui/NotesModal";
import SelfExitModal from "@/components/ui/SelfExitModal";
import { formatShortName, safeFormatShortName } from "@/lib/utils"

interface TabType {
  id: string;
  name: string;
  icon: React.ReactNode;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
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

  const roles = (session?.user?.roles as string[]) || [];
  const isAdmin = roles.includes("ADMIN");
  const isClassTeacher = roles.includes("CLASS_TEACHER");
  const isTeacher = roles.includes("TEACHER");

  // Проверяем, есть ли у пользователя классы
  const hasClasses = classes.length > 0;

  // Показываем интерфейс, если пользователь имеет класс или является админом/классным руководителем
  const showWorkInterface = hasClasses || isClassTeacher || isAdmin;

  const tabs: TabType[] = [
    { id: "attendance", name: "Пропуски", icon: <FileText size={16} /> },
    { id: "self-exit", name: "Самовыход", icon: <UserCheck size={16} /> },
    { id: "notes", name: "Заметки", icon: <BookMarked size={16} /> },
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

  // Обработчик смены класса - ОСНОВНОЕ ИСПРАВЛЕНИЕ
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
        const [attendanceRes, passesRes, newsRes, notesRes, selfExitRes] = await Promise.all([
          fetch(`/api/attendance?classId=${selectedClass.id}&date=${selectedDate.toISOString()}`),
          fetch(`/api/passes?classId=${selectedClass.id}&date=${selectedDate.toISOString()}`),
          fetch(`/api/news?classId=${selectedClass.id}&date=${selectedDate.toISOString()}`),
          fetch(`/api/notes?classId=${selectedClass.id}&date=${selectedDate.toISOString()}`),
          fetch(`/api/self-exit?classId=${selectedClass.id}&date=${selectedDate.toISOString()}`)
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
        body: JSON.stringify({ ...newsData, classId: selectedClass.id, date: selectedDate })
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
        body: JSON.stringify({ ...noteData, classId: selectedClass.id, date: selectedDate })
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const passDateOnly = new Date(passDate);
    passDateOnly.setHours(0, 0, 0, 0);

    if (passDateOnly < today) {
      alert("Нельзя удалить пропуск за прошедшую дату");
      return;
    }

    if (passDateOnly.getTime() === today.getTime()) {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateOnly = new Date(date);
    selectedDateOnly.setHours(0, 0, 0, 0);
    return selectedDateOnly >= today;
  };

  const canDeletePass = (passDate: Date) => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const passDateOnly = new Date(passDate);
    passDateOnly.setHours(0, 0, 0, 0);

    if (passDateOnly < today) return false;
    if (passDateOnly.getTime() === today.getTime()) {
      return now.getHours() < 15;
    }
    return true;
  };

  // Мемоизация данных
  const passesForSelectedDate = useMemo(() => Array.isArray(passesHistory) ? passesHistory : [], [passesHistory]);
  const attendanceForSelectedDate = useMemo(() => attendanceHistory && attendanceHistory.length > 0 ? attendanceHistory[0] : null, [attendanceHistory]);
  const absentStudentsOnSelectedDate = useMemo(() => attendanceForSelectedDate?.absentStudents || [], [attendanceForSelectedDate]);
  const isSelectedDateToday = useMemo(() => selectedDate.toDateString() === new Date().toDateString(), [selectedDate]);
  const isTodayAttendanceMarked = useMemo(() => attendanceHistory.some(a => a && new Date(a.date).toDateString() === new Date().toDateString()), [attendanceHistory]);
  const canIssue = useMemo(() => canIssuePass(selectedDate), [selectedDate]);

  const absentStudentsList = useMemo(() => (attendanceForSelectedDate?.absentStudents || []).map((id: number) => {
    const student = studentsList.find((s: any) => s.id === id);
    const reasonId = attendanceForSelectedDate?.absentReasons?.[id];
    const reasonLabels: Record<string, string> = {
      sick: "🤒 Болен",
      family: "📝 По заявлению родителей",
      other: "⚠️ БУ",
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

  // Если у пользователя нет класса и нет роли классного руководителя или админа
  if (!showWorkInterface) {
    return (
      <div className="min-h-screen p-3" style={{ background: "linear-gradient(135deg, #1a2332 0%, #2b3858 100%)" }}>
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

          {/* Приветственная карточка */}
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl p-8 text-center border border-white/20">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <School size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Добро пожаловать!
            </h1>
            <p className="text-gray-300 mb-4">
              ГБОУ Школа №1298 «Профиль Куркино»
            </p>
            <p className="text-gray-400 text-sm">
              Электронные сервисы школы
            </p>
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-xs text-gray-500">
                Для доступа к полному функционалу обратитесь к администратору
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Рендер таба пропусков
  const renderAttendanceTab = () => (
    <div className="space-y-3">
      <div className="flex gap-2 flex-col">
        {isSelectedDateToday && (
          <button
            onClick={() => setIsAttendanceModalOpen(true)}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
          >
            <CheckCircle size={18} />
            <span>Отметить присутствие</span>
            {!isTodayAttendanceMarked && (
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
                !
              </div>
            )}
          </button>
        )}

        {canIssue && (
          <button
            onClick={() => setIsPassModalOpen(true)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
          >
            <PenSquare size={18} />
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
            {absentStudentsList.slice(0, 5).map((student: { name: string; reason: string }, idx: number) => (
              <div key={idx} className="text-sm text-gray-300 flex justify-between">
                <span>{student.name}</span>
                <span className="text-xs text-orange-400">{student.reason}</span>
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
              Пропуска за {selectedDate.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
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
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
      >
        <Plus size={18} />
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
                  <a
                    href={item.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-flex items-center gap-1"
                  >
                    📎 Фото заявления
                  </a>
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

  // Рендер таба заметок
  const renderNotesTab = () => (
    <div className="space-y-2">
      <button
        onClick={() => setIsNotesModalOpen(true)}
        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-base"
      >
        <Plus size={18} />
        <span>Добавить заметку</span>
      </button>

      {notes.length === 0 ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
          <BookMarked size={32} className="text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">Нет заметок на эту дату</p>
        </div>
      ) : (
        notes.map((note) => (
          <div key={note.id} className={`bg-white/10 backdrop-blur-lg rounded-xl p-3 border ${note.completed ? 'border-green-500/30 bg-green-500/5' : 'border-white/20'}`}>
            <div className="flex items-start gap-2">
              <button onClick={() => toggleNoteStatus(note.id, note.completed)}>
                {note.completed ? (
                  <CheckSquare size={18} className="text-green-400 mt-0.5" />
                ) : (
                  <CheckSquare size={18} className="text-gray-500 mt-0.5" />
                )}
              </button>
              <div className="flex-1">
                <p className={`text-white text-base ${note.completed ? 'line-through text-gray-400' : ''}`}>
                  {note.content}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(note.createdAt).toLocaleTimeString("ru-RU")}
                </p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen p-3" style={{ background: "linear-gradient(135deg, #1a2332 0%, #2b3858 100%)" }}>
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
              {/* <button
                onClick={() => router.push("/class-management")}
                className="w-8 h-8 flex items-center justify-center bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all border border-green-500/30"
                title="Управление классом"
              >
                <Settings size={16} />
              </button> */}
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

        {/* Выбор класса - передаем обработчик */}
        <ClassSelector
          selectedClass={selectedClass}
          onClassChange={handleClassChange}  // ИСПРАВЛЕНО: используем обработчик
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
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
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
        {activeTab === "notes" && renderNotesTab()}
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
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { X, Search, UserCheck, UserX, CheckCircle, XCircle, Users, ChevronRight } from "lucide-react";

interface Student {
  id: number;
  name: string;
}

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSubmit: (data: any) => void;
  existingAttendance: any;
  studentsList: Student[] | string;
}

const absenceReasons = [
  { id: "sick", label: "Болен", icon: "🤒", color: "text-red-400" },
  { id: "family", label: "Заявление родителей", icon: "📝", color: "text-orange-400" },
  { id: "other", label: "Без уважительной причины", icon: "⚠️", color: "text-yellow-400" },
  { id: "vacation", label: "Отпуск/каникулы", icon: "✈️", color: "text-blue-400" },
  { id: "competition", label: "Соревнования", icon: "🏆", color: "text-purple-400" },
];

export default function AttendanceModal({
  isOpen,
  onClose,
  selectedDate,
  onSubmit,
  existingAttendance,
  studentsList,
}: AttendanceModalProps) {
  const [presentStudents, setPresentStudents] = useState<number[]>([]);
  const [absentStudents, setAbsentStudents] = useState<number[]>([]);
  const [absentReasons, setAbsentReasons] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [currentAbsentStudent, setCurrentAbsentStudent] = useState<Student | null>(null);
  const [pendingStudentId, setPendingStudentId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "present" | "absent">("all");

  // Вспомогательная функция для форматирования даты в локальном времени
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Функция для получения читаемой даты
  const getReadableDate = (date: Date): string => {
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  const getStudentsArray = (): Student[] => {
    if (!studentsList) return [];
    if (Array.isArray(studentsList)) return studentsList;
    if (typeof studentsList === "string") {
      try {
        const parsed = JSON.parse(studentsList);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const studentsArray = getStudentsArray();
  const allStudentIds = studentsArray.map(s => s.id);

  useEffect(() => {
    if (isOpen) {
      if (existingAttendance) {
        setPresentStudents(existingAttendance.presentStudents || []);
        setAbsentStudents(existingAttendance.absentStudents || []);
        setAbsentReasons(existingAttendance.absentReasons || {});
      } else {
        setPresentStudents([...allStudentIds]);
        setAbsentStudents([]);
        setAbsentReasons({});
      }
      setSearchQuery("");
      setFilterStatus("all");
    }
  }, [isOpen, existingAttendance]);

  const filteredStudents = studentsArray.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isPresent = presentStudents.includes(student.id);
    if (filterStatus === "present") return matchesSearch && isPresent;
    if (filterStatus === "absent") return matchesSearch && !isPresent;
    return matchesSearch;
  });

  const startRemoveStudent = (studentId: number, student: Student) => {
    if (absentStudents.includes(studentId)) return;
    setCurrentAbsentStudent(student);
    setPendingStudentId(studentId);
    setShowReasonModal(true);
  };

  const confirmAbsence = (reasonId: string) => {
    if (pendingStudentId) {
      setPresentStudents(prev => prev.filter(id => id !== pendingStudentId));
      setAbsentStudents(prev => [...prev, pendingStudentId]);
      setAbsentReasons(prev => ({ ...prev, [pendingStudentId]: reasonId }));
      setShowReasonModal(false);
      setCurrentAbsentStudent(null);
      setPendingStudentId(null);
    }
  };

  const restoreStudent = (studentId: number) => {
    setPresentStudents(prev => [...prev, studentId]);
    setAbsentStudents(prev => prev.filter(id => id !== studentId));
    setAbsentReasons(prev => {
      const newReasons = { ...prev };
      delete newReasons[studentId];
      return newReasons;
    });
  };

  const selectAll = () => {
    setPresentStudents([...allStudentIds]);
    setAbsentStudents([]);
    setAbsentReasons({});
  };

  const clearAll = () => {
    setPresentStudents([]);
    setAbsentStudents([...allStudentIds]);
    setAbsentReasons({});
  };

  const handleSubmit = () => {
    const absentWithoutReason = absentStudents.filter(id => !absentReasons[id]);
    if (absentWithoutReason.length > 0) {
      const names = absentWithoutReason.map(id => studentsArray.find(s => s.id === id)?.name).join(", ");
      alert(`Укажите причину отсутствия для: ${names}`);
      return;
    }

    setIsSubmitting(true);
    const attendanceData = {
      // Используем локальное форматирование даты
      date: formatDateLocal(selectedDate),
      presentStudents: presentStudents,
      absentStudents: absentStudents,
      absentReasons: absentReasons,
    };

    setTimeout(() => {
      onSubmit(attendanceData);
      setIsSubmitting(false);
      onClose();
    }, 500);
  };

  if (!isOpen) return null;

  const presentCount = presentStudents.length;
  const absentCount = absentStudents.length;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-md p-3"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="w-full max-w-lg bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden animate-slide-up">
          {/* Заголовок */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Отметка присутствия</h3>
                <p className="text-green-100 text-xs">
                  {getReadableDate(selectedDate)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors"
                title="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Контент */}
          <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
            {/* Статистика */}
            <div className="flex gap-2 text-xs">
              <div className="flex-1 bg-green-500/10 rounded-lg p-2 text-center border border-green-500/20">
                <div className="text-green-400 font-bold text-lg">{presentCount}</div>
                <div className="text-green-300">Присутствуют</div>
              </div>
              <div className="flex-1 bg-red-500/10 rounded-lg p-2 text-center border border-red-500/20">
                <div className="text-red-400 font-bold text-lg">{absentCount}</div>
                <div className="text-red-300">Отсутствуют</div>
              </div>
            </div>

            {/* Поиск и фильтры */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск ученика..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${filterStatus === "all"
                    ? "bg-green-500/30 text-green-300"
                    : "bg-white/10 text-gray-400 hover:bg-white/20"
                    }`}
                >
                  Все ({studentsArray.length})
                </button>
                <button
                  onClick={() => setFilterStatus("present")}
                  className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${filterStatus === "present"
                    ? "bg-green-500/30 text-green-300"
                    : "bg-white/10 text-gray-400 hover:bg-white/20"
                    }`}
                >
                  Присутствуют ({presentCount})
                </button>
                <button
                  onClick={() => setFilterStatus("absent")}
                  className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${filterStatus === "absent"
                    ? "bg-red-500/30 text-red-300"
                    : "bg-white/10 text-gray-400 hover:bg-white/20"
                    }`}
                >
                  Отсутствуют ({absentCount})
                </button>
              </div>
            </div>

            {/* Кнопки быстрых действий */}
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="flex-1 text-xs py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Users size={12} />
                Все присутствуют
              </button>
              <button
                onClick={clearAll}
                className="flex-1 text-xs py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <UserX size={12} />
                Все отсутствуют
              </button>
            </div>

            {/* Список учеников */}
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="text-center text-gray-400 py-8 text-sm">
                  {searchQuery ? "Ничего не найдено" : "Нет учеников"}
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const isPresent = presentStudents.includes(student.id);
                  const isAbsent = absentStudents.includes(student.id);
                  const reason = absentReasons[student.id];
                  const reasonData = absenceReasons.find(r => r.id === reason);
                  const reasonLabel = reasonData?.label;
                  const reasonIcon = reasonData?.icon;

                  return (
                    <div
                      key={student.id}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${isAbsent
                        ? "bg-red-500/10 border-l-2 border-red-500"
                        : "bg-white/5 hover:bg-white/10"
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={isPresent}
                        onChange={() => isPresent ? startRemoveStudent(student.id, student) : restoreStudent(student.id)}
                        className="w-4 h-4 text-green-500 rounded border-white/30 bg-white/10 focus:ring-green-500"
                      />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${isAbsent ? "line-through text-gray-400" : "text-white"}`}>
                          {student.name}
                        </span>
                        {isAbsent && reasonLabel && (
                          <span className="text-xs text-orange-400 ml-2">
                            {reasonIcon} {reasonLabel}
                          </span>
                        )}
                      </div>
                      {isAbsent ? (
                        <button
                          onClick={() => restoreStudent(student.id)}
                          className="text-green-400 hover:text-green-300 text-xs px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                          title="Вернуть в список присутствующих"
                        >
                          <CheckCircle size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => startRemoveStudent(student.id, student)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                          title="Отметить как отсутствующего"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Кнопка сохранения */}
          <div className="p-3 border-t border-white/10 bg-white/5">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-medium transition-all text-sm ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg"
                }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Сохранение...
                </span>
              ) : (
                `Сохранить отметку (${presentCount} присутствуют)`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно для выбора причины */}
      {showReasonModal && currentAbsentStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
          <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden animate-slide-up">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 px-4 py-3">
              <h3 className="text-lg font-bold text-white">Причина отсутствия</h3>
              <p className="text-orange-100 text-sm">{currentAbsentStudent.name}</p>
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
              {absenceReasons.map((reason) => (
                <button
                  key={reason.id}
                  onClick={() => confirmAbsence(reason.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group"
                >
                  <span className="text-2xl">{reason.icon}</span>
                  <div className="flex-1 text-left">
                    <div className={`font-semibold text-sm ${reason.color} group-hover:text-white transition-colors`}>
                      {reason.label}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-white/10 bg-white/5">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setCurrentAbsentStudent(null);
                  setPendingStudentId(null);
                }}
                className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(20px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slideUp 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
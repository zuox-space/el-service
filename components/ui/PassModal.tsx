"use client";

import { useState, useEffect } from "react";
import { X, Clock, Search, CheckCircle } from "lucide-react";

interface Student {
  id: number;
  name: string;
}

interface PassModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSubmit: (data: any) => void;
  existingPasses: any[];
  absentStudentsOnDate: number[];
  studentsList: Student[] | string | any;
}

export default function PassModal({
  isOpen,
  onClose,
  selectedDate,
  onSubmit,
  existingPasses,
  absentStudentsOnDate,
  studentsList,
}: PassModalProps) {
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [exitTime, setExitTime] = useState("13:00");
  const [exitReason] = useState("Заявление родителей");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

    if (typeof studentsList === 'object') {
      // Проверяем, есть ли поле students
      if (studentsList.students) {
        if (Array.isArray(studentsList.students)) return studentsList.students;
        if (typeof studentsList.students === 'string') {
          try {
            const parsed = JSON.parse(studentsList.students);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) { return []; }
        }
      }

      // Пробуем преобразовать объект в массив
      const values = Object.values(studentsList);
      if (values.length > 0 && values[0] && typeof values[0] === 'object' && 'id' in values[0]) {
        return values as Student[];
      }
      return [];
    }

    if (typeof studentsList === 'string') {
      try {
        const parsed = JSON.parse(studentsList);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'object') {
          const values = Object.values(parsed);
          if (values.length > 0 && values[0] && typeof values[0] === 'object' && 'id' in values[0]) {
            return values as Student[];
          }
        }
        return [];
      } catch (e) { return []; }
    }
    return [];
  };

  const studentsArray = getStudentsArray();

  const isStudentHasPass = (studentId: number) => {
    return existingPasses.some((pass) =>
      pass.students?.some((s: Student) => s.id === studentId)
    );
  };

  const isStudentAbsent = (studentId: number) => {
    return absentStudentsOnDate?.includes(studentId) || false;
  };

  const filteredStudents = studentsArray.filter((student) =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStudent = (studentId: number) => {
    if (isStudentHasPass(studentId) || isStudentAbsent(studentId)) return;
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAll = () => {
    const availableStudents = studentsArray
      .filter((s) => !isStudentHasPass(s.id) && !isStudentAbsent(s.id))
      .map((s) => s.id);
    setSelectedStudents(availableStudents);
  };

  const clearAll = () => {
    setSelectedStudents([]);
  };

  const handleSubmit = () => {
    if (selectedStudents.length === 0) {
      alert("Выберите хотя бы одного ученика");
      return;
    }

    setIsSubmitting(true);

    const passData = {
      // Передаем дату в локальном формате
      date: formatDateLocal(selectedDate),
      students: studentsArray.filter((s) => selectedStudents.includes(s.id)),
      exitTime: exitTime,
      reason: exitReason,
    };

    setTimeout(() => {
      onSubmit(passData);
      setIsSubmitting(false);
      onClose();
      setSelectedStudents([]);
      setExitTime("13:00");
      setSearchQuery("");
    }, 500);
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedStudents([]);
      setSearchQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-md p-3"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden">
        {/* Заголовок */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Пропуск</h3>
              <p className="text-blue-100 text-xs">
                Пропуск на {getReadableDate(selectedDate)}
              </p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
          {/* Поиск */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="flex-1 text-xs py-1.5 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              Выбрать всех
            </button>
            <button
              onClick={clearAll}
              className="flex-1 text-xs py-1.5 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition-colors"
            >
              Очистить
            </button>
          </div>

          {/* Список учеников */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="text-center text-gray-400 py-6 text-sm">
                {searchQuery ? "Ничего не найдено" : "Нет учеников"}
              </div>
            ) : (
              filteredStudents.map((student) => {
                const isDisabled = isStudentHasPass(student.id) || isStudentAbsent(student.id);
                const isSelected = selectedStudents.includes(student.id);
                let disabledReason = "";
                if (isStudentHasPass(student.id)) disabledReason = " (уже есть пропуск)";
                if (isStudentAbsent(student.id)) disabledReason = " (отсутствует)";

                return (
                  <label
                    key={student.id}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isDisabled
                        ? "bg-white/5 opacity-50 cursor-not-allowed"
                        : isSelected
                          ? "bg-blue-500/20 border border-blue-500/30"
                          : "hover:bg-white/10 bg-white/5"
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudent(student.id)}
                      disabled={isDisabled}
                      className="w-4 h-4 text-blue-500 rounded border-white/30 bg-white/10"
                    />
                    <span className={`flex-1 text-sm ${isDisabled ? "text-gray-400 line-through" : "text-white"}`}>
                      {student.name}
                      {disabledReason && (
                        <span className="text-xs text-gray-500 ml-1">{disabledReason}</span>
                      )}
                    </span>
                    {isSelected && !isDisabled && <CheckCircle size={12} className="text-blue-400" />}
                  </label>
                );
              })
            )}
          </div>

          {/* Время выхода */}
          <div>
            <label className="block text-white text-sm mb-1 flex items-center gap-1">
              <Clock size={14} className="text-blue-400" />
              Время выхода
            </label>
            <input
              type="time"
              value={exitTime}
              onChange={(e) => setExitTime(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Информация о выбранных */}
          {selectedStudents.length > 0 && (
            <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
              <p className="text-xs text-blue-300">
                Выбрано учеников: <span className="font-bold">{selectedStudents.length}</span>
              </p>
            </div>
          )}
        </div>

        {/* Кнопка отправки */}
        <div className="p-3 border-t border-white/10 bg-white/5">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedStudents.length === 0}
            className={`w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm ${selectedStudents.length === 0 ? "opacity-50" : ""
              }`}
          >
            {isSubmitting ? "Оформление..." : `Оформить пропуск (${selectedStudents.length})`}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slideUp 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
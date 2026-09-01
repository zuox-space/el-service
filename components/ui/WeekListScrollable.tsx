"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface WeekListScrollableProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export default function WeekListScrollable({ selectedDate, setSelectedDate }: WeekListScrollableProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Вспомогательная функция для получения даты в московском времени
  const getMoscowDate = (date: Date): Date => {
    // Создаем новую дату в локальном времени
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Форматирование даты в YYYY-MM-DD без UTC
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeeks = () => {
    const weeks = [];
    // Работаем с локальным временем
    const baseDate = new Date(currentDate);
    baseDate.setDate(baseDate.getDate() - 14);

    const today = new Date();
    const todayStr = formatDateLocal(today);
    const selectedStr = selectedDate ? formatDateLocal(selectedDate) : '';

    for (let i = 0; i < 35; i++) {
      // Создаем дату в локальном времени
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

      // Очищаем время для корректного сравнения
      const dateWithoutTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dateStr = formatDateLocal(dateWithoutTime);

      weeks.push({
        date: dateWithoutTime,
        dayName: dateWithoutTime.toLocaleDateString("ru-RU", { weekday: "short" }),
        dayNumber: dateWithoutTime.getDate(),
        month: dateWithoutTime.toLocaleDateString("ru-RU", { month: "short" }).replace(".", ""),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedStr,
      });
    }
    return weeks;
  };

  const weeks = getWeeks();

  useEffect(() => {
    if (scrollContainerRef.current && selectedDate) {
      const selectedStr = formatDateLocal(selectedDate);
      const selectedIndex = weeks.findIndex((week) => formatDateLocal(week.date) === selectedStr);
      if (selectedIndex !== -1) {
        const element = scrollContainerRef.current.children[selectedIndex] as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      }
    }
  }, [selectedDate, currentDate]);

  const selectDay = (day: any) => {
    // Передаем дату без времени
    const selected = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
    setSelectedDate(selected);
  };

  const scrollToToday = () => {
    const todayStr = formatDateLocal(new Date());
    const todayIndex = weeks.findIndex((week) => formatDateLocal(week.date) === todayStr);
    if (todayIndex !== -1 && scrollContainerRef.current) {
      const element = scrollContainerRef.current.children[todayIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        const today = new Date();
        setSelectedDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
      }
    }
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const getMonthYear = () => {
    if (weeks.length === 0) return "";
    const startMonth = weeks[0].date.toLocaleDateString("ru-RU", { month: "long" });
    const endMonth = weeks[weeks.length - 1].date.toLocaleDateString("ru-RU", { month: "long" });
    const year = weeks[0].date.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${year}`;
    }
    return `${startMonth} - ${endMonth} ${year}`;
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <button
          onClick={scrollToToday}
          className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded-lg transition-colors border border-blue-500/30"
        >
          <Calendar size={12} />
          Сегодня
        </button>
      </div>

      <div ref={scrollContainerRef} className="flex gap-1.5 overflow-x-auto pb-3 scroll-smooth relative">
        {weeks.map((day, idx) => (
          <div key={idx} className="relative flex flex-col items-center">
            {day.isToday && !day.isSelected && (
              <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                <div className="w-6 h-1 bg-green-500 rounded-full"></div>
              </div>
            )}
            <button
              onClick={() => selectDay(day)}
              className={`
                flex flex-col items-center justify-center min-w-[52px] py-1.5 px-1 rounded-lg transition-all duration-200
                ${day.isSelected
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                  : day.isToday
                    ? "bg-green-500/15 border border-green-500/30 text-green-300"
                    : "bg-white/5 hover:bg-white/10 text-gray-400 border border-white/5 hover:border-white/20"
                }
              `}
            >
              <span className={`text-[10px] font-medium ${day.isSelected ? "text-blue-100" : day.isToday ? "text-green-400" : "text-gray-500"}`}>
                {day.dayName}
              </span>
              <span className={`text-base font-bold mt-0.5 ${day.isSelected ? "text-white" : day.isToday ? "text-green-300" : "text-gray-200"}`}>
                {day.dayNumber}
              </span>
              <span className={`text-[9px] mt-0.5 ${day.isSelected ? "text-blue-100" : day.isToday ? "text-green-500" : "text-gray-500"}`}>
                {day.month}
              </span>
            </button>
          </div>
        ))}
      </div>

      <style jsx>{`
        .scroll-smooth {
          scroll-behavior: smooth;
        }
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
        .overflow-x-auto {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
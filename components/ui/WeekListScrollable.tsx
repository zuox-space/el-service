"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekListScrollableProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
}

export default function WeekListScrollable({ selectedDate, setSelectedDate }: WeekListScrollableProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Вспомогательная функция для получения даты в московском времени
  const getMoscowDate = (date: Date): Date => {
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
    const baseDate = new Date(currentDate);
    baseDate.setDate(baseDate.getDate() - 14);

    const today = new Date();
    const todayStr = formatDateLocal(today);
    const selectedStr = selectedDate ? formatDateLocal(selectedDate) : '';

    for (let i = 0; i < 35; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);

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
    const selected = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
    setSelectedDate(selected);
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

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={goToPreviousWeek}
          className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all flex-shrink-0"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex-1 overflow-hidden">
          <div ref={scrollContainerRef} className="flex gap-1.5 overflow-x-auto pb-2 scroll-smooth relative">
            {weeks.map((day, idx) => (
              <div key={idx} className="relative flex flex-col items-center flex-shrink-0">
                {day.isToday && !day.isSelected && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                    <div className="w-1.5 h-1.5 bg-rose-400 rounded-full shadow-sm shadow-rose-400/50"></div>
                  </div>
                )}
                <button
                  onClick={() => selectDay(day)}
                  className={`
                    flex flex-col items-center justify-center min-w-[44px] py-1.5 px-1.5 rounded-xl transition-all duration-200
                    ${day.isSelected
                      ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                      : day.isToday
                        ? "bg-white/5 border border-rose-500/20 text-rose-300 hover:bg-white/10"
                        : "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white"
                    }
                  `}
                >
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${day.isSelected ? "text-indigo-100" : day.isToday ? "text-rose-400" : "text-gray-500"}`}>
                    {day.dayName}
                  </span>
                  <span className={`text-sm font-bold mt-0.5 ${day.isSelected ? "text-white" : day.isToday ? "text-rose-300" : "text-gray-200"}`}>
                    {day.dayNumber}
                  </span>
                  <span className={`text-[8px] mt-0.5 ${day.isSelected ? "text-indigo-100" : day.isToday ? "text-rose-500" : "text-gray-500"}`}>
                    {day.month}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={goToNextWeek}
          className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all flex-shrink-0"
        >
          <ChevronRight size={16} />
        </button>
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
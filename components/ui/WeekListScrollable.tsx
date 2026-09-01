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

  const getWeeks = () => {
    const weeks = [];
    const baseDate = new Date(currentDate);
    baseDate.setUTCDate(baseDate.getUTCDate() - 14);

    for (let i = 0; i < 35; i++) {
      // 🔥 СОЗДАЁМ ДАТУ В UTC
      const date = new Date(Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth(),
        baseDate.getUTCDate() + i
      ));

      const dateStr = selectedDate.toLocaleDateString('en-CA');
      const todayStr = new Date().toISOString().split('T')[0];
      const selectedStr = selectedDate ? selectedDate.toISOString().split('T')[0] : '';

      weeks.push({
        date: date,
        dayName: date.toLocaleDateString("ru-RU", { weekday: "short" }),
        dayNumber: date.getUTCDate(),
        month: date.toLocaleDateString("ru-RU", { month: "short" }).replace(".", ""),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedStr,
      });
    }
    return weeks;
  };

  const weeks = getWeeks();

  useEffect(() => {
    if (scrollContainerRef.current && selectedDate) {
      const selectedIndex = weeks.findIndex((week) => week.date.toDateString() === selectedDate.toDateString());
      if (selectedIndex !== -1) {
        const element = scrollContainerRef.current.children[selectedIndex] as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      }
    }
  }, [selectedDate, currentDate]);

  const selectDay = (day: any) => {
    // 🔥 Передаём дату как есть (она уже в UTC)
    setSelectedDate(day.date);
  };
  const scrollToToday = () => {
    const todayIndex = weeks.findIndex((week) => week.isToday);
    if (todayIndex !== -1 && scrollContainerRef.current) {
      const element = scrollContainerRef.current.children[todayIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        setSelectedDate(new Date());
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
            {/* Зеленая закладка для сегодняшнего дня */}
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
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Users, Search, AlertCircle, UserRound, School, RefreshCw
} from "lucide-react";

interface Student {
  id: string;
  name: string;
}

export default function ClassManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Список учеников приходит из базы АИС (внешняя система школы) — только для чтения
  const fetchClasses = useCallback(async () => {
    if (!session) return;

    try {
      setError(null);
      const response = await fetch("/api/classes");
      if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);

      const data = await response.json();
      const list = Array.isArray(data) ? data : [];
      setClasses(list);

      if (list.length > 0) {
        // Сохраняем выбранный класс при обновлении списка
        setSelectedClass((current: any) => {
          const same = current ? list.find((c: any) => c.id === current.id) : null;
          const next = same || list[0];
          setStudents(next.students || []);
          return next;
        });
      } else {
        setSelectedClass(null);
        setStudents([]);
      }
    } catch (e) {
      console.error("Error fetching classes:", e);
      setError(e instanceof Error ? e.message : "Не удалось загрузить список класса");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleClassChange = (cls: any) => {
    setSelectedClass(cls);
    setStudents(cls.students || []);
    setSearchQuery("");
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchClasses();
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!mounted || status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-surface border border-border shadow-card p-8 rounded-2xl text-center border border-border">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-fg-muted">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen p-3">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Шапка */}
        <div className="bg-surface border border-border shadow-card rounded-xl p-3 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/")}
                className="w-11 h-11 flex items-center justify-center bg-accent-soft hover:bg-accent/20 text-accent-text rounded-lg transition-all border border-accent/40"
                title="На главную"
                aria-label="На главную"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-10 h-10 rounded-full surface-accent bg-accent-solid flex items-center justify-center">
                <School size={18} className="text-fg" />
              </div>
              <div>
                <p className="text-base font-bold text-fg">Список класса</p>
                <p className="text-xs text-fg-muted">{session.user?.name}</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-11 h-11 flex items-center justify-center bg-surface hover:bg-surface-3 text-fg-muted rounded-lg transition-all border border-border disabled:opacity-50"
              title="Обновить список из базы школы"
              aria-label="Обновить список"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Источник данных: важно, чтобы никто не ждал от страницы редактирования */}
        <div className="bg-accent-soft border border-accent/40 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="text-accent-text mt-0.5 flex-shrink-0" />
            <p className="text-xs text-fg leading-relaxed">
              Список учеников загружается из школьной базы (АИС) и здесь только для просмотра.
              Добавить, удалить или переименовать ученика нужно в АИС — после этого нажмите
              «Обновить» в правом верхнем углу.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-danger-soft border border-danger/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-danger">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg text-xs"
            >
              Повторить
            </button>
          </div>
        )}

        {/* Выбор класса */}
        <div className="bg-surface border border-border shadow-card rounded-xl p-3 border border-border">
          <label className="block text-fg text-sm mb-2">Выберите класс</label>
          {classes.length === 0 ? (
            <p className="text-sm text-fg-muted">Классы не найдены</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => handleClassChange(cls)}
                  className={`min-h-11 px-3 rounded-lg text-sm transition-all ${selectedClass?.id === cls.id
                    ? "bg-gradient-to-r bg-accent-solid text-accent-fg"
                    : "bg-surface text-fg-muted hover:bg-surface-3"
                    }`}
                >
                  {cls.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedClass && (
          <>
            {/* Поиск */}
            <div className="bg-surface border border-border shadow-card rounded-xl p-3 border border-border">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск учеников..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Список учеников — только просмотр */}
            <div className="bg-surface border border-border shadow-card rounded-xl p-3 border border-border">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-fg">
                  Список учеников ({students.length})
                </h3>
                {searchQuery && (
                  <span className="text-xs text-fg-muted">
                    найдено: {filteredStudents.length}
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="text-center text-fg-muted py-8">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery
                        ? "Ничего не найдено по этому запросу"
                        : "В этом классе пока нет учеников"}
                    </p>
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-2 bg-surface-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <UserRound size={14} className="text-fg-muted" />
                        <span className="text-fg text-sm">{student.name}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

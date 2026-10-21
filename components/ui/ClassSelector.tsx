"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, Users, Share2, UserPlus, X, Trash2, Search } from "lucide-react";
import { Modal, ModalFooter, useToast } from "@/components/ui/kit";
interface Class {
  id: string;
  name: string;
  grade: number;
  letter: string;
  ownerId: string;
  students: any[];
  isOwner?: boolean;
  isShared?: boolean;
}

interface ShareInfo {
  id: string;
  teacherId: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
}

interface ClassSelectorProps {
  selectedClass: Class | null;
  onClassChange: (cls: Class) => void;
  classes: Class[];
  currentTeacherId?: string;
}

export default function ClassSelector({
  selectedClass,
  onClassChange,
  classes = [],
  currentTeacherId
}: ClassSelectorProps) {
  const { data: session } = useSession();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedClassForShare, setSelectedClassForShare] = useState<Class | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [shares, setShares] = useState<ShareInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  // Отзыв доступа подтверждаем отдельным окном: раньше confirm был закомментирован,
  // и один тап лишал коллегу доступа к классу без возможности отменить.
  const [pendingUnshare, setPendingUnshare] = useState<{ teacherId: string; teacherName: string } | null>(null);

  const myClasses = classes.filter(c => c.isOwner === true);
  const sharedClasses = classes.filter(c => c.isShared === true && c.isOwner !== true);

  const fetchTeachers = async () => {
    try {
      const response = await fetch("/api/share");
      const data = await response.json();
      setTeachers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      setTeachers([]);
    }
  };

  const fetchShares = useCallback(async (classId: string) => {
    if (!classId) return;

    setIsLoadingShares(true);
    try {
      const response = await fetch(`/api/share?classId=${classId}`);
      const data = await response.json();
      setShares(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching shares:", error);
      setShares([]);
    } finally {
      setIsLoadingShares(false);
    }
  }, []);

  const handleShare = async () => {
    if (!selectedTeacher || !selectedClassForShare) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassForShare.id,
          teacherEmail: selectedTeacher.email
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.show({
          title: "Доступ предоставлен",
          description: `${selectedClassForShare.name} → ${selectedTeacher.name}`,
          tone: "success",
        });
        setSelectedTeacher(null);
        setSearchQuery("");
        await fetchShares(selectedClassForShare.id);
      } else {
        toast.show({ title: data.error || "Не удалось предоставить доступ", tone: "danger" });
      }
    } catch (error) {
      console.error("Share error:", error);
      toast.show({ title: "Не удалось предоставить доступ", tone: "danger" });
    } finally {
      setIsLoading(false);
    }
  };

  /** Открывает подтверждение отзыва доступа. */
  const requestUnshare = (teacherId: string, teacherName: string) => {
    setPendingUnshare({ teacherId, teacherName });
  };

  const confirmUnshare = async () => {
    if (!pendingUnshare || !selectedClassForShare) return;

    const { teacherId, teacherName } = pendingUnshare;
    setPendingUnshare(null);
    setIsUnsharing(true);

    try {
      const response = await fetch(`/api/share?classId=${selectedClassForShare.id}&teacherId=${teacherId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast.show({
          title: "Доступ отозван",
          description: `${teacherName} больше не видит класс ${selectedClassForShare.name}`,
          tone: "success",
        });
        await fetchShares(selectedClassForShare.id);
      } else {
        const error = await response.json().catch(() => ({}));
        toast.show({ title: error.error || "Не удалось отозвать доступ", tone: "danger" });
      }
    } catch (error) {
      console.error("Unshare error:", error);
      toast.show({ title: "Не удалось отозвать доступ", tone: "danger" });
    } finally {
      setIsUnsharing(false);
    }
  };

  const openShareModal = (cls: Class) => {
    setSelectedClassForShare(cls);
    setSelectedTeacher(null);
    setSearchQuery("");
    setIsShareModalOpen(true);
  };

  useEffect(() => {
    if (isShareModalOpen && selectedClassForShare) {
      fetchTeachers();
      fetchShares(selectedClassForShare.id);
    }
  }, [isShareModalOpen, selectedClassForShare, fetchShares]);

  // Закрываем выпадающий список по клику вне его: раньше он оставался открытым
  // и перекрывал карточку календаря.
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (selectorRef.current && target && !selectorRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [isOpen]);
  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!classes || classes.length === 0) {
    return (
      <div className="bg-surface border border-border shadow-card rounded-xl p-4 text-center border border-border">
        <Users size={24} className="text-fg-subtle mx-auto mb-2" />
        <p className="text-sm text-fg-muted">Нет доступных классов</p>
      </div>
    );
  }

  return (
    <>
      <div ref={selectorRef} className="relative mb-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-border shadow-card border border-border rounded-xl text-fg hover:bg-surface-3 transition-all"
        >
          <div className="flex items-center gap-2">
            <Users size={16} className="text-accent-text" />
            <span className="font-semibold">{selectedClass?.name || "Выберите класс"}</span>
            {selectedClass?.isShared && !selectedClass?.isOwner && (
              <span className="text-xs bg-accent/15 text-accent-text px-2 py-0.5 rounded-full">
                Поделенный
              </span>
            )}
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-lg z-20 max-h-80 overflow-y-auto">
            {/* Мои классы */}
            {myClasses.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-semibold text-fg-muted px-3 py-2">Мои классы</div>
                {myClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between px-3 py-2 hover:bg-surface rounded-lg group">
                    <button
                      onClick={() => {
                        onClassChange(cls);
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left text-fg"
                    >
                      <span>{cls.name}</span>
                      <span className="text-xs text-success ml-2">Основной</span>
                    </button>
                    <button
                      onClick={() => openShareModal(cls)}
                      className="text-accent-text hover:text-accent text-sm flex items-center gap-1 px-2 py-1 bg-accent-soft rounded-lg transition-all"
                    >
                      <Share2 size={14} />
                      Поделиться
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Поделенные классы */}
            {sharedClasses.length > 0 && (
              <div className="p-2 border-t border-border">
                <div className="text-xs font-semibold text-fg-muted px-3 py-2">Поделенные классы</div>
                {sharedClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => {
                      onClassChange(cls);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-surface rounded-lg text-fg"
                  >
                    {cls.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно для шаринга */}
      {isShareModalOpen && selectedClassForShare && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/10 backdrop-blur-md p-3">
          <div className="w-full max-w-md bg-bg rounded-xl shadow-2xl border border-border overflow-hidden">
            <div className="surface-card border-b border-border bg-surface-2 px-4 py-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-fg">Управление доступом</h3>
                  <p className="text-fg-muted text-sm">Класс: {selectedClassForShare.name}</p>
                </div>
                <button onClick={() => setIsShareModalOpen(false)} className="text-fg-muted hover:text-fg">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Список учителей, с которыми уже поделились */}
              <div>
                <label className="block font-semibold text-fg text-sm mb-2">
                  Кому уже открыт доступ ({shares.length}):
                </label>

                {isLoadingShares ? (
                  <div className="text-center text-fg-muted py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent mx-auto"></div>
                    <p className="text-xs mt-2">Загрузка...</p>
                  </div>
                ) : shares.length > 0 ? (
                  <div className="space-y-2">
                    {shares.map((share) => (
                      <div key={share.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-border">
                        <div className="flex-1">
                          <div className="font-medium text-fg text-sm">
                            {share.teacher?.name || "Учитель"}
                          </div>
                          <div className="text-xs text-fg-muted">
                            {share.teacher?.email || share.teacherId}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Останавливаем всплытие события
                            requestUnshare(share.teacherId, share.teacher?.name || "учителя");
                          }}
                          disabled={isUnsharing}
                          className="flex items-center gap-1 rounded-control px-3 py-2 text-sm text-danger hover:bg-danger-soft disabled:opacity-50"
                        >
                          <Trash2 size={14} aria-hidden />
                          Отменить
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-fg-muted py-4 bg-surface-2 rounded-lg">
                    Нет активных доступов
                  </div>
                )}
              </div>

              {/* Добавление нового учителя - крупный поиск */}
              <div>
                <label className="block font-semibold text-fg text-sm mb-2">
                  Добавить учителя
                </label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowTeacherDropdown(true);
                    }}
                    onFocus={() => setShowTeacherDropdown(true)}
                    placeholder="Поиск учителя по имени или email..."
                    className="w-full pl-10 pr-3 py-3 bg-surface border border-border rounded-lg text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-ring text-base"
                  />

                  {showTeacherDropdown && filteredTeachers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredTeachers.map((teacher) => (
                        <button
                          key={teacher.id}
                          onClick={() => {
                            setSelectedTeacher(teacher);
                            setSearchQuery(teacher.name);
                            setShowTeacherDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-surface text-fg text-sm"
                        >
                          <div className="font-medium">{teacher.name}</div>
                          <div className="text-xs text-fg-muted">{teacher.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedTeacher && (
                  <div className="mt-2 p-2 bg-success-soft border border-success/40 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-success text-sm font-medium">{selectedTeacher.name}</span>
                      <span className="text-xs text-fg-muted ml-2">{selectedTeacher.email}</span>
                    </div>
                    <button onClick={() => setSelectedTeacher(null)} className="text-fg-muted hover:text-fg">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-warning-soft border border-warning/40 p-3 rounded-lg">
                <p className="text-sm text-warning">
                  ⚠️ При добавлении учителя он получит доступ к просмотру и отметке присутствующих для этого класса.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-surface-2 flex gap-3">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-surface hover:bg-surface-3 text-fg rounded-lg transition-all text-sm font-medium"
              >
                Закрыть
              </button>
              <button
                onClick={handleShare}
                disabled={!selectedTeacher || isLoading}
                className="flex-1 px-4 py-2.5 surface-accent bg-accent-solid hover:bg-accent-solid-hover text-accent-fg shadow-accent rounded-lg transition-all text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? "Передача..." : "Предоставить доступ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Подтверждение отзыва доступа: действие необратимо для коллеги, поэтому спрашиваем */}
      <Modal
        open={Boolean(pendingUnshare)}
        onClose={() => setPendingUnshare(null)}
        title="Отозвать доступ?"
        description={
          pendingUnshare
            ? `${pendingUnshare.teacherName} · класс ${selectedClassForShare?.name ?? ""}`
            : undefined
        }
        size="sm"
        footer={
          <ModalFooter
            onCancel={() => setPendingUnshare(null)}
            onSubmit={confirmUnshare}
            submitLabel="Отозвать доступ"
            loading={isUnsharing}
            tone="danger"
          />
        }
      >
        <p className="text-sm text-fg-muted">
          Учитель больше не увидит список класса и не сможет отмечать присутствующих.
          Доступ можно будет выдать снова.
        </p>
      </Modal>
    </>
  );
}
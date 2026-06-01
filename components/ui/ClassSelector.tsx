"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, Users, Share2, UserPlus, X, Trash2, Search } from "lucide-react";

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
        alert(`Класс "${selectedClassForShare.name}" успешно передан учителю ${selectedTeacher.name}!`);
        setSelectedTeacher(null);
        setSearchQuery("");
        await fetchShares(selectedClassForShare.id);
      } else {
        alert(data.error || "Ошибка при передаче класса");
      }
    } catch (error) {
      console.error("Share error:", error);
      alert("Ошибка при передаче класса");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnshare = async (teacherId: string, teacherName: string) => {
    if (!confirm(`Отозвать доступ у учителя "${teacherName}"? Он потеряет доступ к этому классу.`)) return;
    
    setIsUnsharing(true);
    try {
      const response = await fetch(`/api/share?classId=${selectedClassForShare?.id}&teacherId=${teacherId}`, {
        method: "DELETE"
      });
      
      if (response.ok) {
        alert("Доступ отозван");
        await fetchShares(selectedClassForShare!.id);
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при отзыве доступа");
      }
    } catch (error) {
      console.error("Unshare error:", error);
      alert("Ошибка при отзыве доступа");
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

  const filteredTeachers = teachers.filter(teacher =>
    teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!classes || classes.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 text-center border border-white/20">
        <Users size={24} className="text-gray-500 mx-auto mb-2" />
        <p className="text-sm text-gray-400">Нет доступных классов</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative mb-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all"
        >
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-400" />
            <span className="font-semibold">{selectedClass?.name || "Выберите класс"}</span>
            {selectedClass?.isShared && !selectedClass?.isOwner && (
              <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full">
                Поделенный
              </span>
            )}
          </div>
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a2332] border border-white/20 rounded-xl shadow-lg z-20 max-h-80 overflow-y-auto">
            {/* Мои классы */}
            {myClasses.length > 0 && (
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-400 px-3 py-2">Мои классы</div>
                {myClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg group">
                    <button
                      onClick={() => {
                        onClassChange(cls);
                        setIsOpen(false);
                      }}
                      className="flex-1 text-left text-white"
                    >
                      <span>{cls.name}</span>
                      <span className="text-xs text-green-400 ml-2">Основной</span>
                    </button>
                    <button
                      onClick={() => openShareModal(cls)}
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1 px-2 py-1 bg-blue-500/20 rounded-lg transition-all"
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
              <div className="p-2 border-t border-white/10">
                <div className="text-xs font-semibold text-gray-400 px-3 py-2">Поделенные классы</div>
                {sharedClasses.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => {
                      onClassChange(cls);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 rounded-lg text-white"
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
          <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">Управление доступом</h3>
                  <p className="text-blue-100 text-sm">Класс: {selectedClassForShare.name}</p>
                </div>
                <button onClick={() => setIsShareModalOpen(false)} className="text-white/70 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Список учителей, с которыми уже поделились */}
              <div>
                <label className="block font-semibold text-white text-sm mb-2">
                  Кому уже открыт доступ ({shares.length}):
                </label>
                
                {isLoadingShares ? (
                  <div className="text-center text-gray-400 py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-xs mt-2">Загрузка...</p>
                  </div>
                ) : shares.length > 0 ? (
                  <div className="space-y-2">
                    {shares.map((share) => (
                      <div key={share.id} className="flex justify-between items-center p-3 bg-white/10 rounded-lg border border-white/10">
                        <div className="flex-1">
                          <div className="font-medium text-white text-sm">
                            {share.teacher?.name || "Учитель"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {share.teacher?.email || share.teacherId}
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnshare(share.teacherId, share.teacher?.name || "учителя")}
                          disabled={isUnsharing}
                          className="text-red-400 hover:text-red-300 px-2 py-1 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Отменить
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-4 bg-white/5 rounded-lg">
                    Нет активных доступов
                  </div>
                )}
              </div>

              {/* Добавление нового учителя - крупный поиск */}
              <div>
                <label className="block font-semibold text-white text-sm mb-2">
                  Добавить учителя
                </label>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowTeacherDropdown(true);
                    }}
                    onFocus={() => setShowTeacherDropdown(true)}
                    placeholder="Поиск учителя по имени или email..."
                    className="w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                  />
                  
                  {showTeacherDropdown && filteredTeachers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2332] border border-white/20 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredTeachers.map((teacher) => (
                        <button
                          key={teacher.id}
                          onClick={() => {
                            setSelectedTeacher(teacher);
                            setSearchQuery(teacher.name);
                            setShowTeacherDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-white/10 text-white text-sm"
                        >
                          <div className="font-medium">{teacher.name}</div>
                          <div className="text-xs text-gray-400">{teacher.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedTeacher && (
                  <div className="mt-2 p-2 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-green-400 text-sm font-medium">{selectedTeacher.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{selectedTeacher.email}</span>
                    </div>
                    <button onClick={() => setSelectedTeacher(null)} className="text-gray-400 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg">
                <p className="text-sm text-yellow-400">
                  ⚠️ При добавлении учителя он получит доступ к просмотру и отметке присутствующих для этого класса.
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm font-medium"
              >
                Закрыть
              </button>
              <button
                onClick={handleShare}
                disabled={!selectedTeacher || isLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? "Передача..." : "Предоставить доступ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
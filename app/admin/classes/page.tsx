"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LogOut, ArrowLeft, Users, UserCheck, School, Search,
  GraduationCap, Mail, ChevronDown, ChevronUp, UserX
} from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface Student {
  id: number;
  name: string;
}

interface Class {
  id: string;
  name: string;
  grade: number;
  letter: string;
  ownerId: string;
  owner: Teacher | null;
  students?: Student[];
}

export default function AdminClasses() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async () => {
    try {
      const classesRes = await fetch("/api/admin/classes");
      const classesData = await classesRes.json();
      setClasses(Array.isArray(classesData) ? classesData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setClasses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const toggleExpand = (classId: string) => {
    setExpandedClass(expandedClass === classId ? null : classId);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  };

  const filteredClasses = Array.isArray(classes)
    ? classes.filter(cls => cls.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  if (!mounted || status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
        <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl text-center border border-white/20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-300 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
      {/* Шапка */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-20">
        <div className="px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/admin")}
                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <School size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Классы</p>
                <p className="text-xs text-gray-400">Просмотр классов</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 max-w-full">
        {/* Поиск */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск классов..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Статистика */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Всего классов:</span>
            <span className="text-white font-bold text-lg">{filteredClasses.length}</span>
          </div>
        </div>

        {/* Список классов */}
        <div className="space-y-2">
          {filteredClasses.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center border border-white/20">
              <School size={40} className="text-gray-500 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Нет классов</p>
            </div>
          ) : (
            filteredClasses.map((cls) => (
              <div
                key={cls.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden"
              >
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <School size={14} className="text-blue-400 flex-shrink-0" />
                      <h4 className="font-semibold text-white text-base truncate">{cls.name}</h4>
                    </div>
                    <button
                      onClick={() => toggleExpand(cls.id)}
                      className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-300 rounded-lg hover:bg-white/10"
                    >
                      {expandedClass === cls.id ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <UserCheck size={10} className="text-green-400 flex-shrink-0" />
                      <span className="text-gray-400">Классный руководитель:</span>
                      <span className="text-white text-xs truncate">
                        {cls.owner?.name || cls.owner?.email?.split('@')[0] || "Не назначен"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Users size={10} className="text-blue-400 flex-shrink-0" />
                      <span className="text-gray-400">Учеников:</span>
                      <span className="text-white text-xs">{cls.students?.length || 0}</span>
                    </div>
                  </div>

                  {/* Список учеников */}
                  {expandedClass === cls.id && cls.students && cls.students.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs text-gray-400 mb-2 font-medium">
                        Список учеников ({cls.students.length}):
                      </div>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {cls.students.map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10"
                          >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-white text-sm font-medium truncate">
                                {student.name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span>ID: {student.id}</span>
                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                <span>Класс: {cls.name}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Если учеников нет */}
                  {expandedClass === cls.id && (!cls.students || cls.students.length === 0) && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center justify-center py-4 text-gray-500">
                        <UserX size={16} className="mr-2" />
                        <span className="text-xs">В классе нет учеников</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
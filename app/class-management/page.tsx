"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LogOut, ArrowLeft, Users, UserPlus, Trash2, Save, 
  X, Plus, Search, AlertCircle, UserRound, School
} from "lucide-react";

interface Student {
  id: number;
  name: string;
}

export default function ClassManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Загрузка классов
  useEffect(() => {
    const fetchClasses = async () => {
      if (!session) return;
      
      try {
        const response = await fetch("/api/classes");
        const data = await response.json();
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0]);
          setStudents(data[0].students || []);
        }
      } catch (error) {
        console.error("Error fetching classes:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClasses();
  }, [session]);

  const handleAddStudent = () => {
    if (!newStudentName.trim()) {
      alert("Введите имя ученика");
      return;
    }
    
    const newId = Math.max(...students.map(s => s.id), 0) + 1;
    setStudents([...students, { id: newId, name: newStudentName.trim() }]);
    setNewStudentName("");
  };

  const handleRemoveStudent = (id: number) => {
    if (confirm("Удалить ученика?")) {
      setStudents(students.filter(s => s.id !== id));
    }
  };

  const handleSave = async () => {
    if (!selectedClass) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/classes/${selectedClass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students })
      });
      
      if (response.ok) {
        alert("Список учеников сохранён!");
        // Обновляем данные в выбранном классе
        setSelectedClass({ ...selectedClass, students });
      } else {
        alert("Ошибка при сохранении");
      }
    } catch (error) {
      console.error("Error saving students:", error);
      alert("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClassChange = (cls: any) => {
    setSelectedClass(cls);
    setStudents(cls.students || []);
    setSearchQuery("");
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  if (!session) return null;

  return (
    <div className="min-h-screen p-3" style={{ background: "linear-gradient(135deg, #1a2332 0%, #2b3858 100%)" }}>
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Шапка */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/")}
                className="w-8 h-8 flex items-center justify-center bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all border border-blue-500/30"
                title="На главную"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                <School size={18} className="text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-white">Управление классом</p>
                <p className="text-xs text-gray-400">{session.user?.name}</p>
              </div>
            </div>
            <button
              onClick={() => router.push("/")}
              className="w-8 h-8 flex items-center justify-center bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 rounded-lg transition-all border border-gray-500/30"
              title="На главную"
            >
              <Users size={16} />
            </button>
          </div>
        </div>

        {/* Выбор класса */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
          <label className="block text-white text-sm mb-2">Выберите класс</label>
          <div className="flex flex-wrap gap-2">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => handleClassChange(cls)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  selectedClass?.id === cls.id
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        </div>

        {selectedClass && (
          <>
            {/* Поиск */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск учеников..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Добавление ученика */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Имя нового ученика"
                  className="flex-1 px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === "Enter" && handleAddStudent()}
                />
                <button
                  onClick={handleAddStudent}
                  className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex items-center gap-1"
                >
                  <Plus size={16} />
                  Добавить
                </button>
              </div>
            </div>

            {/* Список учеников */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white">
                  Список учеников ({students.length})
                </h3>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <Save size={14} />
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <Users size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Нет учеников</p>
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <UserRound size={14} className="text-gray-400" />
                        <span className="text-white text-sm">{student.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveStudent(student.id)}
                        className="text-red-400 hover:text-red-300 p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Подсказка */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} className="text-yellow-400" />
                <span className="text-xs text-yellow-400">
                  ⚠️ После добавления/удаления учеников не забудьте нажать "Сохранить"
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
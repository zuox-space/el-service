"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LogOut, ArrowLeft, Plus, Edit2, Trash2, X,
  Users, UserCheck, School, Search, UserPlus, Save,
  AlertCircle, ChevronDown, ChevronUp, Menu, MoveRight, UserMinus,
  GraduationCap, Mail, Phone, Upload, FileSpreadsheet, CheckCircle, XCircle,
  Home, Download, Eye, Bot, Shield, DoorOpen, FileText, Clock, CalendarDays,
  Filter, Undo2, UserX
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
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState("");
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    grade: "",
    letter: "",
    ownerId: "",
  });

  // Состояния для перевода ученика
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [sourceClassId, setSourceClassId] = useState<string>("");

  // Состояния для импорта
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

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
      const [classesRes, teachersRes] = await Promise.all([
        fetch("/api/admin/classes"),
        fetch("/api/admin/teachers"),
      ]);
      const classesData = await classesRes.json();
      const teachersData = await teachersRes.json();

      setClasses(Array.isArray(classesData) ? classesData : []);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
      setClasses([]);
      setTeachers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const handleOpenModal = (cls?: Class) => {
    if (cls) {
      setEditingClass(cls);
      setFormData({
        name: cls.name,
        grade: cls.grade.toString(),
        letter: cls.letter,
        ownerId: cls.ownerId || "",
      });
    } else {
      setEditingClass(null);
      setFormData({
        name: "",
        grade: "",
        letter: "",
        ownerId: "",
      });
    }
    setShowModal(true);
  };

  const handleOpenStudentsModal = (cls: Class) => {
    setSelectedClass(cls);
    setStudents(cls.students || []);
    setNewStudentName("");
    setShowStudentsModal(true);
  };

  // Открытие модального окна перевода
  const handleOpenTransferModal = (student: Student, classId: string) => {
    setSelectedStudent(student);
    setSourceClassId(classId);
    setTargetClassId("");
    setShowTransferModal(true);
  };

  // Перевод ученика в другой класс
  const handleTransferStudent = async () => {
    if (!selectedStudent || !targetClassId || !sourceClassId) {
      alert("Выберите класс для перевода");
      return;
    }

    if (sourceClassId === targetClassId) {
      alert("Ученик уже в этом классе");
      return;
    }

    try {
      const response = await fetch("/api/admin/students/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          fromClassId: sourceClassId,
          toClassId: targetClassId,
        }),
      });

      if (response.ok) {
        alert(`Ученик "${selectedStudent.name}" переведен в новый класс`);
        setShowTransferModal(false);
        setSelectedStudent(null);
        setTargetClassId("");
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при переводе ученика");
      }
    } catch (error) {
      console.error("Error transferring student:", error);
      alert("Ошибка при переводе ученика");
    }
  };

  // Удаление ученика из класса
  const handleRemoveStudentFromClass = async (student: Student, classId: string) => {
    if (!confirm(`Удалить ученика "${student.name}" из класса?`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/students/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
          classId: classId,
        }),
      });

      if (response.ok) {
        alert(`Ученик "${student.name}" удален из класса`);
        fetchData();
        if (showStudentsModal && selectedClass) {
          const updatedClass = classes.find(c => c.id === selectedClass.id);
          if (updatedClass) {
            setStudents(updatedClass.students || []);
          }
        }
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при удалении ученика");
      }
    } catch (error) {
      console.error("Error removing student:", error);
      alert("Ошибка при удалении ученика");
    }
  };

  // Импорт учеников из Excel
  const handleImport = async () => {
    if (!importFile) {
      alert("Выберите файл для импорта");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/admin/classes/import", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      setImportResult(result);

      if (response.ok) {
        alert(result.message);
        fetchData();
        setImportFile(null);
        setTimeout(() => {
          setShowImportModal(false);
          setImportResult(null);
        }, 3000);
      } else {
        alert(result.error || "Ошибка при импорте");
      }
    } catch (error) {
      console.error("Error importing:", error);
      alert("Ошибка при импорте");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.grade || !formData.letter || !formData.ownerId) {
      alert("Заполните все обязательные поля");
      return;
    }

    const payload = {
      name: formData.name,
      grade: parseInt(formData.grade),
      letter: formData.letter.toUpperCase(),
      ownerId: formData.ownerId,
    };

    try {
      const response = await fetch("/api/admin/classes", {
        method: editingClass ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingClass ? { ...payload, id: editingClass.id } : payload),
      });

      if (response.ok) {
        alert(editingClass ? "Класс обновлён" : "Класс создан");
        setShowModal(false);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при сохранении");
      }
    } catch (error) {
      console.error("Error saving class:", error);
      alert("Ошибка при сохранении");
    }
  };

  const handleSaveStudents = async () => {
    if (!selectedClass) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/classes/${selectedClass.id}/students`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students })
      });

      if (response.ok) {
        alert("Список учеников сохранён!");
        setShowStudentsModal(false);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || "Ошибка при сохранении");
      }
    } catch (error) {
      console.error("Error saving students:", error);
      alert("Ошибка при сохранении");
    } finally {
      setIsSaving(false);
    }
  };

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

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Удалить класс "${name}"? Все данные о пропусках и отметках будут удалены.`)) {
      try {
        const response = await fetch(`/api/admin/classes?id=${id}`, { method: "DELETE" });
        if (response.ok) {
          alert("Класс удалён");
          fetchData();
        } else {
          alert("Ошибка при удалении");
        }
      } catch (error) {
        console.error("Error deleting class:", error);
        alert("Ошибка при удалении");
      }
    }
  };

  const toggleExpand = (classId: string) => {
    setExpandedClass(expandedClass === classId ? null : classId);
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
                <p className="text-xs text-gray-400">Управление классами</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 max-w-full">
        {/* Поиск и добавление */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20 mb-3">
          <div className="flex flex-col gap-2">
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
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenModal()}
                className="flex-1 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={14} />
                Создать класс
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Upload size={14} />
                <span className="hidden sm:inline">Импорт</span>
              </button>
            </div>
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
              <button
                onClick={() => handleOpenModal()}
                className="mt-3 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-xs transition-all"
              >
                Создать первый класс
              </button>
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
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenStudentsModal(cls)}
                        className="w-7 h-7 flex items-center justify-center text-green-400 hover:text-green-300 rounded-lg hover:bg-white/10"
                        title="Наполнить класс"
                      >
                        <UserPlus size={14} />
                      </button>
                      <button
                        onClick={() => handleOpenModal(cls)}
                        className="w-7 h-7 flex items-center justify-center text-blue-400 hover:text-blue-300 rounded-lg hover:bg-white/10"
                        title="Редактировать"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(cls.id, cls.name)}
                        className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-300 rounded-lg hover:bg-white/10"
                        title="Удалить"
                      >
                        <Trash2 size={14} />
                      </button>
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
                      <div className="space-y-2">
                        {cls.students.map((student) => (
                          <div
                            key={student.id}
                            className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
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

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleOpenTransferModal(student, cls.id)}
                                className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg transition-all flex items-center gap-1"
                                title="Перевести в другой класс"
                              >
                                <MoveRight size={18} />
                                <span className="text-xs hidden sm:inline">Перевести</span>
                              </button>
                              <button
                                onClick={() => handleRemoveStudentFromClass(student, cls.id)}
                                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-all flex items-center gap-1"
                                title="Удалить из класса"
                              >
                                <UserMinus size={18} />
                                <span className="text-xs hidden sm:inline">Удалить</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Модальное окно создания/редактирования класса */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
          <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white">
                  {editingClass ? "Редактировать класс" : "Новый класс"}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-white text-xs mb-1">Название класса *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: 7А"
                  className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-white text-xs mb-1">Номер *</label>
                  <input
                    type="number"
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    placeholder="7"
                    className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-white text-xs mb-1">Буква *</label>
                  <input
                    type="text"
                    value={formData.letter}
                    onChange={(e) => setFormData({ ...formData, letter: e.target.value.toUpperCase() })}
                    placeholder="А"
                    maxLength={1}
                    className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white text-xs mb-1">Классный руководитель *</label>
                <select
                  value={formData.ownerId}
                  onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-[#1a2332]">Выберите руководителя</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id} className="bg-[#1a2332]">
                      {teacher.name || teacher.email?.split('@')[0]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all text-sm"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно наполнения класса учениками */}
      {showStudentsModal && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
          <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden max-h-[85vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-white">Наполнение класса</h3>
                  <p className="text-green-100 text-xs">{selectedClass.name}</p>
                </div>
                <button onClick={() => setShowStudentsModal(false)} className="text-white/70 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Имя нового ученика"
                  className="flex-1 px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyPress={(e) => e.key === "Enter" && handleAddStudent()}
                />
                <button
                  onClick={handleAddStudent}
                  className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-all flex items-center gap-1 text-sm"
                >
                  <Plus size={14} />
                  Добавить
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white text-xs">Список учеников ({students.length})</span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {students.length === 0 ? (
                    <div className="text-center text-gray-400 py-6">
                      <Users size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Нет учеников</p>
                    </div>
                  ) : (
                    students.map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                        <span className="text-white text-sm truncate flex-1 mr-2">{student.name}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setShowStudentsModal(false);
                              handleOpenTransferModal(student, selectedClass.id);
                            }}
                            className="text-blue-400 hover:text-blue-300 p-1 rounded transition-all"
                            title="Перевести в другой класс"
                          >
                            <MoveRight size={14} />
                          </button>
                          <button
                            onClick={() => handleRemoveStudent(student.id)}
                            className="text-red-400 hover:text-red-300 p-1 rounded transition-all"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={12} className="text-yellow-400" />
                  <span className="text-[10px] text-yellow-400">
                    После изменений нажмите "Сохранить"
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
              <button
                onClick={() => setShowStudentsModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveStudents}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all text-sm disabled:opacity-50"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно перевода ученика */}
      {showTransferModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
          <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-white">Перевод ученика</h3>
                  <p className="text-blue-100 text-xs truncate">{selectedStudent.name}</p>
                </div>
                <button onClick={() => setShowTransferModal(false)} className="text-white/70 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-xs text-gray-400 mb-1">Текущий класс:</div>
                <div className="text-white font-medium">
                  {classes.find(c => c.id === sourceClassId)?.name || "Неизвестно"}
                </div>
              </div>

              <div>
                <label className="block text-white text-xs mb-1">Куда перевести *</label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-[#1a2332]">Выберите класс</option>
                  {classes
                    .filter(c => c.id !== sourceClassId)
                    .map((cls) => (
                      <option key={cls.id} value={cls.id} className="bg-[#1a2332]">
                        {cls.name} ({cls.students?.length || 0} учеников)
                      </option>
                    ))}
                </select>
              </div>

              {targetClassId && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={12} className="text-yellow-400" />
                    <span className="text-[10px] text-yellow-400">
                      Ученик будет перемещен в класс {classes.find(c => c.id === targetClassId)?.name}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
              >
                Отмена
              </button>
              <button
                onClick={handleTransferStudent}
                disabled={!targetClassId}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Перевести
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно импорта */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
          <div className="w-full max-w-lg bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 sticky top-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-white">Импорт учеников</h3>
                  <p className="text-blue-100 text-xs">Загрузите Excel-файл с учениками</p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  className="text-white/70 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Инструкция */}
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="flex items-start gap-2">
                  <FileSpreadsheet size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-xs font-medium">Формат файла:</p>
                    <p className="text-gray-400 text-xs mt-1">
                      • Первая колонка (A) — ФИО ученика<br />
                      • Вторая колонка (B) — Название класса (например: 7А, 8Б, 10А)<br />
                      • Поддерживаются .xlsx и .xls файлы
                    </p>
                    <p className="text-gray-500 text-xs mt-2">
                      💡 Первая строка с заголовками будет пропущена автоматически
                    </p>
                  </div>
                </div>
              </div>

              {/* Область загрузки файла */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${dragActive
                  ? 'border-blue-500 bg-blue-500/10'
                  : importFile
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-white/20 hover:border-white/40'
                  }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  const files = e.dataTransfer.files;
                  if (files.length > 0) {
                    const file = files[0];
                    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                      setImportFile(file);
                    } else {
                      alert('Поддерживаются только .xlsx и .xls файлы');
                    }
                  }
                }}
              >
                {importFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet size={32} className="text-green-400" />
                    <div className="text-left">
                      <p className="text-white text-sm font-medium truncate max-w-[200px]">
                        {importFile.name}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => setImportFile(null)}
                      className="p-1 text-red-400 hover:text-red-300 rounded-full hover:bg-red-500/10 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-400 text-sm">
                      Перетащите файл сюда или <span className="text-blue-400">выберите файл</span>
                    </p>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImportFile(file);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Результат импорта */}
              {importResult && (
                <div className={`rounded-lg p-3 border ${importResult.success
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
                  }`}>
                  <div className="flex items-start gap-2">
                    {importResult.success ? (
                      <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-white text-sm font-medium">
                        {importResult.success ? '✅ Импорт завершен' : '❌ Ошибка импорта'}
                      </p>
                      <p className="text-gray-300 text-xs mt-1">
                        Импортировано: <span className="text-green-400">{importResult.imported || 0}</span> учеников
                        {importResult.skipped > 0 && (
                          <> · Пропущено: <span className="text-yellow-400">{importResult.skipped}</span></>
                        )}
                      </p>
                      {importResult.results && importResult.results.map((result: any, idx: number) => (
                        <div key={idx} className="text-gray-400 text-xs mt-1">
                          {result.className}: +{result.added} учеников (всего {result.total})
                        </div>
                      ))}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto">
                          {importResult.errors.slice(0, 5).map((err: string, idx: number) => (
                            <div key={idx} className="text-yellow-400 text-xs mt-0.5">• {err}</div>
                          ))}
                          {importResult.errors.length > 5 && (
                            <div className="text-gray-500 text-xs mt-1">
                              и еще {importResult.errors.length - 5} ошибок
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex gap-3">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-sm"
              >
                {importResult ? 'Закрыть' : 'Отмена'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || isImporting}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Импорт...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Загрузить
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
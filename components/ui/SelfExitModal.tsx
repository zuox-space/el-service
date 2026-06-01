"use client";

import { useState, useRef, useEffect } from "react";
import { X, Calendar, User, FileText, Image, Upload, Loader2, ChevronDown, Search } from "lucide-react";

interface SelfExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  studentsList: any[];
}

export default function SelfExitModal({ isOpen, onClose, onSubmit, studentsList }: SelfExitModalProps) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Получаем сегодняшнюю дату в формате YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  // Фильтрация учеников по поиску
  const filteredStudents = studentsList.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Закрытие дропдауна при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStudent) {
      alert("Выберите ученика");
      return;
    }
    if (!startDate) {
      alert("Укажите дату начала");
      return;
    }
    if (!endDate) {
      alert("Укажите дату окончания");
      return;
    }
    if (!photo) {
      alert("Прикрепите фото заявления");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", photo);
      
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      const uploadData = await uploadRes.json();
      
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Upload failed");
      }

      onSubmit({
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        startDate,
        endDate,
        photoUrl: uploadData.photoUrl,
        reason,
      });

      setSelectedStudent(null);
      setStartDate("");
      setEndDate("");
      setReason("");
      setPhoto(null);
      setPhotoPreview(null);
      setIsUploading(false);
      onClose();
    } catch (error) {
      console.error("Submit error:", error);
      alert("Ошибка при сохранении");
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3">
      <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 sticky top-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <User size={18} className="text-white" />
              <h3 className="text-lg font-bold text-white">Самовывод ученика</h3>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Кастомный select для выбора ученика */}
          <div>
            <label className="block text-white text-sm mb-1">Ученик *</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span className={selectedStudent ? "text-white" : "text-gray-400"}>
                  {selectedStudent ? selectedStudent.name : "Выберите ученика"}
                </span>
                <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a2332] border border-white/20 rounded-lg shadow-lg z-10 max-h-60 overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Поиск ученика..."
                        className="w-full pl-9 pr-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400 text-center">
                        Ничего не найдено
                      </div>
                    ) : (
                      filteredStudents.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => {
                            setSelectedStudent(student);
                            setIsDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className="w-full text-left px-3 py-2 text-white hover:bg-white/10 transition-colors text-sm"
                        >
                          {student.name}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Период действия */}
          {/* Период действия */}
<div className="flex gap-2">
  <div className="flex-1">
    <label className="block text-white text-xs mb-1">С *</label>
    <input
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      min={today}
      className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
  <div className="flex-1">
    <label className="block text-white text-xs mb-1">По *</label>
    <input
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      min={startDate || today}
      className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
</div>

          {/* Причина (опционально) */}
          <div>
            <label className="block text-white text-sm mb-1">Причина</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Причина (необязательно)"
              rows={2}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Загрузка фото */}
          <div>
            <label className="block text-white text-sm mb-1">Фото заявления *</label>
            <div className="border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:border-indigo-500 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {photoPreview ? (
                <div className="space-y-2">
                  <img src={photoPreview} alt="Preview" className="max-h-32 mx-auto rounded-lg" />
                  <p className="text-sm text-gray-400">Нажмите для замены</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={32} className="mx-auto text-gray-400" />
                  <p className="text-sm text-gray-400">Нажмите или перетащите фото</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5">
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Загрузка...
              </>
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
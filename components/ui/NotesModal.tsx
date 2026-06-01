"use client";

import { useState } from "react";
import { X, BookMarked } from "lucide-react";

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function NotesModal({ isOpen, onClose, onSubmit }: NotesModalProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!content.trim()) {
      alert("Введите текст заметки");
      return;
    }

    setIsSubmitting(true);
    onSubmit({ content });
    setContent("");
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-md p-3">
      <div className="w-full max-w-md bg-gradient-to-br from-[#1a2332] to-[#2b3858] rounded-xl shadow-2xl border border-white/20 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BookMarked size={18} className="text-white" />
              <h3 className="text-lg font-bold text-white">Заметка</h3>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Текст заметки..."
            rows={5}
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg font-medium disabled:opacity-50 transition-all"
          >
            {isSubmitting ? "Добавление..." : "Добавить заметку"}
          </button>
        </div>
      </div>
    </div>
  );
}
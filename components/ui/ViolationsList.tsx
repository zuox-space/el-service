// components/ui/ViolationsList.tsx
"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Clock, User, Trash2, Loader2, Calendar } from "lucide-react";
import { getViolationType } from "@/lib/violations";

interface Violation {
    id: string;
    studentId: string;
    studentName: string;
    className: string;
    violationType: string;
    comment: string | null;
    teacherName: string;
    date: string;
}

interface ViolationsListProps {
    violations: Violation[];
    isLoading?: boolean;
    onDelete?: (id: string) => void;
    showClassName?: boolean;
    showTeacher?: boolean;
    emptyMessage?: string;
}

export default function ViolationsList({
    violations,
    isLoading = false,
    onDelete,
    showClassName = true,
    showTeacher = true,
    emptyMessage = "Нет нарушений",
}: ViolationsListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-sm">Загрузка...</span>
            </div>
        );
    }

    if (violations.length === 0) {
        return (
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 text-center border border-white/10">
                <AlertTriangle size={28} className="text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {violations.map((violation) => {
                const type = getViolationType(violation.violationType);
                return (
                    <div
                        key={violation.id}
                        className="bg-white/10 backdrop-blur-lg rounded-xl p-3 border border-white/20"
                    >
                        <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg ${type.bgColor} flex items-center justify-center flex-shrink-0`}>
                                <span className="text-base">{type.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-white text-sm font-medium truncate">
                                            {violation.studentName}
                                        </h4>
                                        {showClassName && violation.className && (
                                            <span className="text-[10px] text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded">
                                                {violation.className}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-xs ${type.color} font-medium flex-shrink-0`}>
                                        {type.shortLabel}
                                    </span>
                                </div>

                                {violation.comment && (
                                    <p className="text-xs text-gray-300 mt-1 line-clamp-2">
                                        {violation.comment}
                                    </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Clock size={9} />
                                        <span>
                                            {new Date(violation.date).toLocaleString('ru-RU', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    {showTeacher && violation.teacherName && (
                                        <div className="flex items-center gap-1">
                                            <User size={9} />
                                            <span>{violation.teacherName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {onDelete && (
                                <button
                                    onClick={() => onDelete(violation.id)}
                                    className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-red-500/10 transition-all flex-shrink-0"
                                    title="Удалить"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
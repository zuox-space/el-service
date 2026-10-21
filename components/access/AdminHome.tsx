"use client";

// components/access/AdminHome.tsx
import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    ChartPie,
    ClipboardList,
    LayoutDashboard,
    ListOrdered,
    ShieldAlert,
    Shirt,
    UserX,
    Users,
    type LucideIcon,
} from "lucide-react";
import { useAccess } from "./AccessProvider";
import { ACCESS_SECTIONS } from "@/lib/access/registry";
import { Badge } from "@/components/ui/kit";

/**
 * Первый экран админки для сотрудника без «Контроля выхода».
 *
 * Вместо автоперехода в случайный раздел показываем выбор: те разделы, которые
 * ему действительно выданы. Так человек сам решает, с чего начать, и видит
 * границы своего доступа.
 */
const SECTION_ICONS: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    students: Users,
    classes: ClipboardList,
    classesOverview: ListOrdered,
    violations: AlertTriangle,
    schoolRecords: ShieldAlert,
    truants: UserX,
    violationsStats: ChartPie,
    uniform: Shirt,
    absent: BarChart3,
    users: Users,
};

export function AdminHome() {
    const { can } = useAccess();

    const sections = ACCESS_SECTIONS.filter(
        section => section.href && section.id !== "myClass" && can(section.id),
    );

    return (
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5">
            <h1 className="text-xl font-semibold text-fg">Админ панель</h1>
            <p className="mt-1 text-sm text-fg-muted">
                Вам доступны эти разделы. Выберите, с чего начать — меню слева всегда под рукой.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map(section => {
                    const Icon = SECTION_ICONS[section.id] ?? ClipboardList;

                    return (
                        <Link
                            key={section.id}
                            href={section.href as string}
                            className="group rounded-card border border-dashed border-border bg-surface p-3 shadow-card transition-colors hover:border-accent/50 hover:bg-surface-hover"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                                    <Icon size={18} aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-semibold text-fg">{section.label}</h2>
                                    <p className="mt-0.5 line-clamp-2 text-xs text-fg-subtle">
                                        {section.description}
                                    </p>
                                </div>
                                <ArrowRight
                                    size={16}
                                    className="mt-1 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent-text"
                                    aria-hidden
                                />
                            </div>
                        </Link>
                    );
                })}
            </div>

            <p className="mt-3 text-xs text-fg-subtle">
                Доступы выдаёт администратор: <Badge tone="neutral">Персонал → сотрудник → Доступ к разделам</Badge>
            </p>
        </div>
    );
}

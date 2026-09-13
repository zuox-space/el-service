// app/api/admin/school-records/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roles = (session?.user?.roles as string[]) || [];
    if (!roles.includes("ADMIN")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const searchQuery = searchParams.get("search");

        console.log(`🔍 Loading all school records for admin`);

        // Получаем ВСЕ записи
        const allRecords = await prisma.schoolRecord.findMany({
            orderBy: { registeredAt: 'desc' },
        });

        // Фильтр по периоду (для статистики)
        const periodStart = startDate ? new Date(startDate + 'T00:00:00.000Z') : null;
        const periodEnd = endDate ? new Date(endDate + 'T23:59:59.999Z') : null;

        // Фильтр по поиску (по причине, ФИО, классу)
        let filtered = allRecords;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r =>
                r.studentName.toLowerCase().includes(q) ||
                r.className.toLowerCase().includes(q) ||
                r.reason.toLowerCase().includes(q) ||
                r.registeredByName.toLowerCase().includes(q)
            );
        }

        // Получаем уникальные классы
        const uniqueClasses = [...new Set(allRecords.map(r => r.className).filter(Boolean))].sort();

        // Активные записи
        const activeRecords = allRecords.filter(r => r.isActive);

        // Снятые записи
        const releasedRecords = allRecords.filter(r => !r.isActive);

        // 🔥 СТАТИСТИКА
        const now = new Date();
        const in7Days = new Date();
        in7Days.setDate(in7Days.getDate() + 7);
        const in14Days = new Date();
        in14Days.setDate(in14Days.getDate() + 14);
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);

        // Записи, у которых приближается срок снятия (в течение 7/14/30 дней)
        const expiringIn7Days = activeRecords.filter(r => {
            if (!r.plannedReleaseAt) return false;
            const planned = new Date(r.plannedReleaseAt);
            return planned >= now && planned <= in7Days;
        });

        const expiringIn14Days = activeRecords.filter(r => {
            if (!r.plannedReleaseAt) return false;
            const planned = new Date(r.plannedReleaseAt);
            return planned >= now && planned <= in14Days;
        });

        const expiringIn30Days = activeRecords.filter(r => {
            if (!r.plannedReleaseAt) return false;
            const planned = new Date(r.plannedReleaseAt);
            return planned >= now && planned <= in30Days;
        });

        // Просроченные (срок прошёл, а ученик всё ещё на учёте)
        const overdue = activeRecords.filter(r => {
            if (!r.plannedReleaseAt) return false;
            const planned = new Date(r.plannedReleaseAt);
            return planned < now;
        });

        // Постановки за период
        const registeredInPeriod = allRecords.filter(r => {
            if (!periodStart || !periodEnd) return false;
            const regDate = new Date(r.registeredAt);
            return regDate >= periodStart && regDate <= periodEnd;
        });

        // Снятия за период
        const releasedInPeriod = releasedRecords.filter(r => {
            if (!periodStart || !periodEnd) return false;
            if (!r.releasedAt) return false;
            const relDate = new Date(r.releasedAt);
            return relDate >= periodStart && relDate <= periodEnd;
        });

        // Статистика по классам
        const byClass: Record<string, { active: number; total: number }> = {};
        activeRecords.forEach(r => {
            if (!r.className) return;
            if (!byClass[r.className]) {
                byClass[r.className] = { active: 0, total: 0 };
            }
            byClass[r.className].active++;
        });

        // Статистика по месяцам (последние 12 месяцев)
        const byMonth: Record<string, { registered: number; released: number }> = {};
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            byMonth[key] = { registered: 0, released: 0 };
        }

        allRecords.forEach(r => {
            const regDate = new Date(r.registeredAt);
            const regKey = `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, '0')}`;
            if (byMonth[regKey]) {
                byMonth[regKey].registered++;
            }
        });

        releasedRecords.forEach(r => {
            if (!r.releasedAt) return;
            const relDate = new Date(r.releasedAt);
            const relKey = `${relDate.getFullYear()}-${String(relDate.getMonth() + 1).padStart(2, '0')}`;
            if (byMonth[relKey]) {
                byMonth[relKey].released++;
            }
        });

        // Общая статистика
        const stats = {
            total: allRecords.length,
            active: activeRecords.length,
            released: releasedRecords.length,
            expiringIn7Days: expiringIn7Days.length,
            expiringIn14Days: expiringIn14Days.length,
            expiringIn30Days: expiringIn30Days.length,
            overdue: overdue.length,
            uniqueClasses: uniqueClasses.length,
            periodRegistered: registeredInPeriod.length,
            periodReleased: releasedInPeriod.length,
            byClass,
            byMonth,
        };

        console.log(`✅ Stats:`, {
            total: stats.total,
            active: stats.active,
            released: stats.released,
            expiring: stats.expiringIn30Days,
            overdue: stats.overdue,
        });

        return NextResponse.json({
            records: filtered,
            stats,
            uniqueClasses,
            expiringIn7Days,
            expiringIn14Days,
            expiringIn30Days,
            overdue,
            periodRegistered: registeredInPeriod,
            periodReleased: releasedInPeriod,
        });

    } catch (error) {
        console.error("❌ Error fetching school records:", error);
        return NextResponse.json(
            { error: "Failed to fetch", details: String(error) },
            { status: 500 }
        );
    }
}
"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { useAccess } from "@/components/access/AccessProvider";
import { NoAccess } from "@/components/access/NoAccess";
import { AdminHome } from "@/components/access/AdminHome";
import { ACCESS_SECTIONS, isAdminSection, sectionForPath } from "@/lib/access/registry";

/**
 * Клиентский каркас админки.
 *
 * Серверная проверка сессии и наличия хотя бы одного админского раздела
 * находится в app/admin/layout.tsx. Здесь остаётся только UI-навигация
 * и проверка конкретного раздела по адресу.
 */
export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "/admin";
    const { loading, can } = useAccess();

    const section = sectionForPath(pathname);
    const denied = !loading && section ? !can(section.id) : false;

    const showAdminHome =
        !loading &&
        pathname === "/admin" &&
        !can("dashboard") &&
        ACCESS_SECTIONS.some(
            item => isAdminSection(item) && !item.adminOnly && can(item.id),
        );

    if (showAdminHome) {
        return (
            <AppShell>
                <AdminHome />
            </AppShell>
        );
    }

    return <AppShell>{denied ? <NoAccess title={`Нет доступа: ${section?.label}`} /> : children}</AppShell>;
}

"use client";

// app/admin/layout.tsx
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { useAccess } from "@/components/access/AccessProvider";
import { NoAccess } from "@/components/access/NoAccess";
import { sectionForPath } from "@/lib/access/registry";

/**
 * Каркас административного раздела.
 *
 * Навигация (нижний таб-бар на мобильном, сайдбар на планшете и десктопе)
 * и шапка живут здесь, а не в каждой странице — поэтому разделы больше не
 * дублируют меню и не расходятся между собой.
 *
 * Здесь же единая проверка доступа к странице: раздел определяется по адресу
 * (реестр разделов), поэтому новую страницу не нужно отдельно защищать —
 * достаточно указать её href в registry.ts.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "/admin";
    const { loading, can } = useAccess();

    const section = sectionForPath(pathname);
    const denied = !loading && section ? !can(section.id) : false;

    return <AppShell>{denied ? <NoAccess title={`Нет доступа: ${section?.label}`} /> : children}</AppShell>;
}

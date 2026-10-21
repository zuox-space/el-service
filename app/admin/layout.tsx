"use client";

// app/admin/layout.tsx
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { useAccess } from "@/components/access/AccessProvider";
import { NoAccess } from "@/components/access/NoAccess";
import { ACCESS_SECTIONS, sectionForPath } from "@/lib/access/registry";

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
 *
 * Особый случай — сам `/admin`: это «вход в админку». Если у сотрудника нет
 * «Контроля выхода», но есть другие разделы, его сразу переводим в первый
 * доступный — так карточка «Админ панель» на портале всегда приводит туда,
 * куда можно.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname() ?? "/admin";
    const router = useRouter();
    const { loading, can } = useAccess();

    const section = sectionForPath(pathname);
    const denied = !loading && section ? !can(section.id) : false;

    // Первый доступный раздел — для входа в админку без «Контроля выхода»
    const fallbackHref =
        !loading && pathname === "/admin" && !can("dashboard")
            ? ACCESS_SECTIONS.find(
                item => item.href && item.id !== "myClass" && !item.adminOnly && can(item.id),
            )?.href ?? null
            : null;

    useEffect(() => {
        if (fallbackHref) router.replace(fallbackHref);
    }, [fallbackHref, router]);

    // Пока доступы грузятся, на входе в админку не показываем чужой дашборд
    if (loading && pathname === "/admin") {
        return (
            <AppShell>
                <div className="mx-auto w-full max-w-[1440px] px-4 py-10 text-center text-sm text-fg-muted">
                    Загрузка…
                </div>
            </AppShell>
        );
    }

    if (fallbackHref) {
        return (
            <AppShell>
                <div className="mx-auto w-full max-w-[1440px] px-4 py-10 text-center text-sm text-fg-muted">
                    Открываем доступный раздел…
                </div>
            </AppShell>
        );
    }

    return <AppShell>{denied ? <NoAccess title={`Нет доступа: ${section?.label}`} /> : children}</AppShell>;
}

import { redirect } from "next/navigation";
import AdminLayoutClient from "@/components/access/AdminLayoutClient";
import { getSessionAccess } from "@/lib/access/server";
import { ACCESS_SECTIONS, isAdminSection } from "@/lib/access/registry";

/**
 * Серверная граница админки.
 *
 * Клиентский layout раньше показывал «Нет доступа» только после загрузки
 * /api/access. Это защищало данные (API уже проверяет разделы), но сам HTML
 * админки отдавался любому авторизованному сотруднику. Теперь до рендера
 * проверяем сессию и наличие хотя бы одного админского раздела.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const access = await getSessionAccess();

    if (!access) {
        redirect("/login?callbackUrl=/admin");
    }

    const hasAdminSection = ACCESS_SECTIONS.some(
        section => isAdminSection(section) && access.sections.includes(section.id),
    );

    if (!hasAdminSection) {
        redirect("/");
    }

    return <AdminLayoutClient>{children}</AdminLayoutClient>;
}

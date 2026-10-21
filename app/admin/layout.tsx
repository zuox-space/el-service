import { AppShell } from "@/components/shell/AppShell";

/**
 * Каркас административного раздела.
 *
 * Навигация (нижний таб-бар на мобильном, сайдбар на планшете и десктопе)
 * и шапка живут здесь, а не в каждой странице — поэтому разделы больше не
 * дублируют меню и не расходятся между собой.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <AppShell>{children}</AppShell>;
}

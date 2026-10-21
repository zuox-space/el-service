// app/admin/loading.tsx
import { Skeleton } from "@/components/ui/kit";

/**
 * Загрузка раздела /admin: скелет в форме типичной страницы.
 * Показывается внутри каркаса (sidebar/tab bar), поэтому навигация не «прыгает».
 */
export default function AdminLoading() {
    return (
        <div className="min-h-full bg-bg">
            <div className="mx-auto w-full max-w-[1440px] space-y-3 px-4 py-4">
                <div className="space-y-2">
                    <Skeleton height={24} width="40%" radius="control" />
                    <Skeleton height={14} width="55%" radius="control" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} height={72} radius="card" />
                    ))}
                </div>
                <Skeleton height={72} radius="card" />
                <Skeleton height={280} radius="card" />
            </div>
        </div>
    );
}

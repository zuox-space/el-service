// app/loading.tsx
import { PageLoading } from "@/components/ui/kit";

/**
 * Загрузка корневого сегмента.
 *
 * Нужна, чтобы при переходе на страницу не показывалась предыдущая разметка
 * в её старых цветах: сразу рисуется скелет на токенах текущей темы.
 */
export default function RootLoading() {
    return <PageLoading />;
}

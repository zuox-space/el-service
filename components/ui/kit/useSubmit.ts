"use client";

import { useCallback, useState } from "react";

/**
 * useSubmit — единый сценарий отправки формы в модалке.
 *
 * Зачем отдельный хук: раньше каждая модалка закрывалась по таймеру сразу после
 * вызова onSubmit, не дожидаясь ответа сервера, а ошибку показывала через alert().
 * При сбое сети окно уже было закрыто, введённые данные терялись, а пользователь
 * видел лишь всплывающее «Ошибка при сохранении».
 *
 * Теперь: ждём промис → при успехе вызываем onSuccess (обычно закрытие),
 * при ошибке оставляем окно открытым и показываем текст рядом с действиями.
 *
 * Требование к onSubmit в модалке: при ошибке бросать исключение
 * (`throw new Error("текст для пользователя")`), а не молча логировать.
 */
export function useSubmit(onSuccess: () => void) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(
        async (action: () => Promise<void>) => {
            setError(null);
            setSubmitting(true);
            try {
                await action();
                onSuccess();
            } catch (e) {
                const message =
                    e instanceof Error && e.message
                        ? e.message
                        : "Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.";
                setError(message);
            } finally {
                setSubmitting(false);
            }
        },
        [onSuccess],
    );

    return { submitting, error, setError, run };
}

import { getViolationType } from "@/lib/violations";

/**
 * Сообщение родителю о нарушении.
 *
 * Один и тот же текст уходит в системный share-sheet: MAX, Telegram, WhatsApp,
 * iMessage и другие мессенджеры получают обычный текст, поэтому сообщение
 * остаётся читаемым при пересылке куда угодно.
 */
export interface ViolationMessageInput {
    studentName: string;
    violationType: string;
    teacherName?: string | null;
    comment?: string | null;
}

export interface ViolationSharePayload {
    title: string;
    text: string;
}

export function buildParentViolationMessage(input: ViolationMessageInput): ViolationSharePayload {
    const student = input.studentName.trim();
    const type = getViolationType(input.violationType);
    const teacher = input.teacherName?.trim();
    const comment = input.comment?.trim();

    const childPhrase = student
        ? `в отношении вашего ребёнка, ${student},`
        : "в отношении вашего ребёнка";

    const teacherPhrase = teacher
        ? `Нарушение выявил сотрудник: ${teacher}.`
        : "Нарушение выявил сотрудник школы.";

    return {
        title: "Уведомление о нарушении",
        text: [
            "Уведомление о нарушении.",
            "Добрый день!",
            `Сообщаем вам, что в единой школьной системе учёта нарушений правил внутреннего распорядка ${childPhrase} зафиксировано замечание.`,
            `Тип нарушения: ${type.parentLabel}.`,
            teacherPhrase,
            `Комментарий к нарушению: ${comment || "не указан"}.`,
            "Просьба провести воспитательную работу с ребёнком и не допускать повторения ситуации.",
            "Спасибо!",
        ].join("\n\n"),
    };
}

export type ShareViolationResult = "shared" | "copied" | "cancelled";

/**
 * Открывает системное меню «Поделиться». На десктопе, где Web Share часто
 * недоступен, текст копируется в буфер — его можно вставить в любой мессенджер.
 */
export async function shareViolationMessage(payload: ViolationSharePayload): Promise<ShareViolationResult> {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
            await navigator.share({ title: payload.title, text: payload.text });
            return "shared";
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
            throw error;
        }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload.text);
        return "copied";
    }

    throw new Error("Браузер не поддерживает отправку сообщения");
}

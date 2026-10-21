"use client";

// components/ui/NewsModal.tsx
import { useEffect, useState } from "react";
import { FormError, Input, Modal, ModalFooter, Textarea, useSubmit } from "@/components/ui/kit";

/**
 * NewsModal — новость класса.
 *
 * Сейчас окно не вызывается из интерфейса (нет кнопки), но компонент приведён к UI Kit,
 * чтобы при включении функции он сразу соответствовал остальным модалкам:
 * общий Modal, 16px в полях, отправка с ожиданием ответа и ошибкой на экране.
 */
interface NewsModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Бросает исключение при ошибке */
    onSubmit: (data: { title: string; content: string }) => Promise<void>;
}

export default function NewsModal({ isOpen, onClose, onSubmit }: NewsModalProps) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const { submitting, error, run } = useSubmit(() => {
        setTitle("");
        setContent("");
        onClose();
    });

    useEffect(() => {
        if (!isOpen) return;
        setTitle("");
        setContent("");
    }, [isOpen]);

    const handleSubmit = () => {
        void run(async () => {
            await onSubmit({ title: title.trim(), content: content.trim() });
        });
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Новость"
            description="Короткая новость для класса"
            size="md"
            confirmOnClose
            isDirty={Boolean(title.trim() || content.trim())}
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={handleSubmit}
                    submitLabel="Добавить новость"
                    loading={submitting}
                    disabled={!title.trim() || !content.trim()}
                />
            }
        >
            <div className="space-y-4">
                <FormError message={error} />
                <Input
                    label="Заголовок"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="О чём новость"
                    required
                />
                <Textarea
                    label="Текст"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Текст новости"
                    rows={5}
                    required
                />
            </div>
        </Modal>
    );
}

"use client";

// components/ui/NotesModal.tsx
import { useEffect, useState } from "react";
import { FormError, Modal, ModalFooter, Textarea, useSubmit } from "@/components/ui/kit";

/**
 * NotesModal — заметка учителя на день.
 *
 * Как и NewsModal, окно сейчас не вызывается из интерфейса; компонент приведён
 * к UI Kit заранее, чтобы не оставлять в проекте модалку другого стиля.
 */
interface NotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Бросает исключение при ошибке */
    onSubmit: (data: { content: string }) => Promise<void>;
}

export default function NotesModal({ isOpen, onClose, onSubmit }: NotesModalProps) {
    const [content, setContent] = useState("");
    const { submitting, error, run } = useSubmit(() => {
        setContent("");
        onClose();
    });

    useEffect(() => {
        if (!isOpen) return;
        setContent("");
    }, [isOpen]);

    const handleSubmit = () => {
        void run(async () => {
            await onSubmit({ content: content.trim() });
        });
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Заметка"
            description="Напоминание на выбранный день"
            size="sm"
            confirmOnClose
            isDirty={Boolean(content.trim())}
            footer={
                <ModalFooter
                    onCancel={onClose}
                    onSubmit={handleSubmit}
                    submitLabel="Добавить заметку"
                    loading={submitting}
                    disabled={!content.trim()}
                />
            }
        >
            <div className="space-y-4">
                <FormError message={error} />
                <Textarea
                    label="Текст заметки"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Что нужно не забыть"
                    rows={5}
                    required
                />
            </div>
        </Modal>
    );
}

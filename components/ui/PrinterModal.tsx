"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, Printer, X } from "lucide-react";
import { Button, FormError, Modal } from "@/components/ui/kit";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "doc", "docx", "txt", "gif", "webp"];
const ACCEPT = ALLOWED_EXTENSIONS.map(extension => `.${extension}`).join(",");

interface PrintedFile {
    name: string;
    saved_as: string | null;
    status: string;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function extensionOf(name: string): string {
    return name.split(".").pop()?.toLowerCase() ?? "";
}

export function PrinterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<PrintedFile[] | null>(null);

    useEffect(() => {
        if (!open) return;
        setFiles([]);
        setError(null);
        setResults(null);
        setIsUploading(false);
    }, [open]);

    const addFiles = (incoming: FileList | null) => {
        if (!incoming) return;
        setError(null);
        setResults(null);

        const next: File[] = [];
        const rejected: string[] = [];

        for (const file of Array.from(incoming)) {
            if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
                rejected.push(`${file.name} — неподдерживаемый формат`);
                continue;
            }
            next.push(file);
        }

        const merged = [...files, ...next];
        const total = merged.reduce((sum, file) => sum + file.size, 0);
        if (total > MAX_BYTES) {
            setError("Суммарный размер файлов больше 100 МБ. Уберите лишние файлы.");
            return;
        }

        if (rejected.length > 0) setError(rejected.join("; "));
        if (next.length > 0) setFiles(merged);
        if (inputRef.current) inputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        setFiles(current => current.filter((_, fileIndex) => fileIndex !== index));
        setError(null);
        setResults(null);
    };

    const submit = async () => {
        if (files.length === 0) return;

        setIsUploading(true);
        setError(null);
        setResults(null);

        try {
            const body = new FormData();
            for (const file of files) body.append("files", file, file.name);

            const response = await fetch("/api/printer/upload", {
                method: "POST",
                body,
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload.error || `Сервер вернул ошибку ${response.status}`);
            }

            setResults(Array.isArray(payload.files) ? payload.files : []);
            setFiles([]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось отправить файлы");
        } finally {
            setIsUploading(false);
        }
    };

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const uploadedCount = results?.filter(item => item.status === "ok").length ?? 0;
    const skippedCount = results?.filter(item => item.status !== "ok").length ?? 0;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Принтер 99"
            description="Юровская 99 · папка «Документы»"
            size="md"
            confirmOnClose
            isDirty={files.length > 0}
            footer={
                <div className="grid gap-2">
                    <Button
                        size="lg"
                        fullWidth
                        loading={isUploading}
                        disabled={files.length === 0 || isUploading}
                        leftIcon={Printer}
                        onClick={() => void submit()}
                    >
                        Отправить на компьютер
                    </Button>
                    <Button variant="ghost" fullWidth disabled={isUploading} onClick={onClose}>
                        Закрыть
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="rounded-card border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg-muted">
                    Файл, который вы отправите, сохранится на компьютере по адресу
                    <span className="font-medium text-fg"> Юровская 99</span> в папке
                    <span className="font-medium text-fg"> «Документы»</span>.
                </div>

                <label
                    htmlFor="printer-modal-files"
                    className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-surface-2 px-4 py-5 text-center transition-colors hover:border-accent/50 hover:bg-surface-hover"
                >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                        <FileUp size={22} aria-hidden />
                    </span>
                    <span className="text-sm font-medium text-fg">Выберите файлы</span>
                    <span className="text-xs text-fg-subtle">PDF, Word, изображения или TXT · до 100 МБ</span>
                    <input
                        ref={inputRef}
                        id="printer-modal-files"
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="sr-only"
                        onChange={event => addFiles(event.target.files)}
                    />
                </label>

                {files.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
                            Выбрано: {files.length} · {formatBytes(totalBytes)}
                        </p>
                        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
                            {files.map((file, index) => (
                                <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 px-3 py-2.5">
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-fg">{file.name}</span>
                                        <span className="block text-[11px] text-fg-subtle">{formatBytes(file.size)}</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(index)}
                                        aria-label={`Убрать ${file.name}`}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                                    >
                                        <X size={17} aria-hidden />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <FormError message={error} />

                {results && (
                    <div className={`rounded-card border px-3 py-2 text-sm ${
                        uploadedCount > 0
                            ? "border-success/30 bg-success-soft text-success"
                            : "border-warning/30 bg-warning-soft text-warning"
                    }`}>
                        <p className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 size={16} aria-hidden />
                            Отправлено: {uploadedCount}
                            {skippedCount > 0 ? ` · пропущено: ${skippedCount}` : ""}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                            {results.map((item, index) => (
                                <li key={`${item.name}-${index}`} className="truncate">
                                    {item.name} — {item.status === "ok" ? "принят" : "пропущен"}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </Modal>
    );
}

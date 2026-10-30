"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { CheckCircle2, FileUp, Printer, X } from "lucide-react";
import { EmployeeHeader } from "@/components/shell/EmployeeHeader";
import { Button, Card, FormError, Skeleton } from "@/components/ui/kit";

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

export default function PrinterPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<PrintedFile[] | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/login");
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-4">
                    <Skeleton height={56} radius="control" />
                    <Skeleton height={300} radius="card" />
                </div>
            </div>
        );
    }

    if (!session) return null;

    const handleLogout = async () => {
        await signOut({ callbackUrl: "/login" });
    };

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

        if (rejected.length > 0) {
            setError(rejected.join("; "));
        }
        if (next.length > 0) {
            setFiles(merged);
        }
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
        <div className="min-h-full bg-bg">
            <EmployeeHeader
                title="Принтер 99"
                backHref="/"
                userName={session.user.name}
                userEmail={session.user.email ?? null}
                roles={(session.user.roles as string[]) ?? []}
                onLogout={() => void handleLogout()}
            />

            <main className="mx-auto w-full max-w-2xl space-y-3 px-4 py-4">
                <Card padding="md">
                    <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
                            <Printer size={24} aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-lg font-semibold text-fg">Отправить файлы на печать</h1>
                            <p className="mt-1 text-sm text-fg-muted">
                                Файлы попадут в папку печати на компьютере принтера. Можно выбрать несколько файлов.
                            </p>
                        </div>
                    </div>
                </Card>

                <Card padding="md" className="space-y-4">
                    <div>
                        <label
                            htmlFor="printer-files"
                            className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border bg-surface-2 px-4 py-6 text-center transition-colors hover:border-accent/50 hover:bg-surface-hover"
                        >
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-text">
                                <FileUp size={24} aria-hidden />
                            </span>
                            <span className="text-sm font-medium text-fg">Выберите файлы</span>
                            <span className="text-xs text-fg-subtle">
                                PDF, Word, изображения или TXT · до 100 МБ суммарно
                            </span>
                            <input
                                ref={inputRef}
                                id="printer-files"
                                type="file"
                                multiple
                                accept={ACCEPT}
                                className="sr-only"
                                onChange={event => addFiles(event.target.files)}
                            />
                        </label>
                    </div>

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
                            {results.length > 0 && (
                                <ul className="mt-1 space-y-0.5 text-xs">
                                    {results.map((item, index) => (
                                        <li key={`${item.name}-${index}`} className="truncate">
                                            {item.name} — {item.status === "ok" ? "принят" : "пропущен"}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <Button
                        size="lg"
                        fullWidth
                        loading={isUploading}
                        disabled={files.length === 0 || isUploading}
                        onClick={() => void submit()}
                    >
                        Отправить на печать
                    </Button>

                    <p className="text-center text-[11px] text-fg-subtle">
                        Файлы сохраняются на компьютере принтера. Отправка доступна сотрудникам школы.
                    </p>
                </Card>
            </main>
        </div>
    );
}

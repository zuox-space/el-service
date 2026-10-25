"use client";

// app/admin/sync/page.tsx
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import {
    Badge,
    Button,
    Card,
    FormError,
    Modal,
    ModalFooter,
    PageHeader,
    Skeleton,
    useToast,
} from "@/components/ui/kit";

/**
 * Синхронизация сотрудников с АИС.
 *
 * Две кнопки: «Проверить» показывает, что изменится, «Синхронизировать» применяет.
 * Правила те же, что у скрипта: архив вместо удаления, охрана и ручные сотрудники
 * не трогаются, классы приводятся к виду «5А».
 */

interface SyncReport {
    startedAt?: string;
    finishedAt?: string;
    mode?: string;
    source?: string;
    scanned?: number;
    created?: number;
    updated?: number;
    archived?: number;
    restored?: number;
    skipped?: { invalid?: number; security?: number; manual?: number; emailTaken?: number };
    classes?: { created?: number; assigned?: number; reassigned?: number; released?: number; conflicts?: number };
    roles?: { added?: number; removed?: number };
    errors?: string[];
    warnings?: string[];
    details?: Array<{ kind: string; message: string }>;
}

const modeLabel = (mode?: string) => (mode === "apply" ? "применено" : "проверка");

const formatTime = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function SyncTeachersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const toast = useToast();

    const [mounted, setMounted] = useState(false);
    const [lastReport, setLastReport] = useState<SyncReport | null>(null);
    const [isLoadingLast, setIsLoadingLast] = useState(true);
    const [busy, setBusy] = useState<"dry-run" | "apply" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmApply, setConfirmApply] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") router.replace("/login");
    }, [status, router]);

    const loadLast = useCallback(async () => {
        setIsLoadingLast(true);
        try {
            const response = await fetch("/api/admin/sync/teachers");
            if (!response.ok) throw new Error(`Сервер вернул ошибку ${response.status}`);
            const data = await response.json();
            setLastReport(data.last ?? null);
        } catch {
            setLastReport(null);
        } finally {
            setIsLoadingLast(false);
        }
    }, []);

    useEffect(() => {
        if (session?.user?.roles?.includes("ADMIN")) void loadLast();
    }, [session, loadLast]);

    const run = async (mode: "dry-run" | "apply") => {
        setBusy(mode);
        setError(null);

        try {
            const response = await fetch("/api/admin/sync/teachers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const details = [data.error, data.hint, data.log].filter(Boolean).join("\n\n");
                throw new Error(details || "Не удалось выполнить синхронизацию");
            }

            setLastReport(data.report);
            toast.show({
                title: mode === "apply" ? "Синхронизация выполнена" : "Проверка готова",
                description: `Создано: ${data.report?.created ?? 0}, архивировано: ${data.report?.archived ?? 0}`,
                tone: "success",
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось выполнить синхронизацию");
        } finally {
            setBusy(null);
            setConfirmApply(false);
        }
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Синхронизация сотрудников" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-[1200px] space-y-3 px-4 py-4">
                    <Skeleton height={120} radius="card" />
                    <Skeleton height={160} radius="card" />
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) return null;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Синхронизация сотрудников"
                subtitle="ФИО, почта и классы обновляются из внешней системы школы"
                onBack={() => router.push("/admin")}
                actions={
                    <Button
                        size="sm"
                        variant="ghost"
                        leftIcon={RefreshCw}
                        onClick={() => void loadLast()}
                        disabled={isLoadingLast || busy !== null}
                    >
                        <span className="hidden sm:inline">Обновить</span>
                    </Button>
                }
            />

            <main className="mx-auto w-full max-w-[1200px] space-y-3 px-4 py-4">
                {error && <FormError message={error} />}

                {/* Действия */}
                <Card padding="md">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-fg">Синхронизировать сотрудников</p>
                            <p className="mt-1 text-xs text-fg-muted">
                                Источник — портал школы. Сначала можно проверить, что изменится.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="secondary"
                                leftIcon={CheckCircle2}
                                loading={busy === "dry-run"}
                                disabled={busy !== null}
                                onClick={() => void run("dry-run")}
                            >
                                Проверить
                            </Button>
                            <Button
                                leftIcon={RefreshCw}
                                loading={busy === "apply"}
                                disabled={busy !== null}
                                onClick={() => setConfirmApply(true)}
                            >
                                Синхронизировать
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Правила */}
                <Card padding="md">
                    <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                        <ShieldCheck size={14} aria-hidden />
                        Как это работает
                    </p>
                    <ul className="space-y-1.5 text-xs text-fg-muted">
                        <li>• Новые сотрудники получают роль «Сотрудник»; у кого есть класс — класс и «Классный руководитель».</li>
                        <li>• ФИО, почта и классы обновляются; старые классы освобождаются.</li>
                        <li>• Уволенные (исчезли из источника) переводятся в архив — вход закрыт, история сохранена.</li>
                        <li>• Вернувшиеся восстанавливаются из архива, вход снова работает.</li>
                        <li>• Охрана и сотрудники с выключенным флагом синхронизации не трогаются.</li>
                        <li>• Классы приводятся к виду «5А» (без дефиса).</li>
                    </ul>
                </Card>

                {/* Результат */}
                {isLoadingLast ? (
                    <Skeleton height={180} radius="card" />
                ) : lastReport ? (
                    <Card padding="md">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-fg">Последний запуск</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={lastReport.mode === "apply" ? "success" : "info"}>
                                    {modeLabel(lastReport.mode)}
                                </Badge>
                                <span className="text-xs text-fg-subtle">{formatTime(lastReport.finishedAt)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            <Metric label="Записей" value={lastReport.scanned ?? 0} />
                            <Metric label="Создано" value={lastReport.created ?? 0} tone="success" />
                            <Metric label="Обновлено" value={lastReport.updated ?? 0} />
                            <Metric label="Архив" value={lastReport.archived ?? 0} tone="warning" />
                            <Metric label="Восстановлено" value={lastReport.restored ?? 0} tone="success" />
                            <Metric label="Конфликты" value={lastReport.classes?.conflicts ?? 0} tone="warning" />
                        </div>

                        <p className="mt-2 text-xs text-fg-subtle">
                            Классы: +{lastReport.classes?.created ?? 0} · закреплено {lastReport.classes?.assigned ?? 0} ·
                            перезакреплено {lastReport.classes?.reassigned ?? 0} · освобождено{" "}
                            {lastReport.classes?.released ?? 0}. Роли: +{lastReport.roles?.added ?? 0} / −
                            {lastReport.roles?.removed ?? 0}. Пропущено: {lastReport.skipped?.invalid ?? 0} без email/ФИО,{" "}
                            {lastReport.skipped?.manual ?? 0} ручных, {lastReport.skipped?.security ?? 0} охрана.
                        </p>

                        {(() => {
                            const skipped = (lastReport.details ?? []).filter(item => item.kind === "skip");
                            if (skipped.length === 0) return null;
                            return (
                                <details className="mt-3 rounded-control border border-warning/40 bg-warning-soft px-3 py-2">
                                    <summary className="cursor-pointer text-xs font-medium text-fg">
                                        Пропущенные сотрудники ({skipped.length})
                                    </summary>
                                    <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-fg-muted">
                                        {skipped.map((item, index) => (
                                            <li key={`${index}-${item.message.slice(0, 20)}`}>• {item.message}</li>
                                        ))}
                                    </ul>
                                </details>
                            );
                        })()}

                        {(lastReport.warnings?.length ?? 0) > 0 && (
                            <details className="mt-3 rounded-control border border-dashed border-border px-3 py-2">
                                <summary className="cursor-pointer text-xs text-fg">
                                    Предупреждения ({lastReport.warnings?.length})
                                </summary>
                                <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                                    {lastReport.warnings?.map((warning, index) => (
                                        <li key={`${index}-${warning.slice(0, 12)}`}>• {warning}</li>
                                    ))}
                                </ul>
                            </details>
                        )}

                        {(lastReport.errors?.length ?? 0) > 0 && (
                            <div className="mt-3 rounded-control border border-danger/40 bg-danger-soft px-3 py-2">
                                <p className="text-xs font-medium text-danger">
                                    Ошибки ({lastReport.errors?.length})
                                </p>
                                <ul className="mt-1 space-y-1 text-xs text-fg">
                                    {lastReport.errors?.map(errorText => (
                                        <li key={errorText}>• {errorText}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Card>
                ) : (
                    <Card padding="md" className="text-center">
                        <Users size={22} className="mx-auto text-fg-subtle" aria-hidden />
                        <p className="mt-2 text-sm text-fg">Синхронизация ещё не запускалась</p>
                        <p className="mt-1 text-xs text-fg-muted">
                            Нажмите «Проверить», чтобы увидеть изменения без записи в базу.
                        </p>
                    </Card>
                )}

                <p className="flex items-start gap-1.5 pb-4 text-xs text-fg-subtle">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                    Перед первым применением на боевой базе сделайте дамп. Архивные сотрудники не смогут войти,
                    пока снова не появятся в источнике.
                </p>
            </main>

            {/* Подтверждение записи */}
            <Modal
                open={confirmApply}
                onClose={() => setConfirmApply(false)}
                title="Синхронизировать сотрудников?"
                description="Изменения будут записаны в базу"
                size="sm"
                footer={
                    <ModalFooter
                        onCancel={() => setConfirmApply(false)}
                        onSubmit={() => void run("apply")}
                        submitLabel="Синхронизировать"
                        loading={busy === "apply"}
                    />
                }
            >
                <ul className="space-y-1 text-sm text-fg-muted">
                    <li>• новые сотрудники будут созданы;</li>
                    <li>• ФИО, почта и классы обновятся;</li>
                    <li>• исчезнувшие из источника будут архивированы (вход закроется);</li>
                    <li>• охрана и ручные сотрудники останутся без изменений.</li>
                </ul>
            </Modal>
        </div>
    );
}

function Metric({
    label,
    value,
    tone = "neutral",
}: {
    label: string;
    value: number;
    tone?: "neutral" | "success" | "warning";
}) {
    const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-fg";

    return (
        <div className="rounded-card border border-dashed border-border bg-surface px-2.5 py-2">
            <p className="text-[11px] text-fg-subtle">{label}</p>
            <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
        </div>
    );
}

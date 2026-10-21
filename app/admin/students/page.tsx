// app/admin/students/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, UserRound, Users } from "lucide-react";
import { Badge, EmptyState, List, ListItem, PageHeader, SearchInput, Skeleton } from "@/components/ui/kit";

/**
 * Поиск ученика для перехода в портфолио.
 *
 * Переведено на UI Kit: PageHeader, SearchInput (16px — iOS не зумит),
 * ListItem в результатах, EmptyState для пустых состояний.
 */

interface Student {
    aisId: string;
    name: string;
    className: string;
}

export default function StudentsSearchPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [results, setResults] = useState<Student[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recentSearches, setRecentSearches] = useState<Student[]>([]);

    useEffect(() => {
        setMounted(true);
        if (status === "unauthenticated") {
            router.replace("/login");
        }
        if (status === "authenticated") {
            const roles = (session?.user?.roles as string[]) || [];
            if (!roles.includes("ADMIN")) {
                router.replace("/admin");
            }
        }
    }, [session, status, router]);

    // Недавние поиски — в localStorage, чтобы не искать одно и то же каждый день
    useEffect(() => {
        try {
            const saved = localStorage.getItem("recentStudentSearches");
            if (saved) setRecentSearches((JSON.parse(saved) as Student[]).slice(0, 5));
        } catch {
            // повреждённое значение не должно ломать страницу
        }
    }, []);

    // Поиск с задержкой: не дёргаем сервер на каждую букву
    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        let cancelled = false;
        setIsSearching(true);

        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/students/search?q=${encodeURIComponent(query)}&limit=30`,
                );
                const data = await response.json();
                if (!cancelled) setResults(Array.isArray(data) ? data : []);
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        }, 300);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [searchQuery]);

    const openStudent = (student: Student) => {
        try {
            const saved = [student, ...recentSearches.filter(item => item.aisId !== student.aisId)].slice(0, 5);
            localStorage.setItem("recentStudentSearches", JSON.stringify(saved));
        } catch {
            // приватный режим — не критично
        }
        router.push(`/admin/students/${student.aisId}`);
    };

    if (!mounted || status === "loading") {
        return (
            <div className="min-h-full bg-bg">
                <PageHeader title="Ученики" onBack={() => router.push("/admin")} />
                <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-4">
                    <Skeleton height={48} radius="control" />
                    <Skeleton height={56} radius="card" />
                    <Skeleton height={56} radius="card" />
                </div>
            </div>
        );
    }

    if (!session || !session?.user?.roles?.includes("ADMIN")) {
        return null;
    }

    const query = searchQuery.trim();
    const showRecent = query.length < 2 && recentSearches.length > 0;

    return (
        <div className="min-h-full bg-bg">
            <PageHeader
                title="Ученики"
                subtitle="Поиск по базе школы"
                onBack={() => router.push("/admin")}
            />

            <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4">
                <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Фамилия или имя ученика"
                    label="Поиск ученика"
                />

                {showRecent && (
                    <section>
                        <div className="mb-1.5 flex items-center gap-2 px-1">
                            <Users size={14} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
                            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                                Недавние
                            </h2>
                        </div>
                        <List>
                            {recentSearches.map(student => (
                                <li key={student.aisId}>
                                    <ListItem
                                        leading={UserRound}
                                        title={student.name}
                                        subtitle={student.className}
                                        trailing="chevron"
                                        onClick={() => openStudent(student)}
                                    />
                                </li>
                            ))}
                        </List>
                    </section>
                )}

                {query.length >= 2 && (
                    <section>
                        {isSearching ? (
                            <List>
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <li key={index}>
                                        <ListItem loading title="" />
                                    </li>
                                ))}
                            </List>
                        ) : results.length > 0 ? (
                            <>
                                <p className="mb-1.5 px-1 text-xs text-fg-subtle">
                                    Найдено: {results.length}
                                </p>
                                <List>
                                    {results.map(student => (
                                        <li key={student.aisId}>
                                            <ListItem
                                                leading={UserRound}
                                                title={student.name}
                                                subtitle={student.className}
                                                trailing="badge"
                                                trailingContent={
                                                    <Badge tone="neutral">
                                                        <ChevronRight size={12} aria-hidden />
                                                    </Badge>
                                                }
                                                onClick={() => openStudent(student)}
                                            />
                                        </li>
                                    ))}
                                </List>
                            </>
                        ) : (
                            <EmptyState
                                variant="no-results"
                                title="Ученик не найден"
                                description="Проверьте написание фамилии или попробуйте часть имени"
                            />
                        )}
                    </section>
                )}

                {query.length < 2 && !showRecent && (
                    <EmptyState
                        icon={UserRound}
                        title="Начните вводить фамилию"
                        description="Минимум 2 символа. Откроется портфолио: пропуска, нарушения, отсутствия и ВШУ."
                    />
                )}
            </main>
        </div>
    );
}

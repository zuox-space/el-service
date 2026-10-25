"use client";

// app/guard/login/page.tsx
import { useState } from "react";
import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { Button, Card, FormError, Input } from "@/components/ui/kit";

export default function GuardLoginPage() {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/guard/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ login, password }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "Не удалось войти");
            // Полная навигация: middleware и страница должны получить уже
            // установленную cookie, а не закешированный RSC-редирект.
            window.location.replace("/guard");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Не удалось войти");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
            <Card padding="md" className="w-full max-w-sm">
                <div className="mb-4 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-control bg-accent-solid text-accent-fg">
                        <ShieldCheck size={22} aria-hidden />
                    </span>
                    <h1 className="mt-3 text-lg font-semibold text-fg">Пульт охраны</h1>
                    <p className="mt-1 text-sm text-fg-muted">Вход для планшета охраны</p>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <Input
                        label="Логин"
                        value={login}
                        onChange={event => setLogin(event.target.value)}
                        autoComplete="username"
                        leftIcon={KeyRound}
                        required
                    />
                    <Input
                        label="Пароль"
                        type="password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        autoComplete="current-password"
                        required
                    />

                    {error && <FormError message={error} />}

                    <Button type="submit" fullWidth leftIcon={LogIn} loading={loading}>
                        Войти
                    </Button>
                </form>
            </Card>
        </div>
    );
}

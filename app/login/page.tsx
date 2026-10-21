"use client";

import { Suspense } from "react";

import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, School, ArrowRight, RefreshCw } from "lucide-react";
import yandex from './yandex-logo-rus 1.svg'
import Image from "next/image";
import logo1298 from './logo.png'
// Отдельный компонент, который использует useSearchParams
function LoginForm() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Локальный вход для разработки на моковых БД (в рабочем окружении переменной нет)
  const devLogin = process.env.NEXT_PUBLIC_DEV_LOGIN === "true";
  const [devEmail, setDevEmail] = useState("ivanova@school1298.ru");
  const [devError, setDevError] = useState<string | null>(null);
  const [isDevLoading, setIsDevLoading] = useState(false);

  const handleDevLogin = async () => {
    setDevError(null);
    setIsDevLoading(true);
    try {
      const result = await signIn("dev-credentials", {
        email: devEmail,
        code: "dev",
        redirect: false,
      });
      if (result?.error) {
        setDevError("Такого сотрудника нет в моковой базе. Посмотрите список в devdb/README.md");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setDevError("Не удалось войти. Проверьте, что локальные БД запущены (npm run devdb:status)");
    } finally {
      setIsDevLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Функция выхода из Яндекса с очисткой всех cookies
  const handleYandexLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      // 1. Выход из next-auth
      await signOut({ redirect: false });
      
      // 2. Очистка всех cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // 3. Очистка localStorage и sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      
      // 4. Переход на страницу выхода Яндекса
      window.location.href = "https://passport.yandex.ru/logout";
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  // Функция входа с принудительным выбором аккаунта
  const handleYandexLogin = async () => {
    setIsLoading(true);
    
    // Добавляем параметр для принудительного выбора аккаунта
    await signIn("yandex", { 
      callbackUrl: "/",
      // forceLogin: true - заставляет Яндекс показать форму входа
      // prompt: "select_account" - показывает выбор аккаунта
    });
  };

  // Функция входа с принудительным сбросом сессии
  const handleYandexLoginWithAccountChoice = async () => {
    setIsLoading(true);
    
    // Сначала очищаем куки Яндекса
    document.cookie.split(";").forEach((c) => {
      if (c.includes("yandex") || c.includes("ya") || c.includes("yandexuid")) {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      }
    });
    
    // Затем выполняем вход с параметрами
    await signIn("yandex", { 
      callbackUrl: "/",
    });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="bg-surface border border-border shadow-card p-8 rounded-2xl text-center border border-border">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-fg-muted">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если пользователь уже вошел, показываем специальную карточку с выходом
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
        <div className="bg-surface border border-border shadow-card rounded-2xl shadow-2xl p-8 max-w-md w-full border border-border text-center">
          <div className="w-20 h-20 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-4">
            <School size={40} className="text-success" />
          </div>
          <h2 className="text-xl font-bold text-fg mb-2">Вы уже авторизованы</h2>
          <p className="text-fg-muted text-sm mb-6">
            {session.user?.name}
            <br />
            <span className="text-xs text-fg-muted">{session.user?.email}</span>
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => router.push("/")}
              className="w-full surface-accent bg-accent-solid hover:bg-accent-solid-hover text-accent-fg shadow-accent font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <School size={18} />
              Перейти в приложение
            </button>
            
            <button
              onClick={handleYandexLogout}
              disabled={isLoggingOut}
              className="w-full bg-danger-soft hover:bg-danger/20 text-danger font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 border border-danger/40"
            >
              <LogOut size={18} />
              {isLoggingOut ? "Выход..." : "Выйти и сменить аккаунт"}
            </button>
          </div>
          
          <p className="text-xs text-fg-subtle text-center mt-6">
            После выхода вы сможете войти под другим аккаунтом
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="bg-surface border border-border shadow-card rounded-2xl shadow-2xl p-8 max-w-md w-full border border-border">
        <div className="text-center mb-8">
          <div className="w-20 h-20 surface-accent bg-accent-solid rounded-full flex items-center justify-center mx-auto mb-4">
            <Image src={logo1298} className="text-fg" width={100} height={100} alt="1"/>
          </div>
          <h1 className="text-3xl font-bold text-fg mb-2">Электронный пропуск</h1>
          <p className="text-fg-muted text-sm">Система учёта выхода учеников</p>
        </div>

        {error === "AccessDenied" && (
          <div className="mb-4 p-3 bg-warning-soft border border-warning/40 rounded-lg text-center">
            <p className="text-danger text-sm">
              ⚠️ У вас нет прав для доступа к этому приложению.
            </p>
            <p className="text-danger/70 text-xs mt-1">
              Обратитесь к администратору для получения доступа.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleYandexLogin}
            disabled={isLoading}
            className="w-full bg-[#FFC812] hover:bg-[#FFC812] text-black font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Image src={yandex} alt="yandex" width={20} height={20}/>
            {isLoading ? "Загрузка..." : "Войти через Яндекс ID"}
          </button>
          
          {/* <button
            onClick={handleYandexLoginWithAccountChoice}
            disabled={isLoading}
            className="w-full bg-accent-soft hover:bg-accent/20 text-accent-text font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm border border-accent/40"
          >
            <RefreshCw size={14} />
            Войти через другой аккаунт
          </button> */}
        </div>

        {devLogin && (
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-warning mb-2">
              Режим разработки: вход по email из моковой базы
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="email сотрудника"
                className="flex-1 min-w-0 px-3 py-2 bg-surface-2 border border-border rounded-lg text-fg placeholder:text-fg-subtle text-sm focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleDevLogin}
                disabled={isDevLoading || !devEmail}
                className="px-3 py-2 bg-warning-soft hover:bg-warning/20 text-warning rounded-lg text-sm disabled:opacity-50 whitespace-nowrap"
              >
                {isDevLoading ? "Вход…" : "Войти"}
              </button>
            </div>
            {devError && <p className="text-xs text-danger mt-2">{devError}</p>}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-border text-center">
          <p className="text-xs text-fg-subtle">
            Только для авторизованных сотрудников школы
          </p>
          <p className="text-xs text-fg-subtle mt-1">
            ГБОУ Школа №1298 «Профиль Куркино»
          </p>
        </div>
      </div>
    </div>
  );
}

// Главный компонент страницы с Suspense
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="bg-surface border border-border shadow-card p-8 rounded-2xl text-center border border-border">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-fg-muted">Загрузка...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
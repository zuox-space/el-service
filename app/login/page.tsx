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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если пользователь уже вошел, показываем специальную карточку с выходом
  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <School size={40} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Вы уже авторизованы</h2>
          <p className="text-gray-300 text-sm mb-6">
            {session.user?.name}
            <br />
            <span className="text-xs text-gray-400">{session.user?.email}</span>
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => router.push("/")}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <School size={18} />
              Перейти в приложение
            </button>
            
            <button
              onClick={handleYandexLogout}
              disabled={isLoggingOut}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 border border-red-500/30"
            >
              <LogOut size={18} />
              {isLoggingOut ? "Выход..." : "Выйти и сменить аккаунт"}
            </button>
          </div>
          
          <p className="text-xs text-gray-500 text-center mt-6">
            После выхода вы сможете войти под другим аккаунтом
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 max-w-md w-full border border-white/20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Image src={logo1298} className="text-white" width={100} height={100} alt="1"/>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Электронный пропуск</h1>
          <p className="text-gray-300 text-sm">Система учёта выхода учеников</p>
        </div>

        {error === "AccessDenied" && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-red-500/30 rounded-lg text-center">
            <p className="text-red-300 text-sm">
              ⚠️ У вас нет прав для доступа к этому приложению.
            </p>
            <p className="text-red-300/70 text-xs mt-1">
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
            className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-semibold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2 text-sm border border-blue-500/30"
          >
            <RefreshCw size={14} />
            Войти через другой аккаунт
          </button> */}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-gray-500">
            Только для авторизованных сотрудников школы
          </p>
          <p className="text-xs text-gray-500 mt-1">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2332] to-[#2b3858]">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-2xl text-center border border-white/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Загрузка...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
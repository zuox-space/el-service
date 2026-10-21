import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/kit/Toast";
import { AccessProvider } from "@/components/access/AccessProvider";
import { GlobalViolationFab } from "@/components/ui/GlobalViolationFab";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Масштабирование разрешено: запрет зума — нарушение доступности, а проблему
  // «iOS зумит поле при фокусе» решает 16px в полях (см. globals.css).
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0e1014",
};

export const metadata: Metadata = {
  title: "Электронный пропуск",
  description: "Система учета посещаемости",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Электронный пропуск",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/* Тема выставляется до отрисовки: иначе на светлой теме мигает тёмный фон */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Электронный журнал" />
      </head>
      <body>
        <ThemeProvider>
          <Providers>
            <AccessProvider>
              <ToastProvider>
                {children}
                <GlobalViolationFab />
              </ToastProvider>
            </AccessProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import './globals.css'
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2b3858",
};

export const metadata: Metadata = {
  title: "Электронный журнал",
  description: "Система учета посещаемости",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Электронный журнал",
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
    <html lang="ru">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Электронный журнал" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
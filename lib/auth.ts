import { NextAuthOptions, getServerSession } from "next-auth";
import YandexProvider from "next-auth/providers/yandex";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";

/**
 * Локальный вход без Яндекса — ТОЛЬКО для разработки на моковых БД.
 * Включается переменной DEV_LOGIN=true в .env.local (в рабочем окружении её нет).
 */
const devLoginEnabled = process.env.DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

const devProvider = CredentialsProvider({
  id: "dev-credentials",
  name: "Локальный вход (разработка)",
  credentials: {
    email: { label: "Email сотрудника", type: "text" },
    code: { label: "Код", type: "text" },
  },
  async authorize(credentials) {
    // Код фиксированный: это заглушка для локальной проверки, а не механизм аутентификации
    if (!credentials?.email || credentials.code !== "dev") return null;

    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.userRoles.map(ur => ur.role.name),
    };
  },
});

export const authOptions: NextAuthOptions = {
  providers: [
    ...(devLoginEnabled ? [devProvider] : []),
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID!,
      clientSecret: process.env.YANDEX_CLIENT_SECRET!,
      authorization: {
        params: {
      prompt: "login", // Всегда показывать форму входа
      force_confirm: true, // Принудительное подтверждение
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Проверяем, есть ли пользователь в БД
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! },
        include: {
          userRoles: { include: { role: true } }
        }
      });

      if (!existingUser) {
        console.warn("Вход отклонён: пользователя нет в базе:", user.email);
        return false;
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (trigger === "signIn" || trigger === "signUp") {
        if (user?.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name; // Сохраняем имя из БД в токен
          }
        }
      }
      
      // Обновляем роли
      if (token.email) {
        const userWithRoles = await prisma.user.findUnique({
          where: { email: token.email as string },
          include: { userRoles: { include: { role: true } } }
        });
        if (userWithRoles) {
          token.roles = userWithRoles.userRoles.map(ur => ur.role.name);
          // Если имя в БД отличается от того, что в токене - обновляем
          if (userWithRoles.name !== token.name) {
            token.name = userWithRoles.name;
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string; // Используем имя из БД
        session.user.email = token.email as string;
        session.user.roles = (token.roles as string[]) || [];
        session.user.role = session.user.roles[0] || "TEACHER";
      }
      
      return session;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login?error=AccessDenied",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function auth() {
  return await getServerSession(authOptions);
}
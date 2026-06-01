import { NextAuthOptions, getServerSession } from "next-auth";
import YandexProvider from "next-auth/providers/yandex";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
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
      console.log("SignIn attempt:", user.email);
      
      // Проверяем, есть ли пользователь в БД
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! },
        include: {
          userRoles: { include: { role: true } }
        }
      });
      
      if (!existingUser) {
        console.log("User not found in database:", user.email);
        return false;
      }
      
      const roles = existingUser.userRoles.map(ur => ur.role.name);
      console.log("User found, roles:", roles);
      return true;
    },
    async jwt({ token, user, trigger }) {
      console.log("JWT callback - trigger:", trigger);
      
      if (trigger === "signIn" || trigger === "signUp") {
        if (user?.email) {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.email = dbUser.email;
            token.name = dbUser.name; // Сохраняем имя из БД в токен
            console.log("Token name set to DB name:", dbUser.name);
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
            console.log("Token name updated to DB name:", userWithRoles.name);
          }
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      console.log("Session callback - token:", token);
      
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string; // Используем имя из БД
        session.user.email = token.email as string;
        session.user.roles = (token.roles as string[]) || [];
        session.user.role = session.user.roles[0] || "TEACHER";
        console.log("Session user name set to:", session.user.name);
        console.log("Session user roles:", session.user.roles);
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
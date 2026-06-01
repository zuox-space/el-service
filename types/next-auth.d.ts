import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: string[];
      role: string;
    } & DefaultSession["user"];
  }
  
  interface User {
    id: string;
    roles?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email?: string;
    roles?: string[];
  }
}
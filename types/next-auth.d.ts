import "next-auth";
declare module "next-auth" {
  interface Session {
    user: { id: number; name: string; username: string; role: "ADMIN" | "USER"; avatarUrl?: string | null };
  }
  interface User { id: string; name: string; username: string; role: "ADMIN" | "USER"; avatarUrl?: string | null }
}
declare module "next-auth/jwt" {
  interface JWT { id: number; username: string; role: "ADMIN" | "USER"; avatarUrl?: string | null }
}

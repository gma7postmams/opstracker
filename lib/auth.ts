import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { fullName } from "./format";
import type { SessionUser } from "./permissions";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.username || !creds?.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: creds.username.trim().toLowerCase() },
        });
        if (!user || !user.active) return null;
        if (!(await bcrypt.compare(creds.password, user.passwordHash))) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
        return {
          id: String(user.id),
          name: fullName(user),
          username: user.username,
          role: user.role,
          avatarUrl: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = Number((user as any).id);
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.avatarUrl = (user as any).avatarUrl;
      }
      // Editing your own profile should not require signing out and back in.
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id as number } });
        if (fresh) {
          token.name = fullName(fresh);
          token.role = fresh.role;
          token.username = fresh.username;
          token.avatarUrl = fresh.avatarUrl;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id as number,
        name: token.name as string,
        username: token.username as string,
        role: token.role as "ADMIN" | "USER",
        avatarUrl: token.avatarUrl as string | null,
      };
      return session;
    },
  },
};

/**
 * Returns the session user, or null when unauthenticated.
 *
 * The JWT only proves who signed in up to 12 hours ago, so role, active flag
 * and name are read from the database on every call. A deactivated account is
 * locked out immediately and a demotion takes effect on the next request,
 * instead of lingering until the token expires.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const fresh = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, active: true, firstName: true, middleInitial: true, surname: true, mustChangePassword: true },
  });
  if (!fresh || !fresh.active) return null;

  return {
    id: fresh.id,
    role: fresh.role,
    name: fullName(fresh),
    mustChangePassword: fresh.mustChangePassword,
  };
}

import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { fullName } from "./format";
import type { SessionUser } from "./permissions";
import { logAudit } from "./audit";
import { verifyEmailVerificationCode } from "./email2fa";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        verificationCode: { label: "Verification code", type: "text" },
      },
      async authorize(creds) {
        console.log("AUTHORIZE CALLED", {
          usernamePresent: Boolean(creds?.username),
          passwordPresent: Boolean(creds?.password),
          verificationCodePresent: Boolean(creds?.verificationCode),
          verificationCodeLength: creds?.verificationCode?.length ?? 0,
        });
        if (!creds?.username || !creds?.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: creds.username.trim().toLowerCase() },
        });

if (!user || !user.active) {
  console.log("AUTHORIZE FAILED", { reason: !user ? "user-not-found" : "inactive-user" });
  await logAudit({
    action: "LOGIN_FAILED",
    entityType: "auth",
    entityId: "Invalid Username or Password",
    details: {
      username: creds.username,
    },
  });

  return null;
}

if (!(await bcrypt.compare(creds.password, user.passwordHash))) {
  console.log("AUTHORIZE FAILED", { reason: "password-mismatch" });
  await logAudit({
    action: "LOGIN_FAILED",
    entityType: "auth",
    entityId: "Invalid Username or Password",
    details: {
      username: creds.username,
    },
  });

  return null;
}

if (user.email2faEnabled) {
  const verificationValid = Boolean(creds.verificationCode) && await verifyEmailVerificationCode(user.id, creds.verificationCode);
  console.log("AUTHORIZE 2FA RESULT", { verificationCodePresent: Boolean(creds.verificationCode), verificationValid });
  if (!verificationValid) {
    console.log("AUTHORIZE FAILED", { reason: "verification-failed" });
    return null;
  }
  await logAudit({
    action: "2FA_SUCCESS",
    entityType: "auth",
    entityId: "Login verification",
    userId: user.id,
  });
}

await prisma.user.update({
  where: { id: user.id },
  data: { lastLogin: new Date() }
});

await logAudit({
  action: "LOGIN",
  entityType: "auth",
  entityId: "Successful Login",
  userId: user.id,
  details: {
    name: fullName(user),
    username: user.username,
  },
});


console.log("AUTHORIZE SUCCESS", { userId: user.id });
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

/** Returns the session user, or null when unauthenticated. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return { id: session.user.id, role: session.user.role, name: session.user.name };
}

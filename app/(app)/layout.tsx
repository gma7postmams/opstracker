import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import Shell from "@/components/Shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [branding, me] = await Promise.all([
    getBranding(),
    prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } }),
  ]);

  return (
    <Shell branding={branding} user={{ ...user, avatarUrl: me?.avatarUrl ?? null }}>
      {children}
    </Shell>
  );
}

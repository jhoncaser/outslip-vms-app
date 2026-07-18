import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ThemeShell } from "@/components/dashboard/ThemeShell";
import { Navbar } from "@/components/dashboard/Navbar";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { themePreference: true },
  });

  return (
    <ThemeShell initialTheme={user?.themePreference ?? "LIGHT"}>
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-900">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar canProvisionUsers={canProvisionUsers(session)} />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </div>
    </ThemeShell>
  );
}

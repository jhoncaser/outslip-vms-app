import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { AppShell } from "@/components/dashboard/AppShell";

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

  const initials =
    `${session.firstName.charAt(0)}${session.lastName.charAt(0)}`.toUpperCase();
  const fullName = `${session.firstName} ${session.lastName}`;

  return (
    <AppShell
      initials={initials}
      fullName={fullName}
      canProvisionUsers={canProvisionUsers(session)}
    >
      {children}
    </AppShell>
  );
}

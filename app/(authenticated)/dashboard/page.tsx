import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canViewApprovals } from "@/lib/auth/permissions";
import { ModuleGrid } from "@/components/dashboard/ModuleGrid";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#eef1ee]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 flex flex-1 flex-col">
        <ModuleGrid canViewApprovals={session ? canViewApprovals(session) : false} />
      </div>
    </div>
  );
}

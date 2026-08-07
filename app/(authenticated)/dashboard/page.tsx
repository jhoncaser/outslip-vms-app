import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canViewApprovals } from "@/lib/auth/permissions";
import { ModuleGrid } from "@/components/dashboard/ModuleGrid";
import { pageBackground } from "@/lib/deepForest";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  return (
    <div className={`relative flex flex-1 flex-col overflow-hidden ${pageBackground}`}>
      <ModuleGrid canViewApprovals={session ? canViewApprovals(session) : false} />
    </div>
  );
}

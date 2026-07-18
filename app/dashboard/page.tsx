import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="text-center">
        <p className="text-sm text-slate-500">Logged in as</p>
        <p className="mt-1 text-lg font-bold text-[#0b2545]">
          {session.firstName} {session.lastName} ({session.role})
        </p>
        <form action="/api/auth/logout" method="post" className="mt-4">
          <button
            type="submit"
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

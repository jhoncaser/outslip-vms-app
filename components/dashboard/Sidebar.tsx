import Link from "next/link";

export function Sidebar({
  canProvisionUsers,
}: {
  canProvisionUsers: boolean;
}) {
  return (
    <nav className="flex w-48 flex-shrink-0 flex-col gap-1 bg-[#245c01] p-4 text-sm text-white">
      <Link href="/dashboard" className="rounded px-3 py-2 hover:bg-white/10">
        Dashboard
      </Link>
      <Link href="/profile" className="rounded px-3 py-2 hover:bg-white/10">
        Profile
      </Link>
      <Link href="/settings" className="rounded px-3 py-2 hover:bg-white/10">
        Settings
      </Link>
      {canProvisionUsers && (
        <Link
          href="/register"
          className="rounded px-3 py-2 hover:bg-white/10"
        >
          Register User
        </Link>
      )}
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="w-full rounded px-3 py-2 text-left hover:bg-white/10"
        >
          Logout
        </button>
      </form>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itemClass =
  "group relative flex h-11 w-[46px] items-center justify-center rounded-xl text-[#6a7a66] transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none";

const greenItemClass = `${itemClass} hover:bg-[#2C7001] hover:text-white focus-visible:bg-[#2C7001] focus-visible:text-white`;

const flyoutClass =
  "pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-x-2 -translate-y-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold text-white opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:translate-x-0 motion-reduce:transition-none z-50";

const greenFlyoutClass = `${flyoutClass} bg-[#2C7001] shadow-[0_6px_16px_rgba(44,112,1,0.3)]`;

function HomeIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function RailLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(href) ?? false;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? `${itemClass} bg-[#2C7001] text-white shadow-[0_6px_14px_rgba(44,112,1,0.35)]`
          : greenItemClass
      }
    >
      {icon}
      <span className={greenFlyoutClass}>{label}</span>
    </Link>
  );
}

export function Sidebar({
  canProvisionUsers,
}: {
  canProvisionUsers: boolean;
}) {
  return (
    <nav className="relative z-20 my-4 ml-4 flex w-[68px] flex-shrink-0 flex-col items-center rounded-2xl bg-white py-3 shadow-[0_4px_24px_rgba(20,45,8,0.10)]">
      <div className="flex flex-col items-center gap-1.5">
        <RailLink href="/dashboard" label="Dashboard" icon={<HomeIcon />} />
        <RailLink href="/profile" label="Profile" icon={<UserIcon />} />
        <RailLink href="/settings" label="Settings" icon={<SettingsIcon />} />
        {canProvisionUsers && (
          <RailLink
            href="/register"
            label="Register User"
            icon={<UserPlusIcon />}
          />
        )}
      </div>
      <form
        action="/api/auth/logout"
        method="post"
        className="mt-auto flex w-full justify-center border-t border-[#eef1ec] pt-2.5"
      >
        <button
          type="submit"
          className={`${itemClass} hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white`}
        >
          <LogOutIcon />
          <span
            className={`${flyoutClass} bg-red-600 shadow-[0_6px_16px_rgba(220,38,38,0.3)]`}
          >
            Logout
          </span>
        </button>
      </form>
    </nav>
  );
}

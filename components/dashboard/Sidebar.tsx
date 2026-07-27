"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UserIcon,
  SettingsIcon,
  UserPlusIcon,
  LogOutIcon,
} from "./icons";

const itemClass =
  "group relative flex h-11 w-[46px] items-center justify-center rounded-xl text-[#6a7a66] transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none";

const greenItemClass = `${itemClass} hover:bg-[#2C7001] hover:text-white focus-visible:bg-[#2C7001] focus-visible:text-white`;

const flyoutClass =
  "rail-flyout pointer-events-none absolute left-[calc(100%+12px)] top-1/2 -translate-x-2 -translate-y-1/2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold text-white opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:translate-x-0 motion-reduce:transition-none z-50";

const greenFlyoutClass = `${flyoutClass} bg-[#2C7001] shadow-[0_6px_16px_rgba(44,112,1,0.3)]`;

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
    <nav className="relative z-20 my-4 ml-4 hidden w-[68px] flex-shrink-0 flex-col items-center rounded-2xl bg-white py-3 shadow-[0_4px_24px_rgba(20,45,8,0.10)] md:flex">
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

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UserIcon,
  SettingsIcon,
  UserPlusIcon,
  LogOutIcon,
} from "./icons";

function CloseIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DrawerLink({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = pathname?.startsWith(href) ?? false;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-gradient-to-br from-[#3a9d0a] to-[#245c01] text-white"
          : "text-[#cfe9c7] hover:bg-[#57e34c]/10"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function MobileDrawer({
  canProvisionUsers,
  open,
  onClose,
}: {
  canProvisionUsers: boolean;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 md:hidden"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="drawer-slide-in flex h-full w-[260px] flex-col border-r border-[#4ca71a]/30 bg-[#0c120a] shadow-[0_0_40px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-[#4ca71a]/25 px-4 py-3.5">
          <span className="font-outfit text-sm font-bold tracking-wide text-[#7be36f]">
            OUTSLIP VMS
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[#9db894] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57e34c]/50"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <DrawerLink
            href="/dashboard"
            label="Dashboard"
            icon={<HomeIcon />}
            onNavigate={onClose}
          />
          <DrawerLink
            href="/profile"
            label="Profile"
            icon={<UserIcon />}
            onNavigate={onClose}
          />
          <DrawerLink
            href="/settings"
            label="Settings"
            icon={<SettingsIcon />}
            onNavigate={onClose}
          />
          {canProvisionUsers && (
            <DrawerLink
              href="/register"
              label="Register User"
              icon={<UserPlusIcon />}
              onNavigate={onClose}
            />
          )}
        </nav>

        <form
          action="/api/auth/logout"
          method="post"
          className="border-t border-[#4ca71a]/25 p-3"
        >
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOutIcon />
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}

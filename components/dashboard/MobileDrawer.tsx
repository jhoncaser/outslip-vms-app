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
        active ? "bg-[#2C7001] text-white" : "text-[#3f4a3d] hover:bg-[#eef1ec]"
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
      className="fixed inset-0 z-50 bg-slate-900/35 md:hidden"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="drawer-slide-in flex h-full w-[260px] flex-col bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#eef1ec] px-4 py-3.5">
          <span className="text-sm font-bold tracking-wide text-[#2C7001]">
            OUTSLIP VMS
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2C7001]/40"
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
          className="border-t border-[#eef1ec] p-3"
        >
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOutIcon />
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}

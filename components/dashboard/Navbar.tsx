"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UserIcon,
  SettingsIcon,
  UserPlusIcon,
  LogOutIcon,
} from "./icons";

const PAGE_TITLES: Record<string, string> = {
  "/transactions/open": "Open Transaction",
  "/transactions/approved": "Approved Transaction",
  "/transactions/canceled": "Canceled Transaction",
  "/transactions/my-approvals": "My Approvals",
};

const tabClass =
  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-[#9db894] transition-colors hover:text-[#eafbe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57e34c]/50";
const tabActiveClass =
  "flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#3a9d0a] to-[#245c01] px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-[0_0_16px_rgba(87,227,76,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#57e34c]/50";

function NavTab({
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
      className={active ? tabActiveClass : tabClass}
    >
      {icon}
      {label}
    </Link>
  );
}

function MenuIcon() {
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
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3z" />
      <path d="M21 18v3h-3" />
    </svg>
  );
}

function CancelIcon() {
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

export function Navbar({
  initials,
  fullName,
  canProvisionUsers,
  onMenuClick,
}: {
  initials: string;
  fullName: string;
  canProvisionUsers: boolean;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const title = pathname ? PAGE_TITLES[pathname] : undefined;
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  return (
    <header className="navbar-fade-in relative z-20 m-4 rounded-2xl border border-[#4ca71a]/30 bg-[#141e12]/80 px-4 py-3 text-white shadow-[0_0_30px_rgba(44,112,1,0.2)] backdrop-blur-md sm:px-6">
      <div
        data-testid="navbar-desktop"
        className="hidden items-center gap-6 md:flex"
      >
        <img
          src="/mfc-logo.png"
          alt="MFC Global"
          className="h-7 w-auto shrink-0"
        />

        <nav className="flex shrink-0 items-center gap-1">
          <NavTab href="/dashboard" label="Home" icon={<HomeIcon />} />
          <NavTab href="/profile" label="Profile" icon={<UserIcon />} />
          <NavTab href="/settings" label="Settings" icon={<SettingsIcon />} />
          {canProvisionUsers && (
            <NavTab
              href="/register"
              label="Register User"
              icon={<UserPlusIcon />}
            />
          )}
        </nav>

        {title && (
          <>
            <span aria-hidden className="h-[22px] w-px bg-white/30" />
            <span className="whitespace-nowrap text-[13px] font-semibold text-white/90">
              {title}
            </span>
          </>
        )}

        <div className="flex flex-1 justify-center">
          <div className="relative w-full max-w-xs">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#57e34c]/70">
              <SearchIcon />
            </span>
            <input
              type="search"
              aria-label="Search transaction code"
              placeholder="Search..."
              className="w-full rounded-full border border-[#4ca71a]/40 bg-[#0c1a08] py-1.5 pl-9 pr-11 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:outline-none focus:ring-2 focus:ring-[#57e34c]/60"
            />
            <button
              type="button"
              aria-label="Scan QR code"
              title="Scan QR code"
              className="absolute right-1.5 top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full text-[#7be36f] hover:bg-[#57e34c]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#57e34c]/50"
            >
              <QrIcon />
            </button>
          </div>
        </div>

        <div ref={accountMenuRef} className="relative shrink-0">
          <button
            type="button"
            title={fullName}
            aria-label={`Account menu for ${fullName}`}
            aria-haspopup="true"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((open) => !open)}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-xs font-bold transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {initials}
          </button>
          {accountMenuOpen && (
            <div className="absolute right-0 top-[42px] w-[150px] rounded-xl border border-[#4ca71a]/35 bg-[#0c120a] p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                >
                  <LogOutIcon />
                  Logout
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div
        data-testid="navbar-mobile"
        className="flex items-center gap-3 md:hidden"
      >
        {mobileSearchOpen ? (
          <>
            <button
              type="button"
              aria-label="Cancel search"
              onClick={() => setMobileSearchOpen(false)}
              className="shrink-0 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <CancelIcon />
            </button>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#57e34c]/70">
                <SearchIcon />
              </span>
              <input
                type="search"
                aria-label="Search transaction code"
                placeholder="Search..."
                autoFocus
                className="w-full rounded-full border border-[#4ca71a]/40 bg-[#0c1a08] py-1.5 pl-9 pr-3 text-sm text-[#eafbe4] placeholder:text-[#6f8a68] focus:outline-none focus:ring-2 focus:ring-[#57e34c]/60"
              />
            </div>
            <button
              type="button"
              aria-label="Scan QR code"
              title="Scan QR code"
              className="shrink-0 text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <QrIcon />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={onMenuClick}
              className="shrink-0 text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <MenuIcon />
            </button>
            {title ? (
              <span className="flex-1 truncate text-sm font-semibold">
                {title}
              </span>
            ) : (
              <div className="flex-1">
                <img src="/mfc-logo.png" alt="MFC Global" className="h-5 w-auto" />
              </div>
            )}
            <button
              type="button"
              aria-label="Search transaction code"
              onClick={() => setMobileSearchOpen(true)}
              className="shrink-0 text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              aria-label="Scan QR code"
              title="Scan QR code"
              className="shrink-0 text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <QrIcon />
            </button>
            <span
              title={fullName}
              className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold"
            >
              {initials}
            </span>
          </>
        )}
      </div>
    </header>
  );
}

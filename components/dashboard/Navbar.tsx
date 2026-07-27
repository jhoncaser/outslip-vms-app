"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/profile": "Profile",
  "/settings": "Settings",
  "/register": "Register User",
  "/transactions/open": "Open Transaction",
  "/transactions/approved": "Approved Transaction",
  "/transactions/canceled": "Canceled Transaction",
  "/transactions/my-approvals": "My Approvals",
};

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
  onMenuClick,
}: {
  initials: string;
  fullName: string;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const title = pathname ? PAGE_TITLES[pathname] : undefined;
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className="bg-[#2C7001] px-4 py-3 text-white sm:px-6">
      <div
        data-testid="navbar-desktop"
        className="hidden grid-cols-[auto_1fr_auto] items-center gap-6 md:grid"
      >
        <div className="flex items-center gap-3.5">
          <span className="text-sm font-bold tracking-wide">OUTSLIP VMS</span>
          {title && (
            <>
              <span aria-hidden className="h-[22px] w-px bg-white/30" />
              <span className="whitespace-nowrap text-[13px] font-semibold text-white/90">
                {title}
              </span>
            </>
          )}
        </div>
        <div className="flex justify-center">
          <div className="relative w-full max-w-3xl">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2C7001]/60">
              <SearchIcon />
            </span>
            <input
              type="search"
              aria-label="Search transaction code"
              placeholder="Search..."
              className="w-full rounded-full border-0 bg-white py-1.5 pl-9 pr-11 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
            />
            <button
              type="button"
              aria-label="Scan QR code"
              title="Scan QR code"
              className="absolute right-1.5 top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full text-[#2C7001] hover:bg-[#2C7001]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2C7001]/50"
            >
              <QrIcon />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <span
            title={fullName}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-xs font-bold"
          >
            {initials}
          </span>
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
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#2C7001]/60">
                <SearchIcon />
              </span>
              <input
                type="search"
                aria-label="Search transaction code"
                placeholder="Search..."
                autoFocus
                className="w-full rounded-full border-0 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
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
            <span className="flex-1 truncate text-sm font-semibold">
              {title ?? "OUTSLIP VMS"}
            </span>
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

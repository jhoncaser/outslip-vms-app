"use client";

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

export function Navbar({
  initials,
  fullName,
}: {
  initials: string;
  fullName: string;
}) {
  const pathname = usePathname();
  const title = pathname ? PAGE_TITLES[pathname] : undefined;

  return (
    <header className="grid grid-cols-[auto_1fr_auto] items-center gap-6 bg-[#2C7001] px-6 py-3 text-white">
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
          <svg
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2C7001]/60"
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
    </header>
  );
}

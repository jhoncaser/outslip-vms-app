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
    <header className="flex items-center gap-3.5 bg-[#2C7001] px-6 py-3 text-white">
      <div className="flex items-center gap-2 text-sm font-bold tracking-wide">
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
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        OUTSLIP VMS
      </div>
      {title && (
        <>
          <span aria-hidden className="h-[22px] w-px bg-white/30" />
          <span className="text-[13px] font-semibold text-white/90">
            {title}
          </span>
        </>
      )}
      <span className="flex-1" />
      <span
        title={fullName}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-xs font-bold"
      >
        {initials}
      </span>
    </header>
  );
}

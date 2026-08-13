"use client";

import Link from "next/link";
import { useRevealOnce } from "@/lib/useRevealOnce";
import { tileSurface } from "@/lib/deepForest";

function InboxIcon() {
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
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function CheckCircleIcon() {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function ClipboardCheckIcon() {
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
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <polyline points="9 14 11 16 15 12" />
    </svg>
  );
}

const BASE_MODULES = [
  {
    label: "Open Transaction",
    href: "/transactions/open",
    Icon: InboxIcon,
    badgeClass:
      "bg-[#60a5fa]/20 text-[#93c5fd] group-hover:shadow-[0_0_16px_rgba(96,165,250,0.5)]",
  },
  {
    label: "Approved Transaction",
    href: "/transactions/approved",
    Icon: CheckCircleIcon,
    badgeClass:
      "bg-[#57e34c]/20 text-[#86efac] group-hover:shadow-[0_0_16px_rgba(87,227,76,0.5)]",
  },
  {
    label: "Canceled Transaction",
    href: "/transactions/canceled",
    Icon: XCircleIcon,
    badgeClass:
      "bg-[#f87171]/20 text-[#fca5a5] group-hover:shadow-[0_0_16px_rgba(248,113,113,0.5)]",
  },
];

const APPROVALS_MODULE = {
  label: "My Approvals",
  href: "/transactions/my-approvals",
  Icon: ClipboardCheckIcon,
  badgeClass:
    "bg-[#fbbf24]/20 text-[#fcd34d] group-hover:shadow-[0_0_16px_rgba(251,191,36,0.5)]",
};

export function ModuleGrid({
  canViewApprovals,
  openCount = 0,
  approvedCount = 0,
  canceledCount = 0,
  myApprovalsCount = 0,
}: {
  canViewApprovals: boolean;
  openCount?: number;
  approvedCount?: number;
  canceledCount?: number;
  myApprovalsCount?: number;
}) {
  const baseModules = [
    { ...BASE_MODULES[0], count: openCount },
    { ...BASE_MODULES[1], count: approvedCount },
    { ...BASE_MODULES[2], count: canceledCount },
  ];
  const modules = canViewApprovals
    ? [...baseModules, { ...APPROVALS_MODULE, count: myApprovalsCount }]
    : baseModules;

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-6 content-start sm:grid-cols-2">
      {modules.map((module) => (
        <ModuleTile key={module.href} module={module} />
      ))}
    </div>
  );
}

function ModuleTile({
  module,
}: {
  module: (typeof BASE_MODULES)[number] & { count: number };
}) {
  const { ref, revealed } = useRevealOnce<HTMLAnchorElement>();

  return (
    <Link
      ref={ref}
      href={module.href}
      prefetch={false}
      className={`reveal-once ${revealed ? "is-revealed" : ""} group flex items-start justify-between gap-3 border-l-4 border-l-[#3a9d0a] p-4 ${tileSurface} transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-l-[6px] hover:shadow-[0_8px_24px_rgba(58,157,10,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
    >
      <div>
        <div className="text-sm font-semibold uppercase tracking-wide text-[#9db894] transition-colors duration-200 group-hover:text-[#7be36f] motion-reduce:transition-none">
          {module.label}
        </div>
        <div className="mt-1 font-outfit text-xl font-bold text-[#7be36f]">
          {module.count}
        </div>
      </div>
      <span
        aria-hidden
        className={`flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl transition-all duration-200 group-hover:scale-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${module.badgeClass}`}
      >
        <module.Icon />
      </span>
    </Link>
  );
}

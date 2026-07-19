import Link from "next/link";

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
    badgeClass: "bg-sky-100 text-sky-600",
  },
  {
    label: "Approved Transaction",
    href: "/transactions/approved",
    Icon: CheckCircleIcon,
    badgeClass: "bg-green-100 text-green-600",
  },
  {
    label: "Canceled Transaction",
    href: "/transactions/canceled",
    Icon: XCircleIcon,
    badgeClass: "bg-red-100 text-red-600",
  },
];

const APPROVALS_MODULE = {
  label: "My Approvals",
  href: "/transactions/my-approvals",
  Icon: ClipboardCheckIcon,
  badgeClass: "bg-amber-100 text-amber-600",
};

export function ModuleGrid({
  canViewApprovals,
}: {
  canViewApprovals: boolean;
}) {
  const modules = canViewApprovals
    ? [...BASE_MODULES, APPROVALS_MODULE]
    : BASE_MODULES;

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-6 content-start sm:grid-cols-2">
      {modules.map((module) => (
        <Link
          key={module.href}
          href={module.href}
          className="flex items-start justify-between gap-3 rounded border border-l-4 border-slate-200 border-l-[#2C7001] bg-white p-4 shadow-sm hover:shadow-md"
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {module.label}
            </div>
            <div className="mt-1 text-2xl font-bold text-[#2C7001]">
              —
            </div>
          </div>
          <span
            aria-hidden
            className={`flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl ${module.badgeClass}`}
          >
            <module.Icon />
          </span>
        </Link>
      ))}
    </div>
  );
}

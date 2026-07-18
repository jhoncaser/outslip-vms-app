import Link from "next/link";

const MODULES = [
  { label: "Open Transaction", href: "/transactions/open" },
  { label: "Approved Transaction", href: "/transactions/approved" },
  { label: "Canceled Transaction", href: "/transactions/canceled" },
  { label: "My Approvals", href: "/transactions/my-approvals" },
];

export function ModuleGrid() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-6 content-start sm:grid-cols-2">
      {MODULES.map((module) => (
        <Link
          key={module.href}
          href={module.href}
          className="rounded border border-l-4 border-slate-200 border-l-[#0b2545] bg-white p-4 shadow-sm hover:shadow-md dark:border-slate-700 dark:border-l-[#0b2545] dark:bg-slate-800"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {module.label}
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0b2545] dark:text-white">
            —
          </div>
        </Link>
      ))}
    </div>
  );
}

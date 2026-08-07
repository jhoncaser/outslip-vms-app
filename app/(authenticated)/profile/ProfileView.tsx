import Link from "next/link";

function LockIcon() {
  return (
    <svg
      aria-hidden
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export type ProfileViewProps = {
  fullName: string;
  initials: string;
  jobTitle: string;
  roleLabel: string;
  email: string;
  department: string;
  businessUnit: string;
  location: string;
  memberSince: string;
};

const fieldLabelClassName = "mb-1 text-xs font-semibold text-[#9db894]";
const fieldValueClassName = "text-sm text-[#eafbe4]";

export function ProfileView({
  fullName,
  initials,
  jobTitle,
  roleLabel,
  email,
  department,
  businessUnit,
  location,
  memberSince,
}: ProfileViewProps) {
  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-[#4ca71a]/35 shadow-[0_0_40px_rgba(44,112,1,0.25)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-8 py-7">
        <div
          aria-hidden
          className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
        />
        <div
          aria-hidden
          className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
        />
        <div className="relative flex flex-col gap-4 sm:block">
          <Link
            href="/change-password"
            className="z-10 inline-flex w-fit items-center gap-1.5 self-end rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:absolute sm:right-6 sm:top-6"
          >
            <LockIcon />
            Change Password
          </Link>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white">
              {initials}
            </span>
            <div>
              <h1 className="font-outfit text-lg font-bold text-white">{fullName}</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                <span>{jobTitle}</span>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-b-xl border-t border-[#4ca71a]/25 bg-[#141e12]/85 backdrop-blur-md px-8 py-7 sm:grid-cols-2">
        <div>
          <p className={fieldLabelClassName}>Email</p>
          <p className={fieldValueClassName}>{email}</p>
        </div>
        <div>
          <p className={fieldLabelClassName}>Department</p>
          <p className={fieldValueClassName}>{department}</p>
        </div>
        <div>
          <p className={fieldLabelClassName}>Business Unit</p>
          <p className={fieldValueClassName}>{businessUnit}</p>
        </div>
        <div>
          <p className={fieldLabelClassName}>Location</p>
          <p className={fieldValueClassName}>{location}</p>
        </div>
        <div className="col-span-2">
          <p className={fieldLabelClassName}>Member Since</p>
          <p className={fieldValueClassName}>{memberSince}</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { RegistrationWizard } from "./RegistrationWizard";
import { ROLE_LABELS, type RoleValue } from "@/lib/roles";

export type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  role: RoleValue;
  department: string;
  businessUnit: string;
  location: string;
  createdAt: string;
};

const ROLE_PILL_CLASSES: Record<RoleValue, string> = {
  CREATOR: "bg-sky-100 text-sky-800",
  FIRST_APPROVER: "bg-amber-100 text-amber-800",
  SECOND_APPROVER: "bg-green-100 text-green-800",
  THIRD_APPROVER: "bg-indigo-100 text-indigo-800",
  GUARD_PERSONNEL: "bg-purple-100 text-purple-800",
};

const COLUMNS = [
  "First Name",
  "Last Name",
  "Role",
  "Department",
  "Business Unit",
  "Location",
  "Created",
];

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

export function UsersView({ users }: { users: UserRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Registered Users
          </h1>
          <p className="text-xs text-slate-500">
            {users.length} {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[#2C7001] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-150 ease-out hover:bg-[#256000] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(44,112,1,0.35)] active:translate-y-0 active:bg-[#1d4d00] active:shadow-[0_3px_8px_rgba(44,112,1,0.3)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2C7001]/35 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          + Register User
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full border-collapse text-left text-sm text-slate-600">
          <thead>
            <tr className="border-b-2 border-[#2C7001] bg-[#f8faf7]">
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-xs font-semibold text-[#3f6212]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No users registered yet.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <tr
                  key={user.id}
                  className={`border-b border-slate-100 ${
                    index % 2 === 1 ? "bg-[#fbfdf9]" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3">{user.firstName}</td>
                  <td className="px-4 py-3">{user.lastName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_PILL_CLASSES[user.role]}`}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{user.department}</td>
                  <td className="px-4 py-3">{user.businessUnit}</td>
                  <td className="px-4 py-3">{user.location}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {user.createdAt}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-user-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/35"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className="w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
              <div
                aria-hidden
                className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
              />
              <div
                aria-hidden
                className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
              />
              <h2
                id="register-user-title"
                className="text-lg font-extrabold tracking-widest text-white"
              >
                REGISTER USER
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
              >
                <CloseIcon />
              </button>
            </div>
              <div className="px-8 py-7">
                <RegistrationWizard />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import { RegistrationWizard } from "./RegistrationWizard";
import { ROLE_LABELS, type RoleValue } from "@/lib/roles";
import { headingText, mutedText, tableWrap, tableHeaderRow, modalHeader, modalCard, buttonPrimary, pillClass } from "@/lib/deepForest";
import { RevealRow } from "@/components/RevealRow";

export type UserRowData = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  role: RoleValue;
  department: string;
  businessUnit: string;
  location: string;
  createdAt: string;
};

function EditIcon() {
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
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const ROLE_PILL_CLASSES: Record<RoleValue, string> = {
  CREATOR: pillClass("blue"),
  APPROVER: pillClass("amber"),
  GUARD_PERSONNEL: pillClass("slate"),
};

const COLUMNS = ["First Name", "Last Name", "Role", "Actions"];

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; userId: string };

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

function UserRow({
  user,
  index,
  isExpanded,
  onToggle,
  onEdit,
}: {
  user: UserRowData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <Fragment>
      <RevealRow
        index={index}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        aria-expanded={isExpanded}
        className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#57e34c]/50"
      >
        <td className="px-2 py-3 text-center text-[#6f8a68]">
          <span
            aria-hidden
            className={`inline-block transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
          >
            ▸
          </span>
        </td>
        <td className="px-4 py-3 text-[#eafbe4]">{user.firstName}</td>
        <td className="px-4 py-3 text-[#eafbe4]">{user.lastName}</td>
        <td className="px-4 py-3">
          <span className={ROLE_PILL_CLASSES[user.role]}>
            {ROLE_LABELS[user.role]}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#4ca71a]/40 bg-transparent px-2.5 py-1 text-xs font-semibold text-[#7be36f] transition-colors duration-150 hover:border-[#57e34c] hover:bg-[#57e34c]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#57e34c]/35 motion-reduce:transition-none"
          >
            <EditIcon />
            Edit
          </button>
        </td>
      </RevealRow>
      {isExpanded && (
        <tr className="bg-[#0f1611]/60">
          <td colSpan={COLUMNS.length + 1} className="px-4 py-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 pl-9 sm:grid-cols-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Job Title
                </div>
                <div className="text-sm text-[#eafbe4]">{user.jobTitle}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Department
                </div>
                <div className="text-sm text-[#eafbe4]">{user.department}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Business Unit
                </div>
                <div className="text-sm text-[#eafbe4]">{user.businessUnit}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Location
                </div>
                <div className="text-sm text-[#eafbe4]">{user.location}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#6f8a68]">
                  Created
                </div>
                <div className="text-sm text-[#eafbe4]">{user.createdAt}</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function UsersView({ users }: { users: UserRowData[] }) {
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className={`text-lg ${headingText}`}>Registered Users</h1>
          <p className={`text-xs ${mutedText}`}>
            {users.length} {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className={buttonPrimary}
        >
          + Register User
        </button>
      </div>

      <div className={tableWrap}>
        <table className="w-full border-collapse text-left text-sm text-[#cfe9c7]">
          <thead>
            <tr className={tableHeaderRow}>
              <th className="w-9 px-2 py-3" aria-hidden="true" />
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-xs font-bold text-white"
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
                  colSpan={COLUMNS.length + 1}
                  className={`px-4 py-8 text-center ${mutedText}`}
                >
                  No users registered yet.
                </td>
              </tr>
            ) : (
              users.map((user, index) => (
                <UserRow
                  key={user.id}
                  user={user}
                  index={index}
                  isExpanded={expandedUserId === user.id}
                  onToggle={() =>
                    setExpandedUserId(
                      expandedUserId === user.id ? null : user.id
                    )
                  }
                  onEdit={() => setModal({ mode: "edit", userId: user.id })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal.mode !== "closed" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-user-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70"
        >
          <div className="flex min-h-full items-center justify-center p-6">
            <div className={`max-w-[520px] ${modalCard}`}>
              <div className={modalHeader}>
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
                  className={`text-lg tracking-widest ${headingText}`}
                >
                  {modal.mode === "edit" ? "EDIT USER" : "REGISTER USER"}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setModal({ mode: "closed" })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 motion-reduce:transition-none"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="px-8 py-7">
                <RegistrationWizard
                  userId={modal.mode === "edit" ? modal.userId : undefined}
                  onDone={() => setModal({ mode: "closed" })}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

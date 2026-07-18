import { ChangePasswordForm } from "./ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b2545] text-[#e8eef7]">
        <div className="text-4xl">⛨</div>
        <div className="mt-3 text-base font-semibold tracking-wide">
          OUTSLIP VMS
        </div>
      </div>
      <div className="flex flex-[1.3] flex-col justify-center bg-white p-10">
        <div className="mb-1 text-lg font-bold text-[#0b2545]">
          Set a new password
        </div>
        <div className="mb-6 text-xs text-[#8593a8]">
          Your account was created with a temporary password. Choose a new
          one to continue.
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}

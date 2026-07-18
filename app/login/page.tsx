import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b2545] text-[#e8eef7]">
        <div className="text-4xl">⛨</div>
        <div className="mt-3 text-base font-semibold tracking-wide">
          OUTSLIP VMS
        </div>
        <div className="mt-2 max-w-[220px] text-center text-xs text-[#9fb0c9]">
          Outslip Visitor Monitoring System
        </div>
      </div>
      <div className="flex flex-[1.3] flex-col justify-center bg-white p-10">
        <div className="mb-1 text-lg font-bold text-[#0b2545]">
          Welcome back
        </div>
        <div className="mb-6 text-xs text-[#8593a8]">
          Sign in with your company or personal email
        </div>
        <LoginForm />
      </div>
    </div>
  );
}

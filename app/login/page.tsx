import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1ee] p-6">
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-10 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-white/5"
          />
          <h1 className="text-2xl font-extrabold tracking-widest text-white">
            SIGN IN
          </h1>
        </div>
        <div className="px-8 py-7">
          <p className="mb-6 text-center text-xs text-slate-400">
            Sign in with your company or personal email
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

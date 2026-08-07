import { LoginForm } from "./LoginForm";
import { pageBackground, cardSurface, headingText, mutedText } from "@/lib/deepForest";

export default function LoginPage() {
  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden p-6 ${pageBackground}`}>
      <div className={`login-card-in relative z-10 w-full max-w-[400px] overflow-hidden ${cardSurface}`}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-6 py-10 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-white/5"
          />
          <h1 className={`text-2xl tracking-widest ${headingText}`}>
            SIGN IN
          </h1>
        </div>
        <div className="px-8 py-7">
          <p className={`mb-6 text-center text-[13px] ${mutedText}`}>
            Sign in with your company or personal email
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

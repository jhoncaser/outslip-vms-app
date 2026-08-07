import { ChangePasswordForm } from "./ChangePasswordForm";
import { pageBackground, cardSurface, headingText, mutedText } from "@/lib/deepForest";

export default function ChangePasswordPage() {
  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden p-6 ${pageBackground}`}>
      <div className={`relative z-10 w-full max-w-[400px] overflow-hidden ${cardSurface}`}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#3a9d0a] to-[#1d4d00] px-6 py-8 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-32 w-32 rounded-full bg-white/5"
          />
          <h1 className={`text-xl tracking-widest ${headingText}`}>
            SET A NEW PASSWORD
          </h1>
        </div>
        <div className="px-8 py-7">
          <p className={`mb-6 text-center text-xs ${mutedText}`}>
            Your account was created with a temporary password. Choose a new
            one to continue.
          </p>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

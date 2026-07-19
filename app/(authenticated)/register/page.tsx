import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { RegistrationWizard } from "./RegistrationWizard";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canProvisionUsers(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2C7001] to-[#1d4d00] px-6 py-5 text-center">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/5"
          />
          <div
            aria-hidden
            className="absolute -bottom-10 -left-5 h-28 w-28 rounded-full bg-white/5"
          />
          <h1 className="text-lg font-extrabold tracking-widest text-white">
            REGISTER USER
          </h1>
        </div>
        <div className="px-8 py-7">
          <RegistrationWizard />
        </div>
      </div>
    </div>
  );
}

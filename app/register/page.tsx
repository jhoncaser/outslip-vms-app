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
    <div className="flex min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center bg-[#0b2545] text-[#e8eef7]">
        <div className="text-4xl">⛨</div>
        <div className="mt-3 text-base font-semibold tracking-wide">
          OUTSLIP VMS
        </div>
      </div>
      <div className="flex flex-[1.3] flex-col justify-center bg-white p-10">
        <RegistrationWizard />
      </div>
    </div>
  );
}

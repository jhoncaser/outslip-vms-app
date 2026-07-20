import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canProvisionUsers } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { UsersView, type UserRow } from "./UsersView";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session || !canProvisionUsers(session)) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      role: true,
      createdAt: true,
      department: { select: { name: true } },
      businessUnit: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  // Dates are formatted here, server-side, so the client never re-formats
  // them in a different timezone (hydration-safe display strings).
  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    jobTitle: user.jobTitle,
    role: user.role,
    department: user.department.name,
    businessUnit: user.businessUnit.name,
    location: user.location.name,
    createdAt: user.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  return (
    <div className="relative flex flex-1 items-start justify-center overflow-hidden bg-[#eef1ee] p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/mfc-logo.png')] bg-cover bg-center bg-no-repeat opacity-[0.18]"
      />
      <div className="relative z-10 w-full">
        <UsersView users={rows} />
      </div>
    </div>
  );
}

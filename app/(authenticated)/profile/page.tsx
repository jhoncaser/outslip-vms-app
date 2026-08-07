import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { pageBackground } from "@/lib/deepForest";
import { ProfileView } from "./ProfileView";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
    select: {
      firstName: true,
      lastName: true,
      jobTitle: true,
      email: true,
      role: true,
      createdAt: true,
      department: { select: { name: true } },
      businessUnit: { select: { name: true } },
      location: { select: { name: true } },
    },
  });

  const fullName = `${user.firstName} ${user.lastName}`;
  const initials =
    `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const memberSince = user.createdAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <ProfileView
          fullName={fullName}
          initials={initials}
          jobTitle={user.jobTitle}
          roleLabel={ROLE_LABELS[user.role]}
          email={user.email}
          department={user.department.name}
          businessUnit={user.businessUnit.name}
          location={user.location.name}
          memberSince={memberSince}
        />
      </div>
    </div>
  );
}

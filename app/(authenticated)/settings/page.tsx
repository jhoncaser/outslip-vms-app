import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageReferenceData } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { pageBackground } from "@/lib/deepForest";
import { SettingsView } from "./SettingsView";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const canEdit = canManageReferenceData(session);

  const [matrixTypes, departments, businessUnits, locations, matrixTypeApprovers, users] =
    await Promise.all([
      prisma.matrixType.findMany({
        orderBy: { matrixCode: "asc" },
        include: { creator: { select: { email: true } } },
      }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
      prisma.businessUnit.findMany({ orderBy: { name: "asc" } }),
      prisma.location.findMany({ orderBy: { name: "asc" } }),
      prisma.matrixTypeApprover.findMany({
        orderBy: [{ department: { name: "asc" } }, { level: "asc" }],
        include: {
          approver: { select: { firstName: true, lastName: true } },
          department: { select: { name: true } },
          businessUnit: { select: { name: true } },
          location: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

  const matrixTypeRows = matrixTypes.map((row) => ({
    id: row.id,
    matrixCode: row.matrixCode,
    name: row.name,
    creator: row.creator.email,
    createdAt: row.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  }));

  const approverAssignments = matrixTypeApprovers.map((row) => ({
    id: row.id,
    matrixTypeId: row.matrixTypeId,
    approverName: `${row.approver.firstName} ${row.approver.lastName}`,
    level: row.level,
    department: row.department.name,
    businessUnit: row.businessUnit.name,
    location: row.location.name,
  }));

  const userOptions = users.map((user) => ({
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
  }));

  return (
    <div className={`relative flex flex-1 items-start justify-center overflow-hidden p-8 ${pageBackground}`}>
      <div className="relative z-10 w-full">
        <SettingsView
          matrixTypes={matrixTypeRows}
          departments={departments}
          businessUnits={businessUnits}
          locations={locations}
          approverAssignments={approverAssignments}
          users={userOptions}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const DEPARTMENTS = ["ICT", "HROD", "Accounting", "Treasury", "Admin"];
const BUSINESS_UNITS = ["Cawit", "MSC", "Talisayan", "Prime", "Delta", "Alpha"];
const LOCATIONS = ["Zamboanga", "Manila", "Valenzuela", "Batangas"];
const MATRIX_TYPES = [
  "Halfday",
  "Undertime",
  "Routing to other Business Unit",
  "Visitor Pass",
  "Out for Lunch",
  "Others",
];
const TRANSACTION_STATUSES = ["Open", "Cancelled"];

async function seedReferenceData() {
  for (const name of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of BUSINESS_UNITS) {
    await prisma.businessUnit.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const name of LOCATIONS) {
    await prisma.location.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function seedAdmin(): Promise<string> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in the environment to seed the bootstrap admin account."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing.id;
  }

  const adminDepartment = await prisma.department.findUniqueOrThrow({
    where: { name: "Admin" },
  });
  const defaultBusinessUnit = await prisma.businessUnit.findUniqueOrThrow({
    where: { name: BUSINESS_UNITS[0] },
  });
  const defaultLocation = await prisma.location.findUniqueOrThrow({
    where: { name: LOCATIONS[0] },
  });

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      firstName: "Super",
      lastName: "Admin",
      jobTitle: "System Administrator",
      email,
      passwordHash,
      role: "APPROVER",
      departmentId: adminDepartment.id,
      businessUnitId: defaultBusinessUnit.id,
      locationId: defaultLocation.id,
      mustChangePassword: true,
    },
  });

  return admin.id;
}

async function seedMatrixTypes(creatorId: string) {
  for (const name of MATRIX_TYPES) {
    const existing = await prisma.matrixType.findUnique({ where: { name } });
    if (existing) continue;
    const count = await prisma.matrixType.count();
    await prisma.matrixType.create({
      data: {
        matrixCode: `MT-${String(count + 1).padStart(3, "0")}`,
        name,
        creatorId,
      },
    });
  }
}

async function seedTransactionStatuses() {
  for (const name of TRANSACTION_STATUSES) {
    await prisma.transactionStatus.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

export async function main() {
  await seedReferenceData();
  const adminId = await seedAdmin();
  await seedMatrixTypes(adminId);
  await seedTransactionStatuses();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const DEPARTMENTS = ["ICT", "HROD", "Accounting", "Treasury", "Admin"];
const BUSINESS_UNITS = ["Cawit", "MSC", "Talisayan", "Prime", "Delta", "Alpha"];
const LOCATIONS = ["Zamboanga", "Manila", "Valenzuela", "Batangas"];

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

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in the environment to seed the bootstrap admin account."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return;
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

  await prisma.user.create({
    data: {
      firstName: "Super",
      lastName: "Admin",
      email,
      passwordHash,
      role: "FIRST_APPROVER",
      departmentId: adminDepartment.id,
      businessUnitId: defaultBusinessUnit.id,
      locationId: defaultLocation.id,
      mustChangePassword: true,
    },
  });
}

export async function main() {
  await seedReferenceData();
  await seedAdmin();
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

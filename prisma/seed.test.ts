import { describe, it, expect, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { main } from "./seed";

describe("seed script", () => {
  it("creates the bootstrap admin with Admin department and APPROVER role", async () => {
    await main();

    const email = process.env.SEED_ADMIN_EMAIL!;
    const admin = await prisma.user.findUnique({
      where: { email },
      include: { department: true },
    });

    expect(admin).not.toBeNull();
    expect(admin!.department.name).toBe("Admin");
    expect(admin!.role).toBe("APPROVER");
    expect(admin!.mustChangePassword).toBe(true);

    const passwordMatches = await bcrypt.compare(
      process.env.SEED_ADMIN_PASSWORD!,
      admin!.passwordHash
    );
    expect(passwordMatches).toBe(true);
  });

  it("does not duplicate the admin user when run twice", async () => {
    await main();
    await main();

    const email = process.env.SEED_ADMIN_EMAIL!;
    const admins = await prisma.user.findMany({ where: { email } });
    expect(admins).toHaveLength(1);
  });

  it("seeds all reference data values from the spec", async () => {
    await main();

    const departments = await prisma.department.findMany();
    const businessUnits = await prisma.businessUnit.findMany();
    const locations = await prisma.location.findMany();

    expect(departments.map((d) => d.name).sort()).toEqual(
      ["Accounting", "Admin", "HROD", "ICT", "Treasury"].sort()
    );
    expect(businessUnits.map((b) => b.name).sort()).toEqual(
      ["Alpha", "Cawit", "Delta", "MSC", "Prime", "Talisayan"].sort()
    );
    expect(locations.map((l) => l.name).sort()).toEqual(
      ["Batangas", "Manila", "Valenzuela", "Zamboanga"].sort()
    );
  });

  it("seeds all matrix type values with sequential codes", async () => {
    await main();

    const matrixTypes = await prisma.matrixType.findMany({
      orderBy: { matrixCode: "asc" },
    });

    expect(matrixTypes.map((m) => m.name)).toEqual([
      "Halfday",
      "Undertime",
      "Routing to other Business Unit",
      "Visitor Pass",
      "Out for Lunch",
      "Others",
    ]);
    expect(matrixTypes.map((m) => m.matrixCode)).toEqual([
      "MT-001",
      "MT-002",
      "MT-003",
      "MT-004",
      "MT-005",
      "MT-006",
    ]);
  });

  it("does not duplicate matrix types when run twice", async () => {
    await main();
    await main();

    const matrixTypes = await prisma.matrixType.findMany();
    expect(matrixTypes).toHaveLength(6);
  });

  it("seeds the Open, Cancelled, and Approved transaction statuses", async () => {
    await main();

    const statuses = await prisma.transactionStatus.findMany();
    expect(statuses.map((s) => s.name)).toEqual(["Open", "Cancelled", "Approved"]);
  });

  it("does not duplicate transaction statuses when run twice", async () => {
    await main();
    await main();

    const statuses = await prisma.transactionStatus.findMany();
    expect(statuses).toHaveLength(3);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});

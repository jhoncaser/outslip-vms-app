import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "./prisma";

describe("prisma connection", () => {
  it("can query the Department table", async () => {
    const count = await prisma.department.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});

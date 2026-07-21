// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

let adminToken: string;
let nonAdminToken: string;

function requestWithCookie(url: string, token?: string, init: RequestInit = {}) {
  return new NextRequest(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

describe("/api/reference-data", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });

    adminToken = await createSessionToken({
      sub: "admin_user",
      email: "admin@company.com",
      firstName: "Admin",
      lastName: "User",
      role: "FIRST_APPROVER",
      department: "Admin",
      mustChangePassword: false,
    });

    nonAdminToken = await createSessionToken({
      sub: "regular_user",
      email: "regular@company.com",
      firstName: "Regular",
      lastName: "User",
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });
  });

  it("GET returns reference lists for any authenticated user", async () => {
    const response = await GET(
      requestWithCookie("http://localhost/api/reference-data", nonAdminToken)
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.departments.some((d: { name: string }) => d.name === "ICT")).toBe(
      true
    );
    expect(Array.isArray(body.matrixTypes)).toBe(true);
  });

  it("GET returns 401 with no session", async () => {
    const response = await GET(
      requestWithCookie("http://localhost/api/reference-data")
    );
    expect(response.status).toBe(401);
  });

  it("POST returns 403 for a non-Admin-department user", async () => {
    const response = await POST(
      requestWithCookie("http://localhost/api/reference-data", nonAdminToken, {
        method: "POST",
        body: JSON.stringify({ type: "department", name: "Legal" }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("POST adds a new value for an Admin-department user", async () => {
    const response = await POST(
      requestWithCookie("http://localhost/api/reference-data", adminToken, {
        method: "POST",
        body: JSON.stringify({ type: "department", name: "Legal-Test" }),
      })
    );
    expect(response.status).toBe(201);

    const created = await prisma.department.findUnique({
      where: { name: "Legal-Test" },
    });
    expect(created).not.toBeNull();
  });

  afterAll(async () => {
    await prisma.department.deleteMany({ where: { name: "Legal-Test" } });
    await prisma.$disconnect();
  });
});

// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

let provisionerToken: string;
let nonProvisionerToken: string;
let departmentId: string;
let businessUnitId: string;
let locationId: string;
let userId: string;
let otherUserId: string;
const userEmail = "edit-route-test@example.com";
const otherUserEmail = "edit-route-test-other@example.com";

function requestWithCookie(token: string | undefined, body?: unknown) {
  return new NextRequest("http://localhost/api/users/x", {
    method: body ? "PATCH" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {}),
    },
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    role: "CREATOR",
    firstName: "Edited",
    lastName: "User",
    jobTitle: "Updated Title",
    departmentId,
    businessUnitId,
    locationId,
    email: userEmail,
    ...overrides,
  };
}

describe("GET/PATCH /api/users/[id]", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";

    const department = await prisma.department.upsert({
      where: { name: "ICT" },
      update: {},
      create: { name: "ICT" },
    });
    const businessUnit = await prisma.businessUnit.upsert({
      where: { name: "Cawit" },
      update: {},
      create: { name: "Cawit" },
    });
    const location = await prisma.location.upsert({
      where: { name: "Zamboanga" },
      update: {},
      create: { name: "Zamboanga" },
    });
    departmentId = department.id;
    businessUnitId = businessUnit.id;
    locationId = location.id;

    const user = await prisma.user.create({
      data: {
        firstName: "Original",
        lastName: "User",
        jobTitle: "Original Title",
        email: userEmail,
        passwordHash: await hashPassword("supersecure1"),
        role: "CREATOR",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    userId = user.id;

    const otherUser = await prisma.user.create({
      data: {
        firstName: "Other",
        lastName: "User",
        jobTitle: "Other Title",
        email: otherUserEmail,
        passwordHash: await hashPassword("supersecure1"),
        role: "CREATOR",
        departmentId,
        businessUnitId,
        locationId,
        mustChangePassword: false,
      },
    });
    otherUserId = otherUser.id;

    provisionerToken = await createSessionToken({
      sub: "provisioner_user",
      email: "provisioner@company.com",
      firstName: "Provisioner",
      lastName: "User",
      role: "FIRST_APPROVER",
      department: "Admin",
      mustChangePassword: false,
    });

    nonProvisionerToken = await createSessionToken({
      sub: "creator_user",
      email: "creator@company.com",
      firstName: "Creator",
      lastName: "User",
      role: "CREATOR",
      department: "Admin",
      mustChangePassword: false,
    });
  });

  it("GET returns 401 with no session", async () => {
    const response = await GET(requestWithCookie(undefined), context(userId));
    expect(response.status).toBe(401);
  });

  it("GET returns 403 for a session without provisioning permission", async () => {
    const response = await GET(
      requestWithCookie(nonProvisionerToken),
      context(userId)
    );
    expect(response.status).toBe(403);
  });

  it("GET returns 404 for an unknown id", async () => {
    const response = await GET(
      requestWithCookie(provisionerToken),
      context("nonexistent_id")
    );
    expect(response.status).toBe(404);
  });

  it("GET returns the editable fields for a known id", async () => {
    const response = await GET(
      requestWithCookie(provisionerToken),
      context(userId)
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      id: userId,
      firstName: "Original",
      lastName: "User",
      jobTitle: "Original Title",
      email: userEmail,
      role: "CREATOR",
      departmentId,
      businessUnitId,
      locationId,
    });
    expect(body.passwordHash).toBeUndefined();
  });

  it("PATCH returns 401 with no session", async () => {
    const response = await PATCH(
      requestWithCookie(undefined, validPayload()),
      context(userId)
    );
    expect(response.status).toBe(401);
  });

  it("PATCH returns 403 for a session without provisioning permission", async () => {
    const response = await PATCH(
      requestWithCookie(nonProvisionerToken, validPayload()),
      context(userId)
    );
    expect(response.status).toBe(403);
  });

  it("PATCH returns 400 naming the invalid field for a bad email", async () => {
    const response = await PATCH(
      requestWithCookie(provisionerToken, validPayload({ email: "bad" })),
      context(userId)
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/email/i);
  });

  it("PATCH updates the user's fields", async () => {
    const response = await PATCH(
      requestWithCookie(provisionerToken, validPayload()),
      context(userId)
    );
    expect(response.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(updated.firstName).toBe("Edited");
    expect(updated.jobTitle).toBe("Updated Title");
  });

  it("PATCH succeeds when the email is left unchanged", async () => {
    const response = await PATCH(
      requestWithCookie(provisionerToken, validPayload({ email: userEmail })),
      context(userId)
    );
    expect(response.status).toBe(200);
  });

  it("PATCH returns 409 when the email collides with a different user", async () => {
    const response = await PATCH(
      requestWithCookie(
        provisionerToken,
        validPayload({ email: otherUserEmail })
      ),
      context(userId)
    );
    expect(response.status).toBe(409);
  });

  it("PATCH returns 404 for an unknown id", async () => {
    const response = await PATCH(
      requestWithCookie(provisionerToken, validPayload()),
      context("nonexistent_id")
    );
    expect(response.status).toBe(404);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, otherUserEmail] } },
    });
    await prisma.$disconnect();
  });
});

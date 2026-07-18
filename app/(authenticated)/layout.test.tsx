// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock, cookiesMock, verifySessionTokenMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  cookiesMock: vi.fn(),
  verifySessionTokenMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/auth/session", () => ({
  verifySessionToken: (...args: unknown[]) =>
    verifySessionTokenMock(...args),
  SESSION_COOKIE_NAME: "session",
}));

import AuthenticatedLayout from "./layout";

describe("AuthenticatedLayout", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    cookiesMock.mockReset();
    verifySessionTokenMock.mockReset();
  });

  it("redirects to /login when there is no session cookie", async () => {
    cookiesMock.mockResolvedValue({ get: () => undefined });
    verifySessionTokenMock.mockResolvedValue(null);

    await expect(
      AuthenticatedLayout({ children: null })
    ).rejects.toThrow("REDIRECT:/login");
  });

  it("renders the shell for an authenticated session without redirecting", async () => {
    cookiesMock.mockResolvedValue({ get: () => ({ value: "a-token" }) });
    verifySessionTokenMock.mockResolvedValue({
      sub: "user_1",
      email: "juan@company.com",
      firstName: "Juan",
      lastName: "Dela Cruz",
      role: "CREATOR",
      department: "ICT",
      mustChangePassword: false,
    });

    await expect(
      AuthenticatedLayout({ children: null })
    ).resolves.toBeDefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

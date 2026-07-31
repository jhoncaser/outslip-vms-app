import { describe, it, expect } from "vitest";
import { resolveRedirect } from "./routeGuard";
import type { SessionPayload } from "./session";

const activeSession: SessionPayload = {
  sub: "user_1",
  email: "juan@company.com",
  firstName: "Juan",
  lastName: "Dela Cruz",
  role: "APPROVER",
  department: "Admin",
  mustChangePassword: false,
};

const mustChangeSession: SessionPayload = {
  ...activeSession,
  mustChangePassword: true,
};

describe("resolveRedirect", () => {
  it("allows unauthenticated access to /login", () => {
    expect(resolveRedirect({ pathname: "/login", session: null })).toBeNull();
  });

  it("redirects unauthenticated users away from protected pages to /login", () => {
    expect(resolveRedirect({ pathname: "/dashboard", session: null })).toBe(
      "/login"
    );
    expect(resolveRedirect({ pathname: "/register", session: null })).toBe(
      "/login"
    );
  });

  it("redirects authenticated users away from /login to /dashboard", () => {
    expect(
      resolveRedirect({ pathname: "/login", session: activeSession })
    ).toBe("/dashboard");
  });

  it("forces users with mustChangePassword to /change-password", () => {
    expect(
      resolveRedirect({ pathname: "/dashboard", session: mustChangeSession })
    ).toBe("/change-password");
    expect(
      resolveRedirect({ pathname: "/register", session: mustChangeSession })
    ).toBe("/change-password");
  });

  it("allows a mustChangePassword user to reach /change-password", () => {
    expect(
      resolveRedirect({
        pathname: "/change-password",
        session: mustChangeSession,
      })
    ).toBeNull();
  });

  it("allows an authenticated, up-to-date user to reach protected pages", () => {
    expect(
      resolveRedirect({ pathname: "/dashboard", session: activeSession })
    ).toBeNull();
    expect(
      resolveRedirect({ pathname: "/register", session: activeSession })
    ).toBeNull();
  });
});

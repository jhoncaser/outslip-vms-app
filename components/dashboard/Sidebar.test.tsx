import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Sidebar } from "./Sidebar";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

describe("Sidebar", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("always shows Dashboard, Profile, Settings, and Logout", () => {
    render(<Sidebar canProvisionUsers={false} />);
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /profile/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /logout/i })
    ).toBeInTheDocument();
  });

  it("hides Register User when canProvisionUsers is false", () => {
    render(<Sidebar canProvisionUsers={false} />);
    expect(
      screen.queryByRole("link", { name: /register user/i })
    ).not.toBeInTheDocument();
  });

  it("shows Register User when canProvisionUsers is true", () => {
    render(<Sidebar canProvisionUsers={true} />);
    expect(
      screen.getByRole("link", { name: /register user/i })
    ).toBeInTheDocument();
  });

  it("marks the current page's link with aria-current", () => {
    pathnameRef.current = "/profile";
    render(<Sidebar canProvisionUsers={false} />);
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).not.toHaveAttribute("aria-current");
  });

  it("only renders at tablet width and up (hidden below md)", () => {
    render(<Sidebar canProvisionUsers={false} />);
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("md:flex");
  });
});

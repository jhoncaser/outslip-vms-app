import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Navbar } from "./Navbar";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

describe("Navbar", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("shows the brand name", () => {
    render(<Navbar initials="JC" fullName="Jhon Caser" />);
    expect(screen.getByText("OUTSLIP VMS")).toBeInTheDocument();
  });

  it("shows the current page title", () => {
    pathnameRef.current = "/register";
    render(<Navbar initials="JC" fullName="Jhon Caser" />);
    expect(screen.getByText("Register User")).toBeInTheDocument();
  });

  it("shows no page title on an unknown path", () => {
    pathnameRef.current = "/nowhere";
    render(<Navbar initials="JC" fullName="Jhon Caser" />);
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows the user's initials with the full name as tooltip", () => {
    render(<Navbar initials="JC" fullName="Jhon Caser" />);
    const avatar = screen.getByText("JC");
    expect(avatar).toHaveAttribute("title", "Jhon Caser");
  });
});

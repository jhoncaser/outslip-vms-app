import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { AppShell } from "./AppShell";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

describe("AppShell", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("renders the navbar, sidebar, and page content", () => {
    render(
      <AppShell initials="JC" fullName="Jhon Caser" canProvisionUsers={false}>
        <p>Page content</p>
      </AppShell>
    );
    expect(screen.getByTestId("navbar-desktop")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("opens the mobile drawer when the hamburger button is clicked, and closes it via its own Close button", () => {
    render(
      <AppShell initials="JC" fullName="Jhon Caser" canProvisionUsers={false}>
        <p>Page content</p>
      </AppShell>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId("navbar-mobile")).getByRole("button", {
        name: /open navigation menu/i,
      })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

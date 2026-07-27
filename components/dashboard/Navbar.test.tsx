import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
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

  function renderNavbar(onMenuClick = vi.fn()) {
    render(
      <Navbar initials="JC" fullName="Jhon Caser" onMenuClick={onMenuClick} />
    );
    return {
      desktop: screen.getByTestId("navbar-desktop"),
      mobile: screen.getByTestId("navbar-mobile"),
    };
  }

  it("shows the brand name", () => {
    const { desktop } = renderNavbar();
    expect(within(desktop).getByText("OUTSLIP VMS")).toBeInTheDocument();
  });

  it("shows the current page title", () => {
    pathnameRef.current = "/register";
    const { desktop } = renderNavbar();
    expect(within(desktop).getByText("Register User")).toBeInTheDocument();
  });

  it("shows no page title on an unknown path", () => {
    pathnameRef.current = "/nowhere";
    const { desktop } = renderNavbar();
    expect(within(desktop).queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows the user's initials with the full name as tooltip", () => {
    const { desktop } = renderNavbar();
    const avatar = within(desktop).getByText("JC");
    expect(avatar).toHaveAttribute("title", "Jhon Caser");
  });

  it("shows a transaction code search field", () => {
    const { desktop } = renderNavbar();
    const searchbox = within(desktop).getByRole("searchbox", {
      name: "Search transaction code",
    });
    expect(searchbox).toBeInTheDocument();
    expect(searchbox).toHaveAttribute("placeholder", "Search...");
  });

  it("shows a QR scan button inside the search bar", () => {
    const { desktop } = renderNavbar();
    expect(
      within(desktop).getByRole("button", { name: "Scan QR code" })
    ).toBeInTheDocument();
  });

  it("shows a hamburger menu button on the mobile row that calls onMenuClick", () => {
    const onMenuClick = vi.fn();
    const { mobile } = renderNavbar(onMenuClick);
    fireEvent.click(
      within(mobile).getByRole("button", { name: /open navigation menu/i })
    );
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("shows the page title on the mobile row", () => {
    pathnameRef.current = "/register";
    const { mobile } = renderNavbar();
    expect(within(mobile).getByText("Register User")).toBeInTheDocument();
  });

  it("falls back to the brand name on the mobile row when there's no page title", () => {
    pathnameRef.current = "/nowhere";
    const { mobile } = renderNavbar();
    expect(within(mobile).getByText("OUTSLIP VMS")).toBeInTheDocument();
  });

  it("expands a search input on the mobile row when the search icon is tapped, and collapses it back on cancel", () => {
    const { mobile } = renderNavbar();
    expect(within(mobile).queryByRole("searchbox")).not.toBeInTheDocument();

    fireEvent.click(
      within(mobile).getByRole("button", {
        name: /^search transaction code$/i,
      })
    );
    expect(
      within(mobile).getByRole("searchbox", {
        name: "Search transaction code",
      })
    ).toBeInTheDocument();

    fireEvent.click(
      within(mobile).getByRole("button", { name: /cancel search/i })
    );
    expect(within(mobile).queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("shows a QR scan button on the mobile row too", () => {
    const { mobile } = renderNavbar();
    expect(
      within(mobile).getByRole("button", { name: "Scan QR code" })
    ).toBeInTheDocument();
  });
});

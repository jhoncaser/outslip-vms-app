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

  function renderNavbar({
    onMenuClick = vi.fn(),
    canProvisionUsers = false,
  }: { onMenuClick?: () => void; canProvisionUsers?: boolean } = {}) {
    render(
      <Navbar
        initials="JC"
        fullName="Jhon Caser"
        canProvisionUsers={canProvisionUsers}
        onMenuClick={onMenuClick}
      />
    );
    return {
      desktop: screen.getByTestId("navbar-desktop"),
      mobile: screen.getByTestId("navbar-mobile"),
    };
  }

  it("shows the MFC logo", () => {
    const { desktop } = renderNavbar();
    expect(within(desktop).getByAltText("MFC Global")).toBeInTheDocument();
  });

  it("shows the current page title for a route with no nav tab of its own", () => {
    pathnameRef.current = "/transactions/open";
    const { desktop } = renderNavbar();
    expect(within(desktop).getByText("Open Transaction")).toBeInTheDocument();
  });

  it("shows no page title on an unknown path", () => {
    pathnameRef.current = "/nowhere";
    const { desktop } = renderNavbar();
    expect(within(desktop).queryByText("Open Transaction")).not.toBeInTheDocument();
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
    const { mobile } = renderNavbar({ onMenuClick });
    fireEvent.click(
      within(mobile).getByRole("button", { name: /open navigation menu/i })
    );
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it("shows the page title on the mobile row", () => {
    pathnameRef.current = "/transactions/open";
    const { mobile } = renderNavbar();
    expect(within(mobile).getByText("Open Transaction")).toBeInTheDocument();
  });

  it("falls back to the MFC logo on the mobile row when there's no page title", () => {
    pathnameRef.current = "/nowhere";
    const { mobile } = renderNavbar();
    expect(within(mobile).getByAltText("MFC Global")).toBeInTheDocument();
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

  it("always shows Home, Profile, and Settings nav tabs", () => {
    const { desktop } = renderNavbar();
    expect(within(desktop).getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(
      within(desktop).getByRole("link", { name: /^profile$/i })
    ).toBeInTheDocument();
    expect(
      within(desktop).getByRole("link", { name: /^settings$/i })
    ).toBeInTheDocument();
  });

  it("hides the Register User tab when canProvisionUsers is false", () => {
    const { desktop } = renderNavbar({ canProvisionUsers: false });
    expect(
      within(desktop).queryByRole("link", { name: /register user/i })
    ).not.toBeInTheDocument();
  });

  it("shows the Register User tab when canProvisionUsers is true", () => {
    const { desktop } = renderNavbar({ canProvisionUsers: true });
    expect(
      within(desktop).getByRole("link", { name: /register user/i })
    ).toBeInTheDocument();
  });

  it("marks the current page's nav tab with aria-current", () => {
    pathnameRef.current = "/profile";
    const { desktop } = renderNavbar();
    expect(
      within(desktop).getByRole("link", { name: /^profile$/i })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(desktop).getByRole("link", { name: /home/i })
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps the account menu closed until the avatar is clicked", () => {
    renderNavbar();
    expect(
      screen.queryByRole("button", { name: /^logout$/i })
    ).not.toBeInTheDocument();
  });

  it("opens the account menu with Logout when the avatar is clicked", () => {
    const { desktop } = renderNavbar();
    fireEvent.click(
      within(desktop).getByRole("button", { name: /account menu/i })
    );
    expect(screen.getByRole("button", { name: /^logout$/i })).toBeInTheDocument();
  });

  it("closes the account menu when clicking outside it", () => {
    const { desktop } = renderNavbar();
    fireEvent.click(
      within(desktop).getByRole("button", { name: /account menu/i })
    );
    expect(screen.getByRole("button", { name: /^logout$/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(
      screen.queryByRole("button", { name: /^logout$/i })
    ).not.toBeInTheDocument();
  });

  it("closes the account menu on Escape", () => {
    const { desktop } = renderNavbar();
    fireEvent.click(
      within(desktop).getByRole("button", { name: /account menu/i })
    );
    expect(screen.getByRole("button", { name: /^logout$/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("button", { name: /^logout$/i })
    ).not.toBeInTheDocument();
  });
});

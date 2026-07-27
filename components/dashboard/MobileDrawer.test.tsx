import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileDrawer } from "./MobileDrawer";

const pathnameRef = vi.hoisted(() => ({ current: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

// A plain anchor stand-in avoids depending on Next's router-context
// internals for a click-driven unit test — production code still uses the
// real next/link Link, this mock only applies within this test file.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

describe("MobileDrawer", () => {
  beforeEach(() => {
    pathnameRef.current = "/dashboard";
  });

  it("renders nothing when closed", () => {
    render(
      <MobileDrawer canProvisionUsers={false} open={false} onClose={vi.fn()} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows Dashboard, Profile, Settings, and Logout when open", () => {
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={vi.fn()} />
    );
    expect(
      screen.getByRole("link", { name: /dashboard/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profile/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /logout/i })
    ).toBeInTheDocument();
  });

  it("hides Register User when canProvisionUsers is false", () => {
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={vi.fn()} />
    );
    expect(
      screen.queryByRole("link", { name: /register user/i })
    ).not.toBeInTheDocument();
  });

  it("shows Register User when canProvisionUsers is true", () => {
    render(
      <MobileDrawer canProvisionUsers={true} open={true} onClose={vi.fn()} />
    );
    expect(
      screen.getByRole("link", { name: /register user/i })
    ).toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the drawer panel", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("OUTSLIP VMS"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when a nav link is clicked", () => {
    const onClose = vi.fn();
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("link", { name: /profile/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("marks the current page's link with aria-current", () => {
    pathnameRef.current = "/profile";
    render(
      <MobileDrawer canProvisionUsers={false} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: /profile/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
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
});

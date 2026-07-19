import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModuleGrid } from "./ModuleGrid";

describe("ModuleGrid", () => {
  it("always shows Open, Approved, and Canceled Transaction", () => {
    render(<ModuleGrid canViewApprovals={false} />);
    expect(screen.getByText("Open Transaction")).toBeInTheDocument();
    expect(screen.getByText("Approved Transaction")).toBeInTheDocument();
    expect(screen.getByText("Canceled Transaction")).toBeInTheDocument();
  });

  it("hides My Approvals when canViewApprovals is false", () => {
    render(<ModuleGrid canViewApprovals={false} />);
    expect(screen.queryByText("My Approvals")).not.toBeInTheDocument();
  });

  it("shows My Approvals when canViewApprovals is true", () => {
    render(<ModuleGrid canViewApprovals={true} />);
    expect(screen.getByText("My Approvals")).toBeInTheDocument();
  });
});

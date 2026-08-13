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

  it("shows 0 for each tile's count when none is passed", () => {
    render(<ModuleGrid canViewApprovals={false} />);
    const counts = screen.getAllByText("0");
    expect(counts).toHaveLength(3);
  });

  it("shows the real count passed in for each tile", () => {
    render(
      <ModuleGrid
        canViewApprovals={true}
        openCount={5}
        approvedCount={12}
        canceledCount={3}
        myApprovalsCount={2}
      />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

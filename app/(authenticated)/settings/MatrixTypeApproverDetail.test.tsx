import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import {
  MatrixTypeApproverDetail,
  type ApproverAssignmentRow,
  type UserOption,
} from "./MatrixTypeApproverDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const matrixType = { id: "mt1", matrixCode: "MT-004", name: "Visitor Pass" };
const assignments: ApproverAssignmentRow[] = [
  {
    id: "a1",
    matrixTypeId: "mt1",
    approverName: "Jhon Caser",
    level: 1,
    department: "ICT",
    businessUnit: "Cawit",
    location: "Zamboanga",
  },
  {
    id: "a2",
    matrixTypeId: "mt1",
    approverName: "Analyn Gentizon",
    level: 2,
    department: "HR",
    businessUnit: "Ayala",
    location: "Manila",
  },
];
const users: UserOption[] = [
  { id: "u1", name: "Jhon Caser" },
  { id: "u2", name: "Analyn Gentizon" },
];
const departments = [{ id: "d1", name: "ICT" }];
const businessUnits = [{ id: "b1", name: "Cawit" }, { id: "b2", name: "Ayala" }];
const locations = [{ id: "l1", name: "Zamboanga" }, { id: "l2", name: "Manila" }];

function renderDetail(onBack = vi.fn(), canEdit = true) {
  return render(
    <MatrixTypeApproverDetail
      matrixType={matrixType}
      assignments={assignments}
      users={users}
      departments={departments}
      businessUnits={businessUnits}
      locations={locations}
      canEdit={canEdit}
      onBack={onBack}
    />
  );
}

describe("MatrixTypeApproverDetail", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: true, json: async () => ({ id: "new1" }) })
      )
    );
  });

  it("renders the banner with the matrix type name and code", () => {
    renderDetail();
    expect(screen.getByText("VISITOR PASS")).toBeInTheDocument();
    expect(screen.getByText(/MT-004/)).toBeInTheDocument();
  });

  it("renders the assignments table", () => {
    renderDetail();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Approver" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Level" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no assignments", () => {
    render(
      <MatrixTypeApproverDetail
        matrixType={matrixType}
        assignments={[]}
        users={users}
        departments={departments}
        businessUnits={businessUnits}
        locations={locations}
        canEdit
        onBack={vi.fn()}
      />
    );
    expect(screen.getByText(/no approvers assigned yet/i)).toBeInTheDocument();
  });

  it("filters the table by Business Unit via the filter buttons, and All resets it", () => {
    renderDetail();
    const group = screen.getByRole("group", { name: /filter by business unit/i });

    fireEvent.click(within(group).getByRole("button", { name: "Ayala" }));
    expect(screen.queryByText("Jhon Caser")).not.toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "All" }));
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
  });

  it("calls onBack when the Back button is clicked", () => {
    const onBack = vi.fn();
    renderDetail(onBack);
    fireEvent.click(screen.getByRole("button", { name: /^back$/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("opens the Add Approver modal with exactly five fields and no Matrix Type field", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: /\+ add approver/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/^approver$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^level$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^department$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^business unit$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/matrix type/i)).not.toBeInTheDocument();
  });

  it("submits the new assignment to /api/matrix-type-approvers with matrixTypeId included", async () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: /\+ add approver/i }));

    fireEvent.change(screen.getByLabelText(/^approver$/i), { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText(/^level$/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^department$/i), { target: { value: "d1" } });
    fireEvent.change(screen.getByLabelText(/^business unit$/i), { target: { value: "b1" } });
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: "l1" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/matrix-type-approvers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt1",
            approverId: "u1",
            level: 1,
            departmentId: "d1",
            businessUnitId: "b1",
            locationId: "l1",
          }),
        })
      )
    );
  });

  it("closes the modal after a successful submit", async () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: /\+ add approver/i }));
    fireEvent.change(screen.getByLabelText(/^approver$/i), { target: { value: "u1" } });
    fireEvent.change(screen.getByLabelText(/^level$/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/^department$/i), { target: { value: "d1" } });
    fireEvent.change(screen.getByLabelText(/^business unit$/i), { target: { value: "b1" } });
    fireEvent.change(screen.getByLabelText(/^location$/i), { target: { value: "l1" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("hides the + Add Approver button for a non-admin (canEdit false), but still shows the table", () => {
    renderDetail(vi.fn(), false);
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /\+ add approver/i })
    ).not.toBeInTheDocument();
  });
});

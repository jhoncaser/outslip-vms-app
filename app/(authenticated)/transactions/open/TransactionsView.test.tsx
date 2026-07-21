import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TransactionsView } from "./TransactionsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const transactions = [
  {
    id: "t1",
    transactionCode: "OT-001",
    matrixTypeName: "Halfday",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
  },
];
const matrixTypes = [
  { id: "mt1", name: "Halfday" },
  { id: "mt2", name: "Undertime" },
];

function renderView() {
  return render(
    <TransactionsView transactions={transactions} matrixTypes={matrixTypes} />
  );
}

describe("TransactionsView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ id: "new1" }),
        })
      )
    );
  });

  it("renders the transactions table", () => {
    renderView();
    expect(
      screen.getByRole("columnheader", { name: "Transaction Type" })
    ).toBeInTheDocument();
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });

  it("opens the modal and lists matrix type options", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Halfday" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Undertime" })).toBeInTheDocument();
  });

  it("renders the additional optional fields in the Add Transaction modal", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/return time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^origin business unit$/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/enroute to other business unit/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
  });

  it("includes populated optional fields in the submitted body", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Client meeting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt1",
            plannedDate: "2026-07-25",
            reason: "Client meeting",
          }),
        })
      )
    );
  });

  it("includes all selected values when submitting the Enroute to Other Business Unit multi-select", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });

    const enrouteSelect = screen.getByLabelText(
      /enroute to other business unit/i
    ) as HTMLSelectElement;
    const options = Array.from(enrouteSelect.options);
    options.find((option) => option.value === "Alpha")!.selected = true;
    options.find((option) => option.value === "Delta")!.selected = true;
    fireEvent.change(enrouteSelect);

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(
            '"enrouteBusinessUnits":["Alpha","Delta"]'
          ),
        })
      )
    );
  });

  it("submits the selected matrix type to /api/transactions", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ matrixTypeId: "mt2" }),
        })
      )
    );
  });

  it("closes the modal after a successful submit", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});

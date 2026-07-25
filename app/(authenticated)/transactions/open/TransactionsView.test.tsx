import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TransactionsView } from "./TransactionsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const transactions = [
  {
    id: "t1",
    transactionCode: "OT-001",
    qrDataUrl: "data:image/png;base64,mockqrdata",
    matrixTypeName: "Halfday",
    plannedDate: "Jul 25, 2026",
    plannedTime: "9:00 AM",
    returnTime: "5:00 PM",
    originBusinessUnit: "Cawit",
    enrouteBusinessUnits: "Alpha, Delta",
    reason: "Client meeting",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
  },
];
const matrixTypes = [
  { id: "mt1", name: "Halfday" },
  { id: "mt2", name: "Undertime" },
];

function renderView(currentUserBusinessUnit = "") {
  return render(
    <TransactionsView
      transactions={transactions}
      matrixTypes={matrixTypes}
      currentUserBusinessUnit={currentUserBusinessUnit}
    />
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

  it("renders the additional fields as table columns before Created By", () => {
    renderView();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Planned Date",
      "Planned Time",
      "Return Time",
      "Origin Business Unit",
      "Enroute to Other Business Unit",
      "Reason",
      "Created By",
      "Status",
      "Date Filed",
    ]);
    expect(screen.getByText("Jul 25, 2026")).toBeInTheDocument();
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Alpha, Delta")).toBeInTheDocument();
    expect(screen.getByText("Client meeting")).toBeInTheDocument();
  });

  it("renders a QR code thumbnail for each transaction", () => {
    renderView();
    const qrImage = screen.getByAltText("QR code for transaction OT-001");
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,mockqrdata");
  });

  it("opens an enlarged QR view when the thumbnail is clicked, and closes it via the X", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the enlarged QR view open on backdrop click and Escape", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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
      screen.getByRole("group", { name: /enroute to other business unit/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Delta" })).toBeInTheDocument();
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

  it("includes all checked values when submitting the Enroute to Other Business Unit checkboxes", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt1" },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Delta" }));

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

  it("pre-fills Origin Business Unit with the current user's business unit when it's a valid option", () => {
    renderView("Cawit");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("Cawit");
  });

  it("still allows changing the pre-filled Origin Business Unit before submitting", async () => {
    renderView("Cawit");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    fireEvent.change(screen.getByLabelText(/transaction type/i), {
      target: { value: "mt2" },
    });
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Delta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ matrixTypeId: "mt2", originBusinessUnit: "Delta" }),
        })
      )
    );
  });

  it("leaves Origin Business Unit unset when the current user's business unit isn't one of the fixed options", () => {
    renderView("MSC");
    fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("");
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

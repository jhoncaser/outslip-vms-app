import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    visitorType: "—",
    personToMeet: "—",
    department: "—",
    location: "—",
    transportType: "—",
    plateNo: "—",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 21, 2026",
  },
];
const visitorPassTransactions = [
  {
    id: "t2",
    transactionCode: "OT-002",
    qrDataUrl: "data:image/png;base64,mockqrdata",
    matrixTypeName: "Visitor Pass",
    plannedDate: "Jul 26, 2026",
    plannedTime: "10:30 AM",
    returnTime: "—",
    originBusinessUnit: "—",
    enrouteBusinessUnits: "—",
    reason: "Product demo for a prospective supplier",
    visitorType: "Supplier",
    personToMeet: "Analyn Gentizon",
    department: "ICT",
    location: "Lobby, Room 204",
    transportType: "Car",
    plateNo: "ABC-1234",
    createdBy: "Jhon Caser",
    statusName: "Open",
    createdAt: "Jul 25, 2026",
  },
];
const matrixTypes = [
  { id: "mt1", name: "Halfday" },
  { id: "mt2", name: "Undertime" },
  { id: "mt3", name: "Visitor Pass" },
  { id: "mt4", name: "Routing to other Business Unit" },
  { id: "mt5", name: "Out for Lunch" },
];
const departments = [
  { id: "d1", name: "ICT" },
  { id: "d2", name: "HR" },
];

function renderView(currentUserBusinessUnit = "") {
  return render(
    <TransactionsView
      transactions={transactions}
      matrixTypes={matrixTypes}
      currentUserBusinessUnit={currentUserBusinessUnit}
      departments={departments}
    />
  );
}

function rowFor(code: string) {
  const cell = screen.getByText(code);
  const row = cell.closest("tr");
  if (!row) throw new Error(`No <tr> ancestor found for ${code}`);
  return row;
}

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /\+ add transaction/i }));
}

function selectType(id: string) {
  fireEvent.change(screen.getByLabelText(/transaction type/i), {
    target: { value: id },
  });
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

  it("renders the transactions table with the 6 core columns", () => {
    renderView();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual([
      "QR",
      "Code",
      "Transaction Type",
      "Created By",
      "Status",
      "Date Filed",
    ]);
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(screen.getByText("Jhon Caser")).toBeInTheDocument();
  });

  it("does not show detail fields until a row is expanded", () => {
    renderView();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
    expect(screen.queryByText("Cawit")).not.toBeInTheDocument();
  });

  it("expands a row to reveal its populated detail fields, skipping dash-only ones, and collapses again on second click", () => {
    renderView();
    fireEvent.click(rowFor("OT-001"));

    expect(screen.getByText("Jul 25, 2026")).toBeInTheDocument(); // Planned Date
    expect(screen.getByText("9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Cawit")).toBeInTheDocument();
    expect(screen.getByText("Alpha, Delta")).toBeInTheDocument();
    expect(screen.getByText("Client meeting")).toBeInTheDocument();
    // Dash-only fields for this row must not appear in the expanded panel
    expect(screen.queryByText("Visitor Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Person to Meet")).not.toBeInTheDocument();

    fireEvent.click(rowFor("OT-001"));
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
  });

  it("expanding a Visitor Pass row shows its populated visitor fields and skips its dash-only generic fields", () => {
    render(
      <TransactionsView
        transactions={visitorPassTransactions}
        matrixTypes={matrixTypes}
        currentUserBusinessUnit=""
        departments={departments}
      />
    );
    fireEvent.click(rowFor("OT-002"));

    expect(screen.getByText("Supplier")).toBeInTheDocument();
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Lobby, Room 204")).toBeInTheDocument();
    expect(screen.getByText("Car")).toBeInTheDocument();
    expect(screen.getByText("ABC-1234")).toBeInTheDocument();
    expect(screen.queryByText("Origin Business Unit")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Enroute to Other Business Unit")
    ).not.toBeInTheDocument();
  });

  it("renders a QR code thumbnail for each transaction", () => {
    renderView();
    const qrImage = screen.getByAltText("QR code for transaction OT-001");
    expect(qrImage).toHaveAttribute("src", "data:image/png;base64,mockqrdata");
  });

  it("opens an enlarged QR view when the thumbnail is clicked, and closes it via the X, without expanding the row", () => {
    renderView();
    fireEvent.click(
      screen.getByRole("button", {
        name: "QR code for transaction OT-001",
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();

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

  it("pressing Enter on the QR thumbnail opens the enlarge dialog, not the row's expand panel", async () => {
    const user = userEvent.setup();
    renderView();
    const qrButton = screen.getByRole("button", {
      name: "QR code for transaction OT-001",
    });
    qrButton.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("Client meeting")).not.toBeInTheDocument();
  });

  it("opens the modal and lists matrix type options", () => {
    renderView();
    openModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Halfday" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Undertime" })).toBeInTheDocument();
  });

  it("shows no extra fields until a Transaction Type is selected", () => {
    renderView();
    openModal();
    expect(screen.queryByLabelText(/planned date/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^reason$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows exactly Halfday's required fields when Halfday is selected", () => {
    renderView();
    openModal();
    selectType("mt1");

    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/return time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^origin business unit$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /enroute to other business unit/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows exactly Out for Lunch's required fields when selected", () => {
    renderView();
    openModal();
    selectType("mt5");

    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/return time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/^origin business unit$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /enroute to other business unit/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows exactly Routing to other Business Unit's required fields when selected", () => {
    renderView();
    openModal();
    selectType("mt4");

    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^origin business unit$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /enroute to other business unit/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/return time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
  });

  it("shows the Visitor Pass field set when Visitor Pass is selected", () => {
    renderView();
    openModal();
    selectType("mt3");

    expect(screen.getByLabelText(/^visitor type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/planned time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/person to meet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^department$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^transport type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/plate no\./i)).toBeInTheDocument();

    expect(screen.queryByLabelText(/return time/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^origin business unit$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /enroute to other business unit/i })
    ).not.toBeInTheDocument();
  });

  it("switching from Visitor Pass to Halfday swaps the field set", () => {
    renderView();
    openModal();
    selectType("mt3");
    expect(screen.getByLabelText(/^visitor type$/i)).toBeInTheDocument();

    selectType("mt1");
    expect(screen.queryByLabelText(/^visitor type$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^reason$/i)).toBeInTheDocument();
  });

  it("shows a specific error and does not submit when a required field is missing", () => {
    renderView();
    openModal();
    selectType("mt1");
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent("Planned Date is required for this transaction type");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a specific error when Enroute to Other Business Unit has no boxes checked", () => {
    renderView();
    openModal();
    selectType("mt4");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Cawit" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Delivering documents" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enroute to Other Business Unit is required for this transaction type"
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits Halfday's required fields in the request body", async () => {
    renderView();
    openModal();
    selectType("mt1");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
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
            plannedTime: "09:00",
            reason: "Client meeting",
          }),
        })
      )
    );
  });

  it("submits Out for Lunch's required fields in the request body", async () => {
    renderView();
    openModal();
    selectType("mt5");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "12:00" },
    });
    fireEvent.change(screen.getByLabelText(/return time/i), {
      target: { value: "13:00" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Lunch out" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt5",
            plannedDate: "2026-07-25",
            plannedTime: "12:00",
            returnTime: "13:00",
            reason: "Lunch out",
          }),
        })
      )
    );
  });

  it("submits Routing to other Business Unit's required fields, including checked Enroute boxes", async () => {
    renderView();
    openModal();
    selectType("mt4");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Cawit" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Delta" }));
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Delivering documents" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt4",
            plannedDate: "2026-07-25",
            plannedTime: "09:00",
            originBusinessUnit: "Cawit",
            enrouteBusinessUnits: ["Alpha", "Delta"],
            reason: "Delivering documents",
          }),
        })
      )
    );
  });

  it("submits populated Visitor Pass fields in the request body", async () => {
    renderView();
    openModal();
    selectType("mt3");
    fireEvent.change(screen.getByLabelText(/^visitor type$/i), {
      target: { value: "Supplier" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-26" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "10:30" },
    });
    fireEvent.change(screen.getByLabelText(/person to meet/i), {
      target: { value: "Analyn Gentizon" },
    });
    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "d1" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Product demo for a prospective supplier" },
    });
    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "Lobby, Room 204" },
    });
    fireEvent.change(screen.getByLabelText(/^transport type$/i), {
      target: { value: "Car" },
    });
    fireEvent.change(screen.getByLabelText(/plate no\./i), {
      target: { value: "ABC-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            matrixTypeId: "mt3",
            visitorType: "Supplier",
            plannedDate: "2026-07-26",
            plannedTime: "10:30",
            personToMeet: "Analyn Gentizon",
            departmentId: "d1",
            reason: "Product demo for a prospective supplier",
            visitLocation: "Lobby, Room 204",
            transportType: "Car",
            plateNo: "ABC-1234",
          }),
        })
      )
    );
  });

  it("pre-fills Origin Business Unit with the current user's business unit when Routing to other Business Unit is selected", () => {
    renderView("Cawit");
    openModal();
    selectType("mt4");
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("Cawit");
  });

  it("still allows changing the pre-filled Origin Business Unit before submitting", async () => {
    renderView("Cawit");
    openModal();
    selectType("mt4");
    fireEvent.change(screen.getByLabelText(/^origin business unit$/i), {
      target: { value: "Delta" },
    });
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Delivering documents" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"originBusinessUnit":"Delta"'),
        })
      )
    );
  });

  it("leaves Origin Business Unit unset when the current user's business unit isn't one of the fixed options", () => {
    renderView("MSC");
    openModal();
    selectType("mt4");
    expect(
      (screen.getByLabelText(/^origin business unit$/i) as HTMLSelectElement).value
    ).toBe("");
  });

  it("closes the modal after a successful submit", async () => {
    renderView();
    openModal();
    selectType("mt1");
    fireEvent.change(screen.getByLabelText(/planned date/i), {
      target: { value: "2026-07-25" },
    });
    fireEvent.change(screen.getByLabelText(/planned time/i), {
      target: { value: "09:00" },
    });
    fireEvent.change(screen.getByLabelText(/^reason$/i), {
      target: { value: "Client meeting" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});

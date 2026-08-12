import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TransactionDetailView } from "./TransactionDetailView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const visitorPassTransaction = {
  id: "t1",
  transactionCode: "OT-001",
  qrDataUrl: "data:image/png;base64,mockqrdata",
  matrixTypeName: "Visitor Pass",
  statusName: "Open",
  createdBy: "Jhon Caser",
  createdAt: "Jul 28, 2026",
  postedAt: null,
  detailFields: [{ label: "Reason", value: "Client meeting" }],
};

const otherTransaction = {
  ...visitorPassTransaction,
  id: "t2",
  transactionCode: "OT-002",
  matrixTypeName: "Halfday",
};

const visitorPassLineItems = [
  {
    id: "li1",
    variant: "visitor-pass" as const,
    visitorName: "Analyn Gentizon",
    jobTitle: "Procurement Officer",
    company: "Acme Supplies",
    contactNumber: "0917-000-0000",
    emailAddress: "analyn@example.com",
    transportType: "Car",
    plateNo: "ABC-1234",
    uploadFileName: "id.pdf",
    hasFile: true,
    employeeType: "",
    employeeId: "",
    employeeName: "",
    jobPosition: "",
    department: "",
    businessUnit: "",
    remarks: "",
  },
];

const employeeLineItems = [
  {
    id: "li2",
    variant: "employee" as const,
    visitorName: "",
    jobTitle: "",
    company: "",
    contactNumber: "",
    emailAddress: "",
    transportType: "",
    plateNo: "",
    uploadFileName: "",
    hasFile: false,
    employeeType: "Third-Party",
    employeeId: "",
    employeeName: "Mark Reyes",
    jobPosition: "—",
    department: "—",
    businessUnit: "—",
    remarks: "Delivery vendor",
  },
];

const megaEmployeeLineItems = [
  {
    id: "li3",
    variant: "employee" as const,
    visitorName: "",
    jobTitle: "",
    company: "",
    contactNumber: "",
    emailAddress: "",
    transportType: "",
    plateNo: "",
    uploadFileName: "",
    hasFile: false,
    employeeType: "Mega Employee",
    employeeId: "u1",
    employeeName: "Jhon Niño Caser",
    jobPosition: "Business Analyst and Developer",
    department: "Digital Transformation and Business Systems",
    businessUnit: "MFC",
    remarks: "Sample remarks",
  },
];

const employees = [
  {
    id: "u1",
    name: "Jhon Niño Caser",
    jobPosition: "Business Analyst and Developer",
    department: "Digital Transformation and Business Systems",
    businessUnit: "MFC",
  },
];

const approvers = [
  { id: "a1", level: 1, approverName: "Maria Santos", initials: "MS" },
  { id: "a2", level: 1, approverName: "Juan Dela Cruz", initials: "JD" },
  { id: "a3", level: 2, approverName: "Ana Reyes", initials: "AR" },
];

describe("TransactionDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });

  it("renders the header card with QR, code, and populated detail fields", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("OT-001")).toBeInTheDocument();
    expect(screen.getByText("Visitor Pass")).toBeInTheDocument();
    expect(screen.getByText("Client meeting")).toBeInTheDocument();
    expect(screen.getByAltText(/qr code/i)).toHaveAttribute(
      "src",
      "data:image/png;base64,mockqrdata"
    );
  });

  it("renders the Back link pointing at /transactions/open by default", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/transactions/open"
    );
  });

  it("renders the Back link pointing at a custom backHref when provided", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        backHref="/transactions/my-approvals"
      />
    );
    expect(screen.getByRole("link", { name: /back/i })).toHaveAttribute(
      "href",
      "/transactions/my-approvals"
    );
  });

  it("renders the Visitor Pass line items table with its columns", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(screen.getByText("Procurement Officer")).toBeInTheDocument();
    expect(screen.getByText("Acme Supplies")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Visitor Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Transport Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Plate No." })).toBeInTheDocument();
    expect(screen.getByText("ABC-1234")).toBeInTheDocument();
  });

  it("renders the employee-variant line items table with its columns", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={employeeLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("Mark Reyes")).toBeInTheDocument();
    expect(screen.getByText("Delivery vendor")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Remarks" })).toBeInTheDocument();
  });

  it("renders Mega Employee live-lookup fields with actual data, not placeholders", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={megaEmployeeLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("Jhon Niño Caser")).toBeInTheDocument();
    expect(screen.getByText("Business Analyst and Developer")).toBeInTheDocument();
    expect(screen.getByText("Digital Transformation and Business Systems")).toBeInTheDocument();
    expect(screen.getByText("MFC")).toBeInTheDocument();
    expect(screen.getByText("Sample remarks")).toBeInTheDocument();
  });

  it("shows an empty state when there are no line items yet", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText(/no line items yet/i)).toBeInTheDocument();
  });

  it("opens the delete-confirmation modal with the Visitor Pass row's details", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Analyn Gentizon" }));

    const dialog = screen.getByRole("dialog", { name: /delete this line item/i });
    expect(within(dialog).getByText("Analyn Gentizon")).toBeInTheDocument();
    expect(dialog.textContent).toContain("Procurement Officer · Acme Supplies");
  });

  it("opens the delete-confirmation modal with an employee-variant row's details", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={employeeLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Mark Reyes" }));

    const dialog = screen.getByRole("dialog", { name: /delete this line item/i });
    expect(within(dialog).getByText("Third-Party — Mark Reyes")).toBeInTheDocument();
  });

  it("opens the delete-confirmation modal with a Mega Employee row's details", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={megaEmployeeLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Jhon Niño Caser" }));

    const dialog = screen.getByRole("dialog", { name: /delete this line item/i });
    expect(within(dialog).getByText("Mega Employee — Jhon Niño Caser")).toBeInTheDocument();
  });

  it("cancels without making a network request", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Analyn Gentizon" }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(
      screen.queryByRole("dialog", { name: /delete this line item/i })
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes a line item and refreshes on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Analyn Gentizon" }));
    const dialog = screen.getByRole("dialog", { name: /delete this line item/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/line-items/li1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /delete this line item/i })
      ).not.toBeInTheDocument()
    );
  });

  it("shows an error inside the modal and keeps it open when delete fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: "Failed to delete line item" }),
        })
      )
    );
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Analyn Gentizon" }));
    const dialog = screen.getByRole("dialog", { name: /delete this line item/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Failed to delete line item"
      )
    );
    expect(screen.getByRole("dialog", { name: /delete this line item/i })).toBeInTheDocument();
  });

  it("does not close the delete-confirmation modal on a backdrop click or Escape", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Analyn Gentizon" }));
    const dialog = screen.getByRole("dialog", { name: /delete this line item/i });

    fireEvent.click(dialog);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("dialog", { name: /delete this line item/i })).toBeInTheDocument();
  });

  it("links the file thumbnail to the authenticated file route", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByRole("link", { name: /id\.pdf/i })).toHaveAttribute(
      "href",
      "/api/line-items/li1/file"
    );
  });

  it("opens the Add Line Item modal showing the Visitor Pass fields when the transaction is Visitor Pass", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));

    expect(screen.getByLabelText(/visitor name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^company$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact #/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload file/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/transport type/i)).toBeInTheDocument();
  });

  it("opens the Add Line Item modal showing the Employee Type buttons when the transaction is not Visitor Pass", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));

    expect(screen.getByRole("button", { name: "Mega Employee" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Third-Party" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visitor" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i).tagName).toBe("SELECT");
    // Nothing is pre-selected yet
    expect(screen.queryByText("Business Analyst and Developer")).not.toBeInTheDocument();
    expect(screen.queryByText("MFC")).not.toBeInTheDocument();
  });

  it("shows auto-filled fields when an employee is selected from the Mega Employee dropdown", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "u1" },
    });

    expect(screen.getByText("Business Analyst and Developer")).toBeInTheDocument();
    expect(screen.getByText("MFC")).toBeInTheDocument();
  });

  it("switches to a free-text Name field and hides the auto-filled fields when Third-Party is selected", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.click(screen.getByRole("button", { name: "Third-Party" }));

    const modal = screen.getByRole("dialog");
    expect(within(modal).getByLabelText(/^name$/i).tagName).toBe("INPUT");
    expect(within(modal).queryByText("Business Analyst and Developer")).not.toBeInTheDocument();
    expect(within(modal).queryByText("MFC")).not.toBeInTheDocument();
  });

  it("pre-fills Remarks from remarksDefault and allows editing it", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    expect((screen.getByLabelText(/^remarks$/i) as HTMLInputElement).value).toBe(
      "Sample reason"
    );
  });

  it("shows a specific error and does not submit when a required field is missing", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.click(screen.getByRole("button", { name: "Third-Party" }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("submits a new Visitor Pass line item as multipart form data", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.change(screen.getByLabelText(/visitor name/i), {
      target: { value: "Analyn Gentizon" },
    });
    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "Procurement Officer" },
    });
    fireEvent.change(screen.getByLabelText(/^company$/i), {
      target: { value: "Acme Supplies" },
    });
    fireEvent.change(screen.getByLabelText(/transport type/i), {
      target: { value: "Car" },
    });
    fireEvent.change(screen.getByLabelText(/plate no/i), {
      target: { value: "ABC-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/transactions/t1/line-items");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("visitorName")).toBe("Analyn Gentizon");
    expect((options.body as FormData).get("plateNo")).toBe("ABC-1234");
  });

  it("requires Plate No. for a non-Walk-In transport type, and shows a specific error", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.change(screen.getByLabelText(/visitor name/i), {
      target: { value: "Analyn Gentizon" },
    });
    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "Procurement Officer" },
    });
    fireEvent.change(screen.getByLabelText(/^company$/i), {
      target: { value: "Acme Supplies" },
    });
    fireEvent.change(screen.getByLabelText(/transport type/i), {
      target: { value: "Car" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Plate No. is required");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hides Plate No. and does not require it when Transport Type is Walk-In", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.change(screen.getByLabelText(/transport type/i), {
      target: { value: "Walk-In" },
    });
    expect(screen.queryByLabelText(/plate no/i)).not.toBeInTheDocument();
  });

  it("clears an already-typed Plate No. when switching Transport Type to Walk-In", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /\+ add line item/i }));
    fireEvent.change(screen.getByLabelText(/transport type/i), {
      target: { value: "Car" },
    });
    fireEvent.change(screen.getByLabelText(/plate no/i), {
      target: { value: "ABC-1234" },
    });
    fireEvent.change(screen.getByLabelText(/transport type/i), {
      target: { value: "Walk-In" },
    });
    expect(screen.queryByLabelText(/plate no/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/transport type/i), {
      target: { value: "Car" },
    });
    expect((screen.getByLabelText(/plate no/i) as HTMLInputElement).value).toBe("");
  });

  it("opens the Edit modal pre-filled with the line item's current values", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect((screen.getByLabelText(/visitor name/i) as HTMLInputElement).value).toBe(
      "Analyn Gentizon"
    );
  });

  it("opens the Edit modal for a Mega Employee line item with the correct employee pre-selected", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={megaEmployeeLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const modal = screen.getByRole("dialog");
    expect((within(modal).getByLabelText(/^name$/i) as HTMLSelectElement).value).toBe("u1");
    expect(within(modal).getByText("Business Analyst and Developer")).toBeInTheDocument();
    expect((within(modal).getByLabelText(/^remarks$/i) as HTMLInputElement).value).toBe(
      "Sample remarks"
    );
  });

  it("submits an edit as a PATCH request to the line item's own url", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/line-items/li1",
        expect.objectContaining({ method: "PATCH" })
      )
    );
  });

  it("renders the List Approvers panel grouped by level with correct names for Visitor Pass", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        approvers={approvers}
      />
    );
    expect(screen.getByText(/👤 List Approvers/)).toBeInTheDocument();
    expect(screen.getByText(/1st Level/)).toBeInTheDocument();
    expect(screen.getByText(/2nd Level/)).toBeInTheDocument();
    expect(screen.queryByText(/3rd Level/)).not.toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Ana Reyes")).toBeInTheDocument();
    expect(screen.getByText("MS")).toBeInTheDocument();
  });

  it("renders the empty state when no approvers are configured for a Visitor Pass transaction", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        approvers={[]}
      />
    );
    expect(
      screen.getByText(
        "No approvers configured for your Department + Business Unit + Location."
      )
    ).toBeInTheDocument();
  });

  it("renders the empty state, not an error, when no approvers prop is passed at all (legacy transaction)", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(
      screen.getByText(
        "No approvers configured for your Department + Business Unit + Location."
      )
    ).toBeInTheDocument();
  });

  it("renders the List Approvers panel for a non-Visitor-Pass transaction too", () => {
    render(
      <TransactionDetailView
        transaction={otherTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        approvers={approvers}
      />
    );
    expect(screen.getByText(/👤 List Approvers/)).toBeInTheDocument();
  });
});

describe("TransactionDetailView — Post/Unpost", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ postedAt: null }) })));
  });

  it("does not render a Post button for a non-owner", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /^post$/i })).not.toBeInTheDocument();
  });

  it("opens the post-confirmation modal with the transaction code and type", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Visitor Pass")).toBeInTheDocument();
  });

  it("calls the PATCH endpoint on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^post$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: true }) })
      )
    );
  });

  it("closes the modal without calling PATCH when Cancel is clicked", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a POSTED badge and hides + Add Line Item and the Actions column once posted, for every viewer", () => {
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.getByText("POSTED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ add line item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit analyn gentizon/i)).not.toBeInTheDocument();
  });

  it("renders an Unpost button for the owner when posted, and unposts immediately with no confirmation modal", async () => {
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^unpost$/i }));
    expect(screen.queryByRole("dialog", { name: /post this transaction/i })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ posted: false }) })
      )
    );
  });

  it("shows an error inside the modal when the PATCH request fails, and keeps it open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: async () => ({ error: "Only the creator can post or unpost this transaction" }),
        })
      )
    );
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^post$/i }));
    const dialog = screen.getByRole("dialog", { name: /post this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^post$/i }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /only the creator can post or unpost this transaction/i
    );
    expect(screen.getByRole("dialog", { name: /post this transaction/i })).toBeInTheDocument();
  });
});

describe("TransactionDetailView — Delete", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });

  it("does not render a Delete button for a non-owner", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("renders a Delete button for the owner when not posted and not cancelled", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
  });

  it("does not render a Delete button for the owner once posted", () => {
    const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });

  it("opens the confirmation modal with the transaction code and type", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    expect(within(dialog).getByText("OT-001")).toBeInTheDocument();
    expect(within(dialog).getByText("Visitor Pass")).toBeInTheDocument();
  });

  it("calls the DELETE endpoint on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("closes the modal without calling DELETE when Cancel is clicked", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("hides Add Line Item, the Actions column, Post, and Delete once cancelled", () => {
    const cancelledTransaction = { ...visitorPassTransaction, statusName: "Cancelled" };
    render(
      <TransactionDetailView
        transaction={cancelledTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.queryByRole("button", { name: /\+ add line item/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^post$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/edit analyn gentizon/i)).not.toBeInTheDocument();
  });
});

describe("TransactionDetailView — Approver actions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })));
  });

  const postedTransaction = { ...visitorPassTransaction, postedAt: "2026-08-08T00:00:00.000Z" };

  it("does not render approver buttons for a non-pending-approver viewer", () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^revise$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
  });

  it("renders Approve/Revise/Cancel for the pending-level approver", () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^revise$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("opens the approve modal and calls the approve endpoint on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    const dialog = screen.getByRole("dialog", { name: /approve this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^approve$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/approve",
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("opens the revise modal and calls the revise endpoint with the reason on confirm", async () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^revise$/i }));
    const dialog = screen.getByRole("dialog", { name: /send back for revision/i });
    fireEvent.change(within(dialog).getByLabelText(/reason/i), {
      target: { value: "Please double check the planned time" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /send for revision/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/revise",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Please double check the planned time" }),
        })
      )
    );
  });

  it("approver Cancel opens the existing CancelTransactionModal and calls DELETE", async () => {
    render(
      <TransactionDetailView
        transaction={postedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isPendingApprover
        isFinalApprovalLevel={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    const dialog = screen.getByRole("dialog", { name: /delete this transaction/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("shows the revision reason banner when present", () => {
    const revisedTransaction = { ...visitorPassTransaction, revisionReason: "Fix the planned date" };
    render(
      <TransactionDetailView
        transaction={revisedTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.getByText(/fix the planned date/i)).toBeInTheDocument();
  });

  it("does not show the revision reason banner when absent", () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={[]}
        employees={employees}
        remarksDefault="Sample reason"
        isOwner
      />
    );
    expect(screen.queryByText(/revision requested/i)).not.toBeInTheDocument();
  });
});

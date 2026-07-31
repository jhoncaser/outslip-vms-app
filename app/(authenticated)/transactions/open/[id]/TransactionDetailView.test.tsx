import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

describe("TransactionDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    vi.stubGlobal("confirm", vi.fn(() => true));
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

  it("deletes a line item after confirming, and not when the confirm is declined", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
        employees={employees}
        remarksDefault="Sample reason"
      />
    );

    vi.stubGlobal("confirm", vi.fn(() => false));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(fetch).not.toHaveBeenCalled();

    vi.stubGlobal("confirm", vi.fn(() => true));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/transactions/t1/line-items/li1",
        expect.objectContaining({ method: "DELETE" })
      )
    );
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
    // Mega Employee is the default selection: Name dropdown + auto-filled display fields
    expect(screen.getByLabelText(/^name$/i).tagName).toBe("SELECT");
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

    expect(screen.getByLabelText(/^name$/i).tagName).toBe("INPUT");
    expect(screen.queryByText("Business Analyst and Developer")).not.toBeInTheDocument();
    expect(screen.queryByText("MFC")).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/transactions/t1/line-items");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("visitorName")).toBe("Analyn Gentizon");
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
    expect((screen.getByLabelText(/^name$/i) as HTMLSelectElement).value).toBe("u1");
    expect(screen.getByText("Business Analyst and Developer")).toBeInTheDocument();
    expect((screen.getByLabelText(/^remarks$/i) as HTMLInputElement).value).toBe(
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
});

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

describe("TransactionDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("renders the header card with QR, code, and populated detail fields", () => {
    render(<TransactionDetailView transaction={visitorPassTransaction} lineItems={[]} />);
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
      <TransactionDetailView transaction={otherTransaction} lineItems={employeeLineItems} />
    );
    expect(screen.getByText("Mark Reyes")).toBeInTheDocument();
    expect(screen.getByText("Delivery vendor")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Remarks" })).toBeInTheDocument();
  });

  it("shows an empty state when there are no line items yet", () => {
    render(<TransactionDetailView transaction={visitorPassTransaction} lineItems={[]} />);
    expect(screen.getByText(/no line items yet/i)).toBeInTheDocument();
  });

  it("deletes a line item after confirming, and not when the confirm is declined", async () => {
    render(
      <TransactionDetailView
        transaction={visitorPassTransaction}
        lineItems={visitorPassLineItems}
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
      />
    );
    expect(screen.getByRole("link", { name: /id\.pdf/i })).toHaveAttribute(
      "href",
      "/api/line-items/li1/file"
    );
  });
});

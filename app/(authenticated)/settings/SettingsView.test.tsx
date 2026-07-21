import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsView } from "./SettingsView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const matrixTypes = [
  {
    id: "mt1",
    matrixCode: "MT-001",
    name: "Halfday",
    creator: "admin@gmail.com",
    createdAt: "Jul 20, 2026",
  },
];
const departments = [{ id: "d1", name: "ICT" }];
const businessUnits = [{ id: "b1", name: "Cawit" }];
const locations = [{ id: "l1", name: "Zamboanga" }];

function renderView() {
  return render(
    <SettingsView
      matrixTypes={matrixTypes}
      departments={departments}
      businessUnits={businessUnits}
      locations={locations}
    />
  );
}

describe("SettingsView", () => {
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

  it("defaults to the Matrix Type tab and shows its table", () => {
    renderView();
    expect(
      screen.getByRole("columnheader", { name: "Matrix Code" })
    ).toBeInTheDocument();
    expect(screen.getByText("Halfday")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\+ add matrix type/i })
    ).toBeInTheDocument();
  });

  it("switches to the Department tab and shows its table", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Department" }));
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /\+ add department/i })
    ).toBeInTheDocument();
  });

  it("marks the active tab with aria-pressed", () => {
    renderView();
    expect(screen.getByRole("button", { name: "Matrix Type" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Department" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("submits a new matrix type to /api/matrix-types", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add matrix type/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Emergency" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/matrix-types",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Emergency" }),
        })
      )
    );
  });

  it("submits a new department to /api/reference-data with type department", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Department" }));
    fireEvent.click(screen.getByRole("button", { name: /\+ add department/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Legal" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/reference-data",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ type: "department", name: "Legal" }),
        })
      )
    );
  });

  it("closes the modal after a successful submit", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /\+ add matrix type/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Emergency" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });
});

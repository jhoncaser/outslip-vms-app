import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegistrationWizard } from "./RegistrationWizard";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const referenceData = {
  departments: [{ id: "dept_1", name: "ICT" }],
  businessUnits: [{ id: "bu_1", name: "Cawit" }],
  locations: [{ id: "loc_1", name: "Zamboanga" }],
};

describe("RegistrationWizard", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => referenceData,
          });
        }
        if (url === "/api/register") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "new_user_1" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("walks through all 3 steps and submits", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: "CREATOR" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByLabelText(/first name/i);
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Juan" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Dela Cruz" },
    });
    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "IT Officer" },
    });
    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "dept_1" },
    });
    fireEvent.change(screen.getByLabelText(/business unit/i), {
      target: { value: "bu_1" },
    });
    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "loc_1" },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "juan.delacruz@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/review & confirm/i);
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("IT Officer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/register",
        expect.objectContaining({ method: "POST" })
      )
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());

    expect(await screen.findByText(/registration complete/i)).toBeInTheDocument();
    expect(screen.getByText(/juan dela cruz has been registered/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /register another user/i })
    );
    await screen.findByText(/select a role/i);
  });

  it("keeps step 2's Next button disabled until every field is valid", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    fireEvent.change(screen.getByLabelText(/role/i), {
      target: { value: "CREATOR" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByLabelText(/first name/i);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Juan" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Dela Cruz" },
    });
    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "IT Officer" },
    });
    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "dept_1" },
    });
    fireEvent.change(screen.getByLabelText(/business unit/i), {
      target: { value: "bu_1" },
    });
    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "loc_1" },
    });
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "juan.delacruz@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "short" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "supersecure1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "different1" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "supersecure1" },
    });
    expect(nextButton).not.toBeDisabled();
  });
});

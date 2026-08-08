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

function goToPersonalInfo() {
  fireEvent.change(screen.getByLabelText(/role/i), {
    target: { value: "CREATOR" },
  });
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
}

function fillPersonalInfo() {
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: "Juan" },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: "Dela Cruz" },
  });
  fireEvent.change(screen.getByLabelText(/job title/i), {
    target: { value: "IT Officer" },
  });
}

function fillWorkAssignment() {
  fireEvent.change(screen.getByLabelText(/^department$/i), {
    target: { value: "dept_1" },
  });
  fireEvent.change(screen.getByLabelText(/business unit/i), {
    target: { value: "bu_1" },
  });
  fireEvent.change(screen.getByLabelText(/^location$/i), {
    target: { value: "loc_1" },
  });
}

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

  it("walks through all 5 steps and submits", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();

    await screen.findByText(/personal info/i);
    fillPersonalInfo();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/work assignment/i);
    fillWorkAssignment();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/^account$/i);
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

  it("keeps Personal Info's Next button disabled until name and job title are filled", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();

    await screen.findByLabelText(/first name/i);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Juan" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Dela Cruz" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "IT Officer" },
    });
    expect(nextButton).not.toBeDisabled();
  });

  it("keeps Work Assignment's Next button disabled until department, business unit, and location are selected", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();
    await screen.findByText(/personal info/i);
    fillPersonalInfo();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/work assignment/i);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^department$/i), {
      target: { value: "dept_1" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/business unit/i), {
      target: { value: "bu_1" },
    });
    expect(nextButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "loc_1" },
    });
    expect(nextButton).not.toBeDisabled();
  });

  it("keeps Account's Next button disabled until email and password are valid", async () => {
    render(<RegistrationWizard />);

    await screen.findByText(/select a role/i);
    goToPersonalInfo();
    await screen.findByText(/personal info/i);
    fillPersonalInfo();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText(/work assignment/i);
    fillWorkAssignment();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/^account$/i);
    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();

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

describe("RegistrationWizard — edit mode", () => {
  const onDoneMock = vi.fn();
  const existingUser = {
    id: "user_1",
    role: "APPROVER",
    firstName: "Maria",
    middleName: "",
    lastName: "Santos",
    jobTitle: "HR Manager",
    email: "maria.santos@company.com",
    departmentId: "dept_1",
    businessUnitId: "bu_1",
    locationId: "loc_1",
  };

  beforeEach(() => {
    onDoneMock.mockReset();
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
        if (url === "/api/users/user_1" && !init) {
          return Promise.resolve({
            ok: true,
            json: async () => existingUser,
          });
        }
        if (url === "/api/users/user_1" && init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: "user_1" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("loads the existing user, hides password fields, and submits a PATCH", async () => {
    render(<RegistrationWizard userId="user_1" onDone={onDoneMock} />);

    expect(screen.getByText(/loading user/i)).toBeInTheDocument();

    await screen.findByLabelText(/role/i);
    expect(screen.getByLabelText(/role/i)).toHaveValue("APPROVER");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByDisplayValue("Maria");
    expect(screen.getByDisplayValue("Santos")).toBeInTheDocument();
    expect(screen.getByDisplayValue("HR Manager")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/job title/i), {
      target: { value: "Senior HR Manager" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/work assignment/i);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/^account$/i);
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await screen.findByText(/review & confirm/i);
    expect(screen.getByText("Senior HR Manager")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit registration/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/users/user_1",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    const patchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url, init]) => url === "/api/users/user_1" && init?.method === "PATCH"
    );
    const patchBody = JSON.parse(patchCall![1].body as string);
    expect(patchBody).toEqual({
      role: "APPROVER",
      firstName: "Maria",
      middleName: "",
      lastName: "Santos",
      jobTitle: "Senior HR Manager",
      departmentId: "dept_1",
      businessUnitId: "bu_1",
      locationId: "loc_1",
      email: "maria.santos@company.com",
    });
    expect(patchBody.password).toBeUndefined();
    expect(patchBody.confirmPassword).toBeUndefined();
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());

    expect(await screen.findByText(/changes saved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^done$/i }));
    expect(onDoneMock).toHaveBeenCalled();
  });

  it("shows an error if the user fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => referenceData,
          });
        }
        if (url === "/api/users/user_1") {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: "Not found" }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );

    render(<RegistrationWizard userId="user_1" onDone={onDoneMock} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });
});

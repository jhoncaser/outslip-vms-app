import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UsersView, type UserRow } from "./UsersView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const sampleUsers: UserRow[] = [
  {
    id: "u1",
    firstName: "Juan",
    lastName: "Dela Cruz",
    jobTitle: "IT Officer",
    role: "CREATOR",
    department: "ICT",
    businessUnit: "Cawit",
    location: "Zamboanga",
    createdAt: "Jul 18, 2026",
  },
  {
    id: "u2",
    firstName: "Maria",
    lastName: "Santos",
    jobTitle: "HR Manager",
    role: "FIRST_APPROVER",
    department: "Admin",
    businessUnit: "Corporate",
    location: "Navotas",
    createdAt: "Jul 19, 2026",
  },
];

describe("UsersView", () => {
  beforeEach(() => {
    // The wizard inside the modal fetches reference data on mount, and in
    // edit mode also fetches the target user's details.
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/reference-data") {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              departments: [],
              businessUnits: [],
              locations: [],
            }),
          });
        }
        if (url.startsWith("/api/users/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: "u1",
              role: "CREATOR",
              firstName: "Juan",
              middleName: "",
              lastName: "Dela Cruz",
              jobTitle: "IT Officer",
              email: "juan@example.com",
              departmentId: "dept_1",
              businessUnitId: "bu_1",
              locationId: "loc_1",
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("renders all nine column headers", () => {
    render(<UsersView users={sampleUsers} />);
    for (const header of [
      "First Name",
      "Last Name",
      "Job Title",
      "Role",
      "Department",
      "Business Unit",
      "Location",
      "Created",
      "Actions",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: header })
      ).toBeInTheDocument();
    }
  });

  it("renders user rows with role labels, details, and count", () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.getByText("Juan")).toBeInTheDocument();
    expect(screen.getByText("Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("IT Officer")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("1st Level Approver")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Jul 18, 2026")).toBeInTheDocument();
    expect(screen.getByText("2 users")).toBeInTheDocument();
  });

  it("shows the empty state when there are no users", () => {
    render(<UsersView users={[]} />);
    expect(
      screen.getByText(/no users registered yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText("0 users")).toBeInTheDocument();
  });

  it("opens the registration modal and closes it via the Close button", async () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /\+ register user/i })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      await screen.findByText(/select your role/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the modal open on backdrop click and Escape", () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(
      screen.getByRole("button", { name: /\+ register user/i })
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("uses the singular label for exactly one user", () => {
    render(<UsersView users={[sampleUsers[0]]} />);
    expect(screen.getByText("1 user")).toBeInTheDocument();
  });

  it("renders an Edit button for each row", () => {
    render(<UsersView users={sampleUsers} />);
    expect(screen.getAllByRole("button", { name: /^edit$/i })).toHaveLength(2);
  });

  it("opens the edit modal with an EDIT USER header and fetches that row's details", async () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^edit$/i })[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/edit user/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/users/u1")
    );
  });

  it("still shows a REGISTER USER header for the create flow", () => {
    render(<UsersView users={sampleUsers} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ register user/i }));
    expect(screen.getByText(/^register user$/i)).toBeInTheDocument();
  });
});

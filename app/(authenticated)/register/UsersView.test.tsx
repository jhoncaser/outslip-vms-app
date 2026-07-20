import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UsersView, type UserRow } from "./UsersView";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const sampleUsers: UserRow[] = [
  {
    id: "u1",
    firstName: "Juan",
    lastName: "Dela Cruz",
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
    role: "FIRST_APPROVER",
    department: "Admin",
    businessUnit: "Corporate",
    location: "Navotas",
    createdAt: "Jul 19, 2026",
  },
];

describe("UsersView", () => {
  beforeEach(() => {
    // The wizard inside the modal fetches reference data on mount.
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
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
      })
    );
  });

  it("renders all seven column headers", () => {
    render(<UsersView users={sampleUsers} />);
    for (const header of [
      "First Name",
      "Last Name",
      "Role",
      "Department",
      "Business Unit",
      "Location",
      "Created",
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
});

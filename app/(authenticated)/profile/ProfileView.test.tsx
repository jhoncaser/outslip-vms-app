import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileView, type ProfileViewProps } from "./ProfileView";

const sampleProps: ProfileViewProps = {
  fullName: "Juan Dela Cruz",
  initials: "JD",
  jobTitle: "IT Officer",
  roleLabel: "1st Level Approver",
  email: "juan@example.com",
  department: "ICT",
  businessUnit: "Cawit",
  location: "Zamboanga",
  memberSince: "Jul 18, 2026",
};

describe("ProfileView", () => {
  it("renders the banner with full name, initials, job title, and role pill", () => {
    render(<ProfileView {...sampleProps} />);
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("IT Officer")).toBeInTheDocument();
    expect(screen.getByText("1st Level Approver")).toBeInTheDocument();
  });

  it("renders the details grid with email, department, business unit, location, and member-since date", () => {
    render(<ProfileView {...sampleProps} />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("juan@example.com")).toBeInTheDocument();
    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("ICT")).toBeInTheDocument();
    expect(screen.getByText("Business Unit")).toBeInTheDocument();
    expect(screen.getByText("Cawit")).toBeInTheDocument();
    expect(screen.getByText("Location")).toBeInTheDocument();
    expect(screen.getByText("Zamboanga")).toBeInTheDocument();
    expect(screen.getByText("Member Since")).toBeInTheDocument();
    expect(screen.getByText("Jul 18, 2026")).toBeInTheDocument();
  });
});

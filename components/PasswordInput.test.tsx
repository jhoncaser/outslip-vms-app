import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput", () => {
  it("renders as a password field by default", () => {
    render(<PasswordInput id="pw" value="secret" onChange={() => {}} />);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("reveals the value as plain text when the toggle is clicked, and hides it again on a second click", () => {
    render(<PasswordInput id="pw" value="secret" onChange={() => {}} />);
    const input = document.getElementById("pw") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: /show password/i });

    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(input.type).toBe("password");
  });
});

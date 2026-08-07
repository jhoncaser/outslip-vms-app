import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CursorTrail } from "./CursorTrail";

function mockMatchMedia(reduceMotion: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: reduceMotion && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

afterEach(() => {
  cleanup();
  document.querySelectorAll(".cursor-trail-dot").forEach((el) => el.remove());
  vi.unstubAllGlobals();
});

describe("CursorTrail", () => {
  it("spawns a trail dot on mousemove when motion is not reduced", () => {
    mockMatchMedia(false);
    render(<CursorTrail />);

    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 100, clientY: 200 })
    );

    const dots = document.querySelectorAll(".cursor-trail-dot");
    expect(dots.length).toBe(1);
  });

  it("does nothing under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    render(<CursorTrail />);

    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 100, clientY: 200 })
    );

    const dots = document.querySelectorAll(".cursor-trail-dot");
    expect(dots.length).toBe(0);
  });
});

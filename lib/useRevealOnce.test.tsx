import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRevealOnce } from "./useRevealOnce";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: ObserverCallback;
  disconnected = false;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Harness({ onRevealed }: { onRevealed: (r: boolean) => void }) {
  const { ref, revealed } = useRevealOnce<HTMLDivElement>();
  onRevealed(revealed);
  return <div ref={ref} data-testid="target" />;
}

describe("useRevealOnce", () => {
  it("starts unrevealed, then reveals once the element intersects, then disconnects", () => {
    let latestRevealed = false;
    render(<Harness onRevealed={(r) => (latestRevealed = r)} />);

    expect(latestRevealed).toBe(false);

    const observer = FakeIntersectionObserver.instances[0];
    act(() => {
      observer.callback([{ isIntersecting: false }]);
    });
    expect(latestRevealed).toBe(false);

    act(() => {
      observer.callback([{ isIntersecting: true }]);
    });
    expect(latestRevealed).toBe(true);
    expect(observer.disconnected).toBe(true);
  });
});

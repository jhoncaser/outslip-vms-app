import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { TransactionLiveUpdates } from "./TransactionLiveUpdates";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe("TransactionLiveUpdates", () => {
  beforeEach(() => {
    refreshMock.mockClear();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  it("opens a stream to the transactions events endpoint on mount", () => {
    render(<TransactionLiveUpdates />);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/transactions/events");
  });

  it("calls router.refresh() when a message arrives", () => {
    render(<TransactionLiveUpdates />);
    const source = MockEventSource.instances[0];
    source.onmessage?.(new MessageEvent("message", { data: "refresh" }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("closes the stream on unmount", () => {
    const { unmount } = render(<TransactionLiveUpdates />);
    const source = MockEventSource.instances[0];
    expect(source.closed).toBe(false);
    unmount();
    expect(source.closed).toBe(true);
  });
});

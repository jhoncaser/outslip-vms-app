"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TransactionLiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/transactions/events");
    source.onmessage = () => {
      router.refresh();
    };
    return () => {
      source.close();
    };
  }, [router]);

  return null;
}

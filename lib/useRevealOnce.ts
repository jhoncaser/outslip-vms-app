"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals an element once it first scrolls into view, then stays revealed
 * forever (never re-hides on subsequent scrolls) — used for the Deep Forest
 * redesign's entrance animation on cards/tiles/table rows.
 */
export function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, revealed };
}

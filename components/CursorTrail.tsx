"use client";

import { useEffect, useRef } from "react";

const DOT_SIZES = [7, 9, 12, 15, 19];
const SPAWN_THROTTLE_MS = 35;
const DOT_LIFETIME_MS = 600;

/**
 * Global mouse-trail effect for the Deep Forest redesign — mounted once in
 * the root layout. Renders nothing itself; spawns short-lived glowing dots
 * directly on document.body as the mouse moves.
 */
export function CursorTrail() {
  const lastSpawnRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;

    function handleMouseMove(event: MouseEvent) {
      const now = performance.now();
      if (now - lastSpawnRef.current < SPAWN_THROTTLE_MS) return;
      lastSpawnRef.current = now;

      const size = DOT_SIZES[Math.floor(Math.random() * DOT_SIZES.length)];
      const dot = document.createElement("div");
      dot.className = "cursor-trail-dot";
      dot.style.left = `${event.clientX}px`;
      dot.style.top = `${event.clientY}px`;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      document.body.appendChild(dot);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          dot.classList.add("cursor-trail-dot-fade");
        });
      });

      setTimeout(() => dot.remove(), DOT_LIFETIME_MS);
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return null;
}

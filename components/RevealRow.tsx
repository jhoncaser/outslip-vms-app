"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useRevealOnce } from "@/lib/useRevealOnce";
import { tableRow } from "@/lib/deepForest";

type RevealRowProps = {
  index: number;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"tr">, "className" | "children">;

/**
 * A <tr> that fades/slides in the first time it scrolls into view, then
 * stays visible on every later scroll (Deep Forest's "reveal once" table
 * animation). Also applies the shared zebra-striping from tableRow(index).
 */
export function RevealRow({ index, className, children, ...rest }: RevealRowProps) {
  const { ref, revealed } = useRevealOnce<HTMLTableRowElement>();

  return (
    <tr
      ref={ref}
      className={`reveal-once ${revealed ? "is-revealed" : ""} ${tableRow(index)} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </tr>
  );
}

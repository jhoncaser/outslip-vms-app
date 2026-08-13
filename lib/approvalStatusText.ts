const LEVEL_LABELS: Record<number, string> = {
  1: "1st Level",
  2: "2nd Level",
  3: "3rd Level",
};

export function formatApprovalStatusText(
  statusName: string,
  pendingLevel: number | null
): string {
  if (statusName !== "Open" || pendingLevel === null) {
    return statusName;
  }

  const levelLabel = LEVEL_LABELS[pendingLevel] ?? `Level ${pendingLevel}`;
  return `Waiting to be approved in ${levelLabel}`;
}

export type ApprovalStatusHue = "slate" | "red" | "green";

export function getApprovalStatusHue(
  statusName: string,
  pendingLevel: number | null
): ApprovalStatusHue {
  if (statusName === "Approved") return "green";
  if (statusName === "Open" && pendingLevel !== null) return "red";
  if (statusName === "Cancelled") return "red";
  return "slate";
}

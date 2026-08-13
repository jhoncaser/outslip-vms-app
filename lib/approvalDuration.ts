export function formatApprovalDuration(fromMs: number, toMs: number): string {
  const totalSeconds = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}D : ${hours}H`;
  if (hours > 0) return `${hours}H : ${minutes}M`;
  return `${minutes}M : ${seconds}S`;
}

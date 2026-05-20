/**
 * Indonesian-language relative time. Bounded to "baru saja" (< 60s) and "N hari lalu"
 * (>= 1 day); the history slice never spans long enough to need months.
 */
export function formatRelativeID(epochMs: number, now: number = Date.now()): string {
  const diffMs = now - epochMs;
  if (diffMs < 60_000) return "baru saja";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

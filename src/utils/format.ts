import { formatDistanceToNow, format } from "date-fns";

export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

export function formatAbsoluteTime(timestamp: number): string {
  return format(new Date(timestamp), "MMM d, yyyy · h:mm a");
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function formatTokensPerSecond(tps: number): string {
  return `${tps.toFixed(1)} tok/s`;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

export function formatModelSize(paramSize: string): string {
  return paramSize.replace(/(\d+)([BbMm])/, (_, n, unit) => `${n}${unit.toUpperCase()}`);
}

export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

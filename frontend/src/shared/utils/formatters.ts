export function formatDateTime(value: string | null | undefined, fallback = "Nunca") {
  return value ? new Date(value).toLocaleString() : fallback;
}

export function formatFileSizeInKilobytes(bytes: number) {
  return `${new Intl.NumberFormat("es-EC").format(Math.ceil(bytes / 1024))} KB`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-EC").format(value);
}

export function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) return "En curso";
  if (milliseconds < 1000) return `${String(milliseconds)} ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)} s`;
  return `${String(Math.floor(milliseconds / 60_000))} min ${String(Math.round((milliseconds % 60_000) / 1000))} s`;
}

export function formatRelativeDate(value: string) {
  const difference = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (absolute < 60_000) return "Ahora";
  if (absolute < 3_600_000) return formatter.format(Math.round(difference / 60_000), "minute");
  if (absolute < 86_400_000) return formatter.format(Math.round(difference / 3_600_000), "hour");
  if (absolute < 604_800_000) return formatter.format(Math.round(difference / 86_400_000), "day");
  return formatDateTime(value);
}

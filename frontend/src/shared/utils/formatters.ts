export function formatDateTime(value: string | null | undefined, fallback = "Nunca") {
  return value ? new Date(value).toLocaleString() : fallback;
}

export function formatFileSizeInKilobytes(bytes: number) {
  return `${new Intl.NumberFormat("es-EC").format(Math.ceil(bytes / 1024))} KB`;
}

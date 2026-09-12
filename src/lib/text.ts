/** Lowercase, accent-stripped, whitespace-collapsed text for search and ESC/POS output. */
export function normalizeText(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip accents but keep case (for thermal printers that only speak ASCII). */
export function toAscii(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ñ]/g, "n")
    .replace(/[Ñ]/g, "N")
    .replace(/[·•]/g, "-")
    .replace(/[^\x20-\x7e\n]/g, "?");
}

export function normalizeEmail(email: string | null | undefined): string | undefined {
  const e = (email ?? "").trim().toLowerCase();
  return e.length ? e : undefined;
}

export function formatLocalTime(iso: string | undefined, timeZone: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toTimeString().slice(0, 5);
  }
}

export function formatLocalDateTime(iso: string | undefined, timeZone: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

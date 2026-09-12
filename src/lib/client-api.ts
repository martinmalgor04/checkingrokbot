import type { CheckInResponse, EventConfig, Guest, ImportPreview, ImportSummary, PrintResult, Stats } from "./types";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) || res.statusText;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  search: (q: string) => request<{ guests: Guest[] }>(`/api/guests?q=${encodeURIComponent(q)}`),
  list: (filter: string, q: string) =>
    request<{ guests: Guest[] }>(`/api/guests?list=1&filter=${filter}&q=${encodeURIComponent(q)}`),
  stats: () => request<Stats>("/api/guests/stats"),
  checkIn: (id: string, force = false) => request<CheckInResponse>(`/api/guests/${id}/check-in`, json({ force })),
  undo: (id: string) => request<{ guest: Guest }>(`/api/guests/${id}/undo`, json({})),
  print: (id: string, reprint: boolean) =>
    request<{ guest: Guest; print: PrintResult }>(`/api/guests/${id}/print`, json({ reprint })),
  walkIn: (body: { fullName: string; email?: string; note?: string }) =>
    request<CheckInResponse>("/api/guests/walk-in", json(body)),
  settings: () => request<EventConfig>("/api/settings"),
  saveSettings: (patch: Partial<EventConfig>) =>
    request<EventConfig>("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }),
  printers: (driver: string) => request<{ devices: { id: string; name: string; status?: string }[] }>(`/api/printers?driver=${driver}`),
  testPrint: () => request<PrintResult>("/api/printers/test", { method: "POST" }),
  importPreview: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<ImportPreview>("/api/import/preview", { method: "POST", body: fd });
  },
  importApply: (file: File, mapping: Record<string, string | undefined>, includePending: boolean, markMissing: boolean) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(mapping));
    fd.append("includePending", String(includePending));
    fd.append("markMissingAsCancelled", String(markMissing));
    return request<ImportSummary>("/api/import/apply", { method: "POST", body: fd });
  },
  reset: () => request<{ ok: boolean }>("/api/admin/reset", json({ confirm: "BORRAR" })),
};

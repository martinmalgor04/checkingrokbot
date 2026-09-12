import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { normalizeText } from "./text";
import type { AuditAction, AuditLog, Guest, Stats } from "./types";

interface GuestRow {
  id: string;
  luma_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  ticket_type: string | null;
  luma_status: string | null;
  custom_fields: string | null;
  is_walk_in: number;
  cancelled_in_luma: number;
  checked_in: number;
  checked_in_at: string | null;
  printed_count: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

function rowToGuest(r: GuestRow): Guest {
  return {
    id: r.id,
    lumaId: r.luma_id ?? undefined,
    fullName: r.full_name,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    ticketType: r.ticket_type ?? undefined,
    lumaStatus: r.luma_status ?? undefined,
    customFields: r.custom_fields ? JSON.parse(r.custom_fields) : undefined,
    isWalkIn: !!r.is_walk_in,
    cancelledInLuma: !!r.cancelled_in_luma,
    checkedIn: !!r.checked_in,
    checkedInAt: r.checked_in_at ?? undefined,
    printedCount: r.printed_count,
    note: r.note ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function buildSearchText(g: {
  fullName: string;
  email?: string;
  lumaId?: string;
  phone?: string;
}): string {
  return normalizeText([g.fullName, g.email, g.lumaId, g.phone].filter(Boolean).join(" "));
}

export function logAudit(
  guestId: string | null,
  action: AuditAction,
  meta?: Record<string, unknown>,
) {
  getDb()
    .prepare("INSERT INTO audit_log (id, guest_id, action, at, meta) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), guestId, action, new Date().toISOString(), meta ? JSON.stringify(meta) : null);
}

export function getGuest(id: string): Guest | undefined {
  const row = getDb().prepare("SELECT * FROM guests WHERE id = ?").get(id) as GuestRow | undefined;
  return row ? rowToGuest(row) : undefined;
}

export function searchGuests(query: string, limit = 10): Guest[] {
  const tokens = normalizeText(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const where = tokens.map(() => "search_text LIKE ?").join(" AND ");
  const params = tokens.map((t) => `%${t.replace(/[%_]/g, "")}%`);
  const rows = getDb()
    .prepare(
      `SELECT * FROM guests WHERE ${where}
       ORDER BY checked_in ASC, cancelled_in_luma ASC, full_name COLLATE NOCASE ASC
       LIMIT ?`,
    )
    .all(...params, limit) as GuestRow[];
  return rows.map(rowToGuest);
}

export type ListFilter = "all" | "checked_in" | "pending" | "walk_in" | "cancelled";

export function listGuests(filter: ListFilter = "all", query = ""): Guest[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter === "checked_in") clauses.push("checked_in = 1");
  if (filter === "pending") clauses.push("checked_in = 0 AND cancelled_in_luma = 0");
  if (filter === "walk_in") clauses.push("is_walk_in = 1");
  if (filter === "cancelled") clauses.push("cancelled_in_luma = 1");
  for (const t of normalizeText(query).split(" ").filter(Boolean)) {
    clauses.push("search_text LIKE ?");
    params.push(`%${t.replace(/[%_]/g, "")}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`SELECT * FROM guests ${where} ORDER BY checked_in_at DESC, full_name COLLATE NOCASE ASC`)
    .all(...params) as GuestRow[];
  return rows.map(rowToGuest);
}

export function getStats(): Stats {
  const row = getDb()
    .prepare(
      `SELECT
        SUM(CASE WHEN cancelled_in_luma = 0 THEN 1 ELSE 0 END) AS registered,
        SUM(checked_in) AS checked_in,
        SUM(is_walk_in) AS walk_ins,
        SUM(cancelled_in_luma) AS cancelled
       FROM guests`,
    )
    .get() as { registered: number | null; checked_in: number | null; walk_ins: number | null; cancelled: number | null };
  return {
    registered: row.registered ?? 0,
    checkedIn: row.checked_in ?? 0,
    walkIns: row.walk_ins ?? 0,
    cancelled: row.cancelled ?? 0,
  };
}

export function checkInGuest(id: string, opts: { force?: boolean } = {}): Guest {
  const guest = getGuest(id);
  if (!guest) throw new Error("Invitado no encontrado");
  if (guest.checkedIn) return guest;
  if (guest.cancelledInLuma && !opts.force) {
    throw new Error("Este invitado figura cancelado en Luma; confirmá el check-in manual.");
  }
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE guests SET checked_in = 1, checked_in_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);
  logAudit(id, "check_in", { forced: !!opts.force });
  return getGuest(id)!;
}

export function undoCheckIn(id: string): Guest {
  const guest = getGuest(id);
  if (!guest) throw new Error("Invitado no encontrado");
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE guests SET checked_in = 0, checked_in_at = NULL, updated_at = ? WHERE id = ?")
    .run(now, id);
  logAudit(id, "undo_check_in", { previousCheckedInAt: guest.checkedInAt });
  return getGuest(id)!;
}

export function bumpPrinted(id: string, reprint: boolean) {
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE guests SET printed_count = printed_count + 1, updated_at = ? WHERE id = ?")
    .run(now, id);
  if (reprint) logAudit(id, "reprint", { reprintedAt: now });
}

export function createWalkIn(input: { fullName: string; email?: string; note?: string }): Guest {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("El nombre es obligatorio");
  const now = new Date().toISOString();
  const id = randomUUID();
  const email = input.email?.trim().toLowerCase() || undefined;
  getDb()
    .prepare(
      `INSERT INTO guests (id, full_name, email, ticket_type, is_walk_in, checked_in, checked_in_at,
        note, search_text, created_at, updated_at)
       VALUES (?, ?, ?, 'Walk-in', 1, 1, ?, ?, ?, ?, ?)`,
    )
    .run(id, fullName, email ?? null, now, input.note?.trim() || null, buildSearchText({ fullName, email }), now, now);
  logAudit(id, "walk_in_create", { email });
  logAudit(id, "check_in", { walkIn: true });
  return getGuest(id)!;
}

export function getAuditForGuest(id: string): AuditLog[] {
  const rows = getDb()
    .prepare("SELECT * FROM audit_log WHERE guest_id = ? ORDER BY at DESC")
    .all(id) as { id: string; guest_id: string | null; action: AuditAction; at: string; meta: string | null }[];
  return rows.map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    action: r.action,
    at: r.at,
    meta: r.meta ? JSON.parse(r.meta) : undefined,
  }));
}

export function resetAllData() {
  const db = getDb();
  db.exec("DELETE FROM guests; DELETE FROM audit_log;");
}

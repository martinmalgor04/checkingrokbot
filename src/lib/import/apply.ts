import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import { buildSearchText, logAudit } from "../guests";
import { normalizeEmail } from "../text";
import type { ColumnMapping, ImportField, ImportSummary } from "../types";

const INCLUDED_STATUSES = new Set(["approved", "registered", "going", "confirmed", "yes", "checked in", ""]);
const PENDING_STATUSES = new Set(["pending", "pending_approval", "pending approval", "waitlist", "waitlisted"]);

interface NormalizedRow {
  fullName: string;
  email?: string;
  phone?: string;
  ticketType?: string;
  status?: string;
  lumaId?: string;
  customFields: Record<string, string>;
}

function pick(row: Record<string, string>, mapping: ColumnMapping, field: ImportField): string | undefined {
  const col = mapping[field];
  if (!col) return undefined;
  const v = row[col];
  return v === undefined || v === null || String(v).trim() === "" ? undefined : String(v).trim();
}

export function normalizeRow(row: Record<string, string>, mapping: ColumnMapping): NormalizedRow | null {
  let fullName = pick(row, mapping, "full_name");
  const first = pick(row, mapping, "first_name");
  const last = pick(row, mapping, "last_name");
  if (!fullName && (first || last)) fullName = [first, last].filter(Boolean).join(" ");
  const email = normalizeEmail(pick(row, mapping, "email"));
  if (!fullName && email) fullName = email.split("@")[0];
  if (!fullName) return null;

  const mappedCols = new Set(Object.values(mapping).filter(Boolean) as string[]);
  const customFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!mappedCols.has(k) && v !== undefined && String(v).trim() !== "") customFields[k] = String(v).trim();
  }

  return {
    fullName,
    email,
    phone: pick(row, mapping, "phone"),
    ticketType: pick(row, mapping, "ticket_type"),
    status: pick(row, mapping, "status")?.toLowerCase(),
    lumaId: pick(row, mapping, "luma_id"),
    customFields,
  };
}

export function applyImport(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  options: { includePending: boolean; markMissingAsCancelled: boolean },
): ImportSummary {
  const db = getDb();
  const summary: ImportSummary = {
    created: 0,
    updated: 0,
    preservedCheckIns: 0,
    cancelled: 0,
    skippedByStatus: 0,
    duplicates: 0,
    warnings: [],
  };

  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  const now = new Date().toISOString();

  const findByLumaId = db.prepare("SELECT id, checked_in FROM guests WHERE luma_id = ? AND is_walk_in = 0");
  const findByEmail = db.prepare("SELECT id, checked_in FROM guests WHERE lower(email) = ? AND is_walk_in = 0");
  const findByName = db.prepare(
    "SELECT id, checked_in FROM guests WHERE email IS NULL AND lower(full_name) = lower(?) AND is_walk_in = 0",
  );
  const insert = db.prepare(
    `INSERT INTO guests (id, luma_id, full_name, email, phone, ticket_type, luma_status, custom_fields,
      is_walk_in, cancelled_in_luma, checked_in, printed_count, search_text, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE guests SET luma_id = COALESCE(?, luma_id), full_name = ?, email = COALESCE(?, email), phone = ?,
      ticket_type = ?, luma_status = ?, custom_fields = ?, cancelled_in_luma = 0, search_text = ?, updated_at = ?
     WHERE id = ?`,
  );

  const run = db.transaction(() => {
    for (const raw of rows) {
      const r = normalizeRow(raw, mapping);
      if (!r) continue;

      const status = r.status ?? "";
      const isPending = PENDING_STATUSES.has(status);
      if (!(INCLUDED_STATUSES.has(status) || (options.includePending && isPending))) {
        summary.skippedByStatus++;
        continue;
      }

      const dedupeKey = r.email ?? `name:${r.fullName.toLowerCase()}`;
      if (r.email ? seenEmails.has(r.email) : seenNames.has(dedupeKey)) {
        summary.duplicates++;
        continue;
      }
      if (r.email) seenEmails.add(r.email);
      else {
        seenNames.add(dedupeKey);
        summary.warnings.push(`"${r.fullName}" no tiene email; se deduplicó por nombre.`);
      }

      let existing: { id: string; checked_in: number } | undefined;
      if (r.lumaId) existing = findByLumaId.get(r.lumaId) as typeof existing;
      if (!existing && r.email) existing = findByEmail.get(r.email) as typeof existing;
      if (!existing && !r.email) existing = findByName.get(r.fullName) as typeof existing;

      const searchText = buildSearchText(r);
      const custom = Object.keys(r.customFields).length ? JSON.stringify(r.customFields) : null;

      if (existing) {
        update.run(
          r.lumaId ?? null,
          r.fullName,
          r.email ?? null,
          r.phone ?? null,
          r.ticketType ?? null,
          r.status ?? null,
          custom,
          searchText,
          now,
          existing.id,
        );
        seenIds.add(existing.id);
        summary.updated++;
        if (existing.checked_in) summary.preservedCheckIns++;
      } else {
        const id = randomUUID();
        insert.run(
          id,
          r.lumaId ?? null,
          r.fullName,
          r.email ?? null,
          r.phone ?? null,
          r.ticketType ?? null,
          r.status ?? null,
          custom,
          searchText,
          now,
          now,
        );
        seenIds.add(id);
        summary.created++;
      }
    }

    if (options.markMissingAsCancelled && seenIds.size > 0) {
      const all = db.prepare("SELECT id FROM guests WHERE is_walk_in = 0 AND cancelled_in_luma = 0").all() as { id: string }[];
      const cancel = db.prepare("UPDATE guests SET cancelled_in_luma = 1, updated_at = ? WHERE id = ?");
      for (const g of all) {
        if (!seenIds.has(g.id)) {
          cancel.run(now, g.id);
          summary.cancelled++;
        }
      }
    }

    logAudit(null, "import", {
      created: summary.created,
      updated: summary.updated,
      cancelled: summary.cancelled,
      skippedByStatus: summary.skippedByStatus,
      duplicates: summary.duplicates,
      rows: rows.length,
    });
  });

  run();
  if (summary.warnings.length > 5) {
    const extra = summary.warnings.length - 5;
    summary.warnings = [...summary.warnings.slice(0, 5), `…y ${extra} advertencia(s) más.`];
  }
  return summary;
}

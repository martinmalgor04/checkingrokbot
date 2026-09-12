import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const TICKETS_DIR = path.join(DATA_DIR, "tickets");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  luma_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  ticket_type TEXT,
  luma_status TEXT,
  custom_fields TEXT,
  is_walk_in INTEGER NOT NULL DEFAULT 0,
  cancelled_in_luma INTEGER NOT NULL DEFAULT 0,
  checked_in INTEGER NOT NULL DEFAULT 0,
  checked_in_at TEXT,
  printed_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  search_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
CREATE INDEX IF NOT EXISTS idx_guests_luma_id ON guests(luma_id);
CREATE INDEX IF NOT EXISTS idx_guests_checked_in ON guests(checked_in);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  guest_id TEXT,
  action TEXT NOT NULL,
  at TEXT NOT NULL,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_guest ON audit_log(guest_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

declare global {
  var __checkinDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (globalThis.__checkinDb) return globalThis.__checkinDb;
  fs.mkdirSync(TICKETS_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "checkin.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(SCHEMA);
  globalThis.__checkinDb = db;
  return db;
}

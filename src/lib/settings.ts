import { getDb } from "./db";
import type { ColumnMapping, EventConfig } from "./types";

export const DEFAULT_CONFIG: EventConfig = {
  id: "grok-bot-meetup-ctes-2026",
  name: "GROK BOT MEETUP",
  date: "2026-09-16",
  venue: "Parque Tec UNNE",
  ticketHeader: "Corrientes\n16 Sep 2026 · Parque Tec UNNE",
  ticketFooter: "SpaceX AI · xAI / Grok\nQue disfrutes el meetup",
  welcomeText: "Bienvenido/a",
  autoPrint: true,
  printerDriver: "mock",
  printerDeviceId: undefined,
  feedBefore: 0,
  feedAfter: 3,
  cutPaper: true,
  soundOnCheckIn: true,
  timeZone: "America/Argentina/Buenos_Aires",
};

function readSetting<T>(key: string): T | undefined {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

function writeSetting(key: string, value: unknown) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, JSON.stringify(value));
}

export function getConfig(): EventConfig {
  const stored = readSetting<Partial<EventConfig>>("event_config") ?? {};
  return { ...DEFAULT_CONFIG, ...stored };
}

export function saveConfig(patch: Partial<EventConfig>): EventConfig {
  const next = { ...getConfig(), ...patch };
  writeSetting("event_config", next);
  return next;
}

export function mappingKey(headers: string[]): string {
  return "mapping:" + headers.map((h) => h.trim().toLowerCase()).sort().join("|");
}

export function getSavedMapping(headers: string[]): ColumnMapping | undefined {
  return readSetting<ColumnMapping>(mappingKey(headers));
}

export function saveMapping(headers: string[], mapping: ColumnMapping) {
  writeSetting(mappingKey(headers), mapping);
}

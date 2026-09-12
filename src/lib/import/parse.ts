import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ColumnMapping, ImportField } from "../types";

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

const HEADER_CANDIDATES: Record<ImportField, string[]> = {
  full_name: ["name", "full_name", "full name", "guest name", "nombre", "nombre completo", "attendee name"],
  first_name: ["first_name", "first name", "nombre de pila", "given name"],
  last_name: ["last_name", "last name", "apellido", "surname", "family name"],
  email: ["email", "email address", "e-mail", "correo", "mail", "guest email"],
  ticket_type: ["ticket_type", "ticket type", "ticket name", "ticket", "tipo de ticket", "ticket_name"],
  status: ["approval_status", "status", "approval status", "estado", "registration status"],
  luma_id: ["api_id", "guest_id", "id", "luma_id", "guest id", "ticket_key", "ticket key"],
  phone: ["phone", "phone number", "phone_number", "telefono", "teléfono", "celular", "mobile"],
};

function decodeCsv(buffer: Buffer): { text: string; warning?: string } {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("\uFFFD")) return { text: utf8.replace(/^\uFEFF/, "") };
  const latin1 = new TextDecoder("latin1").decode(buffer);
  return { text: latin1, warning: "El CSV no era UTF-8 válido; se leyó como Latin-1." };
}

export function parseUploadedFile(filename: string, buffer: Buffer): ParsedFile {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const warnings: string[] = [];

  let rows: Record<string, string>[] = [];
  let headers: string[] = [];

  if (ext === "xlsx" || ext === "xls") {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("El Excel no tiene hojas");
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    rows = raw.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim(), String(v ?? "").trim()])),
    );
    headers = rows.length ? Object.keys(rows[0]) : [];
    if (wb.SheetNames.length > 1) warnings.push(`Se usó la primera hoja ("${sheetName}").`);
  } else if (ext === "csv" || ext === "txt") {
    const { text, warning } = decodeCsv(buffer);
    if (warning) warnings.push(warning);
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      transform: (v) => (typeof v === "string" ? v.trim() : v),
    });
    if (result.errors.length) {
      warnings.push(`${result.errors.length} fila(s) con errores de formato fueron ignoradas.`);
    }
    rows = result.data;
    headers = (result.meta.fields ?? []).filter(Boolean);
  } else {
    throw new Error("Formato no soportado. Usá .csv, .xlsx o .xls");
  }

  headers = headers.filter((h) => h.length > 0);
  return { headers, rows, warnings };
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const lower = headers.map((h) => h.toLowerCase().trim());

  for (const field of Object.keys(HEADER_CANDIDATES) as ImportField[]) {
    for (const candidate of HEADER_CANDIDATES[field]) {
      const idx = lower.indexOf(candidate);
      if (idx >= 0 && !used.has(headers[idx])) {
        mapping[field] = headers[idx];
        used.add(headers[idx]);
        break;
      }
    }
  }
  return mapping;
}

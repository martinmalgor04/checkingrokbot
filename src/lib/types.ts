export interface EventConfig {
  id: string;
  name: string;
  date: string;
  venue: string;
  ticketHeader: string;
  ticketFooter: string;
  welcomeText: string;
  autoPrint: boolean;
  printerDriver: "mock" | "cups";
  printerDeviceId?: string;
  feedBefore: number;
  feedAfter: number;
  cutPaper: boolean;
  soundOnCheckIn: boolean;
  timeZone: string;
}

export interface Guest {
  id: string;
  lumaId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  ticketType?: string;
  lumaStatus?: string;
  customFields?: Record<string, string>;
  isWalkIn: boolean;
  cancelledInLuma: boolean;
  checkedIn: boolean;
  checkedInAt?: string;
  printedCount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction =
  | "check_in"
  | "undo_check_in"
  | "reprint"
  | "walk_in_create"
  | "import";

export interface AuditLog {
  id: string;
  guestId: string | null;
  action: AuditAction;
  at: string;
  meta?: Record<string, unknown>;
}

export interface Stats {
  registered: number;
  checkedIn: number;
  walkIns: number;
  cancelled: number;
}

export const IMPORT_FIELDS = [
  "full_name",
  "first_name",
  "last_name",
  "email",
  "ticket_type",
  "status",
  "luma_id",
  "phone",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export type ColumnMapping = Partial<Record<ImportField, string>>;

export interface ImportPreview {
  headers: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
  suggestedMapping: ColumnMapping;
  savedMapping: boolean;
  warnings: string[];
}

export interface ImportSummary {
  created: number;
  updated: number;
  preservedCheckIns: number;
  cancelled: number;
  skippedByStatus: number;
  duplicates: number;
  warnings: string[];
}

export interface PrintResult {
  ok: boolean;
  driver: string;
  error?: string;
  preview: string;
}

export interface CheckInResponse {
  guest: Guest;
  print?: PrintResult;
}

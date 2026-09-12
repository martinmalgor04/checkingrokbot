import { formatLocalTime, toAscii } from "../text";
import type { EventConfig, Guest } from "../types";

export const TICKET_COLS = 32;

export type TicketStyle = "normal" | "bold" | "big" | "big-bold";

export interface TicketLine {
  text: string;
  align?: "left" | "center";
  style?: TicketStyle;
}

export interface TicketModel {
  lines: TicketLine[];
  feedBefore: number;
  feedAfter: number;
  cut: boolean;
}

function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const word = w.length > cols ? w.slice(0, cols) : w;
      if ((line + " " + word).trim().length > cols) {
        out.push(line);
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) out.push(line);
  }
  return out;
}

const RULE_DOUBLE = "=".repeat(TICKET_COLS);
const RULE_SINGLE = "-".repeat(TICKET_COLS);

export function buildTicket(guest: Guest, config: EventConfig, opts: { reprint?: boolean; test?: boolean } = {}): TicketModel {
  const lines: TicketLine[] = [];
  const push = (text: string, align: "left" | "center" = "left", style: TicketStyle = "normal") =>
    lines.push({ text, align, style });

  push(RULE_DOUBLE);
  for (const l of wrap(config.name, TICKET_COLS / 2)) push(l, "center", "big-bold");
  for (const l of wrap(config.ticketHeader, TICKET_COLS)) push(l, "center");
  push(RULE_DOUBLE);
  push("");
  push(config.welcomeText, "center");
  push("");
  // Big font halves the available columns.
  for (const l of wrap(guest.fullName.toUpperCase(), TICKET_COLS / 2)) push(l, "center", "big-bold");
  push("");
  push(`Tipo: ${guest.isWalkIn ? "Walk-in" : guest.ticketType || "General"}`, "center");
  push(`Check-in: ${formatLocalTime(guest.checkedInAt ?? new Date().toISOString(), config.timeZone)}`, "center");
  if (opts.reprint) push("(reimpresion)", "center");
  if (opts.test) push("*** TICKET DE PRUEBA ***", "center", "bold");
  push("");
  push(RULE_SINGLE);
  for (const l of wrap(config.ticketFooter, TICKET_COLS)) push(l, "center");
  push(RULE_DOUBLE);

  return { lines, feedBefore: config.feedBefore, feedAfter: config.feedAfter, cut: config.cutPaper };
}

/** Plain-text rendering (used by MockPrinter and the on-screen preview). */
export function renderTicketText(ticket: TicketModel): string {
  const out: string[] = [];
  for (let i = 0; i < ticket.feedBefore; i++) out.push("");
  for (const line of ticket.lines) {
    const isBig = line.style === "big" || line.style === "big-bold";
    const width = isBig ? TICKET_COLS / 2 : TICKET_COLS;
    let text = line.text.slice(0, width);
    if (line.align === "center") {
      const pad = Math.max(0, Math.floor((width - text.length) / 2));
      text = " ".repeat(pad) + text;
    }
    if (isBig) {
      text = text
        .split("")
        .map((c) => (c === " " ? "  " : c + " "))
        .join("")
        .trimEnd();
    }
    out.push(text);
  }
  for (let i = 0; i < ticket.feedAfter; i++) out.push("");
  if (ticket.cut) out.push("- - - - - - - - ✂ - - - - - - - -");
  return out.join("\n");
}

const ESC = 0x1b;
const GS = 0x1d;

/** Build raw ESC/POS bytes for a 58 mm printer (32 columns at Font A). */
export function renderEscPos(ticket: TicketModel): Buffer {
  const chunks: Buffer[] = [];
  const b = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
  const t = (text: string) => chunks.push(Buffer.from(toAscii(text), "ascii"));

  b(ESC, 0x40); // init
  b(ESC, 0x74, 0x00); // code page PC437
  for (let i = 0; i < ticket.feedBefore; i++) b(0x0a);

  let currentAlign: "left" | "center" = "left";
  for (const line of ticket.lines) {
    const align = line.align ?? "left";
    if (align !== currentAlign) {
      b(ESC, 0x61, align === "center" ? 0x01 : 0x00);
      currentAlign = align;
    }
    const style = line.style ?? "normal";
    const bold = style === "bold" || style === "big-bold";
    const big = style === "big" || style === "big-bold";
    b(ESC, 0x45, bold ? 0x01 : 0x00);
    b(GS, 0x21, big ? 0x11 : 0x00);
    t(line.text);
    b(0x0a);
  }
  b(ESC, 0x45, 0x00);
  b(GS, 0x21, 0x00);
  b(ESC, 0x61, 0x00);
  for (let i = 0; i < ticket.feedAfter; i++) b(0x0a);
  if (ticket.cut) b(GS, 0x56, 0x42, 0x00); // partial cut with feed
  return Buffer.concat(chunks);
}

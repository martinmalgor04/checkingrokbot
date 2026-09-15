import { toAscii } from "../text";
import type { EventConfig, Guest } from "../types";
import { GROKBOT_LOGO_HEIGHT, GROKBOT_LOGO_WIDTH, grokbotLogoRaster } from "./logos";

export const TICKET_COLS = 32;

export type TicketStyle = "normal" | "bold" | "big" | "big-bold";

export interface TicketLine {
  text: string;
  align?: "left" | "center";
  style?: TicketStyle;
}

export interface TicketRaster {
  width: number;
  height: number;
  data: Buffer;
  /** GS v 0 m: 0 normal, 1 double-width, 2 double-height, 3 both. */
  mode?: 0 | 1 | 2 | 3;
}

export interface TicketModel {
  lines: TicketLine[];
  headerLogo?: TicketRaster;
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatEventDate(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return `${MONTHS[month - 1] ?? m[2]} ${day}, ${year}`;
}

function formatPrintTime(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toTimeString().slice(0, 5);
  }
}

const RULE = "=".repeat(TICKET_COLS);

export function buildTicket(guest: Guest, config: EventConfig, opts: { reprint?: boolean; test?: boolean } = {}): TicketModel {
  const lines: TicketLine[] = [];
  const push = (text: string, align: "left" | "center" = "left", style: TicketStyle = "normal") => {
    for (const l of wrap(text, TICKET_COLS)) lines.push({ text: l, align, style });
  };

  const printedAt = new Date().toISOString();

  push("");
  push("Grok Bot Meetup", "center", "bold");
  push("Resistencia", "center");
  push(RULE);
  push(`From: ${guest.fullName}`);
  push(`Date: ${formatEventDate(config.date)}`);
  push(`Time: ${formatPrintTime(printedAt, config.timeZone)}`);
  if (opts.test) push("*** TEST TICKET ***", "left", "bold");
  push(RULE);
  push("Message:");
  push("Gracias por venir!");
  push("");

  return {
    lines,
    headerLogo: { width: GROKBOT_LOGO_WIDTH, height: GROKBOT_LOGO_HEIGHT, data: grokbotLogoRaster() },
    feedBefore: config.feedBefore,
    feedAfter: config.feedAfter,
    cut: config.cutPaper,
  };
}

/** Plain-text rendering (used by MockPrinter and the on-screen preview). */
export function renderTicketText(ticket: TicketModel): string {
  const out: string[] = [];
  for (let i = 0; i < ticket.feedBefore; i++) out.push("");
  if (ticket.headerLogo) {
    out.push("[logo grokbot]");
    out.push("");
  }
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
  b(ESC, 0x32); // default line spacing
  for (let i = 0; i < ticket.feedBefore; i++) b(0x0a);

  if (ticket.headerLogo) {
    b(ESC, 0x61, 0x01);
    chunks.push(renderEscPosRaster(ticket.headerLogo));
    b(0x0a);
    b(ESC, 0x40); // cheap POS58 stays in graphics mode unless re-inited
    b(ESC, 0x74, 0x00);
    b(ESC, 0x32);
  }

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
  b(ESC, 0x4a, 48);
  if (ticket.cut) b(GS, 0x56, 0x42, 0x00);
  return Buffer.concat(chunks);
}

/** GS v 0 — raster bit image. 1 = print (black). Width must be a multiple of 8. */
function renderEscPosRaster(img: TicketRaster): Buffer {
  const widthBytes = Math.floor(img.width / 8);
  let height = img.height;
  let data = img.data;
  const expected = widthBytes * height;
  if (data.length < expected) {
    data = Buffer.concat([data, Buffer.alloc(expected - data.length)]);
  } else if (data.length > expected) {
    data = data.subarray(0, expected);
  }
  // POS58 clones eat following text unless height is a multiple of 24.
  const rem = height % 24;
  if (rem !== 0) {
    const extra = 24 - rem;
    data = Buffer.concat([data, Buffer.alloc(widthBytes * extra)]);
    height += extra;
  }
  const header = Buffer.from([
    GS,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ]);
  return Buffer.concat([header, data]);
}

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { TICKETS_DIR } from "../db";
import type { EventConfig, PrintResult } from "../types";
import { renderEscPos, renderTicketText, type TicketModel } from "./ticket";

const execFileAsync = promisify(execFile);

export interface PrinterDevice {
  id: string;
  name: string;
  status?: string;
}

export interface PrinterDriver {
  readonly name: string;
  listDevices(): Promise<PrinterDevice[]>;
  connect(deviceId?: string): Promise<void>;
  printTicket(ticket: TicketModel, label: string): Promise<void>;
  printRaw(bytes: Buffer): Promise<void>;
}

/** Writes tickets as .txt files under data/tickets/ so the flow can be tested without hardware. */
export class MockPrinter implements PrinterDriver {
  readonly name = "mock";
  async listDevices() {
    return [{ id: "mock", name: "Impresora simulada (archivo .txt)", status: "ok" }];
  }
  async connect() {}
  async printTicket(ticket: TicketModel, label: string) {
    fs.mkdirSync(TICKETS_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safe = label.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40);
    fs.writeFileSync(path.join(TICKETS_DIR, `${stamp}_${safe}.txt`), renderTicketText(ticket), "utf8");
  }
  async printRaw(bytes: Buffer) {
    fs.mkdirSync(TICKETS_DIR, { recursive: true });
    fs.writeFileSync(path.join(TICKETS_DIR, `${Date.now()}_raw.bin`), bytes);
  }
}

/** Sends raw ESC/POS bytes to a CUPS queue (`lp -o raw`). Works on macOS with USB thermal printers. */
export class CupsEscPosPrinter implements PrinterDriver {
  readonly name = "cups";
  private deviceId?: string;

  constructor(deviceId?: string) {
    this.deviceId = deviceId;
  }

  async listDevices(): Promise<PrinterDevice[]> {
    try {
      const { stdout } = await execFileAsync("lpstat", ["-p"], { timeout: 5000 });
      return stdout
        .split("\n")
        .map((l) => l.match(/^printer\s+(\S+)\s+(.*)$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => ({ id: m[1], name: m[1], status: m[2] }));
    } catch {
      return [];
    }
  }

  async connect(deviceId?: string) {
    if (deviceId) this.deviceId = deviceId;
    if (!this.deviceId) throw new Error("No hay impresora CUPS seleccionada (Settings → Impresora).");
  }

  async printTicket(ticket: TicketModel) {
    await this.printRaw(renderEscPos(ticket));
  }

  async printRaw(bytes: Buffer) {
    if (!this.deviceId) throw new Error("No hay impresora CUPS seleccionada (Settings → Impresora).");
    const tmp = path.join(os.tmpdir(), `ticket-${Date.now()}.bin`);
    fs.writeFileSync(tmp, bytes);
    try {
      await execFileAsync("lp", ["-d", this.deviceId, "-o", "raw", "-s", tmp], { timeout: 10000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`lp falló: ${msg.split("\n")[0]}`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}

export function getPrinter(config: EventConfig): PrinterDriver {
  return config.printerDriver === "cups" ? new CupsEscPosPrinter(config.printerDeviceId) : new MockPrinter();
}

export async function printWithConfig(config: EventConfig, ticket: TicketModel, label: string): Promise<PrintResult> {
  const preview = renderTicketText(ticket);
  const driver = getPrinter(config);
  try {
    await driver.connect(config.printerDeviceId);
    await driver.printTicket(ticket, label);
    return { ok: true, driver: driver.name, preview };
  } catch (err) {
    return { ok: false, driver: driver.name, error: err instanceof Error ? err.message : String(err), preview };
  }
}

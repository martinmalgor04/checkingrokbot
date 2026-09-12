import { bumpPrinted, getGuest } from "./guests";
import { printWithConfig } from "./printer";
import { buildTicket } from "./printer/ticket";
import { getConfig } from "./settings";
import type { Guest, PrintResult } from "./types";

export async function printTicketForGuest(guestId: string, opts: { reprint?: boolean } = {}): Promise<PrintResult> {
  const guest = getGuest(guestId);
  if (!guest) throw new Error("Invitado no encontrado");
  const config = getConfig();
  const ticket = buildTicket(guest, config, { reprint: opts.reprint });
  const result = await printWithConfig(config, ticket, guest.fullName);
  if (result.ok) bumpPrinted(guest.id, !!opts.reprint);
  return result;
}

export async function printTestTicket(): Promise<PrintResult> {
  const config = getConfig();
  const now = new Date().toISOString();
  const fake: Guest = {
    id: "test",
    fullName: "Nombre Apellido de Prueba",
    ticketType: "General",
    isWalkIn: false,
    cancelledInLuma: false,
    checkedIn: true,
    checkedInAt: now,
    printedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  return printWithConfig(config, buildTicket(fake, config, { test: true }), "test");
}

export function jsonError(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : String(err);
  return Response.json({ error: message }, { status });
}

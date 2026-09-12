import { createWalkIn } from "@/lib/guests";
import { jsonError, printTicketForGuest } from "@/lib/print-flow";
import { getConfig } from "@/lib/settings";
import type { CheckInResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { fullName: string; email?: string; note?: string };
    const guest = createWalkIn(body);
    const response: CheckInResponse = { guest };
    if (getConfig().autoPrint) response.print = await printTicketForGuest(guest.id);
    return Response.json(response);
  } catch (err) {
    return jsonError(err);
  }
}

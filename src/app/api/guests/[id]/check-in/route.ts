import { checkInGuest, getGuest } from "@/lib/guests";
import { jsonError, printTicketForGuest } from "@/lib/print-flow";
import { getConfig } from "@/lib/settings";
import type { CheckInResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/guests/[id]/check-in">) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { force?: boolean };
    const before = getGuest(id);
    if (!before) return jsonError(new Error("Invitado no encontrado"), 404);
    if (before.checkedIn) {
      return Response.json({ error: "already_checked_in", guest: before }, { status: 409 });
    }
    const guest = checkInGuest(id, { force: body.force });
    const response: CheckInResponse = { guest };
    if (getConfig().autoPrint) response.print = await printTicketForGuest(guest.id);
    return Response.json(response);
  } catch (err) {
    return jsonError(err);
  }
}

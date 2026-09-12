import { getGuest } from "@/lib/guests";
import { jsonError, printTicketForGuest } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/guests/[id]/print">) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { reprint?: boolean };
    const print = await printTicketForGuest(id, { reprint: body.reprint });
    return Response.json({ guest: getGuest(id), print });
  } catch (err) {
    return jsonError(err);
  }
}

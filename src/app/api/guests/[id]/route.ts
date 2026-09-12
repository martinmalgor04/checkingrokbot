import { getAuditForGuest, getGuest } from "@/lib/guests";
import { jsonError } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/guests/[id]">) {
  try {
    const { id } = await ctx.params;
    const guest = getGuest(id);
    if (!guest) return jsonError(new Error("Invitado no encontrado"), 404);
    return Response.json({ guest, audit: getAuditForGuest(id) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

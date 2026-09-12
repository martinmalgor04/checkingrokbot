import { undoCheckIn } from "@/lib/guests";
import { jsonError } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: RouteContext<"/api/guests/[id]/undo">) {
  try {
    const { id } = await ctx.params;
    return Response.json({ guest: undoCheckIn(id) });
  } catch (err) {
    return jsonError(err);
  }
}

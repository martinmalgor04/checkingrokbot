import { resetAllData } from "@/lib/guests";
import { jsonError } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "BORRAR") return jsonError(new Error("Confirmación inválida"));
    resetAllData();
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}

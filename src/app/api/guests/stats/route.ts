import { getStats } from "@/lib/guests";
import { jsonError } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(getStats());
  } catch (err) {
    return jsonError(err, 500);
  }
}

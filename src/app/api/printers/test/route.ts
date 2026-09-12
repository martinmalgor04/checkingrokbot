import { jsonError, printTestTicket } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return Response.json(await printTestTicket());
  } catch (err) {
    return jsonError(err, 500);
  }
}

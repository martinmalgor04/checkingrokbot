import { jsonError } from "@/lib/print-flow";
import { getConfig, saveConfig } from "@/lib/settings";
import type { EventConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(getConfig());
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(req: Request) {
  try {
    const patch = (await req.json()) as Partial<EventConfig>;
    delete patch.id;
    return Response.json(saveConfig(patch));
  } catch (err) {
    return jsonError(err);
  }
}

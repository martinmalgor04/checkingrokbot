import { CupsEscPosPrinter, MockPrinter } from "@/lib/printer";
import { jsonError } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const driver = new URL(req.url).searchParams.get("driver") ?? "mock";
    const printer = driver === "cups" ? new CupsEscPosPrinter() : new MockPrinter();
    return Response.json({ devices: await printer.listDevices() });
  } catch (err) {
    return jsonError(err, 500);
  }
}

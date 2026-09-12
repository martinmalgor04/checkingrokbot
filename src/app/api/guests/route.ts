import { listGuests, searchGuests, type ListFilter } from "@/lib/guests";
import { jsonError } from "@/lib/print-flow";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    if (url.searchParams.get("list") === "1") {
      const filter = (url.searchParams.get("filter") ?? "all") as ListFilter;
      return Response.json({ guests: listGuests(filter, q) });
    }
    return Response.json({ guests: searchGuests(q, 10) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

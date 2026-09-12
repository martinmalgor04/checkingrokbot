import { createHash } from "node:crypto";
import Papa from "papaparse";
import { listGuests } from "@/lib/guests";
import { jsonError } from "@/lib/print-flow";
import { getConfig } from "@/lib/settings";
import { formatLocalDateTime } from "@/lib/text";

export const dynamic = "force-dynamic";

const hash = (v: string | undefined) => (v ? createHash("sha256").update(v.toLowerCase()).digest("hex").slice(0, 16) : "");

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const onlyCheckedIn = url.searchParams.get("all") !== "1";
    const anonymize = url.searchParams.get("anonymize") === "1";
    const config = getConfig();
    const guests = listGuests(onlyCheckedIn ? "checked_in" : "all");

    const rows = guests.map((g) => ({
      full_name: anonymize ? hash(g.fullName) : g.fullName,
      email: anonymize ? hash(g.email) : (g.email ?? ""),
      ticket_type: g.isWalkIn ? "Walk-in" : (g.ticketType ?? ""),
      is_walk_in: g.isWalkIn ? "yes" : "no",
      cancelled_in_luma: g.cancelledInLuma ? "yes" : "no",
      checked_in: g.checkedIn ? "yes" : "no",
      checked_in_at: g.checkedInAt ?? "",
      checked_in_local: formatLocalDateTime(g.checkedInAt, config.timeZone),
      printed_count: g.printedCount,
      luma_id: anonymize ? "" : (g.lumaId ?? ""),
    }));

    const csv = "\uFEFF" + Papa.unparse(rows);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const name = `asistencias-${onlyCheckedIn ? "checkin" : "todos"}${anonymize ? "-anon" : ""}-${stamp}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

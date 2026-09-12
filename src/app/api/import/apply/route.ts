import { applyImport } from "@/lib/import/apply";
import { parseUploadedFile } from "@/lib/import/parse";
import { jsonError } from "@/lib/print-flow";
import { saveMapping } from "@/lib/settings";
import type { ColumnMapping } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(new Error("Falta el archivo"));
    const mapping = JSON.parse(String(form.get("mapping") ?? "{}")) as ColumnMapping;
    const includePending = form.get("includePending") === "true";
    const markMissingAsCancelled = form.get("markMissingAsCancelled") !== "false";

    if (!mapping.full_name && !mapping.first_name && !mapping.last_name && !mapping.email) {
      return jsonError(new Error("Mapeá al menos la columna de nombre (o nombre + apellido) o email."));
    }

    const parsed = parseUploadedFile(file.name, Buffer.from(await file.arrayBuffer()));
    const summary = applyImport(parsed.rows, mapping, { includePending, markMissingAsCancelled });
    saveMapping(parsed.headers, mapping);
    summary.warnings.unshift(...parsed.warnings);
    return Response.json(summary);
  } catch (err) {
    return jsonError(err);
  }
}

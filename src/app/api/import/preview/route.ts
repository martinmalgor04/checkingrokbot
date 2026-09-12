import { parseUploadedFile, suggestMapping } from "@/lib/import/parse";
import { jsonError } from "@/lib/print-flow";
import { getSavedMapping } from "@/lib/settings";
import type { ImportPreview } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError(new Error("Falta el archivo"));
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseUploadedFile(file.name, buffer);
    if (!parsed.headers.length) return jsonError(new Error("No se detectaron columnas en el archivo"));
    const saved = getSavedMapping(parsed.headers);
    const preview: ImportPreview = {
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 5),
      rowCount: parsed.rows.length,
      suggestedMapping: saved ?? suggestMapping(parsed.headers),
      savedMapping: !!saved,
      warnings: parsed.warnings,
    };
    return Response.json(preview);
  } catch (err) {
    return jsonError(err);
  }
}

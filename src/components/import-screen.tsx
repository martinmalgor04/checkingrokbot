"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { IMPORT_FIELDS, type ColumnMapping, type ImportField, type ImportPreview, type ImportSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIELD_LABELS: Record<ImportField, string> = {
  full_name: "Nombre completo",
  first_name: "Nombre (si viene separado)",
  last_name: "Apellido (si viene separado)",
  email: "Email",
  ticket_type: "Tipo de ticket",
  status: "Estado de aprobación",
  luma_id: "ID de Luma",
  phone: "Teléfono",
};

const NONE = "__none__";

export function ImportScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [includePending, setIncludePending] = useState(false);
  const [markMissing, setMarkMissing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (f: File) => {
    setLoading(true);
    setSummary(null);
    try {
      const p = await api.importPreview(f);
      setFile(f);
      setPreview(p);
      setMapping(p.suggestedMapping);
      if (p.savedMapping) toast.info("Se aplicó el mapeo guardado para este formato.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer el archivo");
    } finally {
      setLoading(false);
    }
  }, []);

  const apply = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const s = await api.importApply(file, mapping, includePending, markMissing);
      setSummary(s);
      toast.success(`Import listo: ${s.created} nuevos, ${s.updated} actualizados`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falló el import");
    } finally {
      setLoading(false);
    }
  };

  const nameOk = !!(mapping.full_name || mapping.first_name || mapping.last_name || mapping.email);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar inscritos desde Luma</h1>
        <p className="text-sm text-muted-foreground">
          Exportá la lista de invitados desde Luma (CSV o Excel) y subila acá. Se puede re-importar las veces que quieras: los check-ins ya hechos se conservan.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) loadFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          dragging ? "border-primary bg-muted" : "hover:bg-muted/50",
        )}
      >
        <Upload className="size-8 text-muted-foreground" />
        <p className="font-medium">{file ? file.name : "Arrastrá el archivo acá o hacé clic para elegirlo"}</p>
        <p className="text-xs text-muted-foreground">.csv, .xlsx o .xls · máx. unos miles de filas</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {preview && (
        <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Mapeo de columnas</CardTitle>
              <CardDescription>
                {preview.rowCount} filas · {preview.headers.length} columnas. Las columnas sin mapear se guardan como campos custom.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{FIELD_LABELS[field]}</Label>
                  <Select
                    value={mapping[field] ?? NONE}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v === NONE ? undefined : v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="— sin mapear —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— sin mapear —</SelectItem>
                      {preview.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="pending" className="text-sm">
                    Incluir pendientes de aprobación
                  </Label>
                  <Switch id="pending" checked={includePending} onCheckedChange={setIncludePending} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="missing" className="text-sm">
                    Marcar como cancelados a los que ya no están en el export
                  </Label>
                  <Switch id="missing" checked={markMissing} onCheckedChange={setMarkMissing} />
                </div>
              </div>
              {!nameOk && <p className="text-sm text-destructive">Mapeá al menos nombre (o nombre + apellido) o email.</p>}
              <Button className="h-11 w-full text-base" disabled={loading || !nameOk} onClick={apply}>
                <FileSpreadsheet className="size-4" /> {loading ? "Importando…" : "Importar lista"}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {preview.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Vista previa (primeras 5 filas)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">
                          {h}
                          {Object.entries(mapping).find(([, col]) => col === h)?.[0] && (
                            <span className="ml-1 rounded bg-primary/10 px-1 text-[10px] text-primary">
                              {FIELD_LABELS[Object.entries(mapping).find(([, col]) => col === h)![0] as ImportField]}
                            </span>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.sampleRows.map((row, i) => (
                      <TableRow key={i}>
                        {preview.headers.map((h) => (
                          <TableCell key={h} className="max-w-[14rem] truncate whitespace-nowrap">
                            {row[h]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {summary && (
              <Card className="border-emerald-300">
                <CardHeader>
                  <CardTitle>Resumen del import</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                    <Stat label="Nuevos" value={summary.created} />
                    <Stat label="Actualizados" value={summary.updated} />
                    <Stat label="Check-ins preservados" value={summary.preservedCheckIns} />
                    <Stat label="Marcados cancelados" value={summary.cancelled} />
                    <Stat label="Omitidos por estado" value={summary.skippedByStatus} />
                    <Stat label="Duplicados en archivo" value={summary.duplicates} />
                  </dl>
                  {summary.warnings.length > 0 && (
                    <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      {summary.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

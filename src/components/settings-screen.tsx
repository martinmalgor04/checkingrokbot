"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TicketPreview } from "@/components/ticket-preview";
import { api } from "@/lib/client-api";
import type { EventConfig, PrintResult } from "@/lib/types";

const NONE = "__none__";

export function SettingsScreen({ initial }: { initial: EventConfig }) {
  const [cfg, setCfg] = useState<EventConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState<{ id: string; name: string; status?: string }[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [test, setTest] = useState<PrintResult | null>(null);
  const [resetText, setResetText] = useState("");

  const set = <K extends keyof EventConfig>(k: K, v: EventConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const loadDevices = useCallback(async (driver: EventConfig["printerDriver"]) => {
    setLoadingDevices(true);
    try {
      const { devices } = await api.printers(driver);
      setDevices(devices);
    } catch {
      setDevices([]);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .printers(cfg.printerDriver)
      .then(({ devices }) => !cancelled && setDevices(devices))
      .catch(() => !cancelled && setDevices([]));
    return () => {
      cancelled = true;
    };
  }, [cfg.printerDriver]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.saveSettings(cfg);
      setCfg(saved);
      toast.success("Ajustes guardados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const printTest = async () => {
    try {
      await api.saveSettings(cfg);
      const r = await api.testPrint();
      setTest(r);
      if (r.ok) toast.success(r.driver === "mock" ? "Ticket de prueba simulado (data/tickets/)" : "Ticket de prueba enviado a la impresora");
      else toast.error("Falló la impresión de prueba", { description: r.error });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error en la prueba");
    }
  };

  const reset = async () => {
    try {
      await api.reset();
      setResetText("");
      toast.success("Base de invitados vaciada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo vaciar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground">Evento, textos del ticket e impresora. Todo se guarda localmente.</p>
        </div>
        <Button className="h-10" onClick={save} disabled={saving}>
          <Save className="size-4" /> {saving ? "Guardando…" : "Guardar ajustes"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evento y ticket</CardTitle>
            <CardDescription>El ticket se diseña a 32 columnas (58 mm). Los saltos de línea se respetan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Título del ticket (nombre del evento)">
              <Input value={cfg.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha">
                <Input type="date" value={cfg.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Sede">
                <Input value={cfg.venue} onChange={(e) => set("venue", e.target.value)} />
              </Field>
            </div>
            <Field label="Encabezado (debajo del título)">
              <Textarea rows={2} value={cfg.ticketHeader} onChange={(e) => set("ticketHeader", e.target.value)} />
            </Field>
            <Field label="Saludo">
              <Input value={cfg.welcomeText} onChange={(e) => set("welcomeText", e.target.value)} />
            </Field>
            <Field label="Pie del ticket">
              <Textarea rows={2} value={cfg.ticketFooter} onChange={(e) => set("ticketFooter", e.target.value)} />
            </Field>
            <Field label="Zona horaria (para la hora del check-in)">
              <Input value={cfg.timeZone} onChange={(e) => set("timeZone", e.target.value)} />
            </Field>
            <Toggle label="Sonido al hacer check-in" checked={cfg.soundOnCheckIn} onChange={(v) => set("soundOnCheckIn", v)} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Impresora</CardTitle>
              <CardDescription>
                En el Mac: agregá la impresora USB en Ajustes del sistema → Impresoras (driver genérico / raw). Después elegila acá.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Modo">
                <Select value={cfg.printerDriver} onValueChange={(v) => set("printerDriver", v as EventConfig["printerDriver"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock">Simulada (guarda .txt, sin hardware)</SelectItem>
                    <SelectItem value="cups">Térmica USB vía CUPS (ESC/POS raw)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {cfg.printerDriver === "cups" && (
                <Field label="Cola de impresión (lpstat -p)">
                  <div className="flex gap-2">
                    <Select value={cfg.printerDeviceId ?? NONE} onValueChange={(v) => set("printerDeviceId", v === NONE ? undefined : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegí la impresora" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— sin seleccionar —</SelectItem>
                        {devices.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} {d.status ? `· ${d.status}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => loadDevices("cups")} disabled={loadingDevices} title="Actualizar">
                      <RefreshCw className={loadingDevices ? "size-4 animate-spin" : "size-4"} />
                    </Button>
                  </div>
                  {devices.length === 0 && !loadingDevices && (
                    <p className="text-xs text-muted-foreground">No se encontraron colas CUPS. Verificá con <code>lpstat -p</code> en la terminal.</p>
                  )}
                </Field>
              )}
              <Toggle label="Imprimir automáticamente al hacer check-in" checked={cfg.autoPrint} onChange={(v) => set("autoPrint", v)} />
              <Toggle label="Cortar papel al final (GS V)" checked={cfg.cutPaper} onChange={(v) => set("cutPaper", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Líneas en blanco antes">
                  <Input type="number" min={0} max={10} value={cfg.feedBefore} onChange={(e) => set("feedBefore", Number(e.target.value))} />
                </Field>
                <Field label="Líneas en blanco después">
                  <Input type="number" min={0} max={10} value={cfg.feedAfter} onChange={(e) => set("feedAfter", Number(e.target.value))} />
                </Field>
              </div>
              <Button variant="outline" className="h-10 w-full" onClick={printTest}>
                <Printer className="size-4" /> Guardar e imprimir ticket de prueba
              </Button>
              {test && (
                <div className="space-y-2">
                  <p className={test.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
                    {test.ok ? `OK vía ${test.driver}` : `Error: ${test.error}`}
                  </p>
                  <TicketPreview text={test.preview} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Zona peligrosa</CardTitle>
              <CardDescription>Borra todos los invitados, check-ins y la auditoría. Útil después del ensayo, antes del evento real.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Input placeholder='Escribí "BORRAR"' value={resetText} onChange={(e) => setResetText(e.target.value)} className="max-w-[12rem]" />
              <Button variant="destructive" disabled={resetText !== "BORRAR"} onClick={reset}>
                Vaciar base
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

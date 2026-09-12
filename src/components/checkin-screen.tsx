"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Printer, RotateCcw, Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuestBadge, maskEmail } from "@/components/guest-badge";
import { TicketPreview } from "@/components/ticket-preview";
import { api, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import type { CheckInResponse, EventConfig, Guest, PrintResult, Stats } from "@/lib/types";

type Modal =
  | { kind: "already"; guest: Guest }
  | { kind: "cancelled"; guest: Guest }
  | { kind: "undo"; guest: Guest }
  | { kind: "walkin" }
  | null;

function beep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // audio is best effort
  }
}

function localTime(iso?: string, timeZone?: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(iso));
}

export function CheckinScreen({ config }: { config: EventConfig }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Guest[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [lastPrint, setLastPrint] = useState<{ guest: Guest; print?: PrintResult } | null>(null);
  const [walkInKey, setWalkInKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await api.stats());
    } catch {
      // stats are non-critical
    }
  }, []);

  useEffect(() => {
    api.stats().then(setStats).catch(() => undefined);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      if (!q) {
        setResults([]);
        setSelected(0);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const { guests } = await api.search(q);
        if (id === requestId.current) {
          setResults(guests);
          setSelected(0);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error buscando");
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, q ? 150 : 0);
    return () => clearTimeout(t);
  }, [query]);

  const refreshGuestInResults = useCallback((guest: Guest) => {
    setResults((prev) => prev.map((g) => (g.id === guest.id ? guest : g)));
  }, []);

  const clearAndFocus = useCallback(() => {
    setQuery("");
    setResults([]);
    setSelected(0);
    inputRef.current?.focus();
  }, []);

  const openWalkIn = useCallback(() => {
    setWalkInKey((k) => k + 1);
    setModal({ kind: "walkin" });
  }, []);

  const retryPrintRef = useRef<(guest: Guest, reprint?: boolean) => Promise<void>>(async () => {});

  const retryPrint = useCallback(
    async (guest: Guest, reprint = false) => {
      setBusy(true);
      try {
        const res = await api.print(guest.id, reprint);
        refreshGuestInResults(res.guest);
        setLastPrint({ guest: res.guest, print: res.print });
        if (res.print.ok) toast.success(reprint ? "Ticket reimpreso" : "Ticket impreso");
        else
          toast.error("La impresión volvió a fallar", {
            description: res.print.error,
            action: { label: "Reintentar", onClick: () => retryPrintRef.current(guest, reprint) },
          });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error imprimiendo");
      } finally {
        setBusy(false);
      }
    },
    [refreshGuestInResults],
  );
  useEffect(() => {
    retryPrintRef.current = retryPrint;
  }, [retryPrint]);

  const handlePrintOutcome = useCallback(
    (guest: Guest, print: PrintResult | undefined, successMsg: string) => {
      setLastPrint({ guest, print });
      if (!print) {
        toast.success(successMsg, { description: "Auto-print desactivado." });
        return;
      }
      if (print.ok) {
        toast.success(successMsg, {
          description: print.driver === "mock" ? "Ticket simulado guardado en data/tickets/." : "Ticket enviado a la impresora.",
        });
      } else {
        toast.error(`${successMsg} — pero falló la impresión`, {
          description: print.error,
          duration: 10000,
          action: {
            label: "Reintentar impresión",
            onClick: () => retryPrint(guest),
          },
        });
      }
    },
    [retryPrint],
  );

  const doCheckIn = useCallback(
    async (guest: Guest, force = false) => {
      if (busy) return;
      if (guest.checkedIn) {
        setModal({ kind: "already", guest });
        return;
      }
      if (guest.cancelledInLuma && !force) {
        setModal({ kind: "cancelled", guest });
        return;
      }
      setBusy(true);
      try {
        const res: CheckInResponse = await api.checkIn(guest.id, force);
        if (config.soundOnCheckIn) beep();
        handlePrintOutcome(res.guest, res.print, `${res.guest.fullName} adentro`);
        refreshStats();
        clearAndFocus();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const payload = err.payload as { guest: Guest };
          refreshGuestInResults(payload.guest);
          setModal({ kind: "already", guest: payload.guest });
        } else {
          toast.error(err instanceof Error ? err.message : "Error en check-in");
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, clearAndFocus, config.soundOnCheckIn, handlePrintOutcome, refreshGuestInResults, refreshStats],
  );

  const doUndo = useCallback(
    async (guest: Guest) => {
      setBusy(true);
      try {
        const { guest: updated } = await api.undo(guest.id);
        refreshGuestInResults(updated);
        toast.info(`Check-in de ${updated.fullName} deshecho`);
        refreshStats();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo deshacer");
      } finally {
        setBusy(false);
        setModal(null);
        inputRef.current?.focus();
      }
    },
    [refreshGuestInResults, refreshStats],
  );

  const current = results[selected];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openWalkIn();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        if (current?.checkedIn) retryPrint(current, true);
        else toast.info("Seleccioná una persona que ya hizo check-in para reimprimir.");
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        clearAndFocus();
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(results.length - 1, s + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      } else if (e.key === "Enter" && current) {
        e.preventDefault();
        doCheckIn(current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearAndFocus, current, doCheckIn, modal, openWalkIn, results.length, retryPrint]);

  const pct = useMemo(() => {
    if (!stats || stats.registered === 0) return 0;
    return Math.round((stats.checkedIn / stats.registered) * 100);
  }, [stats]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="space-y-4">
        <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 pt-2 pb-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adentro</p>
              <p className="text-3xl font-bold tabular-nums leading-none">
                {stats?.checkedIn ?? "–"}
                <span className="text-lg font-medium text-muted-foreground"> / {stats?.registered ?? "–"}</span>
                <span className="ml-2 text-base font-semibold text-emerald-600">{pct}%</span>
              </p>
              {stats && stats.walkIns > 0 && (
                <p className="text-xs text-muted-foreground">{stats.walkIns} walk-in{stats.walkIns === 1 ? "" : "s"} incluidos</p>
              )}
            </div>
            <Button variant="outline" className="h-10 px-4" onClick={openWalkIn}>
              <UserPlus className="size-4" /> Nuevo walk-in <kbd className="ml-1 hidden rounded border px-1 text-[10px] text-muted-foreground sm:inline">Ctrl+N</kbd>
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, email o código…"
              autoComplete="off"
              spellCheck={false}
              className="h-14 pl-12 pr-12 text-lg md:text-xl"
              aria-label="Buscar invitado"
            />
            {query && (
              <button
                type="button"
                onClick={clearAndFocus}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        </div>

        {!query.trim() && stats && stats.registered === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">Todavía no hay inscritos cargados.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Exportá la lista desde Luma (CSV o Excel) e importala desde la pestaña <strong>Importar</strong>. Los walk-ins se pueden cargar igual.
            </p>
          </div>
        )}

        {query.trim() && !searching && results.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">Sin resultados para “{query.trim()}”.</p>
            <p className="mt-1 text-sm text-muted-foreground">Probá con parte del nombre o del email, o cargalo como walk-in.</p>
            <Button className="mt-4 h-10" variant="outline" onClick={openWalkIn}>
              <UserPlus className="size-4" /> Cargar como walk-in
            </Button>
          </div>
        )}

        <ul className="space-y-2" role="listbox" aria-label="Resultados">
          {results.map((g, i) => {
            const active = i === selected;
            return (
              <li
                key={g.id}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setSelected(i)}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors sm:p-4",
                  active ? "border-primary bg-muted/60 ring-2 ring-primary/30" : "hover:bg-muted/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-semibold leading-tight">{g.fullName}</p>
                    <GuestBadge guest={g} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {maskEmail(g.email) || (g.isWalkIn ? "Walk-in" : "sin email")}
                    {g.ticketType && !g.isWalkIn ? ` · ${g.ticketType}` : ""}
                    {g.checkedIn && g.checkedInAt ? ` · entró ${localTime(g.checkedInAt, config.timeZone)}` : ""}
                  </p>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  {g.checkedIn ? (
                    <>
                      <Button
                        variant="outline"
                        className="h-11 flex-1 px-4 sm:flex-none"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          retryPrint(g, true);
                        }}
                      >
                        <Printer className="size-4" /> Reimprimir
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-11 px-3 text-muted-foreground"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModal({ kind: "undo", guest: g });
                        }}
                        title="Deshacer check-in"
                      >
                        <RotateCcw className="size-4" /> Deshacer
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="h-12 flex-1 px-6 text-base font-semibold sm:flex-none"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        doCheckIn(g);
                      }}
                    >
                      Check-in e imprimir
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          Atajos: <kbd className="rounded border px-1">Enter</kbd> check-in · <kbd className="rounded border px-1">↑↓</kbd> mover ·{" "}
          <kbd className="rounded border px-1">/</kbd> buscar · <kbd className="rounded border px-1">Esc</kbd> limpiar ·{" "}
          <kbd className="rounded border px-1">Ctrl+P</kbd> reimprimir · <kbd className="rounded border px-1">Ctrl+N</kbd> walk-in
        </p>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Último ticket</h2>
          <span className="text-xs text-muted-foreground">
            {config.printerDriver === "mock" ? "Impresora simulada" : `CUPS · ${config.printerDeviceId ?? "sin seleccionar"}`}
          </span>
        </div>
        {lastPrint?.print ? (
          <>
            {!lastPrint.print.ok && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">No se imprimió</p>
                <p className="text-muted-foreground">{lastPrint.print.error}</p>
                <Button size="sm" className="mt-2" onClick={() => retryPrint(lastPrint.guest)} disabled={busy}>
                  Reintentar impresión
                </Button>
              </div>
            )}
            <TicketPreview text={lastPrint.print.preview} />
          </>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Acá vas a ver el ticket del último check-in.
          </div>
        )}
      </aside>

      <AlreadyDialog
        open={modal?.kind === "already"}
        guest={modal?.kind === "already" ? modal.guest : null}
        timeZone={config.timeZone}
        busy={busy}
        onClose={() => {
          setModal(null);
          clearAndFocus();
        }}
        onReprint={(g) => {
          setModal(null);
          retryPrint(g, true).then(clearAndFocus);
        }}
      />

      <ConfirmDialog
        open={modal?.kind === "cancelled"}
        title="Figura cancelado en Luma"
        description={
          modal?.kind === "cancelled"
            ? `${modal.guest.fullName} desapareció del último export de Luma. ¿Hacer check-in manual igual?`
            : ""
        }
        confirmLabel="Sí, check-in manual"
        busy={busy}
        onCancel={() => {
          setModal(null);
          inputRef.current?.focus();
        }}
        onConfirm={() => {
          if (modal?.kind === "cancelled") {
            const g = modal.guest;
            setModal(null);
            doCheckIn(g, true);
          }
        }}
      />

      <ConfirmDialog
        open={modal?.kind === "undo"}
        title="Deshacer check-in"
        description={
          modal?.kind === "undo"
            ? `${modal.guest.fullName} volverá a figurar como pendiente. Queda registrado en la auditoría.`
            : ""
        }
        confirmLabel="Deshacer"
        destructive
        busy={busy}
        onCancel={() => {
          setModal(null);
          inputRef.current?.focus();
        }}
        onConfirm={() => modal?.kind === "undo" && doUndo(modal.guest)}
      />

      <WalkInDialog
        key={walkInKey}
        open={modal?.kind === "walkin"}
        busy={busy}
        onClose={() => {
          setModal(null);
          inputRef.current?.focus();
        }}
        onSubmit={async (body) => {
          setBusy(true);
          try {
            const res = await api.walkIn(body);
            if (config.soundOnCheckIn) beep();
            handlePrintOutcome(res.guest, res.print, `Walk-in: ${res.guest.fullName} adentro`);
            refreshStats();
            setModal(null);
            clearAndFocus();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo crear el walk-in");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function AlreadyDialog({
  open,
  guest,
  timeZone,
  busy,
  onClose,
  onReprint,
}: {
  open: boolean;
  guest: Guest | null;
  timeZone: string;
  busy: boolean;
  onClose: () => void;
  onReprint: (g: Guest) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ya entró</DialogTitle>
          <DialogDescription>
            {guest ? (
              <>
                <strong>{guest.fullName}</strong> ya hizo check-in a las <strong>{localTime(guest.checkedInAt, timeZone)}</strong>
                {guest.printedCount > 0 ? ` (ticket impreso ${guest.printedCount} vez${guest.printedCount === 1 ? "" : "es"})` : ""}.
                ¿Querés reimprimir el ticket?
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={onClose} autoFocus>
            No, volver
          </Button>
          <Button className="h-10" disabled={busy} onClick={() => guest && onReprint(guest)}>
            <Printer className="size-4" /> Reimprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={onCancel} autoFocus>
            Cancelar
          </Button>
          <Button className="h-10" variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalkInDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (body: { fullName: string; email?: string; note?: string }) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!fullName.trim()) return;
            onSubmit({ fullName, email: email || undefined, note: note || undefined });
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Nuevo walk-in</DialogTitle>
            <DialogDescription>Persona sin inscripción en Luma. Se hace check-in e imprime al guardar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wi-name">Nombre y apellido *</Label>
            <Input id="wi-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus className="h-11 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wi-email">Email (opcional)</Label>
            <Input id="wi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wi-note">Nota (opcional)</Label>
            <Textarea id="wi-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10" disabled={busy || !fullName.trim()}>
              Check-in e imprimir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

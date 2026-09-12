"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GuestBadge } from "@/components/guest-badge";
import { api } from "@/lib/client-api";
import type { Guest, Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "checked_in", label: "Adentro" },
  { id: "pending", label: "Pendientes" },
  { id: "walk_in", label: "Walk-ins" },
  { id: "cancelled", label: "Cancelados" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function GuestsScreen({ timeZone }: { timeZone: string }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ guests }, s] = await Promise.all([api.list(filter, query), api.stats()]);
      setGuests(guests);
      setStats(s);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error cargando la lista");
    } finally {
      setLoading(false);
    }
  }, [filter, query]);

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [load]);

  const fmt = (iso?: string) =>
    iso ? new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date(iso)) : "—";

  const undo = async (g: Guest) => {
    if (!confirm(`¿Deshacer el check-in de ${g.fullName}?`)) return;
    try {
      await api.undo(g.id);
      toast.info("Check-in deshecho");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo deshacer");
    }
  };

  const reprint = async (g: Guest) => {
    try {
      const { print } = await api.print(g.id, true);
      if (print.ok) toast.success("Ticket reimpreso");
      else toast.error("Falló la impresión", { description: print.error });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reimprimir");
    }
  };

  const pct = stats && stats.registered ? Math.round((stats.checkedIn / stats.registered) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lista y métricas</h1>
          {stats && (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{stats.checkedIn}</strong> adentro de <strong className="text-foreground">{stats.registered}</strong> inscritos ({pct}%) ·{" "}
              {stats.walkIns} walk-ins · {stats.cancelled} cancelados en Luma
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export" download>
              <Download className="size-4" /> Exportar asistencias
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/api/export?all=1" download>
              Todos
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/api/export?anonymize=1" download>
              Anonimizado
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-md border p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium transition-colors",
                filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nombre o email…" className="h-9 max-w-xs" />
        <span className="ml-auto text-sm text-muted-foreground">{loading ? "Cargando…" : `${guests.length} resultado${guests.length === 1 ? "" : "s"}`}</span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead className="text-right">Tickets</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guests.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No hay invitados que coincidan.
                </TableCell>
              </TableRow>
            )}
            {guests.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">
                  {g.fullName}
                  {g.note && <span className="block text-xs text-muted-foreground">{g.note}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{g.email ?? "—"}</TableCell>
                <TableCell>{g.isWalkIn ? "Walk-in" : (g.ticketType ?? "—")}</TableCell>
                <TableCell>
                  <GuestBadge guest={g} />
                </TableCell>
                <TableCell className="tabular-nums">{fmt(g.checkedInAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{g.printedCount}</TableCell>
                <TableCell className="text-right">
                  {g.checkedIn && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => reprint(g)} title="Reimprimir">
                        <Printer className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => undo(g)} title="Deshacer check-in">
                        <RotateCcw className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

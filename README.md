# Check-in · Grok Bot Meetup

App de recepción para el **Grok Bot Meetup** (Corrientes · Parque Tecnológico UNNE · 16/09/2026). Importa la lista de inscritos exportada desde Luma (CSV o Excel), registra las llegadas en la puerta e imprime un ticket de bienvenida en una impresora térmica de 58 mm (ESC/POS por USB).

Spec completa: [`SPEC.md`](./SPEC.md).

## Qué hace

- **Importar**: drag & drop del export de Luma (`.csv`, `.xlsx`, `.xls`), mapeo automático de columnas (editable y recordado), dedupe por email, filtro por estado de aprobación. Re-importar no pisa check-ins ni walk-ins y marca como "cancelado en Luma" a quien desapareció del export.
- **Check-in**: búsqueda instantánea por nombre / email / código, botón grande "Check-in e imprimir", aviso de doble check-in con opción de reimprimir, walk-ins, deshacer con confirmación, contador de asistencia. Atajos: `Enter`, `↑↓`, `/`, `Esc`, `Ctrl+P`, `Ctrl+N`.
- **Ticket 58 mm**: layout a 32 columnas, ESC/POS raw vía CUPS, corte de papel, feed configurable, ticket de prueba. Si la impresora falla el check-in igual queda guardado y se puede reintentar.
- **Lista / métricas**: tabla filtrable, reimpresión, deshacer y export CSV de asistencias (completo o anonimizado).
- **Offline**: todo vive en SQLite local (`data/checkin.sqlite`). Después del import no hace falta internet.

## Correr en el Mac de recepción

Requisitos: Node.js 20+ (recomendado 22) y npm.

```bash
npm install
npm run dev        # http://localhost:4817
```

Para el día del evento conviene compilar y correr en modo producción (arranca más rápido):

```bash
npm run build
npm run start      # http://localhost:4817
```

Abrí `http://localhost:4817` en el navegador, importá el CSV de Luma desde **Importar** y dejá la pestaña **Check-in** abierta.

Un CSV de ejemplo con datos ficticios está en [`samples/luma-sample.csv`](./samples/luma-sample.csv).

## Impresora térmica USB (macOS + CUPS)

La app manda bytes ESC/POS crudos a una cola de CUPS con `lp -o raw`, así que no depende de drivers específicos.

1. Conectá la impresora por USB y encendela.
2. **Ajustes del sistema → Impresoras y escáneres → Agregar impresora**. Elegí la impresora USB y, en "Usar", seleccioná **Genérico / Generic PostScript** o "Seleccionar software… → Generic Raw" (cualquier driver sirve porque se imprime en modo raw).
3. En la terminal verificá que aparezca la cola:

```bash
lpstat -p
```

4. En la app, **Ajustes → Impresora → Modo: Térmica USB vía CUPS**, elegí la cola y tocá **Guardar e imprimir ticket de prueba**.

Si el ticket sale sin cortar, desactivá "Cortar papel" (no todas las 58 mm tienen cutter). Si sale texto raro, probá una prueba desde la terminal para aislar el problema:

```bash
printf '\x1b@Hola 58mm\n\n\n\n' | lp -d NOMBRE_DE_LA_COLA -o raw
```

Sin impresora conectada usá el modo **Simulada**: cada ticket se guarda como `.txt` en `data/tickets/` y se muestra en pantalla.

## Datos y privacidad

- Todo queda en `data/` (ignorado por git). No subas exports de Luma al repo: `*.csv`, `*.xlsx`, `*.sqlite` están en `.gitignore` (salvo el sample).
- El export anonimizado reemplaza nombre y email por hashes, útil para métricas públicas.
- **Ajustes → Zona peligrosa** vacía la base (por ejemplo después del ensayo).

## Estructura

```
src/app/            páginas (check-in, import, guests, settings) y API routes
src/components/     pantallas y componentes UI (shadcn/ui)
src/lib/db.ts       SQLite (better-sqlite3)
src/lib/guests.ts   búsqueda, check-in, undo, walk-in, auditoría
src/lib/import/     parseo CSV/XLSX, mapeo de columnas, upsert
src/lib/printer/    modelo de ticket, render texto + ESC/POS, drivers Mock y CUPS
```

## Scripts

- `npm run dev` — servidor de desarrollo en el puerto 4817.
- `npm run build` / `npm run start` — build y servidor de producción.
- `npm run lint` — ESLint.

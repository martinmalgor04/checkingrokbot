# Spec — Check-in Grok Bot Meetup (Luma + ticket 58mm)

- **Producto:** app de recepción / check-in para el Grok Bot Meetup
- **Evento referencia:** Corrientes · Parque Tecnológico UNNE · 16/09/2026 · 18:00
- **Versión spec:** 0.1.1
- **Estado:** draft para implementar
- **Owner:** Martín (+ Tobías)
- **Relacionado:** tarea backlog LUG-4 (señalética + punto de check-in)

## 1. Problema

En la puerta necesitamos:

1. Tomar la lista de inscritos exportada desde Luma (CSV o Excel).
2. Registrar quién llegó (check-in).
3. Imprimir un ticket de bienvenida en impresora térmica de 58 mm.

Sin Excel improvisado ni demoras en la cola.

## 2. Objetivos

- Importar participantes desde archivo Luma (CSV / XLSX) en < 30 s.
- Buscar por nombre / email / código en < 2 s.
- Hacer check-in en un toque e imprimir el ticket automáticamente.
- Evitar dobles check-ins (avisar si ya entró).
- Funcionar el día del evento aunque flaquee internet (modo offline después del import).
- Dejar un export de asistencias reales post-evento.

### No objetivos (v1)

- Integración live con API de Luma (solo archivo).
- App mobile nativa (puede ser web local / desktop).
- Venta de entradas o cobros.
- Credenciales con foto.
- Multi-evento SaaS (una instancia = un meetup; config simple).

## 3. Usuarios y roles

| Rol | Quién | Qué hace |
|---|---|---|
| Operador recepción | Martín / voluntario | Busca, check-in, imprime, registra walk-ins |
| Organizador | Martín / Tobías | Importa lista, ve métricas, exporta asistencias |
| Asistente | — | Solo recibe el ticket (no usa la app) |

## 4. Flujo principal

```
[Export Luma CSV/XLSX]
        ↓
[Importar en la app] → validar columnas → lista local
        ↓
[Cola en puerta]
        ↓
[Buscar persona] → ¿encontrada?
        ↓ sí                    ↓ no
[Check-in + print]        [Walk-in: alta rápida + print]
        ↓
[Ticket 58mm]
        ↓
[Estado: checked_in + timestamp]
```

### Flujo secundario: reimpresión

Buscar persona ya checked-in → "Reimprimir ticket" (no cambia el timestamp original; loguea `reprinted_at`).

### Flujo secundario: undo

"Deshacer check-in" solo con confirmación (útil si se equivocaron de persona). Marca `checked_in = false` y guarda auditoría.

## 5. Import Luma (CSV / Excel)

### 5.1 Formato esperado

Luma suele exportar columnas del estilo (nombres pueden variar; la app mapea):

| Campo interno | Posibles headers Luma |
|---|---|
| `full_name` | name, Name, full_name, Guest Name |
| `email` | email, Email, Email Address |
| `ticket_type` | ticket_type, Ticket Type, ticket name |
| `status` | approval_status, Status (approved / pending / rejected) |
| `luma_id` | id, guest_id, api_id (si existe) |
| `phone` | phone, Phone Number (opcional) |
| `custom_*` | columnas custom del form (nivel, qué quiere ver, etc.) |

### 5.2 Reglas de import

- Aceptar `.csv`, `.xlsx`, `.xls`.
- Encoding CSV: detectar UTF-8 / Latin-1; preferir UTF-8.
- Deduplicar por email (case-insensitive). Si no hay email, por `full_name` + warning.
- Por defecto solo importar approved / registered (configurable: incluir pending).
- Re-import (mismo evento):
  - Upsert por email / `luma_id`.
  - No pisar `checked_in`, `checked_in_at`, ni walk-ins.
  - Agregar nuevos inscritos.
  - Marcar como `cancelled_in_luma` a quienes desaparecieron del export (no borrar historial de check-in).
- Mostrar resumen post-import: N nuevos, M actualizados, K ya checked-in preservados, W warnings.

### 5.3 UI de mapeo (si headers no matchean)

Pantalla simple: dropdown "esta columna Luma → campo app" con preview de 5 filas. Guardar el mapeo para el próximo import del mismo evento.

## 6. Check-in (UI)

### 6.1 Pantalla principal (modo puerta)

- Campo de búsqueda grande (autofocus), placeholder: "Nombre, email o código…".
- Resultados en vivo (debounce ~150 ms), máx. 10 hits.
- Cada fila: nombre, email (enmascarado parcial opcional), estado badge (Pendiente / Adentro / Walk-in).
- Botón primario grande: **Check-in e imprimir**.
- Contador sticky: Adentro X / Inscritos Y + %.

### 6.2 Atajos teclado

| Tecla | Acción |
|---|---|
| Enter | Check-in del primer resultado / seleccionado |
| ↑ ↓ | Mover selección |
| `/` o Esc | Foco en búsqueda / limpiar |
| Ctrl+P | Reimprimir selección |
| Ctrl+N | Nuevo walk-in |

### 6.3 Walk-in

Form mínimo: nombre (requerido), email (opcional), nota. Marca `is_walk_in = true`, check-in inmediato + print.

### 6.4 Estados visuales

- Check-in OK → toast verde + sonido corto opcional + limpia búsqueda.
- Ya checked-in → modal: "Ya entró a HH:MM — ¿Reimprimir?".
- Persona `cancelled_in_luma` → warning amarillo, permitir check-in manual con confirmación.

## 7. Ticket 58 mm

### 7.1 Hardware target

- Impresora térmica 58 mm (ancho útil típico ~48–52 mm de impresión).
- Protocolo: ESC/POS (USB y/o Bluetooth; v1 priorizar USB vía sistema).
- Densidad: 203 dpi típica.

### 7.2 Layout del ticket (bienvenida)

Ancho: 32–42 caracteres según fuente (diseñar a 32 cols seguro).

```
================================
     GROK BOT MEETUP
        Corrientes
--------------------------------
  16 Sep 2026 · Parque Tec UNNE
================================

  Bienvenido/a

  NOMBRE APELLIDO
  (puede wrap a 2 líneas)

  Tipo: General
  Check-in: 18:12

--------------------------------
  SpaceX AI · xAI / Grok
  Que disfrutes el meetup
================================
        [opcional QR]
================================
```

### 7.3 Contenido dinámico

| Campo | Origen |
|---|---|
| Nombre | `full_name` |
| Tipo ticket | `ticket_type` o "Walk-in" |
| Hora check-in | `checked_in_at` local |
| QR (opcional v1.1) | payload `meetupId|guestId` |

### 7.4 Reglas de impresión

- Al check-in exitoso → print automático (toggle "auto-print" on por default).
- Si la impresora falla → check-in igual se guarda; UI muestra error + botón "Reintentar impresión".
- Cortar papel (GS V) al final si la impresora lo soporta.
- Prefijo/sufijo de feed (líneas en blanco) configurables.
- Modo test: "Imprimir ticket de prueba" desde Settings.

### 7.5 Abstracción de impresora

```
PrinterDriver
  - listDevices()
  - connect(deviceId)
  - printTicket(ticketModel) → Promise
  - printRaw(escPosBytes)
```

Implementaciones v1:

- `EscPosUsbPrinter` (node-usb / escpos / sistema CUPS raw).
- `MockPrinter` (guarda .txt / preview en pantalla para dev sin hardware).

## 8. Modelo de datos

### 8.1 EventConfig

```ts
{
  id: string
  name: string                 // "Grok Bot Meetup Corrientes"
  date: string                 // ISO date
  venue: string
  ticketHeader: string
  ticketFooter: string
  autoPrint: boolean
  printerDeviceId?: string
}
```

### 8.2 Guest

```ts
{
  id: string                   // uuid interno
  lumaId?: string
  fullName: string
  email?: string
  ticketType?: string
  lumaStatus?: string
  customFields?: Record<string, string>
  isWalkIn: boolean
  cancelledInLuma: boolean
  checkedIn: boolean
  checkedInAt?: string         // ISO
  printedCount: number
  createdAt: string
  updatedAt: string
}
```

### 8.3 AuditLog

```ts
{
  id: string
  guestId: string
  action: "check_in" | "undo_check_in" | "reprint" | "walk_in_create" | "import"
  at: string
  meta?: Record<string, unknown>
}
```

### 8.4 Persistencia

- v1: SQLite local (o IndexedDB si es PWA) en la máquina de recepción.
- Backup: export JSON/CSV on demand.
- No requiere cuenta cloud el día del evento.

## 9. Pantallas

1. **Setup / Settings** — nombre evento, textos ticket, impresora, auto-print, mapeo columnas.
2. **Import** — drag & drop archivo + resumen.
3. **Check-in** — pantalla principal (default al abrir el día del evento).
4. **Lista / métricas** — tabla filtrable, export asistencias.
5. **Printer test** — ticket de prueba.

## 10. Stack sugerido (recomendación, no dogma)

Prioridad: rápido de correr en una laptop el 16/09, USB ESC/POS confiable.

| Capa | Opción A (recomendada) | Opción B |
|---|---|---|
| App | Electron o Tauri + UI web | Next.js local + servidor Node en localhost |
| UI | React + Tailwind | — |
| DB | better-sqlite3 / sqlite | IndexedDB (si PWA pura; impresión más frágil) |
| Parse Excel | xlsx (SheetJS) | — |
| CSV | papaparse | — |
| Print | node-escpos / escpos-usb o raw a CUPS | Browser `window.print` no alcanza para 58mm térmico bien |

Recomendación: Tauri o Electron + ESC/POS USB. PWA sola complica la impresora térmica.

**Sistema target v1: macOS + impresora USB (confirmado 11/09/2026). ESC/POS por USB.**

## 11. Requisitos no funcionales

- Import de 500 guests < 3 s.
- Búsqueda responsive con 1k guests.
- Check-in + encolar print < 500 ms de feedback UI.
- Offline completo post-import.
- Datos solo en disco local; no subir PII a servicios terceros en v1.
- UI usable a 1 m de distancia (botones grandes, alto contraste).

## 12. Privacidad

- Emails y nombres = datos personales: no commitear exports al repo.
- `.gitignore` para `data/`, `*.csv`, `*.sqlite`.
- Export post-evento solo a organizadores.
- Opción "anonimizar export" (hashes) para métricas públicas.

## 13. Criterios de aceptación (v1)

- [ ] Importa CSV Luma real y XLSX con mapeo automático o manual.
- [ ] Re-import no pierde check-ins previos.
- [ ] Buscar por nombre parcial y email funciona.
- [ ] Check-in marca hora local y cambia badge.
- [ ] Doble check-in pide confirmación / ofrece reimpresión.
- [ ] Walk-in crea guest y imprime.
- [ ] Ticket sale en 58 mm con nombre + evento + hora (layout legible).
- [ ] Si no hay impresora, MockPrinter + check-in siguen OK.
- [ ] Export CSV de `checked_in = true` con timestamps.
- [ ] Undo check-in con confirmación + audit log.
- [ ] Atajos teclado de §6.2 funcionan en Check-in.

## 14. Plan de entrega sugerido

| Milestone | Entrega |
|---|---|
| M0 | Spec OK + repo + MockPrinter + modelo Guest |
| M1 | Import CSV/XLSX + pantalla Check-in sin print real |
| M2 | ESC/POS USB + layout ticket 58 mm + auto-print |
| M3 | Walk-in, reimpresión, undo, export, polish atajos |
| M4 | Ensayo en sede con impresora real + lista Luma de prueba |

Deadline blando: ensayo antes del 15/09/2026; uso real 16/09 18:00.

## 15. Preguntas abiertas (para cerrar antes de codear)

**Cerrado**

1. OS laptop recepción: macOS (11/09/2026).
2. Conexión impresora: USB (58 mm ESC/POS). Marca/modelo exacto: pendiente.

**Sigue abierto**

3. ¿Queremos QR en el ticket en v1 o lo dejamos para v1.1?
4. ¿Textos exactos del ticket (título, pie, "Bienvenido/a")?
5. ¿La app corre solo offline en un solo Mac, o hace falta sync entre 2 dispositivos de recepción?
6. ¿Marca/modelo exacto de la impresora 58 mm?

## 16. Assets / inputs necesarios

- Export Luma de prueba (CSV) con ≥ 10 filas.
- Foto o modelo de la impresora.
- Logo chico monocromático (opcional) para el ticket — en 58 mm a veces no vale la pena.
- Copy final del ticket.

## 17. Referencias del meetup

- Venue: Parque Tecnológico UNNE, desde 18:00.
- Check-in humano: punto con impresora 58 mm + carteles (backlog LUG-4).
- Registro público: Luma (ya publicado).

---

Fin spec v0.1.1 — listo para implementar o pasar a un cloud agent de código.

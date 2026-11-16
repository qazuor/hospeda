---
title: QR de ingreso validado en la puerta
linear: HOS-2276
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# QR de ingreso validado en la puerta

## 1. Resumen

Cada anotado en una lista (HOS-2274) y cada reserva confirmada (HOS-2275) tiene un
**pase** con QR propio. En la puerta, alguien del local lo escanea con el celular y
ve: válido, ya usado, de otro día o cancelado. Al validar queda registrada la hora de
ingreso y el pase no se puede usar dos veces. El QR no lleva datos personales: es un
token opaco que solo resuelve quien está autorizado del lado del local.

Asume las opciones recomendadas de HOS-2260, en especial **OQ-6**: el que valida usa
la cuenta del dueño o un **link de puerta** revocable, sin crear roles ni cuentas de
personal.

## 2. Problema

La lista y las reservas sirven de poco si en la puerta nadie puede comprobar quién tiene
lugar. Hoy se mira una captura de WhatsApp o un nombre en un papel. Se cuelan pases
repetidos y no hay registro de quién entró.

## 3. Goals

- G-1: un pase por anotación o reserva, visible en el correo y en Mi cuenta.
- G-2: validación en una sola acción, atómica: un pase no se usa dos veces.
- G-3: el escaneo registra hora y quién validó, y alimenta las estadísticas por evento.
- G-4: el QR no contiene datos personales.
- G-5: validar no depende del plan, para que lo ya confirmado funcione siempre.

## 4. Non-goals

- NG-1: cuentas con varios usuarios o roles de puerta (idea 32, OQ-6 opción 3).
- NG-2: escáner de cámara dentro de la página (exigiría una librería nueva, ver 6.6).
- NG-3: pase rotativo, anti-captura o wallet (Apple/Google).
- NG-4: cobro de entrada.

## 5. Estado actual del código

- `qr_codes` y `qr_code_scans` (`packages/db/src/schemas/qr-code/`) son un sistema de
  **stickers impresos**: slug único para siempre, `targetUrl` editable, redirección
  (`apps/web/src/pages/qr/[slug].astro`), y un escaneo guarda `user_agent` crudo
  (`qr_code_scan.dbschema.ts`, cabecera). Los propósitos son
  `HOST_TRADE_USAGE | LISTING | MENU | CERTIFICATE | BROCHURE`
  (`packages/schemas/src/enums/qr-code-purpose.enum.ts:42-52`).
- El render existe: `apps/api/src/utils/qr-render.ts` (`renderQrSvg`, `renderQrPng`,
  `renderQrMatrix`), con la corrección de errores Q que usa la hoja imprimible
  (`apps/api/src/services/listing-qr-sheet/listing-qr-code.ts`, cabecera).
- Guard `apps/api/test/utils/entity-qr-purpose.guard.test.ts` congela los propósitos.
- Patrón de transiciones por fila y 404 a lo ajeno: `routes/host-trade/protected/usage-transitions.ts`.
- Correo con adjuntos: `packages/notifications/src/transports/email/resend-transport.ts`
  admite `attachments`.
- Ruta neutral al idioma para QR impresos: `isLanguageNeutralRoute` (ver cabecera de
  `qr/[slug].astro`; una ruta de dos letras sería leída como idioma).
- Cron de retención y manifest: `apps/api/src/cron/schedules.manifest.ts`.

## 6. Diseño propuesto

### 6.1 Por qué NO se reusa `qr_codes` (decisión de la spec)

El issue dejaba abierto "sumar un propósito o un token propio". Se recomienda **token
propio** porque el modelo de stickers no encaja:

1. Un sticker es **uno por cosa y dura años**; un pase es **uno por persona y por noche**
   (miles de filas). `slug` es único para siempre y no se reutiliza.
2. Un sticker **redirige**; un pase **se consume**. `targetUrl` no tiene sentido.
3. `qr_code_scans` guarda el user-agent crudo (decisión HOS-1141 para marketing). Un pase
   es un dato operativo del local, y no debe registrar el dispositivo de quien entra.
4. Agregar un propósito es una migración de un enum de Postgres y el guard
   `entity-qr-purpose` lo congela; `EntityTypePgEnum` tampoco tiene los sujetos.

Sí se reusa: `renderQrPng/renderQrSvg`, la corrección de errores Q y `generateShortId`.

### 6.2 Tablas

`venue_entry_pass`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `venue_id` | uuid fk `venues` | alcance de la validación |
| `subject_type` | enum `venue_entry_subject` | `GUEST_LIST_ENTRY`, `RESERVATION`, `RESERVATION_MEMBER` (el último lo usa HOS-2277) |
| `guest_list_entry_id` / `reservation_id` / `reservation_member_id` | uuid null | CHECK en extras: **exactamente uno** y coincide con `subject_type` |
| `token` | varchar(32) único | 128 bits aleatorios (`crypto.randomBytes(16)`, base32 sin ambiguos). **No derivado** de ids |
| `valid_date` | date | fecha de servicio (la noche del viernes sigue siendo viernes pasada la medianoche) |
| `admits` | smallint | cuántas personas ingresan con este pase |
| `state` | enum `venue_entry_pass_state` | `ACTIVE`, `USED`, `VOID` |
| `used_at` | timestamptz null | |
| `used_by_kind` / `used_by_id` | enum / uuid null | `OWNER` (user) o `DOOR_LINK` (link) |
| `void_reason` | varchar(40) null | `CANCELLED`, `EVENT_SUSPENDED` |
| auditoría | | |

Índices: único `token`; `(venue_id, valid_date, state)`; único parcial por sujeto
(`WHERE state <> 'VOID'`) para que el pase sea idempotente por sujeto.

`venue_entry_scan` (solo inserción, sin auditoría ni soft delete, como `qr_code_scans`):
`id`, `venue_id`, `pass_id` null (token desconocido), `result` enum (`VALID`, `USED`,
`WRONG_DAY`, `CANCELLED`, `UNKNOWN`, `UNDONE`), `scanned_at`, `by_kind`, `by_id`. **No
guarda user-agent ni IP.** Retención: 12 meses (cron compartida).

`venue_door_link`:

| Columna | Tipo | Nota |
|---|---|---|
| `id`, `venue_id` | | |
| `token_hash` | char(64) único | SHA-256; el token se muestra **una sola vez** al crearlo |
| `label` | varchar(60) | "Puerta principal" |
| `expires_at` | timestamptz | por defecto 6 h tras terminar el evento (OQ-F) |
| `revoked_at` | timestamptz null | |
| `last_used_at` | timestamptz null | |
| auditoría | | |

Las tres cuelgan de `venues` o de sus filas: sumar a `purged-closed-list.json` y al test
congelado. `venue_door_link` y los pases de un listing purgado se **borran** (no tienen
PII propia).

### 6.3 Emisión del pase (bajo demanda, sin backfill)

El pase se crea **la primera vez que se lo pide** (`mintOrGet`), igual que el QR de la
carta se provisiona en la primera lectura (`routes/venue/protected/menuQr.ts`). Así
HOS-2274 y HOS-2275 no dependen de este issue y no hay que migrar filas viejas.

- Se pide al confirmarse el sujeto (lo hace el correo de confirmación) y desde Mi cuenta.
- Al cancelarse el sujeto, el pase pasa a `VOID` en la misma transacción.
- `admits` = personas del sujeto (`party_size`); en grupos lo define HOS-2277.

El correo adjunta el QR en PNG (`renderQrPng`, nivel Q) y repite el código corto de
texto. La URL codificada es `https://<sitio>/pase/<token>`.

### 6.4 Validación, paso a paso

`validatePass({ token, scope, by, now })` en un servicio de `@repo/service-core`:

1. Forma del token (largo y alfabeto); si no cumple, 400.
2. Un único `UPDATE venue_entry_pass SET state='USED', used_at=now, used_by_* WHERE token
   = $1 AND state='ACTIVE' AND venue_id = $scope AND valid_date = <hoy de servicio>
   RETURNING *`. Si devuelve fila: resultado `VALID`; en la misma transacción el sujeto
   pasa a `CHECKED_IN` y se inserta el escaneo.
3. Si no devuelve fila se **clasifica** con un `SELECT`: `USED` (con la hora), `WRONG_DAY`,
   `CANCELLED` (`VOID`) o `UNKNOWN` (no existe, o es de **otro local**; no se distinguen,
   para no filtrar). En todos se inserta el escaneo.
4. Respuesta **200** con `{ result, display }`. `display` trae solo lo que necesita la
   puerta: nombre de pila, personas que ingresan, tipo (lista, mesa, VIP, grupo), evento
   y, para cumpleaños, el beneficio (HOS-2278). **Nunca** teléfono, nota ni email.
5. `undo`: dentro de 2 minutos de un `VALID`, el mismo actor puede revertirlo
   (`POST .../undo`); vuelve a `ACTIVE`, el sujeto a `CONFIRMED`, el escaneo registra
   `UNDONE`.

"Hoy de servicio": fecha en `America/Argentina/Buenos_Aires`, con corte a las **06:00**
(una validación a las 02:00 del sábado cuenta como el viernes).

### 6.5 Quién valida y cómo se autoriza

Rutas (ambas llaman al mismo servicio):

| Ruta | Tier | Autoriza |
|---|---|---|
| `POST /protected/venues/:id/entry-passes/:token/validate` | protected | sesión del dueño: `listingAccess` `{ vertical: VENUE, operation: 'READ_OWN_COMMERCIAL' }` **sin** `capabilities` (no se gatea validar) |
| `POST /public/venue-door/passes/:token/validate` | public con credencial propia | cabecera `Authorization: Door <token>`; el link se resuelve por su hash, debe estar vigente y no revocado |
| `POST .../undo` (ambos tiers) | | igual que el anterior |
| `GET/POST/DELETE /protected/venues/:id/door-links` | protected | dueño; **gate** (ver abajo) |

Reglas:

- El **link de puerta no es un rol** (G6): no decide quién es nadie, es una capacidad
  atada a un local y a una fecha de vencimiento. La ruta pública declara su credencial
  explícita y se documenta como excepción en `apps/api/docs/route-architecture.md`.
- Por local, el link solo valida pases de **ese** local.
- Error: token de puerta ausente o vencido: 401 `UNAUTHORIZED`; revocado: 401 igual
  (misma respuesta, sin pistas).
- Rate limit: 120 por minuto por credencial (link o usuario) y 600 por hora por IP.
  Además, 10 resultados `UNKNOWN` seguidos bloquean el link 1 minuto (anti-fuerza bruta).
- **Gate de crear links**: lo ideal es "tiene `venue_guest_list` **o** `venue_reservations`".
  El pipeline hoy solo admite **todas** las claves en `capabilities`
  (`listing-access.ts:208-214`). Dos caminos: (a) sumar `capabilitiesAnyOf` al
  middleware y al resolvedor (cambio chico, con tests); (b) gatear por
  `venue_guest_list`, que todo plan con reservas ya trae. (a) es la recomendada, porque
  (b) depende de cómo se armen los planes. Ver OQ-G.
- Tras una baja de plan: no se pueden crear links nuevos, pero **los existentes siguen
  vigentes hasta vencer** y el dueño siempre puede validar con su sesión.

### 6.6 Web

- `/pase/[token]` (ruta neutral al idioma, SSR, `cacheable: false`, `noindex`): una isla
  que lee el token de la URL. Con credencial de puerta guardada en `localStorage` o
  sesión del dueño, valida y muestra una tarjeta grande: verde válido, rojo ya usado o
  cancelado, ámbar otro día. Sin credencial: "Este es un pase de ingreso. Solo el local
  puede validarlo". La página no lleva sesión (guard de páginas sin sesión).
- `/puerta/[linkToken]`: el personal abre el link una vez; guarda el token en
  `localStorage` del navegador y muestra instrucciones: "Escaneá los QR con la cámara del
  celular". Entrada manual por **código corto** como alternativa.
- **No** hay escáner dentro de la página en esta etapa: la cámara del sistema abre
  `/pase/<token>`. Un escáner propio (BarcodeDetector no existe en iOS Safari) exigiría
  una librería nueva (p. ej. `jsQR`), y agregar dependencias se consulta (OQ-F).
- Mi cuenta: tarjeta del sujeto con el QR (SVG) y el código corto.
- Panel del local: crear y revocar links de puerta (se muestra el link una sola vez),
  y "Ingresos" por evento: conteo de pases usados, por hora.

### 6.7 Estadísticas

`venue_entry_scan` y `venue_entry_pass.used_at` alimentan HOS-2265 (estadísticas por
evento): anotados, ingresados, ausentes, ingresos por franja de 15 minutos.
Esta spec expone una consulta de servicio (`entryStatsForEvent`); la pantalla es de HOS-2265.

## 7. i18n

`venue.entry.*` (puerta y panel), `account.entryPass.*`, plantilla de correo del pase.
Textos de estado del escaneo: "Válido", "Ya usado a las {{hora}}", "Es de otro día",
"Cancelado", "No lo reconocemos". es, en, pt.

## 8. Criterios de aceptación

- AC-1: dado un anotado, al pedir su pase se crea uno; pedirlo de nuevo devuelve el mismo.
- AC-2: el contenido del QR es una URL con un token opaco y no contiene ids, nombres ni
  datos personales.
- AC-3: validar un pase `ACTIVE` del día responde `VALID`, marca `USED`, pasa el sujeto a
  `CHECKED_IN` y registra hora y actor.
- AC-4: validarlo otra vez responde `USED` con la hora anterior y no cambia nada.
- AC-5: dos validaciones simultáneas del mismo pase: exactamente una responde `VALID`.
- AC-6: un pase de otro día responde `WRONG_DAY`; uno cancelado, `CANCELLED`.
- AC-7: un token de otro local o inexistente responde `UNKNOWN` (misma forma).
- AC-8: el link de puerta valida solo pases de su local; vencido o revocado responde 401.
- AC-9: la respuesta nunca incluye teléfono, nota ni email.
- AC-10: `undo` dentro de 2 minutos revierte; después responde 409 `INVALID_TRANSITION`.
- AC-11: cancelar la anotación o reserva deja el pase `VOID` en la misma transacción.
- AC-12: tras bajar de plan, el dueño sigue validando con su sesión y los links ya
  creados siguen sirviendo hasta vencer; no se pueden crear links nuevos.
- AC-13: validar a las 02:00 del sábado acepta un pase del viernes.
- AC-14: el escaneo no guarda user-agent ni IP.
- AC-15: 10 `UNKNOWN` seguidos bloquean el link 1 minuto.

## 9. Plan de pruebas

- Unit: clasificación de resultados, hoy de servicio con corte 06:00, generación de token
  (longitud, alfabeto), hash del link (`packages/service-core/test/...`).
- Integración con base: atomicidad (AC-5), CHECK de "exactamente un sujeto", pase `VOID`
  con cancelación, `undo`.
- Rutas (`apps/api/test/routes/...`): ambos caminos de autorización, contrato de errores,
  rate limit, que `display` no filtre datos.
- Guards: `check-purged-closed-list`, páginas sin sesión, `entity-qr-purpose` (no debe
  cambiar: se verifica que NO se tocó el enum).
- Web: isla de validación y estados.
- E2E: confirmar reserva, abrir correo, escanear (URL directa), validar con link de puerta.

## 10. Riesgos

- R-1: link de puerta filtrado. Vence, se revoca, hay `undo`, límite y registro (OQ-6).
- R-2: dos navegadores. La cámara del celular puede abrir otro navegador que el que guardó
  el link (por ejemplo, un navegador dentro de otra app). Mitigación: instrucciones, y
  código corto de reemplazo.
- R-3: capturas de pantalla compartidas. El primero en usarlo entra; es inherente al
  modelo sin pase rotativo. Se registra la hora para reclamos.
- R-4: se debe extender `listing-access` (OQ-G) o aceptar el gate por `venue_guest_list`.
- R-5: una excepción de tier nueva (`public` con credencial). Documentar.

## 11. Preguntas abiertas para el owner

Generales: HOS-2260, OQ-6 (quién valida). Específicas:

- OQ-F: **¿validar al escanear o ver y confirmar?** (1) **Validar y marcar al escanear,
  con deshacer 2 minutos (recomendada)**: rápido en una fila larga. Contra: un escaneo
  accidental marca un pase. (2) Mostrar y pedir "Dejar pasar": más lento, más seguro. Y
  **¿escáner propio dentro de la página?** Recomendada: no ahora (la cámara del sistema
  + código corto); implica una dependencia nueva, que se consulta antes.
- OQ-G: **gate de los links de puerta.** (a) Extender `listing-access` con
  `capabilitiesAnyOf` (recomendada). (b) Gatear por `venue_guest_list`. Impacto de (a):
  un cambio chico en `apps/api/src/middlewares/listing-access.ts` y su resolvedor.
- OQ-H: **vencimiento del link de puerta.** Recomendada: 6 h tras terminar el evento.
  Alternativa: manual (hasta revocarlo). Contra: se olvidan activos.

## 12. Dependencias

- Bloqueado por: HOS-2260 (OQ-6), HOS-2274 y HOS-2275 (sujetos del pase), HOS-2259 (claves).
- Habilita: HOS-2277 (pase por persona), HOS-2278 (beneficio en la puerta), HOS-2265
  (estadísticas por evento).

## 13. Smoke y What's New

`status-needs-smoke-staging` y `status-needs-smoke-local` (hace falta un celular real
escaneando). What's New: sí, junto a las listas y reservas.

## 14. Desglose de tareas

1. T-1: enums, tablas `venue_entry_pass`, `venue_entry_scan`, `venue_door_link`,
   migración, extras y filas PURGED (1 día).
2. T-2: servicio `mintOrGet` y `validatePass` con transacciones y `undo` (1 día).
3. T-3: rutas del dueño (validar, links de puerta) con gate (1 día).
4. T-4: ruta pública de puerta con credencial, rate limit y bloqueo (1 día).
5. T-5: `capabilitiesAnyOf` en `listing-access` (si se elige OQ-G a) (0,5 día).
6. T-6: PNG adjunto en correos y plantilla de pase (0,5 día).
7. T-7: páginas `/pase/[token]` y `/puerta/[linkToken]` e isla (1 día).
8. T-8: Mi cuenta (QR) y panel de links e ingresos (1 día).
9. T-9: consulta de estadísticas y cron de retención de escaneos (0,5 día).
10. T-10: pruebas de integración, E2E y guards (1 día).

## 15. Linear

Canonical tracking:
HOS-2276

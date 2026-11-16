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
**pase** con QR propio. En la puerta, el **dueño** lo escanea con el celular (con su sesión) y
ve: válido, ya usado, de otro día o cancelado. Al validar queda registrada la hora de
ingreso y el pase no se puede usar dos veces. El QR no lleva datos personales: es un
token opaco que solo resuelve quien está autorizado del lado del local.

Aplica las decisiones del owner del 16/11/2026 (HOS-2260), en especial **OQ-6**: el QR lo
valida **solo la cuenta del dueño**. No hay link de puerta, ni `capabilitiesAnyOf`, ni
cuentas de empleados: el personal de puerta pasa a **HOS-2295** (etapa 2). Esto difiere de
la recomendación original de la spec (link de puerta).

## 2. Problema

La lista y las reservas sirven de poco si en la puerta nadie puede comprobar quién tiene
lugar. Hoy se mira una captura de WhatsApp o un nombre en un papel. Se cuelan pases
repetidos y no hay registro de quién entró.

## 3. Goals

- G-1: un pase por anotación o reserva, visible en el correo y en Mi cuenta.
- G-2: validación en una sola acción, atómica: un pase no se usa dos veces.
- G-3: el escaneo registra hora y la cuenta que validó, y alimenta las estadísticas por evento.
- G-4: el QR no contiene datos personales.
- G-5: validar no depende del plan, para que lo ya confirmado funcione siempre.

## 4. Non-goals

- NG-1: link de puerta, cuentas con varios usuarios, cuentas de empleados o roles de puerta. Todo eso es HOS-2295.
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
| `used_by_id` | uuid null fk `users` | la cuenta del dueño que validó |
| `void_reason` | varchar(40) null | `CANCELLED`, `EVENT_SUSPENDED` |
| auditoría | | |

Índices: único `token`; `(venue_id, valid_date, state)`; único parcial por sujeto
(`WHERE state <> 'VOID'`) para que el pase sea idempotente por sujeto.

`venue_entry_scan` (solo inserción, sin auditoría ni soft delete, como `qr_code_scans`):
`id`, `venue_id`, `pass_id` null (token desconocido), `result` enum (`VALID`, `USED`,
`WRONG_DAY`, `CANCELLED`, `UNKNOWN`, `UNDONE`), `scanned_at`, `by_user_id`. **No
guarda user-agent ni IP.** Retención: 12 meses (cron compartida).

Las dos cuelgan de `venues` o de sus filas: sumar a `purged-closed-list.json` y al test
congelado. Los pases de un listing purgado se **borran** (no tienen PII propia). No existe
tabla de links de puerta (HOS-2295).

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
2. Un único `UPDATE venue_entry_pass SET state='USED', used_at=now, used_by_id WHERE token
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

**Solo la cuenta del dueño del local** (OQ-6). Una sola ruta, con sesión:

| Ruta | Tier | Autoriza |
|---|---|---|
| `POST /protected/venues/:id/entry-passes/:token/validate` | protected | sesión del dueño: `listingAccess` `{ vertical: VENUE, operation: 'READ_OWN_COMMERCIAL' }` **sin** `capabilities` (no se gatea validar) |
| `POST /protected/venues/:id/entry-passes/:token/undo` | protected | igual que el anterior |

Reglas:

- No hay credencial de puerta, ni ruta pública, ni `capabilitiesAnyOf` en `listing-access`,
  ni excepción de tier en `route-architecture.md`. La propiedad la resuelve el pipeline
  (paso 4); un rol nunca decide (G6).
- Por local, la cuenta solo valida pases de **ese** local.
- Errores: sin sesión, 401 `UNAUTHORIZED`; un local ajeno responde 404 (no se distingue de
  "no existe").
- Rate limit: 120 por minuto por cuenta. Además, 10 resultados `UNKNOWN` seguidos bloquean
  la validación de esa cuenta 1 minuto (anti-fuerza bruta).
- Tras una baja de plan: el dueño **sigue validando** con su sesión lo ya emitido (no se
  gatea).
- **Riesgo: contraseña compartida.** Como solo valida el dueño y no está siempre en la
  puerta, puede prestar su sesión o su contraseña al personal. El panel muestra un texto que
  lo desalienta ("No compartas tu contraseña. Abrí la validación en tu propio celular o
  acercate a la puerta"). Mitigaciones técnicas: `undo` de 2 minutos y registro de cada
  escaneo con la cuenta. La solución real (cuentas de personal con permisos propios) es
  HOS-2295.

### 6.6 Web

- `/pase/[token]` (ruta neutral al idioma, SSR, `cacheable: false`, `noindex`): una isla
  que lee el token de la URL. Con la sesión del dueño, valida y muestra una tarjeta grande:
  verde válido, rojo ya usado o cancelado, ámbar otro día. Sin sesión del dueño: "Este es un
  pase de ingreso. Solo el local puede validarlo". La página no lleva sesión en el HTML (guard
  de páginas sin sesión); la isla consulta la sesión en el cliente.
- Entrada manual por **código corto** como alternativa, dentro del panel del dueño.
- **No** hay escáner dentro de la página en esta etapa: la cámara del sistema abre
  `/pase/<token>`. Un escáner propio (BarcodeDetector no existe en iOS Safari) exigiría una
  librería nueva (p. ej. `jsQR`), y agregar dependencias se consulta (OQ-F).
- Mi cuenta: tarjeta del sujeto con el QR (SVG) y el código corto.
- Panel del local: pantalla "Validar ingresos" con el **texto que desalienta compartir la
  contraseña**, y "Ingresos" por evento: conteo de pases usados, por hora.

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
- AC-8: la cuenta del dueño valida solo pases de su local; sin sesión responde 401 y un local ajeno 404. No existe ruta de puerta con credencial propia.
- AC-9: la respuesta nunca incluye teléfono, nota ni email.
- AC-10: `undo` dentro de 2 minutos revierte; después responde 409 `INVALID_TRANSITION`.
- AC-11: cancelar la anotación o reserva deja el pase `VOID` en la misma transacción.
- AC-12: tras bajar de plan, el dueño sigue validando con su sesión.
- AC-13: validar a las 02:00 del sábado acepta un pase del viernes.
- AC-14: el escaneo no guarda user-agent ni IP.
- AC-15: 10 `UNKNOWN` seguidos bloquean la validación de esa cuenta 1 minuto.
- AC-16: la pantalla de validación del panel muestra el texto que desalienta compartir la
  contraseña.

## 9. Plan de pruebas

- Unit: clasificación de resultados, hoy de servicio con corte 06:00, generación de token
  (longitud, alfabeto) (`packages/service-core/test/...`).
- Integración con base: atomicidad (AC-5), CHECK de "exactamente un sujeto", pase `VOID`
  con cancelación, `undo`.
- Rutas (`apps/api/test/routes/...`): autorización del dueño, contrato de errores,
  rate limit, que `display` no filtre datos.
- Guards: `check-purged-closed-list`, páginas sin sesión, `entity-qr-purpose` (no debe
  cambiar: se verifica que NO se tocó el enum).
- Web: isla de validación y estados.
- E2E: confirmar reserva, abrir correo, escanear (URL directa), validar con la sesión del dueño.

## 10. Riesgos

- R-1: **contraseña compartida** (OQ-6). Solo el dueño valida, así que puede prestar su
  cuenta. Se desalienta con un texto en el panel; `undo` y registro por cuenta. Solución real
  en HOS-2295.
- R-2: el dueño no está en la puerta y debe prestar el celular con su sesión abierta. Es
  inherente a la decisión; HOS-2295.
- R-3: capturas de pantalla compartidas. El primero en usarlo entra; es inherente al
  modelo sin pase rotativo. Se registra la hora para reclamos.

## 11. Preguntas abiertas para el owner

OQ-6 (quién valida) está **decidida** en HOS-2260 (16/11/2026): solo la cuenta del dueño.
Las preguntas OQ-G (gate con `capabilitiesAnyOf`) y OQ-H (vencimiento del link de puerta)
**desaparecen** con el link de puerta y pasan a HOS-2295. Queda abierta:

- OQ-F: **¿validar al escanear o ver y confirmar?** (1) **Validar y marcar al escanear,
  con deshacer 2 minutos (recomendada)**: rápido en una fila larga. Contra: un escaneo
  accidental marca un pase. (2) Mostrar y pedir "Dejar pasar": más lento, más seguro. Y
  **¿escáner propio dentro de la página?** Recomendada: no ahora (la cámara del sistema
  + código corto); implica una dependencia nueva, que se consulta antes.

## 12. Dependencias

- Bloqueado por: HOS-2274 y HOS-2275 (sujetos del pase), HOS-2259 (claves).
- Etapa 2 (personal de puerta): HOS-2295.
- Habilita: HOS-2277 (pase por persona), HOS-2278 (beneficio en la puerta), HOS-2265
  (estadísticas por evento).

## 13. Smoke y What's New

`status-needs-smoke-staging` y `status-needs-smoke-local` (hace falta un celular real
escaneando). What's New: sí, junto a las listas y reservas.

## 14. Desglose de tareas

1. T-1: enums, tablas `venue_entry_pass` y `venue_entry_scan`, migración, extras y filas
   PURGED (1 día).
2. T-2: servicio `mintOrGet` y `validatePass` con transacciones y `undo` (1 día).
3. T-3: rutas del dueño (validar, undo) con sesión, rate limit y bloqueo (1 día).
4. T-4: PNG adjunto en correos y plantilla de pase (0,5 día).
5. T-5: página `/pase/[token]` e isla de validación (1 día).
6. T-6: Mi cuenta (QR), pantalla de validación con el texto contra compartir contraseña e
   ingresos (1 día).
7. T-7: consulta de estadísticas y cron de retención de escaneos (0,5 día).
8. T-8: pruebas de integración, E2E y guards (1 día).

## 15. Linear

Canonical tracking:
HOS-2276

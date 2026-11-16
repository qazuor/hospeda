---
title: Eventos de local - los eventos únicos pasados dejan de mostrarse
linear: HOS-2254
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - web
  - db
---

# Eventos de local: los eventos únicos pasados dejan de mostrarse

Hija de la épica HOS-2252 (Comer y salir). Fase 1: no toca el catálogo, se puede hacer ya.

## 1. Summary

Un evento de fecha única (`once`) hoy sigue en la ficha pública para siempre. Esta spec lo oculta cuando ya terminó, lo agrupa como «Pasados» en el editor del dueño y define la noción única de "evento activo" que después usa el tope por plan (HOS-2263).

## 2. Problem

- La ficha muestra «12 de septiembre, 21:00» en noviembre. Resta credibilidad al local.
- El único límite hoy es el tope fijo de 30 entradas (`VENUE_EVENTS_MAX_ENTRIES`). Con los pasados acumulados, el dueño llega a 30 y tiene que borrar a mano para poder cargar algo nuevo.
- La decisión 1 del owner (HOS-2253) dice que un evento pasado **no cuenta** como activo. Falta una definición única de "pasado" que compartan la API pública, el servicio y el editor.

## 3. Goals

- G-1. La API pública no devuelve eventos `once` pasados. Una sola implementación de "pasado", reusada por API, servicio y web.
- G-2. En el editor, los pasados salen agrupados aparte («Pasados»), con acciones borrar y duplicar.
- G-3. Los pasados no cuentan contra el tope de 30 de la agenda viva.
- G-4. Exponer `isPast` / `isLive` calculados en la lectura protegida, así el editor no recalcula con su propio reloj.

## 4. Non-goals

- NG-1. Tope por plan (HOS-2263), recurrencia por plan (HOS-2264), link de entradas (HOS-2255).
- NG-2. Borrado automático de pasados (cron). Queda como pregunta abierta, ver OQ-2.
- NG-3. Los eventos `weekly` nunca están "pasados": no tienen fecha de fin (el schema no tiene fecha de fin, a propósito).
- NG-4. Zona horaria por local. Hoy no existe (ver 5.4).

## 5. Current baseline (verificado en `origin/staging`, checkout `hospeda-spec-hos-2252-docs`)

### 5.1 Datos

- Tabla `venue_events`: `packages/db/src/schemas/venue/venue_event.dbschema.ts:44-80`. Columnas relevantes: `recurrence` (enum `once|weekly`), `date` (`date`, null si weekly), `weekday`, `startTime` (`time`, not null), `endTime` (`time`, null), `isActive` (bool, default true), `displayOrder`.
- Tipo `date`: el string `YYYY-MM-DD` vuelve tal cual. Tipo `time`: Postgres devuelve `HH:MM:SS`; `toClockTime` lo recorta a `HH:MM` (`packages/service-core/src/services/venue/venue.events.ts:112-131`).
- Schemas Zod: `packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts`. Tope `VENUE_EVENTS_MAX_ENTRIES = 30` (línea 54), aplicado al array completo en `VenueEventsReplacePayloadSchema` (líneas 303-315).

### 5.2 Lectura pública

- `apps/api/src/routes/venue/public/getBySlug.ts:122-124`: `activeVenueEvents = eventsResult.data.events.filter((event) => event.isActive)`. No filtra por fecha. Pasa `venueEvents` al proyector (línea 144).
- El proyector oculta la sección entera si el plan del dueño no tiene `manage_venue_events` (sección `venueEvents`, `packages/schemas/src/catalog/listing-sections.ts:108-117`, `readOnlyFields: ['venueEvents']`).
- Ya existe el patrón "hoy en la zona de mercado": `getTodayInMarketTimezone()` en `apps/api/src/services/calendar-sync/date-range.ts:63` (usa `Intl.DateTimeFormat`). El de web, `lib/venue/open-now-in-zone.ts`, evalúa el badge en `America/Argentina/Buenos_Aires` (`VENUE_OPEN_NOW_TIME_ZONE`, línea 32). El mismo archivo aclara que el local **no tiene** zona propia y que esa constante es el lugar único para revisarlo.
- El menú del día ya hace lo mismo: filtra por "hoy" en la zona de mercado dentro de la API (`getBySlug.ts:96-108`, `getVenueDailySpecials({ validOn: today })`). Ese comentario también explica la cola de cache: un especial vencido puede sobrevivir unos minutos en el borde.

### 5.3 Render

- `apps/web/src/components/venue/VenueEvents.astro` es "puramente presentacional": confía en que la API ya filtró (`isActive` y plan). No filtra nada (líneas 17-24 del comentario, 58-62 el `return` vacío).

### 5.4 Editor

- `VenueEventsManager.client.tsx` (482 líneas): carga con `GET /protected/venues/:id/events` (devuelve TODO, incluidos `isActive:false`, `getEvents.ts`), mantiene un `EventDraft[]` plano, `addEntry` frena en `VENUE_EVENTS_MAX_ENTRIES` (línea ~199), guarda con `PUT` la agenda completa. Sin agrupación, sin "duplicar".
- `EventDraft` no lleva `id` (`apps/web/src/lib/venue/venue-event-draft.ts`).
- El PUT hace delete-and-reinsert: los ids no son estables (`venue.events.ts:243-275`). No afecta esta spec, pero sí a HOS-2255 (ver ahí).

## 6. Proposed design

### 6.1 Definición única de "pasado"

Función pura nueva en `@repo/schemas`, junto al subtipo de evento (`packages/schemas/src/entities/venue/subtypes/venue.event.lifecycle.ts`, exportada desde el índice). Sin dependencias de librerías de fechas: compara strings `YYYY-MM-DD` y `HH:MM` ya convertidos a la zona.

```ts
/** Zone every venue lives in until a listing carries its own. */
export const VENUE_EVENT_TIME_ZONE = 'America/Argentina/Buenos_Aires';
/** Local time (next day) at which a once-event WITHOUT end time stops being published. */
export const VENUE_EVENT_NO_END_GRACE_TIME = '06:00';

export function isVenueEventPast(input: {
  readonly event: Pick<VenueEvent, 'recurrence' | 'date' | 'startTime' | 'endTime'>;
  readonly now: Date;
  readonly timeZone?: string; // default VENUE_EVENT_TIME_ZONE
}): boolean;
```

Reglas:

1. `weekly` nunca es pasado.
2. `once` con `endTime`: el fin es `date + endTime`. Si `endTime < startTime` (cruza medianoche, "22:00 a 02:00", caso que el schema admite a propósito, `venue.event.schema.ts` comentario de `refineRecurrenceShape`), el fin es `date + 1 día + endTime`.
3. `once` sin `endTime`: el fin es `date + 1 día + 06:00`. Razón: un boliche que anuncia "sábado 23:00" no debe desaparecer a las 00:00 en plena fiesta. Ver OQ-1.
4. Es pasado cuando "ahora en la zona" es **estrictamente mayor** al fin. "Ahora en la zona" se obtiene con `Intl.DateTimeFormat(...).formatToParts` (mismo método que `open-now-in-zone.ts`), nunca con `getHours()` del proceso. El día siguiente se calcula con aritmética UTC sobre el string (`Date.UTC`), nunca con `new Date('YYYY-MM-DD')` local (incidente documentado en `VenueEvents.astro`, líneas 40-45).

Helpers hermanos: `isVenueEventLive({ event, now })` = `isActive && !past`, y `partitionVenueEvents({ events, now })` -> `{ live, past }`.

### 6.2 API pública

`getBySlug.ts:122-124`: el filtro pasa a `isActive && !isVenueEventPast(...)`. Se filtra en la API, no en el render (el payload no debe traer eventos viejos). El reloj se inyecta (`now`) para poder testear; en el handler es `new Date()`.

Cache: igual que el menú del día, la cola es el TTL del cache global. Aceptable; no hay job. Documentarlo en el comentario del filtro.

### 6.3 API protegida

`GET /protected/venues/:id/events` sigue devolviendo todo (el dueño necesita ver los pasados). Cada evento suma dos campos calculados, no persistidos: `isPast: boolean`. `VenueEventPublicSchema` no cambia; se agrega un schema de salida del dueño (`VenueEventOwnerSchema = VenueEventPublicSchema.extend({ isPast })`) y `VenueEventsOutputSchema` del GET protegido lo usa. Alternativa descartada: que el editor calcule con su reloj, porque el navegador del dueño puede estar en otra zona.

### 6.4 Tope de 30

`VENUE_EVENTS_MAX_ENTRIES = 30` pasa a aplicarse a los eventos **no pasados** (vivos + apagados). Los pasados tienen su propio techo, `VENUE_EVENTS_MAX_PAST_ENTRIES = 60`, así que el techo del array completo es 90. Se valida en el servicio (`replaceVenueEvents`) con `partitionVenueEvents`, no en el schema del array (el schema no conoce la hora). El schema del payload sube a `.max(VENUE_EVENTS_MAX_ENTRIES + VENUE_EVENTS_MAX_PAST_ENTRIES)`. Error: `VALIDATION_ERROR` 400 con el mensaje `zodError.venue.events.max` (existente) y uno nuevo `zodError.venue.events.pastMax`. Ver OQ-2.

### 6.5 Web

- `VenueEvents.astro`: sin cambios de lógica (sigue confiando en la API). Sólo se actualiza el comentario de cabecera para citar el filtro de fecha.
- `VenueEventsManager.client.tsx`:
  - separa `entries` en dos listas con el `isPast` que llega de la API (los borradores recién creados en la sesión se tratan como vivos);
  - la sección «Pasados» va colapsada, debajo de la agenda viva, con contador;
  - cada pasado tiene «Duplicar» (crea un borrador vivo con los mismos datos, `date` vacía para obligar a elegir una nueva, `isActive: true`) y «Quitar» (el existente);
  - botón «Borrar todos los pasados».
  - Los pasados se reenvían en el PUT (el payload es el documento entero), salvo los quitados.
- Un pasado editado a una fecha futura vuelve a la lista viva en el próximo render (se recalcula con `isPast` local de sesión: función pura importada de `@repo/schemas`, con el `now` del navegador convertido a la zona fija; es sólo para agrupar mientras se edita, la verdad la sigue dando la API al recargar).

### 6.6 i18n (es / en / pt)

Claves nuevas bajo `venue.owner.editor.venueEventsManager.*` en `packages/i18n/src/locales/{es,en,pt}/venue.json`: `pastTitle` («Pasados»), `pastCount_one/_other`, `pastEmpty`, `duplicate`, `removeAllPast`, `removeAllPastConfirm`, `pastMaxReached_one/_other`. En `zodError` (misma carpeta que las existentes `zodError.venue.events.max`): `zodError.venue.events.pastMax`. Reusar las claves existentes `removeEntry`.

### 6.7 Catálogo

Ninguno. No hay claves nuevas ni migración de catálogo (por eso es Fase 1).

## 7. Data model / contracts

- Sin migración. Sin columnas nuevas.
- Contrato: `GET /api/v1/protected/venues/:id/events` agrega `isPast` por evento. `PUT` sin cambios de forma; cambia sólo el techo del array.
- Error contract (`apps/api/docs/error-contract.md`): sin códigos nuevos. 400 `VALIDATION_ERROR` por techo.

## 8. UX / UI behavior

1. El dueño ve «Agenda del local» con sus eventos vivos y, debajo, «Pasados (N)» colapsado.
2. «Duplicar» sobre un pasado agrega un evento vivo abajo de todo con foco en el campo fecha.
3. Si el dueño no tiene pasados, la sección no aparece.
4. En la ficha pública, un evento de la noche del sábado desaparece el domingo a las 06:00 (sin hora de fin) o al pasar su hora de fin.

## 9. Acceptance criteria

- AC-1. Dado un evento `once` con `date` = ayer y `endTime` pasado, cuando se pide `GET /public/venues/:slug`, entonces no figura en `venueEvents`.
- AC-2. Dado un `once` de hoy con `startTime 22:00` y `endTime 02:00`, a las 01:00 de mañana (zona AR) sigue publicado; a las 02:01 ya no.
- AC-3. Dado un `once` de hoy sin `endTime`, a las 23:30 de hoy sigue publicado; a las 06:01 de mañana ya no.
- AC-4. Dado un `weekly`, nunca se oculta por fecha.
- AC-5. Si todos los eventos son pasados, `venueEvents` no figura en el payload (mismo comportamiento que lista vacía hoy).
- AC-6. El cálculo es por zona `America/Argentina/Buenos_Aires`, no por UTC ni por el reloj del proceso: a las 21:30 AR (00:30 UTC del día siguiente) un evento de hoy 22:00 sigue publicado.
- AC-7. `GET /protected/venues/:id/events` devuelve los pasados con `isPast: true` y los apagados con `isActive: false`.
- AC-8. Con 30 eventos no pasados, agregar uno más falla con 400 `VALIDATION_ERROR`; con 30 no pasados y 25 pasados, guardar funciona.
- AC-9. En el editor, los pasados aparecen en «Pasados», se pueden duplicar y borrar (uno o todos).
- AC-10. Textos en es, en y pt; el guard de i18n pasa.
- AC-11. `isVenueEventPast` es la única implementación: no hay otra comparación de fechas de eventos en API ni web (grep en el PR).

## 10. Test plan

- Unit (`packages/schemas/test/entities/venue/venue.event.lifecycle.test.ts`, nuevo): tabla de casos con `now` inyectado. Casos trampa: cruce de medianoche, sin `endTime`, fin de mes (`2026-11-30` + 1 día), domingo `weekday 0`, 21:30 AR = 00:30 UTC.
- Unit (`packages/service-core/test/services/venue/venue.events.test.ts`): techo de no pasados y de pasados.
- Route (`apps/api/test/routes/venue/public/`): nuevo `venue-events-past.test.ts` con `getBySlug`. Reusar el patrón de `night-info.test.ts` y `menu-file-gate.test.ts`.
- Route protegida (`apps/api/test/routes/venue/protected/content-routes-chain.test.ts`): `isPast` presente.
- Web: `apps/web/test/components/venue/VenueEventsManager.past.test.tsx` (nuevo; agrupa, duplica, borra). Mutación a mano del filtro (cambiar `!` por nada) para comprobar que el test del público falla.
- Sin e2e propio. Smoke manual en staging (ver 13).

## 11. Risks and open questions for the owner

- R-1. Cola de cache de la ficha pública: un evento recién vencido puede verse hasta el TTL. Mismo trade-off ya aceptado para el menú del día.
- R-2. Un dueño con un local en otra zona (hoy no existe) vería mal el corte. La constante es el lugar único a revisar; ya está declarado así en `open-now-in-zone.ts`.
- R-3. El editor hoy recibe `isPast` sólo al cargar. Un evento que pasa mientras el dueño tiene el editor abierto se reagrupa al recargar. Aceptable.

**OQ-1. Evento sin hora de fin: ¿cuándo se considera pasado?**

1. Hasta las 06:00 del día siguiente (recomendada). Pro: cubre la noche entera del boliche. Contra: un evento de tarde sin hora de fin queda visible hasta la madrugada siguiente.
2. Hasta las 00:00 del día siguiente. Pro: simple. Contra: corta una fiesta en curso.
3. Obligar a cargar hora de fin. Pro: sin ambigüedad. Contra: rompe el contrato actual (`endTime` es opcional) y suma fricción.

**OQ-2. Tope de entradas pasadas y retención.**

1. Los pasados no cuentan para los 30; techo propio de 60 pasados; el dueño los borra a mano (recomendada). Pro: nada se borra solo, alinea con "no borrar nada" de la decisión 6. Contra: puede quedar basura de hasta 60 filas por local.
2. Cron que borra pasados con más de 90 días. Pro: tabla limpia. Contra: pierde datos que las estadísticas de HOS-2265 podrían querer comparar; sumar un job a `schedules.manifest.ts`.
3. Mantener 30 en total, pasados incluidos. Pro: cero cambios de tope. Contra: el dueño tiene que borrar pasados para poder cargar nuevos, el problema que esta spec quiere evitar.

## 12. Implementation notes

- No tocar `VenueEvents.astro` más que el comentario: la regla del repo es que la ficha no re-deriva filtros.
- La ficha sigue siendo "session-blind" (`cacheable-pages-are-session-blind.guard.test.ts`): el filtro es del lado API, no depende de sesión.
- Guard G1: nada de `vertical === 'venue'` en código compartido. La función vive en el subtipo de venue de `@repo/schemas`, no en un paquete común.
- Orden sugerido: ver "Task breakdown".

### Task breakdown

1. T-1. `venue.event.lifecycle.ts` + tests de tabla (0,5 día).
2. T-2. Filtro en `getBySlug` + test de ruta pública (0,5 día).
3. T-3. `isPast` en la salida protegida + techo de no pasados/pasados en `replaceVenueEvents` (0,5 día).
4. T-4. Editor: agrupación, duplicar, borrar pasados (1 día).
5. T-5. i18n es/en/pt (0,25 día).

## 13. Linear

Canonical tracking: HOS-2254. Padre: HOS-2252. Decisión base: HOS-2253 (decisión 1).

- Dependencias: ninguna. Bloquea HOS-2263 (el conteo de activos usa `isVenueEventLive`).
- Smoke: `status-needs-smoke-staging` (la zona horaria y el cache sólo se ven contra el entorno real). Sin `smoke-prod`.
- What's New: sí, entrada breve ("Los eventos únicos que ya pasaron dejan de mostrarse solos"), la escribe el flujo de smoke.

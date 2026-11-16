---
title: Eventos de local - tope de eventos activos según el plan
linear: HOS-2263
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - billing
  - api
  - web
---

# Eventos de local: tope de eventos activos según el plan

Hija de la épica HOS-2252. **Fase 3**: depende de las claves nuevas del catálogo (HOS-2259), que a su vez esperan la pasada final de HOS-1352. Esta spec también contiene la **regla de baja de plan para eventos** (decisión 6 del owner), que HOS-2264 y HOS-2265 reusan.

## 1. Summary

Se aplica el límite `max_venue_active_events` al guardar la agenda del local. Valores acordados (HOS-2253, decisión 1): básico 1, pro 10, premium sin tope. El tope es **por local** (no por dueño). Se cuentan los eventos **activos a la vez**: un semanal cuenta 1; un único pasado no cuenta (los borra un cron a los 60 días, HOS-2254); uno apagado por el dueño no cuenta, y al volver a prenderlo se vuelve a controlar el tope. Si se supera, la API responde 403 `LIMIT_REACHED`. El techo técnico de 30 sigue como seguro.

## 2. Problem

- Hoy cualquier plan con `manage_venue_events` puede cargar hasta 30 eventos. No hay diferencia comercial entre básico, pro y premium.
- La épica reparte "estar en el catálogo / operar / vender más" y los eventos activos son una de las palancas.
- Hace falta una regla de baja de plan que respete lo ya cargado: no borrar nada, frenar lo nuevo.

## 3. Goals

- G-1. Gate de límite `max_venue_active_events` en `PUT /protected/venues/:id/events`.
- G-2. Definición única de "evento activo" (reusa `isVenueEventLive` de HOS-2254).
- G-3. El editor muestra "X de N activos" y el upsell cuando se llega al tope.
- G-4. Regla de baja de plan sin borrar datos (sección 6.4).
- G-5. Soporte de add-ons: el límite se agrega con `SUM` (decisión 7), así que el pack "+5 eventos activos" (HOS-2285) funciona sin código nuevo.

## 4. Non-goals

- NG-1. Crear las claves y asignarlas a planes: son HOS-2259 (claves) y HOS-2280 (additive grant a los planes). Esta spec escribe el gate, no el catálogo.
- NG-2. Recurrencia (HOS-2264) y estadísticas (HOS-2265).
- NG-3. Un job que apague o archive eventos al bajar de plan (ver 6.4: todo se evalúa en vivo; el enforcement de la clave es `NONE`, decidido por el owner, ver OQ-3).

## 5. Current baseline (verificado en `origin/staging`)

### 5.1 Gate actual de la ruta

- `PUT .../events` (`apps/api/src/routes/venue/protected/putEvents.ts:81-91`) declara `listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id', listingSection: ({ body }) => [{ id: 'venueEvents', intent: ... }] }`. `listingSection` hace que el pipeline exija la clave de la sección: `venueEvents` -> `entitlementKey: K.MANAGE_VENUE_EVENTS` (`packages/schemas/src/catalog/listing-sections.ts:108-117`). El `intent: 'delete'` se aplica cuando el array viene vacío (vaciar no exige la clave).
- No hay `limit`. El único tope es `VENUE_EVENTS_MAX_ENTRIES = 30` (`venue.event.schema.ts:54`, usado en el schema del payload líneas 303-315, en el editor `VenueEventsManager.client.tsx:~199,323` y en la lectura `venue.events.ts:64`, `EVENTS_READ_PAGE_SIZE = 500`).
- Hoy `manage_venue_events` sólo está en los planes pro y premium del catálogo de producción (`scripts/production-catalog/catalog.ts:761` y `:891`; migración `0144_production_plan_catalog.sql:187,209`). La épica lo agrega a básico (HOS-2280).
- Tipo de la clave: `['manage_venue_events', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']` (`packages/schemas/src/catalog/entitlement-keys.ts:37`).

### 5.2 Mecanismo de límite del pipeline

- `ListingAccessConfig.limit` (`apps/api/src/types/authorization.ts:67`) es un callback; el middleware lo evalúa con `{ ctx, listingId, subjectId }` (`apps/api/src/middlewares/listing-access.ts:206-207`) y pasa `limit` al resolver, que lo evalúa en el **paso 7** (`packages/verticals/src/authorization/resolve-listing-access.ts:251-274`). Precedente de ruta de local/alojamiento: `accommodation/protected/addMedia.ts:42` con `accommodationGalleryPhotoLimit` (`apps/api/src/utils/listing-access/photo-limit.ts`).
- `resolveLimitStep` (`packages/verticals/src/authorization/limit-step.ts:13-45`): `requested > max` bloquea. `max = effective.limits.get(...) ?? fallbackMax ?? 0`: **un límite ausente vale 0 = sin acceso**.
- El middleware responde 403 `LIMIT_REACHED` con `details: { limitKey, currentCount: requested - 1, maxAllowed }` (`listing-access.ts:366-370`; contrato en `apps/api/docs/error-contract.md:96`).
- `enforceUserGate` (`apps/api/src/utils/listing-access/user-gate.ts:7-45`) hace lo mismo para rutas **sin listing**, por usuario+vertical (precedente `owner-promotion/protected/create.ts:44-62`). Esta ruta **sí** tiene listing, así que el camino correcto es `listingAccess.limit`, no `enforceUserGate`. El issue sugiere `enforceUserGate`; se difiere a la ruta del listado porque `listingAccess` ya tiene el contexto del local y el sujeto efectivo (acción administrativa de staff incluida, `subjectId`).
- `readEffectiveLimit` (`user-gate.ts:85-113`) lee un límite sin rechazar: sirve para mostrar "X de N" en el editor.

### 5.3 Valores y agregación

- `plan_version_limit.value` es `integer` con `CHECK (value >= 0)` (`packages/db/src/schemas/vertical/plan-catalog.dbschema.ts:195-201`). `2147483647` (= `UNLIMITED_LIMIT_VALUE`) es el máximo int4. Con `SUM`, un add-on sobre premium puede desbordar int4; **verificar en HOS-2259** que ningún valor sumado se persista en una columna int4 y acotar al máximo si hace falta (decisión 7). Esta spec calcula en memoria (JS `number`) y compara; no persiste sumas.
- `max_active_promotions` (alojamiento) es `SUM` con enforcement `ARCHIVE` (`packages/schemas/src/catalog/limit-keys.ts:18`); el campo `enforcement` ("qué se hace con el exceso persistido") se declara por clave. Ver 6.1.

### 5.4 Web

- `apps/web/src/lib/billing-limit-error.ts`: `KNOWN_LIMIT_KEYS` (línea ~75) lista las claves con bloque propio `billing.limit.<key>.*`; una clave fuera cae en `billing.limit.generic.*`. Hay que sumar `max_venue_active_events`.
- `useListingPlanGate` (`apps/web/src/hooks/useListingPlanGate.ts`) ya lee el effective set para el editor; no entrega **valores** de límites. El editor de eventos hoy sólo conoce el 403 de entitlement (`VenueEventsManager.client.tsx`, `result.error.status === 403` => upsell).
- Upsell: `resolveVenueUpsellPlans` (`apps/web/src/lib/venue/section-upsell-plan.ts:55-64`) resuelve el nombre del plan que habilita la sección desde el catálogo; **la UI lee el catálogo**, nunca un mapa hardcodeado (HOS-1967).

## 6. Proposed design

### 6.1 Catálogo (lo declara esta spec, lo ejecuta HOS-2259)

Fila nueva en `packages/schemas/src/catalog/limit-keys.ts`:

```ts
['max_venue_active_events', 'vertical', 'SUM', 'NONE', 'COMMERCIAL']
```

- `SUM`: decisión 7 (add-ons suman).
- Decidido (owner, 16/11/2026): enforcement **`NONE`**, no `ARCHIVE`: `ARCHIVE` dice "se archivan los excedentes más nuevos" (`key-attributes.ts:42`), exactamente lo contrario de la decisión 6 (respetar lo cargado). `NONE` = "nada persistido para reconciliar; el gate se evalúa en vivo" (`key-attributes.ts:45`), que es lo que hace esta spec.
- Valores por plan los fija HOS-2280 (básico 1, pro 10, premium 2147483647). Esta spec no toca el catálogo (regla de las versiones inmutables: sólo se **agregan** claves con additive grant, precedente `0202_hos_2105_faq_draft_catalog.sql` + data-migration de seed `0168-hos-2105-faq-draft-plan-version-grant.ts`).
- Guards: G3 (`check-catalog-key-usage`): la clave debe existir en el catálogo antes de usarse en código, por eso esta spec va **después** de HOS-2259. G18 (`check-catalog-sql`) valida el SQL generado; G7: ningún precio ni valor comercial en código (los 1/10/∞ NO se escriben en TS).

### 6.2 Definición de "activo"

En `@repo/schemas`, junto al ciclo de vida de HOS-2254:

```ts
export function countActiveVenueEvents(input: {
  readonly events: readonly Pick<VenueEvent,
     'recurrence'|'date'|'startTime'|'endTime'|'isActive'>[];
  readonly now: Date;
  readonly recurrenceAllowed: boolean; // trait de HOS-2264; true cuando no se evalúa
}): number;
```

Cuenta un evento si: `isActive` **y** (`weekly` y `recurrenceAllowed`, o `once` y no pasado). Un `weekly` cuenta 1. Un `once` pasado no cuenta (HOS-2254). Un evento apagado (`isActive:false`) no cuenta: es la forma de "guardar" un evento sin gastar un lugar. Al **prenderlo** (`isActive` pasa a `true`) vuelve a contar y el tope se re-controla: eso lo resuelve la regla "sin aumento neto" de 6.3, porque la agenda resultante tiene un activo más que la actual y, si supera el máximo, el PUT devuelve `LIMIT_REACHED`. El conteo es siempre sobre los eventos de **un** local (el del `:id` de la ruta), nunca sumando los demás locales del dueño (OQ-1). Un `weekly` en borrador por plan (ver 6.4) no cuenta.

### 6.3 Gate en la ruta

`putEvents.ts` declara:

```ts
listingAccess: {
  vertical: VerticalEnum.VENUE, operation: 'EDIT', idParam: 'id',
  listingSection: ...,
  limit: venueActiveEventsLimit   // nuevo, apps/api/src/utils/listing-access/venue-events-limit.ts
}
```

1. `ListingAccessConfig.limit` hoy no recibe el body. Se amplía la firma a `{ ctx, listingId, subjectId, body }` (cambio chico y aditivo en `apps/api/src/types/authorization.ts:67` y en `listing-access.ts:207`; los callbacks existentes lo ignoran).
2. `venueActiveEventsLimit` calcula `resulting = countActiveVenueEvents(body.events)` (la agenda **resultante** de ese local, porque el PUT reemplaza todo) y `previous = countActiveVenueEvents(filas actuales)`.
3. Devuelve `{ key: 'max_venue_active_events', requested: resulting <= previous ? 0 : resulting }`. Es la **regla "sin aumento neto"** de la baja de plan (6.4): un dueño que ya está por encima del tope puede seguir editando mientras **no suba** su cantidad de activos. Un `requested` de 0 nunca supera ningún máximo (ni el 0 de "sin clave"; si la clave falta del todo, `resulting <= previous` igual pasa, y la sección ya la gatea `manage_venue_events`).
4. Si `resulting > previous` y `resulting > max` => 403 `LIMIT_REACHED` `{ limitKey, currentCount: resulting - 1, maxAllowed }`. Por la fórmula del middleware (`requested - 1`), `currentCount` es "resultante menos uno". Para un alta de a un evento coincide con el conteo real. Si se agregan varios de una vez el número es mayor al real: el editor muestra sus **propios** números (6.5), no los del error. Se deja asentado en el contrato.
5. El techo `VENUE_EVENTS_MAX_ENTRIES` (HOS-2254: 30 no pasados, los pasados no cuentan) sigue aplicándose en el servicio, como seguro. Si el plan da `2147483647`, manda el techo de 30.
6. Orden del pipeline sin cambios: sección y entitlement (paso 6) antes que límite (paso 7). Un plan sin `manage_venue_events` recibe 403 `ENTITLEMENT_REQUIRED`, no `LIMIT_REACHED`.

Guards y contrato: G2 (`VerticalEnum.VENUE` en la ruta, ya está), G6 (el rol no decide: la ruta sigue por `listingAccess`), G1 (sin `vertical === 'venue'` en código compartido: el helper vive en un archivo de venue). `check-step5-declared` y `OPERATION_STEP6_KEY` no aplican: no se agrega una operación nueva al pipeline, se usa `EDIT` con la sección que ya existe.

### 6.4 Baja de plan (decisión 6) para eventos

Principio: **se respeta lo cargado, se frena lo nuevo, se oculta lo que el plan nuevo no incluye, sin borrar nada.** Todo se evalúa **en vivo**, sin jobs ni columnas de estado. Matriz para un local con eventos cargados que baja de plan (ej. premium a pro, pro a básico):

| Caso | Visible en ficha pública | En el editor | Escritura |
|---|---|---|---|
| Evento único vivo, el plan nuevo tiene tope menor | **Sí, hasta su fecha** (no se toca) | Visible y editable | Se puede guardar sin aumentar la cantidad de activos; no se pueden **sumar** nuevos mientras `resulting > max` |
| Evento único pasado | No (HOS-2254) | En «Pasados» | Igual que antes |
| Evento semanal, plan sin `venue_event_recurrence` | **No** (queda en borrador, ver HOS-2264) | Visible con la marca «Borrador: tu plan no incluye eventos recurrentes» | Se puede quitar; no se puede crear ni reactivar uno nuevo |
| Evento semanal, el dueño sube de plan | **Vuelve solo** | Normal | Normal |
| Plan sin `manage_venue_events` (hoy: basic o gratis) | No (sección entera oculta, ya existe: `getBySlug` proyector) | Sección en modo bloqueado de lectura/«vaciar» (existe) | 403 `ENTITLEMENT_REQUIRED`, salvo vaciar |

"Borrador" no es una columna nueva: es el estado derivado "semanal sin entitlement de recurrencia". La columna `isActive` sigue siendo exclusivamente del dueño (apagar a mano). Se descartó persistir un `status` por evento porque (a) una baja y una subida de plan no dejan ningún job que mantener, (b) evita estados desfasados si cambia el catálogo, (c) es el mismo criterio con el que ya se oculta la sección entera.

Consecuencia sobre el conteo: los borradores no cuentan como activos (6.2). Al volver el entitlement, los semanales cuentan otra vez; como la subida de plan sube también el tope, no hay riesgo de quedar por encima. Si el dueño baja y vuelve a subir al mismo tier nada cambió.

Consecuencia sobre guardados: un dueño de básico con 6 únicos cargados (venía de pro) puede corregir un typo en uno de ellos y guardar; no puede sumar un séptimo. Para volver a sumar, tiene que bajar a `resulting <= max` (en básico, a 1 activo) o subir de plan.

### 6.5 API de lectura y editor

- `GET /protected/venues/:id/events` agrega un bloque `limits` al envelope: `{ maxActiveEvents: number, activeCount: number, recurrenceAllowed: boolean }`. `maxActiveEvents` sale de `readEffectiveLimit({ userId: subjectId, vertical: VENUE, key: 'max_venue_active_events' })` (devuelve 0 si falta la clave o si la lectura falla: **falla cerrado**, consistente con el pipeline; el editor sólo la usa para mostrar, el PUT decide). `activeCount` usa `countActiveVenueEvents`. `recurrenceAllowed` lo resuelve HOS-2264 (en esta spec: `true` hasta que exista el trait).
- `VenueEventsManager.client.tsx`:
  - cabecera: «Eventos activos: 1 de 1» (o «1 de ilimitados» cuando `maxActiveEvents >= UNLIMITED_LIMIT_VALUE`, sin mostrar 2147483647);
  - al llegar al tope, «Agregar evento» queda deshabilitado, con un texto y el upsell (nombre del plan que mejora el límite **leído del catálogo**, `resolveUnlockingPlanName`/ `fetchAudiencePlans`, nunca un mapa fijo);
  - al guardar, un 403 con `code === 'LIMIT_REACHED'` se distingue del 403 `ENTITLEMENT_REQUIRED`: hoy `VenueEventsManager` trata **todo 403** como falta de plan (`setIsLocked(true)`). Se separa por `error.code` (patrón `useCollectionMutation.ts:160`);
  - `max_venue_active_events` entra en `KNOWN_LIMIT_KEYS` (`billing-limit-error.ts:75`).
- Plan comparison: la fila de eventos del cuadro de planes lee el límite del catálogo (`plan-comparison-catalog-rows.ts:121-126`); el texto de la fila es de HOS-2262. Si la fila debe mostrar "1 / 10 / ilimitados", lo resuelve esa spec leyendo el valor, no esta.

### 6.6 i18n (es / en / pt)

- `billing.limit.max_venue_active_events.{title,message_one,message_other,cta}` («Llegaste al límite de eventos activos», «Ya tenés {{currentCount}} de {{maxAllowed}} evento activo en tu plan...»).
- `billing.limit.<key>` en los dos mapas que hoy listan nombres/descripciones de límites (`billing.json` líneas ~773 y ~798 en es): «Eventos activos del local» y «Cuántos eventos podés tener activos a la vez. Un evento semanal cuenta como uno; los que ya pasaron no cuentan».
- `venue.owner.editor.venueEventsManager.{activeCount, activeUnlimited, limitReached, limitReachedUpsell, draftByPlan}`.

## 7. Data model / contracts

- DB: ninguna tabla ni columna nueva. Sí catálogo (HOS-2259/2280): una fila de `limit_catalog`/key `max_venue_active_events`, y sus filas `plan_version_limit` por additive grant.
- API: `PUT` sin cambios de forma; nuevos errores posibles: 403 `LIMIT_REACHED` (ya existe en el contrato, `details { limitKey, currentCount, maxAllowed }`). `GET` agrega `limits`.
- Middleware: firma de `limit` suma `body` (aditivo).
- Sin migración estructural. Carriles: **catálogo** (HOS-2259, migración generada por `pnpm gen:catalog-sql --load=catalog_key`) y **seed data-migration** para versiones publicadas desde el admin (HOS-2280), según el procedimiento de la épica. Esta spec no escribe SQL.

## 8. UX / UI behavior

1. Básico (1 evento): el dueño ve «Eventos activos: 1 de 1». Para cargar otro, apaga el actual (queda guardado, no cuenta) o pasa a pro.
2. Pro (10): ve «3 de 10». Premium: «5 (sin tope)».
3. Al intentar pasar el tope: el botón agregar se deshabilita y aparece «Llegaste al máximo de eventos activos de tu plan» con el link al upsell; el servidor igual lo bloquea con 403.
4. Un dueño que bajó de plan ve un aviso: «Tu plan permite N eventos activos. Los que ya cargaste se mantienen hasta su fecha; no podés sumar nuevos hasta bajar de N.»

## 9. Acceptance criteria

- AC-1. Dado básico (límite 1) con 1 evento único vivo, `PUT` con 2 únicos vivos devuelve 403 `LIMIT_REACHED` `{ limitKey: 'max_venue_active_events', maxAllowed: 1 }`.
- AC-2. Dado básico con 1 vivo y 1 `isActive:false`, `PUT` con ambos y un tercero apagado se acepta (no cuentan los apagados). Prender uno de los apagados deja 2 activos y devuelve `LIMIT_REACHED`.
- AC-2b. El conteo es por local: un dueño de básico con 1 evento activo en el local A puede cargar 1 activo en el local B.
- AC-3. Dado un único con fecha pasada, no cuenta: básico con 1 vivo + 5 pasados guarda bien.
- AC-4. Un semanal cuenta 1, sin importar cuántas semanas pasaron.
- AC-5. Dado pro (10), 10 activos se aceptan y 11 devuelven `LIMIT_REACHED` con `maxAllowed: 10`.
- AC-6. Dado premium (`2147483647`), no hay tope por plan; rige el techo técnico de 30 no pasados (400 `VALIDATION_ERROR`).
- AC-7. Dado un add-on que suma +5 al límite de pro (`SUM`), el máximo efectivo es 15 sin cambios de código.
- AC-8. **Baja de plan**: dado un local que venía de pro con 8 únicos vivos y ahora es básico, un `PUT` que mantiene los 8 (corrigiendo un título) se acepta; uno que agrega un noveno devuelve `LIMIT_REACHED`; uno que reduce a 5 se acepta.
- AC-9. Dado un plan sin la clave `max_venue_active_events` (ausente = 0) y con `manage_venue_events`, `PUT` que **suma** activos devuelve `LIMIT_REACHED` `maxAllowed: 0`; uno que no suma pasa.
- AC-10. Dado un plan sin `manage_venue_events`, `PUT` devuelve 403 `ENTITLEMENT_REQUIRED` (no `LIMIT_REACHED`): el paso 6 va antes que el 7. `PUT { events: [] }` (vaciar) sigue permitido.
- AC-11. Nunca se borra una fila por cambiar de plan: tras una baja y una subida los mismos eventos están (`SELECT count(*)` igual).
- AC-12. El editor muestra «X de N» y «sin tope» para valores >= `UNLIMITED_LIMIT_VALUE`, y distingue `LIMIT_REACHED` de `ENTITLEMENT_REQUIRED` en el toast.
- AC-13. Un staff con acción administrativa sobre un local ajeno es evaluado con el límite del **dueño** (sujeto efectivo), no el del staff.
- AC-14. Es un 403, nunca 500, con `details` completo (`limitKey`, `currentCount`, `maxAllowed`), y cumple el orden del contrato de errores (auth, permiso, forma 400, existencia 404, reglas).
- AC-15. Guards G1, G2, G3, G6, G7, G18 y `check-step5-declared` pasan.

## 10. Test plan

- Unit (`packages/schemas/test/entities/venue/venue.event.lifecycle.test.ts`): `countActiveVenueEvents` (semanal 1, pasado 0, apagado 0, borrador por plan 0; prender un apagado lo cuenta).
- Unit del helper del límite (`apps/api/test/utils/listing-access/venue-events-limit.test.ts`, nuevo): regla "sin aumento neto", `resulting <= previous` devuelve 0.
- Route (`apps/api/test/routes/venue/protected/content-routes-chain.test.ts`, existente, y un nuevo `venue-events-limit.test.ts`): AC-1 a AC-10 con effective set simulado (patrón de `apps/api/test/routes/content-gates.venue-experience.test.ts`, que ya simula `manage_venue_events`).
- Integración (BD real, `packages/db/test/integration/`): un set de dos guardados con baja de plan simulada, AC-11 por conteo de filas.
- Web: `VenueEventsManager.limit.test.tsx` (nuevo; contador, deshabilitado, distinción 403) y el guard existente `venue-editor-upsell-no-plan-names.guard.test.ts` (no hardcodear nombres de plan).
- Guard de i18n: `billing-limit-key-i18n-coverage.guard.test.ts` (exige que toda clave de límite esté en `KNOWN_LIMIT_KEYS` y con bloque en los 3 idiomas).
- Mutación manual: cambiar `resulting <= previous ? 0` por `resulting` y comprobar que AC-8 falla; cambiar `isActive` en el conteo y comprobar que AC-2 falla.
- E2E (Playwright, `apps/e2e`): no hace falta propio; cubre el smoke de staging (ver 13).

## 11. Risks and open questions for the owner

- R-1. Regla "sin aumento neto": un dueño sobre el tope puede intercambiar (borrar uno y crear otro) manteniendo la cantidad. Es el comportamiento deseado ("se respeta lo cargado").
- R-2. `currentCount` del error es `resultante - 1`; para altas de varios a la vez es aproximado. Mitigado con los números propios del editor.
- R-3. Dependencia de bloqueo: HOS-2259 (claves) y la pasada final de HOS-1352. Mientras tanto la ruta no puede declarar la clave (G3 lo rechaza).
- R-4. `UNLIMITED_LIMIT_VALUE` con `SUM` y add-ons puede superar int4 al sumar. Está en HOS-2259; acá nunca se persiste la suma.
- R-5. El cambio de firma de `limit` toca un middleware compartido; es aditivo, pero hay que correr los tests de todas las rutas con `listingAccess.limit`.

**OQ-1. ¿El límite es por local o por dueño?** Decidido (owner, 16/11/2026): por local. "Eventos activos a la vez" se entiende por ficha y un dueño con 3 locales de pro no comparte 10 entre todos. Costo asumido: el dueño con muchos locales multiplica sus eventos.

**OQ-2. ¿Un evento apagado (`isActive:false`) cuenta como activo?** Decidido (owner, 16/11/2026): no cuenta, y al prenderlo se vuelve a controlar el tope. Es la forma de guardar un evento sin gastar lugar. Los eventos pasados tampoco cuentan.

**OQ-3. Enforcement declarado de la clave.** Decidido (owner, 16/11/2026): `NONE`. Se evalúa en vivo y no se archiva nada; coherente con la decisión 6. La clave no participa de ningún reconciliador de `ARCHIVE`.

## 12. Implementation notes

- `listing-access.ts:207` es el único call site de `config.limit`; el cambio de firma es seguro.
- La carga de "previous" es una lectura extra por guardado (30 filas máx.); es aceptable y se hace una sola vez por request.
- El helper del límite va en `apps/api/src/utils/listing-access/venue-events-limit.ts`, junto a `photo-limit.ts`.
- Si HOS-2264 (recurrencia) aún no está, `recurrenceAllowed` es `true` en todos lados; el parámetro existe desde acá para no reabrir la firma.

### Task breakdown

1. T-1. `countActiveVenueEvents` + tests de tabla (0,5 día; depende de HOS-2254 y de la regla de los apagados: re-control al prender).
2. T-2. Ampliar `limit` con `body` y helper `venueActiveEventsLimit` + regla sin aumento neto (1 día).
3. T-3. Declarar `limit` en `putEvents.ts` + tests de ruta AC-1 a AC-10 (1 día; **bloqueada por HOS-2259**).
4. T-4. `GET` con bloque `limits` (0,5 día).
5. T-5. Editor: contador, tope, upsell, separación de 403 (1 día).
6. T-6. `KNOWN_LIMIT_KEYS` + i18n es/en/pt + guard (0,5 día).

## 13. Linear

Canonical tracking: HOS-2263. Padre: HOS-2252. Decisiones: HOS-2253 (1, 2, 6, 7) y del 16/11/2026 (tope por local, apagados no cuentan, pasados no cuentan, enforcement `NONE`).

- Dependencias: HOS-2254 (pasado = no cuenta), HOS-2291 (ids estables de eventos, necesario para distinguir lo existente), **HOS-2259** (clave), HOS-2262 (textos del cuadro de planes), HOS-2280 (valores por plan, additive grant), HOS-2285 (add-on +5).
- Smoke: `status-needs-smoke-staging` (toca billing, entitlements y límites: el checklist de `docs/billing/smoke-checklist.md`, sección staging, es obligatorio). No toca el núcleo de billing, así que no pide `smoke-prod`.
- What's New: sí, en la entrega conjunta de HOS-2284 (presentación y novedades), no por separado.

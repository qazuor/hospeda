---
title: Eventos de local - fechas recurrentes solo en pro y premium
linear: HOS-2264
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - billing
  - api
  - web
---

# Eventos de local: fechas recurrentes solo en pro y premium

Hija de la épica HOS-2252. **Fase 3**: depende de la clave nueva `venue_event_recurrence` (HOS-2259). La regla de baja de plan está en HOS-2263 sección 6.4; acá se aplica a los semanales.

## 1. Summary

La recurrencia semanal («Todos los jueves») hoy la tiene cualquier plan con eventos. Cuando básico tenga 1 evento, la recurrencia pasa a ser de pro en adelante (decisión 2 del owner). Se implementa como un **trait** de la sección `venueEvents` (clave `venue_event_recurrence`), siguiendo el mismo patrón que la carta usa para fotos por plato y traducciones.

## 2. Problem

- Un semanal es el evento más valioso para el local (happy hour todos los martes) y no debería regalarse en el plan básico.
- Para básico con 1 evento, la propuesta es: "un evento de fecha única"; lo recurrente es operar el local, pro.
- Hace falta decidir qué pasa con los semanales ya cargados cuando el local baja de plan.

## 3. Goals

- G-1. Al guardar un evento `weekly` nuevo (o convertir un `once` en `weekly`), exigir `venue_event_recurrence`.
- G-2. Sin la clave, el editor sólo ofrece «fecha única» y muestra el upsell.
- G-3. Baja de plan: los semanales ya cargados quedan en **borrador** (no se publican), no se borran, y vuelven solos al subir (HOS-2263 6.4).
- G-4. Un dueño sin la clave puede seguir editando el resto de su agenda sin ser bloqueado por semanales viejos.

## 4. Non-goals

- NG-1. Nuevos tipos de recurrencia (mensual, quincenal, fin de semana): el schema lo excluye a propósito (`venue.event.schema.ts`, cabecera "Recurrence is two shapes, on purpose").
- NG-2. Tope (HOS-2263), estadísticas (HOS-2265).
- NG-3. Persistir un estado "borrador" por evento (se deriva en vivo).

## 5. Current baseline (verificado en `origin/staging`)

- Modelo: `recurrence` es `once | weekly` (`packages/db/src/schemas/venue/venue_event.dbschema.ts:44`, `VenueEventRecurrenceSchema` en `venue.event.schema.ts:67`). Reglas de forma en `refineRecurrenceShape` (líneas 185-243): `weekly` exige `weekday` y prohíbe `date`.
- Sin gate: `PUT .../events` (`putEvents.ts:81-91`) sólo exige `manage_venue_events` vía la sección. Todo plan con la sección puede guardar semanales.
- Patrón de trait ya implementado para la carta: `listing-sections.ts:81-98` declara `traits: [{ id: 'itemPhotos', entitlementKey: K.MENU_ITEM_PHOTOS }, { id: 'translations', ... }]`; la ruta `putMenu.ts:91-94` devuelve `sectionTraits: ({ body }) => [ ...(menuPayloadCarriesItemPhoto(body) ? ['itemPhotos'] : []), ... ]`; `ListingAccessWithSections.sectionTraits` acepta función con `body` (`apps/api/src/middlewares/listing-access.ts:59-61`, evaluada en la línea 214-216); el proyector público oculta lo que no está disponible con `projectVenueMenuTraits` (`apps/api/src/utils/public-listing-projector.ts:28-62`, lee `menu.traits.get('itemPhotos') === 'available'`).
- Rutas con gate de clave por capacidad: `capabilities: ['issue_experience_certificate']` (`apps/api/src/routes/experience/protected/certificates.ts:152`, HOS-1643); también admite función con `body`.
- Editor: `VenueEventEntryCard.client.tsx` ofrece el selector de recurrencia (`once`/`weekly`), `setRecurrence` en `VenueEventsManager.client.tsx` (~líneas 200-230), y `EMPTY_DRAFT` arranca en `weekly` (línea ~97 del manager: `recurrence: 'weekly'`). El default tendrá que cambiar.
- Estado público actual: `VenueEvents.astro` renderiza `weekly` como «Todos los {{weekday}}»; no sabe de planes.
- Ya existe `useListingPlanGate` (lee el effective set; gate `open | preTrial | plan`) y `resolveUnlockingPlanName` para el upsell desde el catálogo (`section-upsell-plan.ts:20-28`).
- Catálogo: la clave no existe aún (HOS-2259). Reglas: sólo se AGREGAN claves; versiones de plan inmutables.

## 6. Proposed design

### 6.1 Catálogo (declarado acá, ejecutado en HOS-2259/2280)

- Entitlement: `['venue_event_recurrence', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']` en `entitlement-keys.ts` + `key-enums.ts` (`EntitlementKeyEnum.VENUE_EVENT_RECURRENCE`).
- Trait en la sección `venueEvents` (`listing-sections.ts:108-117`):

```ts
traits: [{ id: 'recurrence', entitlementKey: K.VENUE_EVENT_RECURRENCE }]
```

Hoy esa sección tiene `readOnlyFields: ['venueEvents']` y ningún trait. Se mantiene `readOnlyFields` (la sección se retira entera cuando no hay `manage_venue_events`). El trait **no** lleva `fields` (no oculta una columna del payload); el filtrado de semanales lo hace un proyector específico (6.3), igual que `projectVenueMenuTraits` filtra campos anidados de la carta.

- Asignación a planes: pro y premium (HOS-2280, additive grant). Esta spec no la hace.
- Guards: G3 (la clave tiene que estar en el catálogo antes del código), G18, G7.

### 6.2 Escritura: gate al guardar

`putEvents.ts` agrega:

```ts
sectionTraits: ({ body }) => venueEventsPayloadCarriesNewWeekly(body) ? ['recurrence'] : []
```

`venueEventsPayloadCarriesNewWeekly` **no** puede mirar sólo "hay un semanal en el payload", porque un dueño sin la clave con un semanal viejo (en borrador) quedaría trabado para guardar cualquier otra cosa. Compara el payload contra lo guardado (requiere ids estables, HOS-2291):

1. Un semanal es "nuevo" si no trae `id`, o su `id` no pertenece al local, o su `id` existe pero la fila guardada era `once` (conversión a semanal).
2. Un semanal con `id` de una fila ya `weekly` **no** requiere la clave (se conserva; sigue en borrador). Cambiarle el día o la hora tampoco (es un cambio de contenido de algo que ya tenía). Pasarlo de `isActive:false` a `true` **sí** cuenta como reactivar algo que el plan no incluye: requiere la clave (mismo criterio que "no reactivar" de HOS-2263 6.4).
3. Quitar un semanal nunca requiere la clave.

La comparación vive en un helper puro (`apps/api/src/routes/venue/protected/putEvents.helpers.ts`) que recibe el body y las filas actuales del local.

Problema: hoy `sectionTraits` (y `capabilities`) se evalúan sólo con el **body**, sin acceso a la BD (`listing-access.ts:59-61, 208-216`), y la comparación necesita las filas guardadas. Opción A (recomendada): ampliar la firma de `sectionTraits` a `({ body, ctx, listingId })` y que el middleware haga `await` del resultado. Es aditivo y es el mismo tipo de cambio que HOS-2263 hace a `limit`; conviene un único PR de middleware con ambos. Opción B: dejar el middleware como está y lanzar desde `replaceVenueEvents` el mismo `ENTITLEMENT_REQUIRED { entitlementKey: 'venue_event_recurrence' }`. Ver OQ-1.

Resultado al fallar: 403 `ENTITLEMENT_REQUIRED` con `details.entitlementKey = 'venue_event_recurrence'` (contrato `error-contract.md:93`). El editor lo distingue del 403 `LIMIT_REACHED` por `code`.

El `intent` de la sección no cambia (`delete` cuando el array viene vacío no requiere ni la clave de la sección).

### 6.3 Lectura pública: semanales en borrador

`getBySlug.ts` ya pasa `venueEvents` al proyector. Se agrega `projectVenueEventTraits(listing, states)` en `public-listing-projector.ts` (mismo estilo que `projectVenueMenuTraits`): si `states.get('venueEvents')?.state === 'available'` y `traits.get('recurrence') !== 'available'`, filtra `weekly`; si queda vacío, quita el campo. Resultado: el semanal de un plan sin la clave **no se publica**, pero tampoco se borra: un `SELECT` muestra la fila intacta (AC-4).

Sin job, sin columna. Al subir de plan el trait pasa a `available` y los semanales reaparecen en la siguiente lectura (el TTL del cache global es la cola; igual que cualquier cambio de plan hoy).

### 6.4 Lectura protegida y editor

- `GET .../events` agrega a cada evento `isDraftByPlan: boolean` (= `recurrence === 'weekly' && !recurrenceAllowed`) y el bloque `limits.recurrenceAllowed` (el que HOS-2263 dejó en `true`; acá se resuelve con `readEffectiveKeys({ keys: ['venue_event_recurrence'] })`, `user-gate.ts:50-83`, que **falla cerrado** a `false` si no se puede leer).
- `VenueEventEntryCard.client.tsx`: prop `recurrenceAllowed`. Sin la clave, el selector de recurrencia no ofrece «Todas las semanas» (sólo «Un solo día») en eventos **nuevos**; junto al selector, un texto de upsell («Los eventos que se repiten todas las semanas están disponibles desde el plan {{plan}}») con el nombre del plan leído del catálogo (`resolveUnlockingPlanName`, `useListingPlanGate`). Un evento semanal ya guardado se muestra con la insignia «Borrador: tu plan no incluye eventos recurrentes» y un enlace al upsell; se puede quitar, editar el contenido (sin reactivar) o dejar.
- `EMPTY_DRAFT.recurrence` pasa de `weekly` a `once` (hoy es `weekly`, `VenueEventsManager.client.tsx` ~97): el default sensato cuando la recurrencia deja de ser universal. Con la clave, el dueño puede elegir semanal igual.
- Conteo en el editor: los borradores por plan no cuentan en «X de N» (HOS-2263 6.2).

### 6.5 i18n (es / en / pt)

`venue.owner.editor.venueEventsManager.{recurrenceLocked, recurrenceLockedNoPlan, draftByPlan, draftByPlanHelp}` y, si el upsell usa el patrón `translateUpsell`, un bloque `*_RECURRENCE_UPSELL_COPY` análogo a `VENUE_EVENTS_UPSELL_COPY` (`VenueEventsManager.client.tsx:~58-65`). Nombre en el cuadro de planes: lo cubre HOS-2262.

## 7. Data model / contracts

- DB: ninguna. Catálogo: 1 entitlement + 1 trait (HOS-2259) y grants a pro/premium (HOS-2280).
- API: `PUT` sin cambio de forma; puede devolver 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_event_recurrence'`. `GET` agrega `isDraftByPlan` y `limits.recurrenceAllowed`.
- Middleware: firma de `sectionTraits` (opción A) o un chequeo en el servicio (opción B).
- Carriles de migración: catálogo (HOS-2259) y data-migration de seed (HOS-2280). Ninguno en esta spec.

## 8. UX / UI behavior

1. Básico: el selector de nuevo evento sólo trae «Un solo día». Debajo: «Para eventos que se repiten todas las semanas necesitás el plan Pro» (nombre real leído del catálogo).
2. Pro/premium: ambos tipos.
3. Dueño que bajó de plan: sus semanales aparecen en la lista con la marca de borrador; en la ficha pública dejaron de mostrarse. Si sube de plan, vuelven solos.

## 9. Acceptance criteria

- AC-1. Dado básico (sin la clave), `PUT` con un evento nuevo `weekly` devuelve 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_event_recurrence'`.
- AC-2. Dado pro (con la clave), el mismo `PUT` se acepta.
- AC-3. Dado básico con un `weekly` guardado (venía de pro), `PUT` que lo conserva igual (mismo `id`) y modifica otro evento se acepta.
- AC-4. Dado ese mismo local, la ficha pública no muestra el semanal y la tabla `venue_events` sigue con la fila.
- AC-5. Dado básico, convertir un `once` guardado en `weekly` devuelve 403; reactivar (`isActive false -> true`) un `weekly` guardado devuelve 403; quitarlo se acepta.
- AC-6. Al subir a pro, el semanal vuelve a la ficha sin intervención (en la siguiente lectura; con la cola del cache).
- AC-7. Sin la clave, el editor no ofrece «Todas las semanas» en eventos nuevos y muestra el upsell con el nombre de plan leído del catálogo (el guard `venue-editor-upsell-no-plan-names` sigue verde).
- AC-8. Un evento `weekly` en borrador por plan no cuenta para `max_venue_active_events` (HOS-2263).
- AC-9. La lectura de `recurrenceAllowed` falla cerrada (`false`) si el effective set no se puede leer, y el `PUT` decide igual.
- AC-10. `PUT { events: [] }` no requiere la clave de recurrencia.
- AC-11. Orden de errores del contrato: 401, 403 de permiso, 400 de forma, 404, luego reglas; el 403 de recurrencia no tapa un 400 de payload inválido.
- AC-12. Guards G1, G2, G3, G6, G7, G18 pasan.

## 10. Test plan

- Unit: helper `venueEventsPayloadCarriesNewWeekly` (`apps/api/test/routes/venue/protected/putEvents.helpers.test.ts`, nuevo): nuevo, conversión, conservado, reactivado, quitado, id ajeno, sin ids (cliente viejo: todos los semanales cuentan como nuevos).
- Proyector (`apps/api/test/utils/public-listing-projector.test.ts`, existente, ya tiene casos de `venueEvents`): trait `recurrence` no disponible filtra semanales y quita el campo si queda vacío; disponible los deja.
- Route (`apps/api/test/routes/venue/protected/content-routes-chain.test.ts` y `content-gates.venue-experience.test.ts`, existentes): AC-1 a AC-5, AC-10, AC-11.
- Integración BD real: baja y subida de plan (simulada con effective set), conteo de filas intacto.
- Web: `VenueEventsManager.recurrence.test.tsx` (nuevo) + `VenueEventsManager.upsell.test.tsx` (existente) para el upsell sin nombres hardcodeados + `VenueEventEntryCard.weekdays.test.tsx` (existente).
- Mutación manual: quitar el filtro de `weekly` del proyector y comprobar que AC-4 falla; quitar la excepción de "semanal conservado" y comprobar que AC-3 falla.
- Smoke manual en staging.

## 11. Risks and open questions for the owner

- R-1. Si HOS-2291 (ids estables de eventos) no está, no se puede distinguir un semanal conservado de uno nuevo: el gate sería "cualquier semanal en el payload requiere la clave", que bloquea a un dueño en baja. Por eso HOS-2291 es prerrequisito duro.
- R-2. La opción A toca la firma de `sectionTraits` (middleware compartido). Es aditivo, pero el cambio debe coordinarse con HOS-2263, que hace lo mismo con `limit`; conviene un único PR de middleware con ambos.
- R-3. El default del editor pasa de `weekly` a `once`: un cambio visible aun para pro. Es deliberado.
- R-4. Cola de cache: el semanal tarda hasta el TTL en volver tras subir de plan (igual que cualquier cambio de plan hoy).

**OQ-1. ¿Dónde se resuelve la comparación "nuevo vs conservado"?**

1. En el middleware, ampliando `sectionTraits` a `({ body, ctx, listingId })` (recomendada). Pro: el gate sigue siendo declarativo y consistente con la carta; el trait aparece en `evaluatedSteps`. Contra: toca un middleware compartido.
2. En el servicio `replaceVenueEvents`, lanzando `ENTITLEMENT_REQUIRED`. Pro: no toca el middleware. Contra: el gate pasa a ser imperativo, un patrón que el repo evita para entitlements de ruta, y no queda registrado en el pipeline.

**OQ-2. Reactivar un semanal en borrador sin la clave.**

1. Requiere la clave (recomendada): reactivar equivale a publicar algo que el plan no incluye. Contra: el dueño en baja que apagó a mano uno de sus semanales y quiere volver a prenderlo, no puede.
2. Permitido mientras el plan siga sin la clave pero sin efecto público. Contra: es un estado confuso, "activo" pero invisible.

## 12. Implementation notes

- El orden de los pasos del pipeline es: sección/entitlement (6), traits de la sección (4b/6), límite (7). Un semanal nuevo en un plan sin la clave debe devolver `ENTITLEMENT_REQUIRED` **antes** que `LIMIT_REACHED`.
- `readEffectiveKeys` ya existe y falla cerrado; no inventar otra lectura.
- No agregar `vertical === 'venue'` en código compartido (G1): el helper y el proyector específico de venue se declaran por sección, igual que el de la carta.

### Task breakdown

1. T-1. Helper `venueEventsPayloadCarriesNewWeekly` + tests (0,5 día; usa ids de HOS-2291).
2. T-2. Ampliar `sectionTraits` + `sectionTraits` en `putEvents.ts` + tests de ruta (1 día; **bloqueada por HOS-2259**).
3. T-3. `projectVenueEventTraits` + tests del proyector (0,5 día).
4. T-4. `GET` con `isDraftByPlan` y `recurrenceAllowed` (0,5 día).
5. T-5. Editor: selector, upsell, insignia de borrador, default `once` (1 día).
6. T-6. i18n es/en/pt + guard (0,25 día).

## 13. Linear

Canonical tracking: HOS-2264. Padre: HOS-2252. Decisiones: HOS-2253 (2, 6).

- Dependencias: **HOS-2259** (clave y trait), HOS-2291 (ids estables de eventos), HOS-2263 (conteo y regla de baja), HOS-2262 (texto del cuadro), HOS-2280 (asignar a pro/premium).
- Smoke: `status-needs-smoke-staging` (billing/entitlements; checklist de staging). Sin `smoke-prod`.
- What's New: sí, en la entrega conjunta de HOS-2284.

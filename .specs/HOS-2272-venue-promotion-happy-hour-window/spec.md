---
title: Promos de local, happy hour con franja horaria
linear: HOS-2272
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# Promos de local: happy hour con franja horaria y badge «Ahora»

Hijo de HOS-2252. Depende de HOS-2270 (modelo y rutas) y HOS-2271 (editor y ficha). Último de la cadena HOS-2270, 2271, 2272.

## 1. Resumen

Una promo de local puede valer solo ciertos días y horas: «2x1 en tragos, de jueves a sábado de 23 a 00:30». La franja es opcional, puede cruzar la medianoche con la misma regla que los horarios (DEC-FAC-052), y mientras está vigente la ficha y la tarjeta muestran el badge «Ahora». Fuera de la franja se ve el texto «Jue a sáb, 23 a 00:30». El cálculo se hace en el navegador porque las páginas se cachean. Usa el mismo gate que las promos (`create_promotions`): el happy hour es una promo más y cuenta contra `max_active_promotions` (decisión 5 de HOS-2253).

## 2. Problema

`valid_from` y `valid_until` son timestamps: dicen entre qué fechas rige la promo, no a qué horas. No hay recurrencia semanal ni hora de inicio y fin. Un happy hour hoy solo se podría cargar como una promo «de siempre», que miente, o como una entrada semanal de la agenda de eventos (`venue_events`), que no es una promo y no cuenta como tal.

## 3. Objetivos

- G-1. Franja opcional por promo: días de la semana más hora de inicio y de fin.
- G-2. La franja puede cruzar la medianoche. Un tramo pertenece al día en que empieza.
- G-3. «Ahora» en la ficha y en la tarjeta mientras la franja está vigente; si no, el texto de la franja.
- G-4. Cálculo en el cliente, sobre HTML cacheado, en la zona horaria del local.
- G-5. Sin lógica nueva de cruce de medianoche: se reusa la de `venue-hours.ts`.

## 4. Fuera de alcance

- Más de una franja por promo (decidido: una sola, ver OQ-2).
- Recurrencias distintas de la semanal, excepciones y feriados.
- Zona horaria propia por local (ver OQ-1).
- Refresco automático del badge sin navegar (ver OQ-4).
- Promos VIP (HOS-2273), salvo que usan la misma franja sin cambios.
- Alojamiento: sus promos no tienen franja y su schema la rechaza.

## 5. Estado actual del código

Verificado en `origin/staging` (`92994b9dc6`).

- `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts:27-28`: `valid_from` (NOT NULL) y `valid_until` son `timestamp with time zone`. No hay columnas de días ni de hora.
- **Cruce de medianoche (DEC-FAC-052).** `apps/web/src/lib/venue-hours.ts:89-123` (`entryCoversNowOnItsStartDay`, `entryWrapsIntoToday`) y `:152-170` (`computeOpenNowStatus`): un tramo con `close <= open` cruza la medianoche, pertenece al día en que empieza, cubre `[open, 24:00)` ese día y `[00:00, close)` el siguiente. El domingo mira hacia el sábado. Recibe un mapa `{ monday: { isOpen, shifts: [{ open, close }] }, … }` con horas `HH:mm` (`apps/web/src/data/types.ts:1008-1027`).
- **Zona horaria.** `apps/web/src/lib/venue/open-now-in-zone.ts`: `VENUE_OPEN_NOW_TIME_ZONE = 'America/Argentina/Buenos_Aires'` y `computeOpenNowInZone({ openingHours, now, timeZone })`, que lee día, hora y minuto en la zona del local y delega en `computeOpenNowStatus`. El docblock explica por qué el reloj del visitante está mal.
- **Isla de cliente sobre HTML cacheado.** `apps/web/src/components/venue/VenueOpenNowBadge.client.tsx:39-53`: no pinta nada en el servidor ni en el primer render del cliente, calcula una vez al montar y sin intervalo. Está sobre la imagen con `position: absolute`, así no mueve el layout. Se monta en `VenueCard.astro:124-131` con `client:idle`.
- **Agenda de eventos.** `venue_events` (`packages/db/src/schemas/venue/venue_event.dbschema.ts:66-68`) guarda `weekday` (0 a 6, domingo primero) y `start_time`/`end_time` como `time`. Su schema valida horas con `VenueEventTimeSchema` (`packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts:85`, regex `HH:MM`). Esa tabla ya nombra al happy hour como ejemplo de entrada semanal, pero no es una promo.
- Los cruces entre columnas no se declaran en Drizzle: van al carril `packages/db/src/migrations/extras/` (el docblock de `venue_event.dbschema.ts` lo dice).
- Nombres de día en i18n: `venue.detail.openingHours.<day>` (nombres completos). `apps/web/src/lib/i18n-client-namespaces.ts:268-282` expone al navegador los prefijos `venue.card` y `venue.detail`.
- Mapa de i18n del cliente: los prefijos que el navegador no recibe no se pueden usar en una isla. Las islas de tarjeta y ficha de esta spec viven bajo `venue.card.*` y `venue.detail.promotions.*`, ya expuestos.

## 6. Diseño propuesto

### 6.1 Datos (estructural más extras)

Tres columnas nuevas en `owner_promotions` (migración con `pnpm db:generate`):
- `window_weekdays smallint[] NULL`: días en que rige, `0` domingo a `6` sábado (misma convención que `venue_events.weekday`).
- `window_start time NULL` y `window_end time NULL`: hora local del local, `HH:MM`.

Restricciones en el carril de extras (archivo idempotente en `packages/db/src/migrations/extras/`, se reaplica con `pnpm db:apply-extras`):
- Todo o nada: `(window_weekdays IS NULL) = (window_start IS NULL) AND (window_start IS NULL) = (window_end IS NULL)`.
- `cardinality(window_weekdays) BETWEEN 1 AND 7` y todos los valores entre 0 y 6.
- `window_start <> window_end`. Si `window_end < window_start`, la franja cruza la medianoche. (Un cierre igual a la apertura queda prohibido: en horarios significa «24 horas», acá sería ambiguo.)
- La franja solo vale en promos de local: `window_weekdays IS NULL OR entity_type = 'venue'` (HOS-2270 reemplazó `venue_id` por `entity_type` + `entity_id`).

Las tres columnas son aditivas y nulas, sin dato previo: no hay data-migration ni expand/contract propio (el de HOS-2270 ya cubre el cambio de modelo). Esta migración va después de la de HOS-2270 (release N) y no depende de borrar `accommodation_id`. Orden en vivo: `db:migrate`, luego `db:apply-extras`.

### 6.2 Schemas y API

- `OwnerPromotionSchema` suma `windowWeekdays`, `windowStart`, `windowEnd` (nullable, opcionales) y un `superRefine` con las mismas reglas que la base: todo o nada, días únicos entre 0 y 6, inicio distinto de fin, horas con `VenueEventTimeSchema`.
- Al cliente se expone un objeto `window: { weekdays: number[]; startTime: string; endTime: string } | null`, no las tres columnas sueltas. El mapeo vive en un solo helper (`toPromotionWindow` / `fromPromotionWindow`) usado por el servicio y por los tests.
- El schema de alta y de edición de local (HOS-2270) acepta `window`. `OwnerPromotionCreateRequestSchema` (alojamiento) no lo acepta y su update `.strict()` responde 400.
- Respuestas: la ruta pública de promos (HOS-2271, `GET /public/venues/{id}/promotions`) devuelve `window` por promo. `promoBadge` de la tarjeta (HOS-2271) pasa a `{ hasPromo: true, hasUnscheduled: boolean, windows: PromotionWindow[] }`, con `windows` solo de las promos que tienen franja y deduplicadas, y `hasUnscheduled` verdadero si alguna promo vigente no tiene franja. Tope de 10 franjas por tarjeta para no inflar el HTML de la lista.
- Mismo gate y mismos errores que HOS-2270 (no hay clave nueva). Una franja inválida responde 400 `VALIDATION_ERROR`.
- La consulta batch de la tarjeta (`findVenueIdsWithActivePromo`) pasa a devolver también las franjas por local.

### 6.3 Lógica de «Ahora» en el cliente

Módulo puro nuevo `apps/web/src/lib/venue/promotion-window.ts`:
- `isPromotionWindowActive({ window, now, timeZone = VENUE_OPEN_NOW_TIME_ZONE })`: arma un mapa tipo horarios (`monday…sunday`, cada día de la franja con un tramo `{ open: startTime, close: endTime }`) y llama a `computeOpenNowInZone`. Un resultado `null` (sin entrada para hoy) se toma como `false`. Así el cruce de medianoche y la regla de «el tramo pertenece al día en que empieza» salen de la misma función que ya tiene su test del calendario viernes y sábado. No se escribe ninguna comparación de horas nueva.
- `isPromotionLive({ promo, now })`: `isPromotionWindowActive` y además `now` dentro de `validFrom` y `validUntil`, porque el HTML cacheado puede sobrevivir al fin de la promo.
- `formatPromotionWindow({ window, t })`: texto «Jue a sáb, 23 a 00:30».
  - Días en orden de semana lunes primero. Corridas consecutivas: 7 días → «Todos los días»; 3 o más → «Jue a sáb»; 2 → «Vie y sáb»; 1 → «Vie». Varias corridas se unen con coma: «Lun, vie a dom».
  - Horas: sin minutos cuando son `00` («23»), con minutos si no («00:30»). Conector «a».
  - Todas las palabras salen de i18n (`venue.detail.promotions.window.*`: días cortos, «a», «y», «Todos los días»).

### 6.4 Islas

- **Ficha.** `PromotionWindowStatus.client.tsx` (nuevo, por debajo de 500 líneas): recibe `window`, `validFrom`, `validUntil` y las etiquetas. El HTML del servidor ya trae el texto de la franja (indexable y legible sin JS). Al montar calcula `isPromotionLive` y, si es verdadero, suma el badge «Ahora» (estilo igual al de `VenueOpenNowBadge`, ancho reservado para no mover el texto). Sin intervalo, como el badge de abierto. `VenuePromotions.astro` (HOS-2271) lo monta con `client:visible` solo en promos con franja.
- **Tarjeta.** HOS-2271 pinta «Promo» estático. Con `windows.length > 0`, `VenuePromoBadge.client.tsx` (nuevo) reemplaza esa etiqueta al montar por «Ahora» (estilo destacado) cuando alguna franja está viva, y la deja en «Promo» si no. Si `hasUnscheduled` y no hay franja viva, queda «Promo». Mismo recuadro y `min-width` que la etiqueta estática: sin salto de layout. `client:idle`, como el badge de abierto.
- Textos en `venue.card.promo*` y `venue.detail.promotions.*`.

### 6.5 Formulario del dueño

`VenuePromotionForm` (HOS-2271) suma un bloque «Solo en ciertos días y horas», apagado por defecto:
- Siete casillas de día (lunes primero) con nombres cortos.
- Dos `<input type="time">` (inicio y fin). Si `fin <= inicio`, una ayuda dice «Termina después de la medianoche, el día siguiente».
- Vista previa en vivo con `formatPromotionWindow`.
- Validación en cliente con el mismo schema (`safeParse`); el 400 de la API se muestra por campo.
- Ayuda corta: «Si es una entrada fija de tu agenda (música en vivo, por ejemplo), cargala en Eventos. Acá va el beneficio.» (ver OQ-5).

### 6.6 Baja de plan y límites

Sin cambios: la franja es un dato de la promo. Una promo con franja ya cargada sigue vigente tras una baja (decisión 6). Cuenta como una promo para `max_active_promotions` siempre que su ciclo sea ACTIVE, esté o no dentro de su franja.

## 7. Contratos

- `PromotionWindow = { weekdays: number[]; startTime: 'HH:MM'; endTime: 'HH:MM' }` exportado desde `@repo/schemas` junto con su schema Zod. Es la única forma que cruza la frontera.
- La ruta protegida de promos de local lee y escribe `window`.

## 8. UX

- Ficha: «2x1 en tragos · Jue a sáb, 23 a 00:30» y, si está vigente, la etiqueta «Ahora» al lado. Sin franja, la promo se ve como en HOS-2271 (sin etiqueta «Ahora»).
- Tarjeta: «Promo» o «Ahora».
- Accesibilidad: «Ahora» tiene texto; el cambio al montar no se anuncia como alerta (no es `role="alert"`).
- Español rioplatense neutro: «Jue a sáb», «Todos los días».

## 9. Criterios de aceptación

- AC-1. Dada una promo con franja jue, vie, sáb de 23:00 a 00:30, cuando son las 23:30 del jueves en Buenos Aires, entonces `isPromotionWindowActive` es verdadero.
- AC-2. Dada la misma promo, a las 00:15 del viernes es verdadero (el tramo del jueves) y a las 00:45 del viernes es falso.
- AC-3. Dada una franja que incluye domingo de 23:00 a 02:00, a la 01:00 del lunes es verdadero: el tramo del domingo sigue hasta las 02:00 del lunes, porque el lunes mira hacia el domingo.
- AC-4. Dado el mismo instante UTC, entonces el resultado es el de la zona de Buenos Aires (02:30 UTC del viernes se evalúa como 23:30 del jueves), sin depender de la zona del navegador.
- AC-5. Dada una promo vencida (`validUntil` pasado) con HTML cacheado, entonces no muestra «Ahora».
- AC-6. Dada una promo con franja en el dueño, cuando elige fin menor o igual que inicio, entonces se ve la ayuda de «después de la medianoche»; con fin igual a inicio, error de validación.
- AC-7. Dado un body con `window` incompleto (días sin horas), días fuera de 0 a 6, repetidos o vacíos, entonces 400 `VALIDATION_ERROR`; y a nivel DB la restricción lo rechaza aunque se salte la API.
- AC-8. Dado un body de alojamiento con `window`, entonces 400.
- AC-9. Dado `formatPromotionWindow` con los días 4, 5, 6 y horas 23:00 a 00:30, entonces «Jue a sáb, 23 a 00:30» en es, y el equivalente en en y pt. Con 7 días, «Todos los días». Con {1, 5, 6, 0}, corridas «Lun, vie a dom».
- AC-10. Dada una promo con franja y otra sin franja, entonces la tarjeta muestra «Promo» salvo que la franja esté viva, y entonces «Ahora».
- AC-11. Dado el HTML de la ficha y de la tarjeta, entonces es idéntico para todo visitante y no contiene «Ahora» en el servidor (el badge aparece solo tras montar).
- AC-12. Dada la promo con franja, entonces cuenta como una activa para `max_active_promotions`.
- AC-13. Dado un dueño que bajó de plan, entonces la promo con franja sigue visible y calculando «Ahora».
- AC-14. Dada una franja guardada con `time` de Postgres, entonces la API devuelve `HH:MM` (sin segundos).

## 10. Plan de pruebas

- Unit `apps/web/test/lib/venue/promotion-window.test.ts` (tabla): AC-1 a AC-5 y AC-9, con `vi.useFakeTimers` y `now` inyectado; incluye el calendario jueves a sábado cruzando medianoche, domingo a lunes, y dos zonas del navegador.
- Unit schemas `packages/schemas/test/entities/ownerPromotion/`: AC-7, AC-8, `toPromotionWindow`/`fromPromotionWindow`.
- Integración DB `packages/db/test/integration/`: las restricciones de extras (AC-7 a nivel DB), formato `time` (AC-14).
- API: rutas de local con `window` (AC-6/7), `promoBadge` con tope de 10 franjas, conteo contra el límite (AC-12).
- Web: `PromotionWindowStatus`, `VenuePromoBadge` (render del servidor sin «Ahora», AC-11), formulario (AC-6).
- Guards: `cacheable-pages-are-session-blind` (la isla no lee sesión), i18n (estructura).
- e2e: sin spec nuevo; se verifica en el smoke de staging porque depende de la hora real.

## 11. Riesgos y preguntas para el dueño

Riesgos:
- R-1. Dos relojes: el de la zona del local (franja) y el del navegador. Mitigación: todo pasa por `computeOpenNowInZone`.
- R-2. El badge puede quedar desactualizado con la pestaña abierta (sin intervalo). Mitigación: mismo comportamiento que «Abierto ahora».
- R-3. El conteo de franjas en la tarjeta infla el HTML de listados largos. Mitigación: tope de 10 y deduplicado.
- R-4. Esta spec y HOS-2271 tocan la misma isla de tarjeta: coordinar el orden de merge.

Preguntas (OQ-2 decidida abajo, el resto abiertas y menores):
- OQ-1. Zona horaria. Opciones: (a) fija de Buenos Aires, como `VENUE_OPEN_NOW_TIME_ZONE`; (b) una zona por local (columna nueva). **Recomiendo (a)**: todos los locales están en Argentina y el propio código lo declara como único lugar a revisar.
- Decidido (owner, 16/11/2026): una franja por promo. Una franja es un conjunto de días con un único rango de horas. Quien necesite «lun a mié 18 a 20» y «jue a sáb 23 a 00:30» carga dos promos, y cada una cuenta contra `max_active_promotions` (dos promos son dos cupos). No hay tabla ni lista de franjas. Esto deja el modelo de 6.1 tal cual y fija el tope de 10 franjas de la tarjeta como un máximo de promos con franja, no de franjas por promo.
- OQ-3. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #26): opción (a).** Una promo sin franja muestra solo «Promo», sin «Ahora». Una promo sin franja, ¿muestra «Ahora» todo el tiempo? Opciones: (a) no, solo «Promo»; (b) sí. **Recomiendo (a)**: «Ahora» solo tiene sentido si hay una franja.
- OQ-4. Refresco del badge con la página abierta. Opciones: (a) sin intervalo (precedente de «Abierto ahora»); (b) recalcular cada minuto. **Recomiendo (a)**.
- OQ-5. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #27): opción (a).** Si el local ya tiene un happy hour en su agenda, el formulario muestra una ayuda pero no lo impide. Solapamiento con la agenda (`venue_events` ya admite un happy hour semanal). Opciones: (a) solo una ayuda en el formulario; (b) impedirlo. **Recomiendo (a)**: son cosas distintas (agenda vs beneficio) y el dueño puede querer ambas.

## 12. Dependencias

- HOS-2270 (modelo, schemas, rutas) y HOS-2271 (editor, ficha, tarjeta) son previas. No empezar antes de que HOS-2271 esté en `staging`.
- HOS-2282 (grant de `create_promotions` y `max_active_promotions` a los planes de local) para el smoke real.
- HOS-2273 reusa esta franja sin cambios.

## 13. Etiquetas de smoke y Novedades

- `status-needs-smoke-staging`: la lógica depende de la hora real y de HTML cacheado en el borde. Pasos del smoke: cargar una promo con franja que arranque en 5 minutos, mirar la ficha y la tarjeta antes y después (con recarga), y probar una franja que cruce la medianoche usando un día y hora ya elegidos. Billing: el gate es el de HOS-2270, sin cambios.
- Novedades: extiende la entrada de HOS-2271 («Promociones en tu local» ahora con happy hour y «Ahora»). Etiqueta `whats-new-done`.

## 14. Desglose de tareas

1. T-1 `@repo/schemas`: `PromotionWindow`, schema, `superRefine`, helpers de mapeo. Tests.
2. T-2 DB: migración estructural (tres columnas) y archivo de extras con las restricciones. Test de integración.
3. T-3 Servicio y modelo: persistir y leer `window`, conteo de promos con franja, consulta batch de la tarjeta con franjas.
4. T-4 Rutas de local: aceptar y devolver `window`; `promoBadge` ampliado y ruta pública. Tests.
5. T-5 `promotion-window.ts` (`isPromotionWindowActive`, `isPromotionLive`, `formatPromotionWindow`) con la tabla de pruebas.
6. T-6 `PromotionWindowStatus.client.tsx` y `VenuePromotions.astro`.
7. T-7 `VenuePromoBadge.client.tsx` y `VenueCard.astro`.
8. T-8 Formulario del dueño: bloque de franja, vista previa, errores por campo.
9. T-9 i18n es, en, pt (días cortos, conectores, «Ahora», ayudas).
10. T-10 Quality gate y smoke de staging.

## 15. Linear

Canonical tracking: HOS-2272. Épica: HOS-2252. Previas: HOS-2270, HOS-2271.

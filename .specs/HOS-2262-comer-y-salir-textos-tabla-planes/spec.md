---
title: Planes de Comer y salir. Textos de las claves nuevas en la tabla comparativa y el upsell
linear: HOS-2262
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - web
  - billing
  - i18n
---

# Planes de Comer y salir. Textos de las claves nuevas en la tabla comparativa y el upsell

## 1. Resumen

Cada clave nueva de la épica HOS-2252 necesita su texto (etiqueta y descripción en
es, en y pt) para aparecer bien en la tabla comparativa de planes y en el upsell. La
tabla marca «solo para locales de noche» donde corresponde, con el mismo mecanismo
que hoy marca «solo para locales con carta». Los topes se muestran con su valor leído
del catálogo. Ningún valor ni precio se escribe en código (G7).

## 2. Problema

La tabla de planes de venue no se genera entera desde el catálogo de claves. Se arma
con filas curadas a mano más filas generadas solo desde secciones y traits de
`LISTING_SECTIONS`. Una clave nueva que no sea sección ni trait **no aparece** hasta que
alguien le arme una fila y sus textos. Y una fila que sí aparece, sin grant en ningún
plan, se ve como «No incluido» en todas las columnas: una promesa vacía.

## 3. Alcance

- Textos es/en/pt de las 7 claves y 2 límites (etiqueta, descripción, ayuda del tope).
- Filas curadas para las claves que no son sección ni trait.
- Marca «solo para locales de noche» (lista de invitados) reusando el mecanismo de rubros.
- Valor de los topes leído del catálogo, incluido «Ilimitado».
- Textos de upsell y de tope alcanzado de los límites nuevos.
- Ocultar una fila hasta que algún plan la otorga (ver 6.3), incluida la fila de video de
  HOS-2258: **no** se muestra como «Próximamente» (decisión 28 del owner, 16/11/2026).
- Aviso del trial con los planes que incluyen la función, leídos del catálogo (ver 6.6).

## 4. Fuera de alcance

- Los textos mínimos exigidos por los guards de CI (`billing.entitlement.<key>`,
  `billing.limit.<key>.title`, `billing.comparison.limitLabel.<key>`): van en HOS-2259.
- El gate y la lógica de cada función (HOS-2263 a HOS-2278).
- Precios (los define el owner en el admin de add-ons y de billing).

## 5. Estado actual verificado (`origin/staging`)

- `VENUE_GROUPS` (`apps/web/src/components/billing/plan-comparison-rows.ts:437-444`) =
  `VENUE_LISTING_ROWS` curadas (línea 341) + `buildCatalogComparisonGroup({vertical:'venue'})`
  + `listingExtrasRows`. El archivo tiene 525 líneas y su cabecera dice que está al
  límite de tamaño: las filas nuevas deben ir en un módulo aparte, como hizo
  `plan-comparison-catalog-rows.ts`.
- Filas generadas: `buildCatalogComparisonGroup` emite una fila por cada sección con
  `entitlementKey` y por cada trait con clave, tomando la presentación (rowId, claves
  i18n, ícono) de `VENUE_CATALOG_PRESENTATION`
  (`plan-comparison-catalog-rows.ts:71-132`). Ese objeto está `satisfies
  Record<ListingSectionId<'venue'>, ...>`: **agregar una sección al catálogo sin su
  presentación rompe el typecheck** a propósito. Los traits no tienen esa exigencia
  (cuando no hay presentación, el rowId cae a `<section>.<trait>`).
- El marcador «solo para locales con carta»: `buildCatalogComparisonGroup` llama a
  `resolveSectionBusinessLines({vertical, sectionId})` (`business-lines.ts`), que lee
  `BUSINESS_LINES.venue[].sections` (`business-lines.ts:26-39`: `food` posee `menu` y
  `dailySpecials`; `nightlife` posee `nightInfo`). Cada fila lleva `lineMarks` y se
  dibuja con `getLineMarkText` y la clave `billing.comparison.lineMark`
  («Para locales del rubro {{rubro}}»), con el nombre del rubro tomado de
  `venue.owner.businessLines.<value>.label`. La web no importa `BUSINESS_LINES`
  (G-FAC-03, lista cerrada de importadores).
- `PlanComparisonTable.astro:128-170` no oculta filas: toda fila del grupo se renderiza.
  Una celda `entitlement` es «yes» si la clave está en `plan.entitlements`; una celda
  `limit` lee `plan.limits[key]` y muestra el número o «Ilimitado»
  (`isUnlimitedLimit`, `plan-card-delta.ts:51`, umbral `>= 2147483647`). Una fila con
  `status:'upcoming'` muestra «Próximamente».
- Etiquetas: `getEntitlementName` busca `billing.entitlementByAudience.<audience>.<key>`
  y cae en `billing.entitlement.<key>` (`billing-i18n.ts:74-91`): permite un texto
  distinto para venue de una clave compartida con alojamiento, sin tocar el otro.
  Límites: `billing.comparison.limitLabel.<key>` (`billing-i18n.ts:149-156`) y ayuda en
  `billing.limitHelp.<key>` (`billing-i18n.ts:165-175`).
- Tarjetas de precio: `plan-card-delta.ts` calcula qué agrega cada plan; una clave que
  no está en `LIMIT_DISPLAY_ORDER` (línea 65) se agrega al final en el orden del payload.
- Upsell del editor: el plan que desbloquea una función sale del catálogo
  (`apps/web/src/lib/venue/section-upsell-plan.ts`, `resolveUnlockingPlanName`, el más
  barato que la contiene). El guard
  `apps/web/test/components/venue/venue-editor-upsell-no-plan-names.guard.test.ts`
  prohíbe nombrar planes en los textos de upsell de los editores de venue.
- Guards de i18n: paridad es/en/pt (`packages/i18n/test/key-coverage.test.ts`); el guard
  de traducciones que verifica que en/pt no sean copia del español (criterio del issue).
  Hay un test que cuida que `limit.<key>` plural tenga forma `_one/_other`
  (`apps/web/test/lib/i18n-plural-shape.guard.test.ts`).
- Las claves reusadas hoy tienen texto pensado para alojamiento
  (`view_advanced_stats`: «Estadísticas avanzadas», `rowDesc.advancedStats`:
  «Reportes ... de tu alojamiento», `create_promotions`, `can_embed_video`).

## 6. Diseño propuesto

### 6.1 Qué fila corresponde a cada clave

| Clave | Fila | Cómo se genera |
|---|---|---|
| `manage_venue_events` (existe) | `venueEvents` | ya generada (sección `venueEvents`) |
| `max_venue_active_events` | `maxVenueActiveEvents` | curada, celda `limit` |
| `venue_event_recurrence`, `venue_event_notifications`, `venue_event_stats` | una por clave | trait de `venueEvents` si el issue de la función lo declara; si no, curada |
| `view_advanced_stats` (reusada) | `venueListingStats` | curada, texto de audiencia venue |
| `can_embed_video` (reusada) | `venueVideo` | curada, texto de audiencia venue |
| `create_promotions` + `max_active_promotions` (reusadas) | `venuePromotions` (límite) | curada, celda `limit`; la entitlement se muestra por el tope |
| `venue_vip_promotions` | `venueVipPromotions` | curada |
| `venue_guest_list` | `venueGuestList` | sección `guestList`, `common:false`, poseída por `nightlife` |
| `max_venue_guest_list_size` | `maxVenueGuestListSize` | curada, celda `limit` |
| `venue_reservations`, `venue_group_reservations` | `venueReservations`, `venueGroupReservations` | curadas (o secciones si HOS-2275 y HOS-2277 las declaran) |

Las filas curadas van en un módulo nuevo
`apps/web/src/components/billing/plan-comparison-venue-night-rows.ts` (RO-RO, JSDoc) y
se suman a `VENUE_GROUPS` como un grupo nuevo `venueNight` (etiqueta de grupo en
`billing.comparison.group.venueNight`). **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #10):** el grupo se llama «Eventos y reservas» (es; en/pt a traducir).

### 6.2 Marca «solo para locales de noche»

Se reusa el mecanismo de `food`: la sección `guestList` se declara en
`LISTING_SECTIONS.venue` (`packages/schemas/src/catalog/listing-sections.ts`, patrón de
`venueEvents`, línea 108: `entitlementKey: K.VENUE_GUEST_LIST`, `fields: []`,
`common: false`) y se agrega a `BUSINESS_LINES.venue[nightlife].sections`
(`['nightInfo', 'guestList']`). Con eso `resolveSectionBusinessLines` devuelve
`nightlife` y la fila muestra «Para locales del rubro Noche» sin código nuevo en la web.
Para la fila curada `maxVenueGuestListSize` (que no es sección) se agrega a `RowConfig`
un campo opcional `lineMarksOfSection: 'guestList'` que reusa el mismo helper; la web
sigue sin importar `BUSINESS_LINES`.

Coordinación (importante): la declaración de la sección pertenece al issue de la función
(HOS-2274, lista de invitados). Este issue **no la duplica**: la consume y aporta la
presentación (`VENUE_CATALOG_PRESENTATION.guestList`) en el mismo PR o en uno posterior,
porque el `satisfies` obliga. Ver pregunta 1.

### 6.3 No mostrar una fila hasta que algún plan la otorga

**Decidido (owner, 16/11/2026, decisión 28):** las filas sin grant se ocultan en la tabla
de planes hasta que algún plan las tiene. No se usa «Próximamente» para estas filas.
Incluye la fila de videos (HOS-2258). Nota de coordinación: el comentario de
coordinación con la sesión de billing hablaba de la fila de videos como «Próximamente»;
esa redacción quedó superada por esta decisión posterior.

Diseño: `RowConfig` y `CatalogRowPresentation` (filas generadas desde secciones y traits)
suman el campo opcional `hideUntilGranted?: boolean`. La tabla (o su helper
`plan-comparison-table.helpers.ts`) omite una fila con ese flag cuando ninguna de las
columnas activas la otorga (entitlement presente o límite > 0). Todas las filas nuevas de
la épica llevan el flag: las curadas de este issue y las generadas por trait (la fila
`venueVideos` de HOS-2258). Así, con HOS-2259 mergeado y sin grants (HOS-2280 a HOS-2283),
la tabla pública no cambia; al aplicarse cada grant, la fila aparece sola, **sin deploy de
web**. Es coherente con HOS-1967 (la UI lee el catálogo). Las filas existentes no llevan
el flag y no cambian; el estado `upcoming` («Próximamente») sigue disponible para las
filas que ya lo usan.

Orden de merge: HOS-2258 sale primero (entra en la ventana de redeploy de billing) y
necesita el flag en `CatalogRowPresentation`. Quien llegue primero introduce el campo en
el tipo compartido y el otro lo reusa; HOS-2258 lo declara en su tarea T-6, y este issue
lo extiende a las filas curadas.

### 6.4 Textos (es/en/pt)

Todos en `packages/i18n/src/locales/{es,en,pt}/billing.json`. Los de en/pt son
traducciones reales; el español rioplatense usa voseo, igual que el resto del archivo.

- `billing.entitlement.<key>` refinado (HOS-2259 deja una versión mínima).
- `billing.entitlementByAudience.venue.{view_advanced_stats, can_embed_video,
  create_promotions}`: textos propios de venue («Métricas de tu ficha», «Video en la
  galería de tu local», «Promos y happy hour»).
- `billing.comparison.row.<rowId>` y `billing.comparison.rowDesc.<rowId>` para cada fila
  de 6.1.
- `billing.comparison.limitLabel.{max_venue_active_events, max_venue_guest_list_size}`
  y `billing.limitHelp.<key>` (qué pasa al llegar al tope y qué pasa al bajar de plan,
  según la decisión 6: se respeta lo cargado, se frena lo nuevo).
- `billing.limit.<key>.{message_one,message_other,cta}` y `atLimitPanel` si lo usa el
  editor, para el aviso de tope alcanzado. Sin nombres de plan (guard de upsell).
- `billing.comparison.group.venueNight`.
- `billing.comparison.lineMark` ya existe; no cambia.

Ejemplo de ayuda del tope de eventos (es): «Cuántos eventos podés tener activos a la
vez. Un evento semanal cuenta como uno y un evento de fecha única que ya pasó no cuenta.
Si bajás de plan, lo que ya cargaste se respeta, pero no podés sumar eventos nuevos
mientras superes el tope.»

### 6.5 Valores de los topes

Las celdas `limit` leen `plan.limits[key]`. El payload sale de `/api/v1/public/plans`
con los valores de `plan_version_limit` (HOS-2280 a HOS-2283). Nada de números en el
código web: ni 1, ni 10, ni 100, ni «sin tope». Un guard nuevo (ver tests) escanea el
módulo de filas y falla si encuentra un literal numérico de tope.

`LIMIT_DISPLAY_ORDER` (`plan-card-delta.ts:65`) suma los dos límites nuevos en un orden
razonable (después de `MAX_VENUES`).

### 6.6 Aviso del trial: qué planes incluyen la función, leído del catálogo

**Decidido (owner, 16/11/2026, decisiones 27 y 27b; texto ajustado el 18/11/2026, HOS-2252 ronda 1, #4):** durante el trial las funciones nuevas
funcionan con valores mínimos (1 promo activa, 10 lugares de lista, 1 evento activo,
filas de límite en la versión `trial`; HOS-2280 a HOS-2283) y muestran un aviso que dice
**qué planes la incluyen**, calculado del catálogo. **El texto «Incluido en …» lo arma
el catálogo** según qué planes tienen la clave: «Incluido en Premium» o «Incluido en Pro
y Premium». **No hay un texto aparte para las funciones solo-Premium**: es una única
plantilla, `Incluido en {{plans}}`, y la lista de planes cambia sola.

- Funciones en Pro y Premium (promos, lista, avisos, recurrencia, métricas, video):
  «Incluido en Pro y Premium».
- Funciones solo de Premium (estadísticas por evento, promos VIP, reservas, grupos y
  cumpleaños): «Incluido en Premium».
- Se retira la frase «El plan Básico no lo tiene» de la redacción del 16/11/2026.
- Textos en es/en/pt (`billing.trial.includedInNotice.*`), con los nombres de plan
  interpolados desde el catálogo (`plan.name` de las versiones vendibles y vigentes que
  tienen la clave), nunca escritos a mano en el texto, y sin precios.
- Condición: la suscripción está en trial **y** la clave no está en la versión más baja
  vendible. Si mañana Pro pierde o gana una clave, el aviso cambia solo (HOS-1967).
- **Guard de upsell:** `venue-editor-upsell-no-plan-names.guard.test.ts` prohíbe nombrar
  planes. Se le agrega una excepción explícita y acotada: solo el componente
  `TrialIncludedInNotice` y solo con nombres que vienen del catálogo, nunca literales. La
  excepción va con su test (una literal «Premium» en ese componente sigue fallando).
- Un componente compartido lo monta cada editor. Cada spec de función solo lo monta; este
  issue lo define y escribe los textos.

## 7. Modelo de datos / contratos

Sin tablas ni migraciones. Contratos tocados: `RowConfig` (campos opcionales
`hideUntilGranted`, `lineMarksOfSection`) y el catálogo de secciones (sección y
ownership de `guestList`, según 6.2).

## 8. UX / UI

- Tabla de planes de «Comer y salir»: grupo nuevo «Eventos y reservas» (decidido el 18/11/2026) con filas de eventos, promos, lista y reservas, cada una con su ícono
  (`comparison-row-icons.ts`, íconos de `@repo/icons`).
- Fila de lista de invitados con la leyenda «Para locales del rubro Noche».
- Topes con su número o «Ilimitado», y «No incluido» donde no hay fila de límite.
- Tarjetas de precio: el delta muestra «hasta N eventos activos» donde sube el tope.

## 9. Criterios de aceptación

1. Dado cada una de las 9 claves, cuando se carga la tabla de planes de venue en es, en
   y pt, entonces existe etiqueta y descripción (ningún `humanizeKey` de fallback).
2. Dado que ningún plan otorga una clave nueva, cuando se renderiza la tabla, entonces
   su fila no aparece (tampoco como «Próximamente»); cuando algún plan la otorga, aparece
   sin cambiar código. Vale también para la fila de videos de HOS-2258.
3. Dada la fila de lista de invitados, cuando se renderiza, entonces muestra la marca de
   rubro Noche; las filas de carta siguen mostrando la de rubro Gastronomía.
4. Dados los planes con `max_venue_active_events` = 1 / 10 / 2147483647, cuando se
   renderiza, entonces la tabla muestra 1, 10 e «Ilimitado», leídos del payload.
5. Los textos en/pt no son copia del es (guard de traducciones) y la paridad de claves
   pasa.
6. Ningún literal numérico de tope ni de precio en los módulos de filas (G7 de espíritu
   y guard nuevo).
7. El upsell de los editores no nombra planes (guard existente verde con los textos nuevos).
8. La tabla de alojamiento, de experiencia y las filas existentes de venue no cambian.
9. Dado un venue en trial, cuando abre una función que está en Pro y Premium (promos,
   lista, avisos), entonces ve «Incluido en Pro y Premium»; si
   la función es solo de Premium (reservas, promos VIP, estadísticas por evento), ve
   «Incluido en Premium». Es la misma plantilla y los nombres salen del
   catálogo, en es/en/pt. Un venue con plan pago no lo ve.
10. Dado que el componente del aviso tiene un nombre de plan literal, cuando corre el guard
   de upsell, entonces falla; con nombres leídos del catálogo, pasa.

## 10. Plan de tests

- Nuevo: `apps/web/test/components/billing/plan-comparison-venue-night-rows.test.ts`
  (filas, `hideUntilGranted`, marcas de rubro, límites con ilimitado).
- Actualizar: `plan-comparison-catalog-rows.test.ts` (presentación exhaustiva con
  `guestList`), `plan-comparison-rows.test.ts`.
- Test del aviso del trial: visible en trial para claves ausentes en Básico, oculto fuera
  de trial; guard de upsell sin nombres de plan contemplado (6.6).
- Nuevo guard: sin literales de tope en `plan-comparison-venue-night-rows.ts`.
- Existentes que deben seguir verdes: `entitlement-label-coverage.test.ts`,
  `billing-limit-key-i18n-coverage.guard.test.ts`, `i18n-plural-shape.guard.test.ts`,
  `venue-editor-upsell-no-plan-names.guard.test.ts`, `key-coverage.test.ts`.
- Visual: revisión con captura de la tabla en es/en/pt a 375 y 1280 px (staging).

## 11. Riesgos

- R-1. Traducciones en/pt flojas: el guard solo mira que no sean copia exacta. Mitigación:
  revisión de copy por el owner.
- R-2. Dos issues declaran la misma sección (`guestList`) en paralelo. Mitigación:
  una sola PR dueña (pregunta 1).
- R-3. Ocultar filas sin grant (6.3) cambia una regla de la tabla. Mitigación: flag
  opcional, solo en filas nuevas.
- R-4. El aviso del trial nombra planes: se resuelve con la excepción acotada del guard (6.6).

## 12. Preguntas abiertas para el owner

1. **Quién declara la sección `guestList` y su ownership por rubro.** Opciones: (a) el
   issue de la lista (HOS-2274), y este issue solo agrega presentación y textos;
   (b) este issue, que la deja lista sin comportamiento. Recomendación: (a), una sola
   fuente por sección y este issue después.
2. **Decidido (owner, 16/11/2026): filas sin grant.** Se ocultan hasta que algún plan las
   otorga (6.3); no se muestran como «Próximamente». Incluye la fila de videos.
3. **Nombre del grupo de filas** («Para la noche», «Eventos y reservas», otro).
   **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #10): «Eventos y reservas».**
4. **Decidido (owner, 16/11/2026): texto del aviso del trial.** Lo arma el catálogo según
   qué planes tienen la clave, con excepción acotada en el guard de upsell (6.6).

## 13. Dependencias

- HOS-2259 (claves y textos mínimos) antes.
- HOS-1787 (rubros y mecanismo de marca) ya mergeado; HOS-1967 (tabla desde el catálogo).
- HOS-2274 / HOS-2275 / HOS-2277 (declaración de secciones o traits).
- HOS-2280 a HOS-2283: sin ellos las filas no aparecen (por diseño); además cargan los
  límites mínimos del trial (6.6).
- HOS-2258: su fila de videos usa el mismo mecanismo de ocultar (6.3).
- Orden: no se mergea antes de la pasada final de HOS-1352 si toca el catálogo de
  secciones compartido con billing; los textos solos no están bloqueados.

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (revisión visual de la tabla con datos reales, tras HOS-2280).
- What's New: no por sí solo; lo cubre HOS-2284 (presentación y Novedades).

## 15. Desglose de tareas

1. Campo `hideUntilGranted` y `lineMarksOfSection` en `RowConfig` + helper + tests (0,5 día).
2. Módulo de filas curadas y grupo `venueNight` («Eventos y reservas») (0,5 día).
3. Presentación de `guestList` y traits en `VENUE_CATALOG_PRESENTATION` (0,25 día).
4. Textos es/en/pt de etiquetas y descripciones (1 día, con revisión de copy).
5. Textos de ayuda, tope alcanzado y audiencia venue (0,5 día).
6. `LIMIT_DISPLAY_ORDER` y guard de literales (0,25 día).
6b. Componente y textos del aviso del trial (6.6) con tests (0,5 día).
7. Captura visual y revisión (0,25 día).

## 16. Linear

Canonical tracking:
HOS-2262

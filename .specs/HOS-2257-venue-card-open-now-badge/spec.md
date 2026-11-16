---
title: Comer y salir - badge «Abierto ahora / Abre a las» en las tarjetas del listado
linear: HOS-2257
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - web
---

# Comer y salir: badge «Abierto ahora / Abre a las 23» en las tarjetas

## 1. Resumen

El issue pide mostrar en las tarjetas del listado de `/comer-y-salir/` y de cada rubro el estado «Abierto ahora», «Abre a las HH:MM» o «Cerrado». **Verificado: la mitad ya está hecha.** Las tarjetas ya muestran «Abierto ahora» y «Cerrado ahora», calculados en el navegador, en la zona horaria del local (HOS-1787 hoja 6.3). Lo que falta es el estado **«Abre a las HH:MM»**, y alinear el texto de «Cerrado».

Es una mejora chica, sólo web, sin entitlement, sin API ni base de datos. Hija de la épica HOS-2252, Fase 1.

Dos afirmaciones del issue y de la épica no se confirman en el código y se corrigen aquí (sección 5.4).

## 2. Problema

- Un turista que mira el listado a las 22:00 ve «Cerrado ahora» en un boliche que abre a las 23:00. No le dice cuándo abre, que es justo lo que decide si espera o elige otro.
- El cálculo actual devuelve sólo `true | false | null` (`computeOpenNowStatus`), sin la hora de apertura.

## 3. Objetivos

- G-1. La tarjeta muestra «Abierto ahora», «Abre a las HH:MM» (si abre más tarde ese mismo día) o «Cerrado».
- G-2. Se calcula del lado del cliente, en la zona horaria del local, sin leer la hora del render (las páginas se cachean en el borde).
- G-3. Vale para todos los planes; sin entitlement.
- G-4. Respeta los horarios que cruzan la medianoche (regla DEC-FAC-052).
- G-5. Misma accesibilidad y sin saltos de layout que el badge actual.

## 4. No-objetivos

- NG-1. Mostrar el badge en la ficha del local (ver 5.4 y OQ-2).
- NG-2. «Cierra a las HH:MM» o «Cierra pronto».
- NG-3. Filtro «abierto ahora» en el listado.
- NG-4. Actualización en vivo (intervalo). El estado se calcula una vez al hidratar, como hoy.
- NG-5. Zona horaria por local: hoy es una constante (ver 5.3).

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 Dónde se muestra hoy (lo que pedía verificar el issue)

- `apps/web/src/components/venue/VenueCard.astro:126`: `<VenueOpenNowBadge client:idle locale openingHours />`, sólo si `data.openingHours` existe. Hay un test que fija esa forma exacta (`apps/web/test/components/venue/VenueCard.test.ts`, `TEST:6.3:3`).
- Isla: `apps/web/src/components/venue/VenueOpenNowBadge.client.tsx:39`. No renderiza nada en el servidor ni en el primer render del cliente; calcula una vez tras montar y recién entonces pinta. Está `position: absolute` sobre la imagen, así que no mueve el layout. Sin intervalo, a propósito.
- Las dos páginas que usan `VenueCard`: `apps/web/src/pages/[lang]/comer-y-salir/index.astro:416` y `comer-y-salir/rubro/[rubro]/index.astro`. Es decir, **cubre el listado general y cada rubro**.
- El dato llega: `VenuePublicListItemSchema` es `VenuePublicSchema.omit({ contactInfo })` e incluye `openingHours` (`packages/schemas/src/entities/venue/venue.access.schema.ts:127`, `:308`); la transformación lo normaliza a `Record<string, VenueOpeningHoursEntry>` (`apps/web/src/lib/api/transforms.ts:2660`). El issue pregunta si `openingHours` ya viene en el listado: **sí**.
- Textos: `venue.card.openNow` = «Abierto ahora», `venue.card.closedNow` = «Cerrado ahora» (es/en/pt en `packages/i18n/src/locales/*/venue.json:46-47`). El namespace `venue.card` ya está declarado para el navegador (`apps/web/src/lib/i18n-client-namespaces.ts:268`).
- Estilos: `VenueOpenNowBadge.module.css`; relleno verde (`--hospeda-forest`) y rojo oscurecido, con texto blanco constante para cumplir AA en tema claro y oscuro (BETA-117).

### 5.2 El cálculo

- `computeOpenNowStatus(openingHours, now)` en `apps/web/src/lib/venue-hours.ts:161`. Devuelve `true | false | null`. Aplica DEC-FAC-052: un turno pertenece al día en que empieza; un turno que cruza la medianoche cubre `[open, 24:00)` de su día y el tramo posterior se mira con el día anterior.
- `computeOpenNowInZone` en `apps/web/src/lib/venue/open-now-in-zone.ts:96`. Lee día, hora y minuto **en la zona del local** con `Intl.DateTimeFormat`, arma una fecha "de pared" sintética y delega en `computeOpenNowStatus`. Así la regla de medianoche vive en un solo lugar y la hora del visitante no importa.
- Tests existentes: `open-now-in-zone.test.ts`, `VenueOpenNowBadge.test.tsx`.

### 5.3 Zona horaria

`VENUE_OPEN_NOW_TIME_ZONE = 'America/Argentina/Buenos_Aires'` (`open-now-in-zone.ts:32`). El `timezone` del local se descarta en `normalizeOpeningHours`. Está documentado como alcance deliberado: todos los locales están en Argentina.

### 5.4 Correcciones a lo que dicen el issue y la épica

1. La épica dice que el badge "existe en la ficha" del local. **No existe en la ficha.** `VenueOpenNowBadge` sólo se importa en `VenueCard.astro`. La ficha muestra la grilla de horarios (`OpeningHoursSection.astro`, `OpeningHoursGrid.client.tsx`), no un estado.
2. El issue dice que "falta mostrarlo en las tarjetas". Ya está en las tarjetas; lo que falta es el estado «Abre a las».
3. El issue pide el cálculo en el cliente por las páginas cacheables. Ya se cumple y el diseño lo mantiene. El guard `cacheable-pages-are-session-blind.guard.test.ts` no se ve afectado: la isla es `.tsx` y no lee sesión.

## 6. Diseño

### 6.1 Cálculo: de booleano a estado

Agregar en `apps/web/src/lib/venue-hours.ts` una función pura:

`computeOpenStatusDetail(openingHours, now) -> { status: 'open' } | { status: 'opensToday', opensAt: 'HH:MM' } | { status: 'closed' } | null`

Reglas, sobre la misma fecha "de pared" que ya usa `computeOpenNowInZone`:

1. Si `computeOpenNowStatus` da `true`: `open`.
2. Si hay entrada para hoy y tiene turnos con `open > minuto actual` (turnos que **empiezan** más tarde hoy, incluidos los que cruzan la medianoche, que empiezan hoy): `opensToday` con el menor `open` de esos turnos.
3. Si hay entrada para hoy y no hay turno posterior (día cerrado o ya pasó el último): `closed`.
4. Sin entrada para hoy: `null` (sin badge), como hoy.

Un local que abre mañana muestra «Cerrado», no «Abre mañana»: el issue sólo pide los tres estados. Se podría sumar después sin cambiar el contrato.

`computeOpenNowInZone` se mantiene (devuelve el booleano, lo usan sus tests). Se agrega `computeOpenStatusInZone` en `open-now-in-zone.ts` que **comparte** la construcción de la fecha de pared: se extrae esa parte a una función interna en lugar de duplicarla, para que la zona y la regla de medianoche sigan en un solo lugar.

### 6.2 Isla

`VenueOpenNowBadge.client.tsx` pasa de guardar `boolean | null` a guardar el estado detallado. Mismo contrato de render: nada en el servidor ni en el primer render. Etiquetas:

- `open` -> `venue.card.openNow` («Abierto ahora»), relleno verde.
- `opensToday` -> `venue.card.opensAt` («Abre a las {{time}}»), relleno propio (ver abajo).
- `closed` -> `venue.card.closedNow` (ver OQ-1), relleno rojo.

Formato de hora: `HH:MM` de 24 horas tal cual viene del dato (el `HH:mm` de `OpeningHoursSchema`), sin conversión de zona porque ya está en hora local del local.

Estilo del tercer estado: una clase `.opensSoon` en `VenueOpenNowBadge.module.css` con relleno sólido y opaco, texto blanco constante, y **contraste AA verificado** en claro y oscuro (como BETA-117). Candidato: un ámbar oscurecido con `color-mix(... black)`, no el naranja de acento, que no llega a 4,5:1 con blanco. El valor exacto se define en la implementación con una medición, no por intuición.

### 6.3 i18n

- Claves nuevas: `venue.card.opensAt` en es/en/pt con `{{time}}` (es «Abre a las {{time}}», en «Opens at {{time}}», pt «Abre às {{time}}»).
- `venue.card` ya está en `i18n-client-namespaces.ts`, así que no hay que declarar prefijos nuevos.
- Texto de `closedNow`: ver OQ-1.

### 6.4 Lo que no cambia

- `VenueCard.astro`: la forma exacta del montaje que fija `TEST:6.3:3` no cambia. No recibe el cálculo en el servidor.
- API, schemas, base de datos, catálogo, planes: nada.

## 7. Datos y migraciones

Ninguna. Sin seed ni data-migration.

## 8. Criterios de aceptación

Hora de referencia: viernes en `America/Argentina/Buenos_Aires`.

- AC-1. Dado un local abierto de 09:00 a 18:00 y las 12:00, la tarjeta muestra «Abierto ahora».
- AC-2. Dado el mismo local y las 07:00, muestra «Abre a las 09:00».
- AC-3. Dado el mismo local y las 20:00, muestra «Cerrado».
- AC-4. Dado un boliche con turno 23:00-05:00 (cruza la medianoche), a las 22:00 muestra «Abre a las 23:00», a las 23:30 «Abierto ahora», y el sábado a las 02:00 (tramo después de medianoche del turno del viernes) «Abierto ahora».
- AC-5. Dado un local con dos turnos (12:00-15:00 y 20:00-00:00) y las 16:00, muestra «Abre a las 20:00» (el próximo turno de hoy).
- AC-6. Dado un local cerrado hoy (`isOpen: false`), muestra «Cerrado», aunque abra mañana.
- AC-7. Dado un local sin entrada de horarios para hoy, o sin `openingHours`, la tarjeta no muestra badge.
- AC-8. El resultado depende de la hora del local y no de la del navegador: un visitante con el reloj en otra zona ve lo mismo para el mismo instante.
- AC-9. El HTML servido (`renderToString` de la isla y el `.astro` de la tarjeta) **no** contiene el estado: se pinta recién después de montar.
- AC-10. El badge no cambia el layout de la tarjeta (sigue `position: absolute`).
- AC-11. El relleno del estado «Abre a las» cumple contraste AA (>= 4,5:1) con el texto blanco en tema claro y oscuro.
- AC-12. No se agrega ningún campo a la API ni lectura de sesión a las páginas del listado.

## 9. Plan de pruebas

Unit
- `apps/web/test/lib/venue/venue-hours.detail.test.ts`: AC-1 a AC-7 con fechas fijas, incluidos los casos de medianoche, turnos múltiples y día sin entrada.
- `apps/web/test/lib/venue/open-now-in-zone.test.ts` (existente): agregar `computeOpenStatusInZone` con visitante en otra zona (AC-8) y mantener los casos actuales del booleano.
- `apps/web/test/components/venue/VenueOpenNowBadge.test.tsx` (existente): las tres etiquetas, vacío en `renderToString` (AC-9), estilos por estado.
- `apps/web/test/components/venue/VenueCard.test.ts` (existente): **no se modifica el patrón del montaje** (AC-10, 12); agregar la aserción de que la clave `venue.card.opensAt` existe en los tres idiomas.

Contraste (AC-11): prueba de lectura del CSS como la de `badgeCss` en `VenueCard.test.ts` (fija el color-mix y el texto) más una verificación manual de la medición en la PR.

E2E: no hace falta; el comportamiento depende del reloj y se cubre con fechas inyectadas.

Guards: `cacheable-pages-are-session-blind.guard.test.ts`, el guard de i18n (claves en los tres idiomas y namespaces del navegador), `check:guards`.

## 10. Riesgos

- R-1. **Estado viejo en pestañas abiertas.** Se calcula al hidratar y no se refresca (decisión de HOS-1787). Una pestaña abierta durante horas puede mostrar «Abre a las 23:00» pasadas las 23:00. Mitigado: el próximo cambio de página lo recalcula. Si molesta, se agrega un intervalo en una spec aparte.
- R-2. **Constante de zona horaria.** Si algún día hay un local fuera de Argentina, el badge será incorrecto. Es un riesgo conocido y documentado en el módulo (5.3).
- R-3. **Dato de horarios mal cargado** (turnos con `close == open`, datos nulos) puede dar «Abre a las» raros. `parseTimeToMinutes` ya ignora lo malformado; se agrega un test de turno degenerado.
- R-4. **Contraste del tercer color** sobre fotos. Mitigado con relleno sólido y la medición de AC-11.
- R-5. **Cantidad de islas.** Una isla `client:idle` por tarjeta (hasta una página de resultados). Ya es así hoy; el cambio no agrega islas.

## 11. Preguntas abiertas para el owner

- OQ-1. **Texto del estado cerrado.** Hoy dice «Cerrado ahora»; el issue pide «Cerrado».
  1. Cambiar a «Cerrado» (en «Closed», pt «Fechado»). Recomendada: sigue el issue y queda parejo con «Abre a las…», donde «ahora» sobra.
  2. Dejar «Cerrado ahora». Pro: cero cambios de texto ni de tests existentes. Contra: no coincide con el criterio escrito.
- OQ-2. **Badge en la ficha del local.** La épica da por hecho que ya está ahí y no lo está.
  1. No agregarlo (fuera de esta spec); la ficha ya muestra la grilla de horarios. Recomendada: el issue habla sólo de las tarjetas.
  2. Agregarlo al encabezado de la ficha reusando la isla. Pro: coherencia con la tarjeta. Contra: alcance nuevo y otra pieza que probar; si se quiere, va en otro issue.
- OQ-3. **«Abre mañana».** Un local que cerró hoy y abre mañana muestra «Cerrado».
  1. Dejarlo así (lo que pide el issue). Recomendada.
  2. Mostrar «Abre mañana a las HH:MM». Pro: más informativo. Contra: requiere mirar el día siguiente y el feriado/excepción no está modelado.

## 12. Etiquetas de smoke y Novedades

- `status-needs-smoke-local`: alcanza, porque no depende de nada externo; se verifica con un local de la base de desarrollo en distintos horarios.
- `status-needs-smoke-staging`: sólo por el caché del borde (que la tarjeta cacheada no congele el estado). Opcional; se recomienda incluirlo porque el motivo de fondo de esta spec es justamente el caché.
- What's New: **no aplica**. Es un detalle de una tarjeta que ya mostraba un badge; si el owner quiere anunciarlo, va con la novedad de HOS-2284.

## 13. Dependencias

- Ninguna técnica. Independiente de las demás hijas de HOS-2252 y de HOS-1352.
- Relación con HOS-2272 (happy hour y badge «ahora»): ese issue podría reusar `computeOpenStatusDetail`; se deja la función en `venue-hours.ts` sin atarla a la tarjeta.

## 14. Desglose en tareas

1. T-1. `computeOpenStatusDetail` en `venue-hours.ts` y su par en zona (`open-now-in-zone.ts`), con extracción de la fecha de pared + tests (0,75 día).
2. T-2. Isla: estados, etiquetas, clase `.opensSoon` con contraste medido + tests (0,5 día).
3. T-3. i18n `venue.card.opensAt` (y `closedNow` según OQ-1) en es/en/pt + test de claves (0,25 día).
4. T-4. Smoke local y en staging (0,25 día).

## 15. Linear

Canonical tracking:
HOS-2257

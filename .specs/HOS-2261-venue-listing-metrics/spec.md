---
title: Ficha de local - métricas de la ficha para pro y premium
linear: HOS-2261
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - web
  - db
---

# Ficha de local: métricas de la ficha para pro y premium

## 1. Resumen

El local básico ve hoy sólo las vistas únicas y totales de 7 o 30 días (`view_basic_stats`). Pro y premium suman un panel con: vistas por día, clics por canal y tasa de clics, en ventanas de 7, 30 y 90 días. El gate es `view_advanced_stats`, una clave que ya existe en el catálogo y que hoy sólo lee código de alojamiento.

Hija de la épica HOS-2252. Fase 1: **no toca el catálogo**. Como ningún plan de local tiene la clave todavía, el panel queda oculto hasta que HOS-2280 la asigne. Va **después de HOS-2256** (registro de clics).

Esta spec revierte a pedido del owner (16/11) la decisión de HOS-734, que dejó fuera las analíticas avanzadas de local (`apps/api/src/routes/venue/protected/viewStats.ts:6-9`).

## 2. Problema

- El básico ve dos números. No hay desglose por canal ni tendencia diaria, que es lo que le sirve a un dueño para decidir.
- El gráfico diario ya existe en la API (`viewStatsDailySeries.ts`) pero **no está conectado** a ninguna pantalla (`ListingViewsWidget.client.tsx:21-22`).
- No hay dato de clics hasta que exista HOS-2256.
- Reusar `view_advanced_stats` en un vertical nuevo exige confirmar que no abre nada de alojamiento por accidente (sección 5.4).

## 3. Objetivos

- G-1. Panel por local, con vistas por día, clics por canal (teléfono, mapa, web, Instagram, entradas, y WhatsApp cuando exista) y tasa de clics.
- G-2. Ventanas de 7, 30 y 90 días.
- G-3. Gate `view_advanced_stats` en el pipeline de autorización del listado (vertical `VENUE`).
- G-4. El básico sigue viendo lo de hoy, más un upsell que nombra lo que se desbloquea y el plan que lo trae, leído del catálogo.
- G-5. Cero cambios de comportamiento en alojamiento y experiencia.

## 4. No-objetivos

- NG-1. El registro de clics: HOS-2256.
- NG-2. Estadísticas por evento: HOS-2265 (clave `venue_event_stats`, sólo premium).
- NG-3. Asignar `view_advanced_stats` a los planes de local: HOS-2280 (additive grant). Hasta entonces el panel no se ve en ningún plan.
- NG-4. Panel avanzado de experiencia. La ruta, el componente y el copy son de local.
- NG-5. Cambiar la ventana de las vistas básicas de alojamiento o experiencia (`EntityViewWindowSchema` queda en `7d|30d`).
- NG-6. Métricas de QR de carta: ya existen (`VenueMenuQrWidget`, clave `menu_qr_scan_metrics`).

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 Lo que el dueño ve hoy

- `GET /api/v1/protected/venues/mine/views?window=7d|30d`: `apps/api/src/routes/venue/protected/viewStats.ts`. Gate `enforceUserGate({ vertical: VENUE, keys: ['view_basic_stats'] })` (línea 59). Devuelve una fila por local del dueño. Hay gemela de experiencia.
- `GET /api/v1/protected/venues/mine/views/daily-series`: `viewStatsDailySeries.ts`, misma clave. Serie diaria **agregada sobre todos los locales del dueño**, rellenada con ceros.
- Servicio: `entityViewService.getStatsForOwnListings` (`packages/service-core/src/services/entityView/entityView.service.ts:1058`) y `getDailySeriesForOwnListings` (`:1098`). Ventana: `WINDOW_DAYS = { '7d': 7, '30d': 30 }` (`:107`); schema `EntityViewWindowSchema = z.enum(['7d','30d'])` (`packages/schemas/src/entities/entityView/entityView.query.schema.ts:30`).
- Widget: `apps/web/src/components/listing/ListingViewsWidget.client.tsx`, montado en `apps/web/src/pages/[lang]/mi-cuenta/comercio/index.astro:21`. Sirve local **y** experiencia. Un 403 `ENTITLEMENT_REQUIRED` se muestra como estado `locked`.
- Precedente de panel exclusivo de local con ventanas 7/30/90, estado `locked` y upsell por plan: `VenueMenuQrWidget.client.tsx` (489 líneas) y su ruta `apps/api/src/routes/venue/protected/menuQrScans.ts` (usa `QrCodeScanWindowSchema = ['7d','30d','90d']`, `qr-code.http.schema.ts:246`). Se monta sólo con `venueListings` en `comercio/index.astro:247`.
- Datos de clics: **no existen** hasta HOS-2256.

### 5.2 Cómo se gatea hoy una lectura propia con clave de capacidad

`createProtectedRoute` acepta `listingAccess: { vertical, operation: 'READ_OWN', idParam, capabilities: [...] }` (`apps/api/src/middlewares/listing-access.ts:208-212`, "HOS-1643"). Uso real: `apps/api/src/routes/experience/protected/certificates.ts:152` (`capabilities: ['issue_experience_certificate']`). `READ_OWN` no exige clave por sí mismo (`OPERATION_STEP6_KEY.READ_OWN = { kind: 'NONE' }`, `packages/verticals/src/authorization/listing-operation.ts:110`) y es la que hace dueño o 404.

### 5.3 La clave `view_advanced_stats`

- Catálogo: `['view_advanced_stats', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']` (`packages/schemas/src/catalog/entitlement-keys.ts:20`). Alcance **por vertical**.
- Asignada hoy sólo a una versión de plan de **alojamiento** (premium): `packages/db/src/migrations/0144_production_plan_catalog.sql:134`. Ninguna de local.

### 5.4 Auditoría de lectores de `view_advanced_stats` (pedida por el issue)

Todos los lectores en `origin/staging` (excluyendo tests y locales i18n):

| Lector | Vertical que consulta | ¿Se abre algo si se la asignan a un plan de local? |
|---|---|---|
| `apps/api/.../accommodation/protected/hostFavoritesBreakdown.ts:52` | `VerticalEnum.ACCOMMODATION` | No |
| `apps/api/.../accommodation/protected/hostMarketComparison.ts:71` | `VerticalEnum.ACCOMMODATION` | No |
| `apps/web/src/components/host/AnalyticsSection.client.tsx:154` | `getEntitlementsCached({ vertical: 'accommodation' })` | No |
| `apps/web/src/components/host/FavoritesWidget.client.tsx` | montado por el anterior | No |
| `apps/admin/.../accommodations/config/sections/statistics.consolidated.ts:25` | sección de alojamiento | No |
| `apps/web/src/components/billing/plan-comparison-rows.ts:225` | grupo de **alojamiento** de la tabla de planes | No |
| Mobile (`use-accommodation-view-stats.ts`) | sólo vistas | No |

Conclusión: la clave es `scope: 'vertical'`, y todo lector la consulta contra `ACCOMMODATION` explícitamente. El conjunto efectivo se resuelve por `(usuario, vertical)`, así que darla a una versión de plan de `VENUE` no abre nada en alojamiento. Un dueño que es host **y** dueño de local tiene dos conjuntos separados.

Fugas que sí existen y hay que tratar:

1. **Texto.** `billing.comparison.rowDesc.advancedStats` dice "tendencias de tu alojamiento" (`packages/i18n/src/locales/es/billing.json:729`). La tabla de planes de local se arma desde el catálogo de secciones (`buildCatalogComparisonGroup`, `plan-comparison-catalog-rows.ts`), que **no** tiene una sección o trait para métricas: la fila no aparecerá sola. El upsell de este panel nombra el plan con `resolveUnlockingPlanName` (`apps/web/src/lib/venue/section-upsell-plan.ts`), no con un texto compartido. Los textos de la tabla de planes son de HOS-2262.
2. **Test cruzado ausente.** Hoy no hay ningún test que pruebe que un usuario con la clave sólo en `VENUE` recibe 403 en las rutas de alojamiento. Se agrega (AC-9).
3. **Entitlements del alojamiento premium.** `apps/e2e/tests/admin/adm-06-effective-set-gates.spec.ts` ya fija que la clave aparece con `?vertical=accommodation`. No se toca.

Ningún otro mecanismo propaga claves entre verticales (la herencia de VIP del turista es de otra clave y de otro vertical).

## 6. Diseño

### 6.1 Ventana de 90 días

Se crea `VenueStatsWindowSchema = z.enum(['7d','30d','90d'])` propio de esta ruta. **No** se amplía `EntityViewWindowSchema`: lo usan las rutas básicas de alojamiento y experiencia, y ampliarlo les daría 90 días sin decisión de producto. Decidido (owner, 16/11/2026): las métricas se guardan 120 días (HOS-2256, OQ-2), lo que deja 30 días de margen sobre la ventana de 90. Además HOS-2256 escribe un resumen mensual (rollup) desde el primer día, así que la historia más vieja que 120 días no se pierde; este panel sigue leyendo las filas crudas de hasta 90 días y el rollup queda disponible para una ventana más larga futura.

### 6.2 API

`GET /api/v1/protected/venues/{id}/stats?window=7d|30d|90d` en `apps/api/src/routes/venue/protected/stats.ts` (nuevo, exportado desde `index.ts` de la carpeta, registrado en el manifest).

- Tier protegido, `createProtectedRoute`.
- `listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id', capabilities: ['view_advanced_stats'] }`. Dueño o 404 (un local ajeno responde 404, nunca 403: error contract); sin la clave: 403 `ENTITLEMENT_REQUIRED` con `entitlementKey`. No se hace `enforceUserGate` a mano: el pipeline lo registra en `evaluatedSteps` y `check-step5-declared` / G6 siguen cumplidos.
- `emailUnverifiedOperation: 'READ_OWN'`, como `menuQrScans.ts`.
- `customRateLimit` por usuario, 30/min, como `menuQrScans.ts`.
- Respuesta `VenueStatsSchema` (en `@repo/schemas`):

```
{
  window: '7d'|'30d'|'90d',
  views:    { unique, total },
  dailyViews: [{ date: 'YYYY-MM-DD', total }],   // gap-filled, día local MARKET_TIMEZONE
  clicks:   { total, byKind: { PHONE_CLICK: {unique,total}, MAP_CLICK, WEBSITE_CLICK, INSTAGRAM_CLICK, TICKET_CLICK, WHATSAPP_CLICK } },
  clickRate: number | null                        // 0..1; null si no hubo vistas
}
```

Todos los `kind` vienen siempre, con ceros, para que el panel no tenga que adivinar columnas.

Las rutas básicas (`/mine/views`, `/mine/views/daily-series`) **no cambian** y siguen con `view_basic_stats`.

### 6.3 Servicio y modelo

- `EntityViewService`: método `getStatsForVenue({ actor, venueId, window })` que reusa `model.getStatsForEntities({ entityIds: [id] })` y `getDailySeriesForEntityIds` (ambos ya aceptan una lista de ids y hacen el dedup de 30 minutos y el día local). Se agrega el parámetro de ventana de 90 días sin tocar `WINDOW_DAYS` (un mapa propio).
- `EntityInteractionModel` (creado en HOS-2256): `getClickStatsForEntity({ entityType, entityId, windowDays })` devuelve `unique` y `total` por `kind`, con el mismo dedup que vistas (`COUNT(DISTINCT visitor_hash)` y `COUNT(DISTINCT (visitor_hash, bucket de 30 min))`, agrupado por `kind` y `event_id`).
- **Definición de la tasa de clics.** `clickRate = visitas con al menos un clic / total de vistas`, donde "visitas con clic" = `COUNT(DISTINCT (visitor_hash, bucket de 30 min))` sobre todos los `kind` del local, y `total de vistas` es el `total` deduplicado de vistas. Se recorta a 1. Motivo: sumar clics por canal sobre vistas podría pasar de 100% (un visitante toca teléfono y mapa) y no significa nada. La definición va visible en el panel ("de cada 100 visitas, N tocaron algún contacto").
- No depende de que el hash de vista y el de clic coincidan (HOS-2256, 7.5): ambas son cuentas de buckets, no de identidades.

### 6.4 Web

- `apps/web/src/components/venue/VenueListingStatsPanel.client.tsx` (nuevo), mismo patrón que `VenueMenuQrWidget`: `client:visible`, estados `loading | ready | locked | error`, `*.module.css` propio. Se agrega **debajo** de `ListingViewsWidget`, dentro de `comercio/index.astro`, sólo con `venueListings` (como el widget del QR: es de local, no entra en el widget compartido, así que no hay `vertical === 'venue'` en código compartido y el guard G-FAC-05 no aplica).
- Un selector de local (los dueños pueden tener varios) y el selector de ventana 7/30/90. Un local por vez: la ruta es por id.
- Gráfico diario: se recomienda la lista de barras CSS de `VenueMenuQrWidget` (`DailySeries`, `:132`) en vez de `recharts`, que sólo carga el widget de alojamiento (`host/ViewsWidget.client.tsx:18`). Evita agregar un bundle al panel de comercio. El componente de barras se **extrae** a `components/shared/` si hace falta para no pasar las 500 líneas de `VenueMenuQrWidget`.
- Cómo sabe el panel si mostrar datos o upsell:
  1. Pide `GET /venues/{id}/stats`. 200: muestra el panel.
  2. 403 `ENTITLEMENT_REQUIRED` con esa clave: estado `locked`. El upsell usa `resolveUnlockingPlanName({ plans, entitlementKey: 'view_advanced_stats', t })`, igual que `section-upsell-plan.ts`: nombra el primer plan **de local** que incluye la clave, leído del catálogo (regla HOS-1967: ningún mapa hardcodeado).
  3. Si **ningún** plan de local incluye todavía la clave (estado de la Fase 1), `resolveUnlockingPlanName` devuelve `null` y el panel **no se muestra**: no se promete algo que no se puede comprar. Esto es lo que mantiene la función oculta hasta HOS-2280.
- El copy del upsell nombra lo que se desbloquea: gráfico diario, clics por canal, tasa de clics, 90 días.
- Se usa `useListingPlanGate` como `VenueMenuQrWidget`, para distinguir "sin trial todavía" de "plan sin la clave".
- Cliente: `listingAnalyticsApi.getVenueStats({ id, window })` en `apps/web/src/lib/api/endpoints-protected.ts` (objeto `listingAnalyticsApi`, línea 2480).

### 6.5 i18n

Claves nuevas es/en/pt en el namespace de comercio (verificar el namespace existente de `ListingViewsWidget`, `i18n-client-namespaces.ts:213`): título del panel, nombre de cada canal, "tasa de clics" con su explicación, ventanas "90 días", estados vacío/locked/error, copy del upsell con `{{plan}}`. Declarar los prefijos nuevos en `i18n-client-namespaces.ts`, que es lo que el guard de i18n exige para claves leídas en el navegador.

## 7. Datos y migraciones

Ninguna de esta spec. La tabla, su migración, la retención de 120 días y el rollup mensual son de HOS-2256. Aquí sólo consultas y rutas. No hay seed ni catálogo.

## 8. Criterios de aceptación

- AC-1. Dado un dueño con `view_advanced_stats` en `VENUE`, cuando abre su panel, ve vistas por día, clics por canal y tasa de clics del local elegido.
- AC-2. Dadas las ventanas 7, 30 y 90, la serie diaria tiene exactamente N días rellenados con ceros, con días locales de `MARKET_TIMEZONE`. La ventana de 90 días se sirve completa porque la retención cruda es de 120.
- AC-3. Todos los canales vienen en la respuesta, con ceros si no hubo clics.
- AC-4. `clickRate` está entre 0 y 1; es `null` si el local no tuvo vistas; un visitante que toca teléfono y mapa en la misma visita cuenta una vez.
- AC-5. Un dueño sin la clave recibe 403 `ENTITLEMENT_REQUIRED` en `/venues/{id}/stats`.
- AC-6. Un local ajeno responde 404 con el mismo cuerpo que uno inexistente. Un id con formato inválido responde 400.
- AC-7. El básico sigue viendo exactamente lo de hoy en `ListingViewsWidget`.
- AC-8. Con la clave asignada a ningún plan de local (estado de la Fase 1), el panel no se renderiza y no muestra upsell. Cuando un plan de local la incluye, el upsell nombra ese plan, leído del catálogo.
- AC-9. Un usuario con `view_advanced_stats` **sólo** en `VENUE` recibe 403 en `hostFavoritesBreakdown` y `hostMarketComparison` (alojamiento) y `AnalyticsSection` sigue en `locked`/básico para él.
- AC-10. `EntityViewWindowSchema` sigue rechazando `90d` en las rutas básicas.
- AC-11. Los números básicos de `/mine/views` y `/mine/views/daily-series` no cambian para ningún plan.
- AC-12. El panel no se monta para locales de experiencia, y un dueño sin locales no descarga su JS.
- AC-13. La página `comercio/index.astro` sigue siendo SSR de dueño (no cacheable) y no agrega lecturas de sesión a páginas públicas.

## 9. Plan de pruebas

Unit
- `packages/schemas/test/...`: `VenueStatsSchema`, `VenueStatsWindowSchema`.
- `packages/service-core/test/services/entityView/entityView.venue-stats.test.ts`: composición, relleno, tasa de clics (AC-3, 4).
- `apps/web/test/components/venue/VenueListingStatsPanel.test.tsx`: estados loading/ready/locked/error, upsell con plan, panel oculto sin plan que la incluya (AC-8), cambio de ventana.
- `apps/web/test/components/venue/venue-stats-panel-mount.test.ts` (lectura de fuente): se monta sólo con `venueListings`.

Integración (base real)
- `packages/db/test/integration/entity-interaction-stats.model.integration.test.ts`: dedup por bucket de 30 min, agrupado por `kind`, ventana de 90 días con datos de hasta 120 días presentes.

API
- `apps/api/test/routes/venue/protected/stats.test.ts`: AC-1, 5, 6. Seguir en los tests de handler lo que dice `apps/api/CLAUDE.md` (bypass de SUPER_ADMIN, mock global de `@repo/db`, `CI=true`).
- `apps/api/test/routes/commercial-gates.stats.test.ts`: ya cubre el gate de estadísticas; agregar AC-9 (cruce de verticales) y AC-10.

E2E: el flujo dueño-con-plan requiere que HOS-2280 haya asignado la clave. Hasta entonces, un test e2e con un usuario sembrado con la clave vía fixture de catálogo en la base de test (no por la UI de planes).

Guards: `check:guards`, `check-catalog-key-usage` (la clave ya está en el catálogo), `cacheable-pages-are-session-blind`.

## 10. Riesgos

- R-1. **Retención vs ventana.** Resuelto (owner, 16/11/2026): con retención de 120 días y ventana de 90, un cron caído hasta 30 días no recorta el panel. El resumen mensual existe desde el primer día (HOS-2256, T-7). Riesgo residual: si el cron de purga se adelanta o se acorta el horizonte, hay que revisar esta ventana.
- R-2. **Dueño con varios locales.** El panel muestra uno por vez; el total de la cuenta no existe. Es una decisión (OQ-2).
- R-3. **Las vistas cuentan al dueño, los clics no** (HOS-2256 OQ-5). La tasa de clics queda ligeramente por debajo. Aceptable, documentado.
- R-4. **Tasa de clics sobrestimada por bloqueadores.** Un visitante con bloqueador puede registrar clic sin vista (el beacon de vistas cae) y la tasa pasa de 100% antes del recorte. Se recorta.
- R-5. **Copy compartido de la clave** ("tendencias de tu alojamiento"). No se reusa en este panel; HOS-2262 decide cómo se rotula en la tabla de planes.
- R-6. **`VenueMenuQrWidget` ya tiene 489 líneas**; no se le agrega nada. El panel nuevo va en su propio archivo.

## 11. Preguntas abiertas para el owner

- OQ-1. **Tasa de clics: qué significa.**
  1. "Visitas con al menos un clic sobre total de visitas", recortada a 100%. Es lo que se explica en 6.3. Recomendada.
  2. "Clics totales sobre vistas totales". Pro: simple. Contra: puede pasar de 100% y se lee mal.
  3. "Clics de un canal sobre vistas" (una tasa por canal). Pro: más detalle. Contra: ocho números chicos poco confiables en un local con pocas visitas.
- OQ-2. **Un local por vez o total de la cuenta.**
  1. Un local por vez con selector. Recomendada: la ruta ya es por id y los dueños con varios locales suelen tener rubros distintos.
  2. Además un total de la cuenta. Pro: vista general. Contra: otra ruta y otra definición; se puede agregar después.
- OQ-3. **Qué ve un local sin plan que la incluya (hoy: todos).**
  1. Nada hasta que haya un plan de local con la clave. Recomendada: no promete lo que no se vende.
  2. Un upsell genérico sin plan. Pro: anticipa la oferta. Contra: promete algo que HOS-2280 puede no asignar.
- OQ-4. **Qué plan recibe la clave.** El reparto aprobado dice pro y premium. Lo decide HOS-2280, no esta spec; se registra para que el upsell pueda nombrar "Pro" y no "Premium".

## 12. Etiquetas de smoke y Novedades

- `status-needs-smoke-staging`: porque necesita datos reales de clics (HOS-2256 desplegada) y un usuario con la clave en un plan de local, que sólo existe después de HOS-2280. Se anota en la spec: **no se puede firmar** hasta que ambas estén desplegadas.
- `status-needs-smoke-local`: no hace falta.
- What's New: **sí aplica**, pero se escribe recién cuando HOS-2280 habilite el panel (la novedad es del turista-dueño que lo ve). Hasta entonces la función está oculta; no se anuncia nada.

## 13. Dependencias

- Depende de HOS-2256 (tabla y datos de clics, retención de 120 días y rollup mensual desde el primer día).
- Habilitada por HOS-2280 (asignación de la clave). Sin ella el panel queda oculto, por diseño.
- Relacionada con HOS-2265 (comparte `EntityInteractionModel`) y HOS-2262 (textos de la tabla de planes).
- No toca el catálogo.

## 14. Desglose en tareas

1. T-1. Schemas `VenueStatsSchema`, `VenueStatsWindowSchema` + i18n de validación (0,5 día).
2. T-2. `EntityInteractionModel.getClickStatsForEntity` con dedup y test de integración (0,75 día).
3. T-3. `EntityViewService.getStatsForVenue` con ventana 90d y tasa de clics + unit (0,75 día).
4. T-4. Ruta `GET /venues/{id}/stats` con `capabilities`, registro, manifest y tests de ruta (0,75 día).
5. T-5. Test cruzado de verticales (AC-9) y de `EntityViewWindowSchema` (AC-10) (0,5 día).
6. T-6. Cliente `getVenueStats` y componente de barras diarias compartido (0,5 día).
7. T-7. `VenueListingStatsPanel` (estados, selector de local y ventana, upsell por catálogo) + i18n es/en/pt + tests (1 día).
8. T-8. Montaje en `comercio/index.astro` y declaración de namespaces (0,25 día).
9. T-9. Smoke (queda en espera de HOS-2280).

## 15. Linear

Canonical tracking:
HOS-2261

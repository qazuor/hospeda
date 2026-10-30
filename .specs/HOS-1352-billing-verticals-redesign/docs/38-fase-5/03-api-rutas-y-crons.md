---
title: "FASE 5 · agente 3 — API (apps/api) fuera de la autorización: rutas, raíz de composición, outbox, crons, caché y logger"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
fase: 5
---

# 03 · API fuera de la autorización: rutas, crons, outbox, caché y logger

- **Área**: `apps/api` fuera de la autorización (rutas y sus factories, receptor de avisos de Mercado
  Pago, raíz de composición, outbox y notificaciones, crons que no son de billing, invalidación de
  caché, logger).
- **Código de referencia**: `origin/staging` en `35e2d63e819d087cb871392ec923158b91630f30`, leído con
  `git show` / `git grep` desde el worktree del programa.
- **Fecha**: 2026-09-30.
- **Criterio**: `DEC-METH-017` (reglas de la FASE 5). `$D` = `.specs/HOS-1352-billing-verticals-redesign/docs`,
  `V/` = `.specs/HOS-1353-…/docs`, `B/` = `.specs/HOS-1354-…/docs`.
- **Fuera de esta área, a propósito**: los gates de entitlement y de permisos
  (`middlewares/entitlement.ts`, `owner-entitlement.ts`, `route-factory-tiered.ts` en lo que hace al
  contrato de errores) son del agente de autorización; acá sólo se cuentan cuando pesan sobre la
  compilación de `U1`.

## Resumen

Conteo por categoría, sacado con script sobre las líneas `- **categoría**:` de este archivo
(comando al final, en *«búsquedas de ausencia»*):

| categoría | piezas |
|---|---|
| CONFIRMA | 10 |
| CONTRADICE | 4 |
| FALTA | 6 |
| ADAPTAR | 4 |
| DELETE (lote N) | 1 (una lista) |
| **total** | **25** |

Dentro de lo que el diseño conserva de fuera del billing viejo, la plantilla del PDR queda así:
**KEEP** las factories de rutas con `ResponseFactory` (F5-API-007), el servicio de revalidación con
`@repo/cache-tags` (F5-API-014), `@repo/logger` (F5-API-024) y la primitiva de día de mercado de
`@repo/utils` (F5-API-022); **ADAPT** la raíz de composición (F5-API-005) y la infraestructura de
crons (F5-API-009). Ninguna pieza conservada sale **REWRITE**; lo que habría que reescribir
(`@repo/notifications` como outbox) no se conserva: el diseño lo da por nuevo (F5-API-020).

**Las ALTA** (una línea cada una):

1. **F5-API-019** — `billing_notification_log` es la bitácora de **todos** los correos de la
   plataforma (contacto, feedback, partners, alianzas, intercambio entre anfitriones, calendario, IA), y el lote N borra
   `billing_*` entero sin decir qué pasa con ella: `U1` o rompe el build, o deja viva una tabla
   `billing_*` con FK a `billing_customers`.
2. **F5-API-020** — **Ninguna de las 23 unidades construye el outbox** de `NUCLEO/07`: hay unidades
   que prueban *«el correo quedó encolado»* y ninguna que construya la cola, el despachador, la clave
   de deduplicación, la jerarquía de supresión ni el escalado.
3. **F5-API-015** — el cron `archive-abandoned-drafts` archiva borradores de alojamiento a los 30
   días fijos de `updated_at` y le revoca el rol HOST al dueño: es un segundo `PB5` que el diseño no
   conoce, y `U1` no lo borra porque no es de billing.

---

## 1. El receptor de avisos de Mercado Pago y la ruta

### F5-API-001 · La ruta y la marca del canal

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **diseño**: el receptor nuevo sirve *«la misma ruta que el viejo, `/api/v1/webhooks/mercadopago`,
  con la marca `source_news=webhooks` en la URL de Webhooks y sin ella en la de IPN, como hoy»*
  (`$D/16-fase-7-del-paraguas.md` §4.2, fila 3; `B/06-proveedor.md:549`).
- **código**: se monta en `apps/api/src/routes/index.ts:781`
  (`app.route('/api/v1/webhooks/mercadopago', …)`); la marca es `V2_SOURCE_NEWS_MARKER = 'webhooks'`
  (`apps/api/src/routes/webhooks/mercadopago/router.ts:99`), documentada con la URL completa en
  `router.ts:86` y leída en `router.ts:210-211`.
- **argumento**: la ruta y el discriminador por URL existen tal como el diseño los describe. Lo que
  hace hoy la ruta **después** de leer la marca —descartar la entrega IPN con `200`
  (`router.ts:211-225`) en vez de guardarla en `provider_notification` (`B/descomposicion.md:129`)—
  es código del receptor viejo, que se va con el lote N (F5-API-025). Lo que se conserva es el
  camino, no el handler.
- **unidad**: la del receptor nuevo (`B/descomposicion.md:129`).

### F5-API-002 · El montaje condicionado a que billing esté configurado

- **categoría**: ADAPTAR
- **severidad**: MEDIA
- **diseño**: la ruta existe en todo momento del corte: el borde la cierra con un Worker que contesta
  `500` y al quitarle la ruta *«la ruta vuelve a contestar la aplicación»* (§4.2, fila 0 y fila 3);
  *«no hay rato en que la ruta no exista»* (fila 4b).
- **código**: `apps/api/src/routes/index.ts:778-784` monta la ruta **sólo si**
  `createMercadoPagoWebhookRoutes()` devuelve algo; si billing no está configurado
  (`router.ts` `getWebhookDependencies()` nulo) la ruta no se registra y el pedido cae al `notFound`
  (sólo un `warn`).
- **argumento**: con esa forma, un error de configuración del receptor nuevo en el paso 3 convierte
  la ruta en un `404`, que no es el `500` medido que el proveedor reintenta (`WH-4`). El diseño da por
  hecho que la aplicación contesta en esa ruta; el patrón de montaje de hoy lo vuelve condicional. Las
  líneas se reescriben igual al montar el receptor nuevo; lo que hay que decidir es si el montaje nuevo
  conserva la condición.
- **qué corregir**: el código (el montaje del receptor nuevo), o una línea en el diseño que diga qué
  contesta la ruta si el receptor no arranca.
- **unidad**: la del receptor (`B/descomposicion.md:129`); el ensayo del paso 0 lo vería.

### F5-API-003 · Lo que la ruta hereda por su camino

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **diseño**: el receptor nuevo recibe en la misma ruta, sin apuntar nada (§4.2, 4b).
- **código**: el bucket de rate-limit de webhooks se elige por el camino
  (`apps/api/src/middlewares/rate-limit.ts:660`, `path.includes('/webhooks/')`) y el caché de
  respuestas excluye `'/api/v1/webhooks'` (`apps/api/src/middlewares/cache.constants.ts:56`).
- **argumento**: los dos comportamientos que importan a un receptor (no quedar cacheado, no compartir
  el bucket de tráfico humano) cuelgan del camino y no del handler, así que el receptor nuevo los
  hereda sin tocar nada. El rate-limit propio de 100/min que el viejo agrega en `router.ts` se va con
  él.
- **unidad**: ninguna.

### F5-API-004 · El Worker del borde que contesta `500`

- **categoría**: FALTA
- **severidad**: BAJA
- **diseño**: *«vive versionado con el script del corte en `scripts/cutover/`, es de esta FASE 7 del
  paraguas»* (§4.2, *«las herramientas del corte»*, punto 5).
- **código**: `scripts/cutover/` no existe (`git ls-tree` de `scripts/` en origin/staging: `__tests__`,
  `backup`, `ci`, `client-tools`, `posthog`, `sentry`, `server-tools`). **Sí existen dos Workers del
  borde versionados**, con su `wrangler.toml`: `infra/cloudflare/posthog-proxy/wrangler.toml` y
  `infra/cloudflare/sentry-tunnel/wrangler.toml`.
- **argumento**: la ausencia es la esperada (es de la FASE 7 del paraguas, no de una unidad). Lo que
  el diseño no mira es que el repositorio ya tiene un lugar y una forma para Workers del borde, y que
  el que elige es otro. No contradice nada; es un dato para quien lo escriba.
- **unidad**: FASE 7 del paraguas.

---

## 2. La raíz de composición y el reloj

### F5-API-005 · La raíz de composición de `apps/api`

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **plantilla del PDR**: **ADAPT** (cambio chico y claro: una línea para el reloj, las de `B4`, y sacar
  las del cobro viejo).
- **diseño**: *«El único lugar que junta las dos mitades es la raíz de composición de `apps/api`»*;
  *«La implementación real del reloj … la inyecta esa raíz»*; *«La línea de esa raíz que lo inyecta la
  escribe `B1`»* (`$D/12-contrato-de-cobertura.md` §7.1, punto 5 y párrafo siguiente; caso K-C).
- **código**: `apps/api/src/index.ts:176` (`startServer`) ya es esa raíz, y ya inyecta puertos en
  `@repo/service-core` con setters: `setUserPermissionsCacheInvalidator` (`:356`),
  `setPermissionChangeAuditEmitter` (`:357`), `setCalendarConnectionRevocationPort` (`:364`), y
  `initializeRevalidationService` (`:334`). El comentario de `:350-353` dice la razón: *«The service
  cannot import the API's in-memory permission cache … so the API registers them here at startup»*.
- **argumento**: el diseño supone un lugar donde se cablean implementaciones hacia los packages, y
  existe, con un patrón ya usado tres veces para exactamente esto (un package que no puede importar la
  app). El reloj y la implementación real de `cobertura` entran como un setter más. Las condiciones del
  KEEP que no cumple: *«no depende de conceptos legacy»* (mezcla `validateBillingConfigOrThrow`,
  `mountQZPayAdminTier` y `ensureDefaultPromoCodes`, `:295`, `:303`, `:311`, que son lote N), por eso
  ADAPT y no KEEP.
- **unidad**: `B1` (el reloj), `B4` (la implementación real), `U1` (sacar las tres líneas).

### F5-API-006 · La interfaz del reloj

- **categoría**: FALTA
- **severidad**: BAJA
- **diseño**: *«La interfaz del reloj con que el código de producción de las dos mitades lee la hora,
  inyectada»* (`12-contrato…` §7.1, punto 5).
- **código**: no hay interfaz de reloj en `apps/` ni `packages/` (búsqueda al final). El contexto de
  los crons fija la hora con `startedAt: new Date()` (`apps/api/src/cron/bootstrap.ts:50`) y los 50
  archivos de `apps/api/src/cron` usan `new Date()`/`Date.now()` 252 veces (conteo con script).
- **argumento**: la ausencia es la esperada (la construye `B1`), y la severidad es baja por eso. El
  dato que el diseño no escribe: el adelantable sólo mueve lo que lee la interfaz, y los jobs nuevos
  van a vivir en la infraestructura de crons de hoy, cuyo contexto trae la hora del sistema. Eso es
  F5-API-009.
- **unidad**: `B1`.

---

## 3. Rutas y sus factories

### F5-API-007 · Factories de rutas, `ResponseFactory` y las tres capas

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **plantilla del PDR**: **KEEP**, en lo que hace a esta área.
- **diseño**: no las nombra: `createSimpleRoute`, `createOpenApiRoute`, `createListRoute`,
  `createAdminListRoute`, `ResponseFactory` y `createProtectedRoute` dan **cero** apariciones en el
  núcleo, el contrato, `16-` y las dos épicas (búsqueda al final). Lo que el diseño sí da por hecho es
  que sus superficies (`B/19-superficies.md`, `V/19-superficies.md`) se sirven desde la API, y
  `B/19-superficies.md:329` deja *«qué endpoints expone la API, uno por uno»* fuera de su alcance.
- **código**: `createSimpleRoute` (`apps/api/src/utils/route-factory.ts:323`), `createCRUDRoute`
  (`:365`), `createListRoute` (`:482`); las de capa en `apps/api/src/utils/route-factory-tiered.ts`
  (`createPublicRoute:95`, `createProtectedRoute:145`, `createAdminRoute:223`,
  `createPublicListRoute:313`, `createProtectedListRoute:356`, `createAdminListRoute:398`);
  `ResponseFactory` en `apps/api/src/utils/response-factory.ts:12`. Tests en
  `apps/api/test/route-factory/*.test.ts`. **`createOpenApiRoute` no existe** en origin/staging (cero
  archivos; el control positivo `createCRUDRoute` da 83): el `CLAUDE.md` raíz la nombra y está
  desactualizado.
- **argumento**: son genéricas (ninguna nombra una vertical ni un concepto de billing), aparecen en cientos
  de archivos de rutas (entre 3 y 418 archivos cada una; conteo con script), y tienen tests propios. Cumplen las condiciones del KEEP en lo
  que les toca: correctas, genéricas, testeadas, sin legacy. La parte de `createProtectedRoute` que
  hace cumplir el contrato de errores la evalúa el agente de autorización.
- **unidad**: ninguna.

### F5-API-008 · Rutas que no son de billing y están cableadas al cobro viejo

- **categoría**: ADAPTAR
- **severidad**: MEDIA
- **diseño**: `U1` borra el cobro viejo y *«la rama sigue compilando: typecheck y lint verdes. Lo que
  queda roto es el comportamiento, no el build»* (`16-` §4.6, *«qué deja demostrado»*). Publicar y
  despublicar pasan a ser `PB1` y `PB6` (`V/03-maquinas-de-estado.md` §9), de `V6`.
- **código**: fuera de `routes/billing/` y `routes/webhooks/`, **7** archivos de rutas importan
  `services/accommodation-publish-deps.ts` (las de publicar, despublicar, `patch` y `update` de
  alojamiento, protegidas y admin), que a su vez importa `@qazuor/qzpay-core`, `@repo/billing` y las
  tablas `billing_*` (`accommodation-publish-deps.ts:30-40`); **93** importan `@repo/billing`, **17**
  `middlewares/billing`, **2** `@qazuor/qzpay` directo (conteo con script; el control positivo sobre
  `routes/billing` da 28 archivos).
- **argumento**: el diseño describe el resultado de `U1` y no su tamaño en rutas que conserva. Cortar
  esas dependencias sin romper el build obliga a `U1` a tocar las rutas de publicación de alojamiento,
  que el diseño deja para `V6`, y a decidir qué se hace con `@repo/billing` en 93 rutas (mucho es
  entitlement, del agente de autorización). No contradice: es trabajo que el diseño no dimensiona.
- **qué corregir**: el diseño, con una línea en `U1` que diga qué hace con los importadores
  conservados (stub, borrar la llamada, o dejar el comportamiento roto detrás de una interfaz vacía).
- **unidad**: `U1`, `V6`.

---

## 4. Crons: infraestructura y los que el diseño toca

### F5-API-009 · La infraestructura de crons

- **categoría**: ADAPTAR
- **severidad**: MEDIA
- **plantilla del PDR**: **ADAPT**.
- **diseño**: el diseño necesita muchos jobs nuevos (el reconciliador diario de cobertura de `V6`,
  `PB4`/`PB5`/`PB9`, `T3`, el barrido de `B11`, el detector posterior al corte, el despachador del
  outbox) y les exige tres cosas que hoy no tiene el contexto de un job: **leer la hora del reloj
  inyectado** (`12-` §7.1, punto 5), **computar toda ventana en días en el huso del mercado**
  (`NUCLEO/07` §3, consecuencia 2: *«Un proceso que corre en UTC tiene que convertir, y eso incluye a
  los jobs»*), y **llevar la correlación de su corrida y la de cada entidad** (`NUCLEO/08` §2.3).
- **código**: registro en `apps/api/src/cron/registry.ts` (47 jobs), programación en proceso con
  `node-cron` (`apps/api/src/cron/bootstrap.ts:128`, `nodeCron.schedule(scheduleExpression, …)`,
  **sin opción de huso**), contexto con `logger`, `startedAt: new Date()` y `dryRun`
  (`bootstrap.ts:31-52`, `types.ts:25-41`), y registro de corridas en `record-run.ts`. Tests en
  `apps/api/test/cron/` (`bootstrap`, `record-run`, `schedules-manifest`, `cron-run-purge`).
- **argumento**: es genérica y testeada, y sirve de soporte a los jobs nuevos; no cumple *«representa
  el modelo nuevo»* en tres puntos concretos del contexto (hora, huso, correlación), que son
  agregados chicos: pasar el reloj por el contexto, declarar el huso de la programación, y un id de
  corrida. Por eso ADAPT y no REWRITE.
- **unidad**: `B1` (el reloj entra por la raíz de composición); el resto no tiene unidad escrita
  (ver *«lo que no pude cerrar»*).

### F5-API-010 · Los crons del sistema nuevo arrancan con el despliegue del paso 3

- **categoría**: ADAPTAR
- **severidad**: MEDIA
- **diseño**: *«Hasta acá [paso 5] el sistema nuevo no crea nada en el proveedor, así que la rama de
  aborto nunca restaura un backup encima de un preapproval vivo»* (`16-` §4.2, fila 5); la rama de
  aborto cubre el paso 3 **incluidos** el 3b, el 4 y el 4b (§4.2, fila 3, última columna).
- **código**: el proceso arranca el programador de crons apenas levanta el servidor, para todo
  entorno que no sea `test` (`apps/api/src/index.ts:392-393`); el único interruptor es
  `HOSPEDA_CRON_ADAPTER` (`bootstrap.ts:81`), de proceso entero, que se lee al arrancar.
- **argumento**: entre el despliegue del paso 3 y el cierre del paso 4 corren todos los jobs
  nuevos: el despachador del outbox manda correos que un aborto no deshace, el reconciliador diario
  evalúa fichas antes de los grants del 3b y el barrido de `B11` lee el proveedor antes de las
  lápidas. El diseño cuida el receptor (borde cerrado) y las altas (borde cerrado), pero no dice nada
  de los jobs, y el código no los distingue. Nada de esto rompe una unidad, pero sí la premisa de que
  la rama de aborto sólo tiene que deshacer lo que enumera.
- **qué corregir**: el diseño (§4.2, paso 3: si los jobs del sistema nuevo corren o no hasta el paso
  5, y con qué acto operativo se prenden).
- **unidad**: FASE 7 del paraguas.

### F5-API-011 · La premisa del paso 4c: *«la detección de páginas viejas … a las 48 h»*

- **categoría**: CONTRADICE
- **severidad**: MEDIA
- **diseño**: *«sin este paso la ficha que el corte bajó se sigue viendo en su página y en el buscador
  hasta que la detección de páginas viejas del código actual la alcance, a las 48 h
  (`apps/api/src/cron/jobs/page-revalidation.job.ts:11`)»* (`16-` §4.2, fila 4c).
- **código**: la detección existe (`STALE_WINDOW_MS = 48 h`, `page-revalidation.job.ts:27`), pero es
  **por tipo de entidad** y no por ficha: lee la última corrida por `entityType`
  (`page-revalidation.job.ts:101`, `:152`) y purga con `revalidateEntityTypesBatch` (`:195`), que
  resuelve **sólo las etiquetas del tipo** (`packages/service-core/src/revalidation/revalidation.service.ts:401`);
  el propio servicio lo dice: *«Per-entity staleness is caught by that entity's own write hook, not
  by this cron path»* (`revalidation.service.ts:395-396`). Y la pasada por intervalo corre antes que la
  de 48 h: alojamiento tiene `cronIntervalMinutes: 60`
  (`packages/seed/src/data/revalidationConfig/001-revalidation-config-defaults.json`), así que purga
  `list-accom` y `home` en cada corrida del cron, que en producción es cada 6 h (`F-1B-017`).
- **argumento**: las dos mitades de la premisa están mal, y en direcciones opuestas. **La página de
  la ficha y la del destino no las purga nunca el cron** (ni a las 48 h ni después): sin el 4c se ven
  hasta que venza su caché. **Los listados, en cambio, se purgan solos en 6 h o menos**, no en 48. La
  conclusión del diseño (el 4c hace falta) se sostiene y hasta se fortalece para la página de la
  ficha y la del destino; la razón escrita es falsa, y el número que da (48 h) no es la cota de nada.
- **qué corregir**: el diseño (la razón del 4c).
- **unidad**: `V6` (la herramienta del 4c).

### F5-API-012 · Las etiquetas que el 4c purga

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **diseño**: purga *«una vez por tipo de ficha, la etiqueta de colección (`list-accom`, `list-gastro`
  y `list-exp`, `packages/cache-tags/src/vocabulary.ts:84`) … y la de la portada»*, y *«la página de
  cada destino, que … el código invalida por su destino y no por una colección
  (`packages/service-core/src/revalidation/entity-tag-mapper.ts:75`): una purga por destino, 22»*
  (`16-` §4.2, fila 4c).
- **código**: `CACHE_TAG_COLLECTIONS` en `packages/cache-tags/src/vocabulary.ts:84-91`;
  `CACHE_TAG_HOME` en `:100`; el mapeo de alojamiento agrega la etiqueta del destino padre en
  `entity-tag-mapper.ts:75-83`, y el de Gastronomía y Experiencia hace lo mismo en `:166-190`.
- **argumento**: las etiquetas y su semántica son las que el diseño cita. Tres datos que el diseño no
  pesa y le sirven a la herramienta: (1) **existe una purga única por entorno**,
  `RevalidationService.purgeEverything` (`revalidation.service.ts:787`), que purga `<env>:all`
  (`vocabulary.ts:144`), etiqueta que llevan todas las respuestas cacheables; es una purga contra el
  tope, no 22 más 4. (2) La revalidación ya tiene endpoints de admin, `POST
  /api/v1/admin/revalidation/revalidate/entity` y `/revalidate/type`
  (`apps/api/src/routes/revalidation/index.ts:202`, `:321`; montado en `routes/index.ts:687`), que la
  herramienta puede usar sin armar su propio cliente. (3) El servicio sólo se inicializa si hay
  `HOSPEDA_REVALIDATION_SECRET` (`apps/api/src/index.ts:314`), y sin él el cron y los endpoints se
  saltean en silencio (`page-revalidation.job.ts`, rama `service_not_initialized`).
- **unidad**: `V6`.

### F5-API-013 · La escritura de nacimiento no programa revalidación

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **diseño**: *«la escritura de nacimiento es directa y no es una transición, así que no programa
  revalidación»* (`16-` §4.2, fila 4c).
- **código**: la revalidación por entidad la dispara el servicio al escribir
  (`scheduleRevalidation`, `revalidation.service.ts:310`; llamado desde
  `packages/service-core/src/services/accommodation/accommodation.service.ts:1013`), con debounce en
  memoria y *«fire-and-forget»* (`revalidation.service.ts:296-309`). Una migración SQL no pasa por ahí.
- **argumento**: cierto tal como lo dice el diseño.
- **unidad**: `V6`.

### F5-API-014 · El servicio de revalidación y `@repo/cache-tags`

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **plantilla del PDR**: **KEEP**.
- **diseño**: las transiciones de publicación programan revalidación y el 4c la usa (`16-` §4.2, 4c);
  `V/02-modelo-de-datos.md:750` conserva `revalidation_log` y `revalidation_config` en la lista de lo
  que `PURGED` no toca.
- **código**: `packages/service-core/src/revalidation/` (servicio, adaptadores Cloudflare y noop,
  mapeo de etiquetas) y `packages/cache-tags/src/` (vocabulario y espacio de nombres por entorno).
  Tests: `packages/cache-tags/src/{namespace,vocabulary}.test.ts` y diez archivos en
  `packages/service-core/test/revalidation/`, dos de ellos guards (`every-entity-type-has-config`,
  `entity-revalidation-carries-id`).
- **argumento**: genérico por tipo de entidad (cubre `gastronomy` y `experience` con el mismo brazo,
  `entity-tag-mapper.ts:166-167`), no nombra billing, y está vigilado por guards. Cumple las cinco
  condiciones del KEEP en lo que el diseño le pide.
- **unidad**: ninguna.

### F5-API-015 · `archive-abandoned-drafts` es un segundo `PB5`

- **categoría**: CONTRADICE
- **severidad**: ALTA
- **diseño**: `PB5`: `DRAFT` → `ARCHIVED` a los **N meses de inactividad, contado sobre
  `listing.inactiva_desde` o sobre el fin de la última pausa, con la versión de plazos que guarda la
  ficha** (el plazo 3 de `NUCLEO/02` §1.5) (`V/03-maquinas-de-estado.md:487`); la máquina de
  publicación es la tabla cerrada de §9, y la construye `V6` (`V/descomposicion.md:488`).
- **código**: `apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts`: `ARCHIVE_THRESHOLD_DAYS = 30`
  y aviso a los 23 (`:44-47`), contado sobre `updated_at` (cabecera, `:4-15`), escribe
  `lifecycleState: ARCHIVED` (`:288`) y además **le revoca el rol HOST** al dueño cuya última ficha
  archivó (`:35`, `shouldRevokeHostHat`). Corre todos los días a las 3.
- **argumento**: es otra transición `DRAFT` → `ARCHIVED`, con otro reloj (30 días fijos contra N meses
  versionados), otra fuente (`updated_at` contra `inactiva_desde`), sin los hechos de reinicio de
  `NUCLEO/01` §1.2, y con un efecto que ninguna fila de §9 tiene (sacar un rol). No es de billing, así
  que `U1` no lo borra (`16-` §4.6 borra *«todo el cobro viejo»*), y ninguna unidad de verticales lo
  nombra (cero apariciones de `archive-abandoned-drafts` en las épicas; búsqueda al final). Si nadie lo
  ve, el sistema nuevo tiene dos escritores de `PB5` y los borradores de la cartera se archivan al
  mes.
- **qué corregir**: el diseño (que `U1` o `V6` lo borre, nombrado), o el código.
- **unidad**: `V6` (dueña de `PB5`), `U1`.

### F5-API-016 · Los tres crons de partner archivan una presencia que el diseño no archiva

- **categoría**: CONTRADICE
- **severidad**: MEDIA
- **diseño**: *«La página propia de Partner Gold no tiene máquina de estados. La lectura pública
  pregunta si el partner tiene HOY el entitlement»*; *«El contenido se conserva. No se baja, no se
  archiva y no se borra nada»* (`V/18-partner.md` §1.6). `B/21-migracion.md` §4 (`:438-440`) retira
  `partner_subscriptions`.
- **código**: `partner-expiry` archiva (`lifecycleState: ARCHIVED`) a los partners con `endsAt`
  vencido y `subscriptionStatus` activo (`apps/api/src/cron/jobs/partner-expiry.job.ts:78-79`);
  `partner-unpaid-reaper` los archiva a los 90 días sin pago (`partner-unpaid-reaper.job.ts:133`);
  `partner-payment-review` marca revisión de pago manual e importa `ENTITLEMENT_GRANTING_STATUSES` de
  `@repo/billing` (`partner-payment-review.job.ts:51`).
- **argumento**: los tres leen el estado de suscripción viejo del partner (`partners.subscription_status`,
  `starts_at`, `payment_review_state`) y los dos primeros ejecutan una transición que el modelo nuevo
  prohíbe. No están entre los 17 de billing de `F-1B-018`, así que no es obvio que caigan en el lote N,
  y `16-` §4.6 no los nombra. La severidad es media porque Partner tiene hoy cero filas (`V/18` §1.6,
  punto 2 de lo que no cierra).
- **qué corregir**: el diseño (nombrarlos en el lote N o en `V7`).
- **unidad**: `U1`, `V7`.

### F5-API-017 · El job de alertas deja de evaluar una alerta cerrada

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **diseño**: las alertas de precio de una ficha `PURGED` *«se cierran, con un aviso al turista …: sin
  ficha no hay precio que vigilar, y el job de alertas dejaría de evaluar una ficha vacía»*
  (`V/02-modelo-de-datos.md:747`).
- **código**: la tabla tiene `isActive` (`packages/db/src/schemas/alert/tourist_price_alerts.dbschema.ts:50`)
  y el evaluador que usa `alerts-digest` sólo toma `{ isActive: true, deletedAt: null }`
  (`packages/service-core/src/services/alert/price-drop-evaluator.service.ts:343`; ídem
  `promo-offer-evaluator.service.ts:400`).
- **argumento**: cerrar es poner `isActive = false`, y el job deja de evaluarla sin cambios.
- **unidad**: `V9`/`V6` (quien corre `PB9`/`PB12`).

### F5-API-018 · El reconciliador diario de cobertura

- **categoría**: FALTA
- **severidad**: BAJA
- **diseño**: *«el reconciliador diario de cobertura, que una vez por día corre `PB2`/`PB3`/`PB7`
  donde el aviso no llegó, escribe los hechos 2 y 5, invalida el caché»* (`V/descomposicion.md:59`,
  fila `V6`); también cubre la presencia de Partner (`V/18` §1.6).
- **código**: no hay equivalente conservable. Sus análogos de hoy —`entity-subscription-cache-reconcile`,
  `featured-by-entitlement-reconcile` y la visibilidad de commerce que maneja
  `reconcileSubscriptionLinkedEntities` (`apps/api/src/services/subscription-linked-entities.service.ts:104`,
  que llama a `reconcileCommerceListingVisibility`,
  `packages/service-core/src/services/commerce/commerce-visibility.ts:239`)— leen `entity_subscriptions`
  y `featured_by_entitlement`, que el lote N retira (`B/21` §4, `:438-440`).
- **argumento**: ausencia esperada y con dueño (`V6`); por eso baja. Lo único que se reusa es la
  infraestructura de F5-API-009.
- **unidad**: `V6`.

---

## 5. Outbox y notificaciones

### F5-API-019 · `billing_notification_log` es de todos los correos, y el lote N borra `billing_*`

- **categoría**: CONTRADICE
- **severidad**: ALTA
- **diseño**: el lote N no conserva *«`billing_*` entero (suscripciones, pagos, compras de addon,
  canjes de promo)»* (`B/21-migracion.md:438`), y `U1` borra *«el esquema de las tablas viejas de
  billing»* sin romper el build (`16-` §4.6, punto 1 y *«qué deja demostrado»*).
- **código**: la tabla está en `packages/db/src/schemas/billing/billing_notification_log.dbschema.ts:15`,
  con FK a `billing_customers` (`:18-20`), y **todo correo que manda `NotificationService`** se
  registra ahí (`packages/notifications/src/services/notification.service.ts:3`, `:1063`). Mandan por
  ese servicio, además del cobro, `lib/alliance-ports.ts`, `lib/host-trade-ports.ts`,
  `lib/partner-ports.ts`, `routes/contact/submit.ts`, `routes/feedback/public/submit.ts`,
  `services/ical-calendar/ical-calendar-sync.service.ts`, `services/mercadolibre-oauth/ml-token.service.ts`,
  `services/ai-cost-alert.service.ts` y los crons `newsletter-close-campaigns`,
  `archive-abandoned-drafts` y `partner-unpaid-reaper` (35 archivos de `apps/api/src` en total).
  Además la leen el de-dup de alertas de costo de IA (`services/ai-cost-alert.service.ts:31`, `:70-74`)
  y el cron `notification-log-purge`, vía
  `packages/service-core/src/services/billing/notification/notification-retention.service.ts:18`; y
  su índice único de idempotencia vive en el carril de extras
  (`packages/db/src/migrations/extras/004-billing.constraints.sql:94`).
- **argumento**: la tabla tiene nombre y carpeta de billing y FK a una tabla de qzpay, pero es la
  bitácora de toda la mensajería de la plataforma. Si `U1` la borra con `billing_*`, rompe la
  compilación de `@repo/notifications`, de `@repo/service-core` y de una docena de consumidores que
  no son de billing, contra *«la rama sigue compilando»*. Si no la borra, queda viva una tabla
  `billing_*` con una FK que apunta a una tabla borrada, contra *«`billing_*` entero»*. El diseño no
  elige, y el outbox nuevo (F5-API-020) no dice si la reemplaza.
- **qué corregir**: el diseño (nombrar la tabla en el lote N, decir con qué la reemplaza el outbox o
  si sobrevive como bitácora renombrada, y si `@repo/notifications` se conserva).
- **unidad**: `U1`, y la dueña del outbox (que no existe: F5-API-020).

### F5-API-020 · El outbox: no hay nada equivalente, y ninguna unidad lo construye

- **categoría**: FALTA
- **severidad**: ALTA
- **diseño**: `NUCLEO/07-outbox-y-notificaciones.md`: el correo se encola **en la transacción de
  dominio** y se manda afuera (§1.1), la fila guarda la dirección al encolarse (§1.1), `processing`
  con dueño y vencimiento (§1.2), escalado del `failed` obligatorio (§1.3), clave única
  `(destinatario, plantilla, ocurrencia)` calculada antes de encolar (§2). `16-` §4.2 lo da por nuevo:
  *«antes de que exista el outbox nuevo»* (`16-fase-7-del-paraguas.md:293`). Y las unidades lo
  consumen: `V9` prueba que *«después de `PB9` la alerta de precio … está cerrada y su correo
  encolado»* (`V/descomposicion.md:606`), `V6` que `PB12` cierra el pedido *«sin encolar correo»*
  (`:507`), `B12` que `S37` *«encola»* (`B/descomposicion.md:138`), `B4` que la pérdida de cobertura
  se guarda *«en la misma transacción que encola el aviso»* (`:699`).
- **código**: lo más parecido es `NotificationService.send`, que **manda primero y registra después**
  (`notification.service.ts:244` envía, `:264` registra `sent`, `:289` registra `failed`), fuera de
  toda transacción de dominio; reintenta sólo si falló, en Redis y si hay Redis
  (`:1111-1150`), más un cron que reintenta cinco tipos de billing (`F-1B-119`); y deduplica con una
  clave opcional dentro de un JSON (`extras/004-billing.constraints.sql:94`). El único outbox de verdad
  del repo es el del newsletter: filas de entrega con transiciones de estado, despachadas por BullMQ
  (`packages/service-core/src/services/newsletter/newsletter-delivery.service.ts:15-27`).
- **argumento**: de las cinco propiedades del §1 y el §2 el código no tiene ninguna, y es la base
  sobre la que se apoya todo el catálogo del §6. La ausencia sola sería esperada (el diseño
  lo sabe nuevo); lo que la vuelve ALTA es que **`outbox` tiene cero apariciones en las dos
  `descomposicion.md` y en `16-`** salvo la frase citada, y ninguna fila de unidad construye la cola,
  el despachador, la clave, la supresión ni el escalado: las unidades lo usan y nadie lo hace. El
  precedente del newsletter es el punto de partida natural.
- **qué corregir**: el diseño (asignar el outbox a una unidad, o a `U1`/una unidad del paraguas si es
  de las dos mitades).
- **unidad**: ninguna, que es el hallazgo.

### F5-API-021 · La jerarquía de supresión del §4

- **categoría**: FALTA
- **severidad**: MEDIA
- **diseño**: dos clases (transaccional no suprimible y comercial) y cuatro causas en orden: rebote
  duro, cuenta borrada, opt-out sólo de lo comercial, tope diario por destinatario
  (`NUCLEO/07` §4.1-§4.3).
- **código**: el rebote duro se registra **sólo para suscriptores del newsletter**
  (`apps/api/src/routes/webhooks/brevo.ts:102`;
  `packages/service-core/src/services/newsletter/newsletter-tracking.service.ts:171-172`, `:295`); los
  correos transaccionales salen por Resend (`packages/notifications/src/config/resend.config.ts`) sin
  ningún registro de rebote (búsqueda al final). El opt-out existe por categoría
  (`PreferenceService`, `packages/notifications/src/config/notification-categories.ts:6`), con
  categorías que no son las dos clases del diseño: los avisos de vencimiento de trial son `REMINDER`
  suprimibles (`:21-29`), y el diseño los hace transaccionales no suprimibles (§4.1); pero esos tipos
  son del cobro viejo y se van con él. No hay tope diario.
- **argumento**: la preferencia por categoría es reusable como mecanismo; el rebote duro sobre lo
  transaccional y el tope por destinatario no existen.
- **qué corregir**: nada del diseño; entra con el outbox (F5-API-020).
- **unidad**: la dueña del outbox.

### F5-API-022 · El huso del mercado

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **plantilla del PDR**: **KEEP** (la primitiva).
- **diseño**: *«toda ventana expresada en días se computa en el huso del mercado —
  `America/Argentina/Buenos_Aires`—, y el instante se guarda siempre en UTC»* (`NUCLEO/07` §3).
- **código**: la primitiva existe y está testeada: `packages/utils/src/local-day.ts:28`
  (`MARKET_TIMEZONE`), con `getLocalDateString` (`:55`), `getUtcInstantForLocalMidnight` (`:140`),
  `getLocalDayWindow` (`:212`) y `getLocalMonthWindow` (`:301`); tests en
  `packages/utils/test/local-day.test.ts`. Pero el literal del huso se repite en cinco lugares más de
  `apps/api/src` (`cron/jobs/partner-payment-review.job.ts:89`, `lib/lead-intake-ports.ts:119`,
  `services/calendar-sync/date-range.ts:33`, `services/courtesy-notifications.service.ts:65`,
  `services/ical-calendar/ical-parser.ts:110`).
- **argumento**: la invariante tiene ya su primitiva, con la razón escrita (HOS-1169) y correcta:
  resuelve por nombre de zona, no por desplazamiento. Genérica, testeada, sin legacy: KEEP. Las copias
  del literal son deuda ajena al diseño; lo que sí toca al diseño es la programación de crons sin huso
  (F5-API-009).
- **unidad**: ninguna.

---

## 6. Logger y observabilidad

### F5-API-023 · El identificador de correlación y el tipo de actor

- **categoría**: FALTA
- **severidad**: MEDIA
- **diseño**: la correlación se acuña *«en el borde, una vez por intención»* y viaja al evento de
  dominio y a la fila de outbox (`NUCLEO/08` §2.1-§2.2); los jobs llevan la de su corrida y la de cada
  entidad (§2.3); y al §50 le falta *«el tipo de actor»* (§5).
- **código**: el contexto de pedido tiene `requestId`, método, camino, usuario y roles
  (`apps/api/src/lib/request-context.ts:36-51`), inyectado en cada línea de log desde la raíz de
  composición (`apps/api/src/index.ts`, `configureLogger({ … getContext })`). No hay campo de
  correlación: `correlationId`/`correlation_id` da cero en `apps/api/src`, `packages/logger/src` y
  `packages/service-core/src` (búsqueda al final). El contexto de un cron no tiene id de corrida
  (`cron/types.ts:25-41`).
- **argumento**: el `requestId` es por pedido, no por intención, y no llega a ninguna fila. El
  mecanismo de propagación (`AsyncLocalStorage` más el `getContext` del logger) es el lugar natural
  donde sumarlo.
- **qué corregir**: nada del diseño; ninguna unidad lo nombra (ver *«lo que no pude cerrar»*).
- **unidad**: sin unidad escrita.

### F5-API-024 · `@repo/logger`

- **categoría**: CONFIRMA
- **severidad**: BAJA
- **plantilla del PDR**: **KEEP**.
- **diseño**: `NUCLEO/08` §5 pide campos en el log estructurado; no pide otro logger.
- **código**: `packages/logger` con doce archivos de test (`packages/logger/test/*.test.ts`, incluido
  el guard `redact.error-own-properties.guard.test.ts`), configurado una vez en la raíz de
  composición con nivel, formato y un gancho de contexto (`apps/api/src/index.ts`, `configureLogger`).
- **argumento**: genérico, sin billing, testeado, y con el gancho (`getContext`) por donde entran la
  correlación y el tipo de actor de F5-API-023 sin tocar el package.
- **unidad**: ninguna.

---

## 7. DELETE (lote N)

### F5-API-025 · Lo del cobro viejo en esta área

- **categoría**: DELETE
- **severidad**: —
- **argumento**: `U1`, lote N (`16-` §4.6, punto 1; `B/21` §4).
- **lista**:
  - los 17 crons de billing de `F-1B-018`: `abandoned-pending-subs`, `addon-expiry`,
    `addon-subscription-reconcile`, `apply-scheduled-plan-changes`, `courtesy-expiry`, `dunning`,
    `entity-subscription-cache-reconcile`, `featured-by-entitlement-reconcile`,
    `finalize-cancelled-subs`, `notification-schedule` (con `trial-series-dispatch.ts` y
    `notification-schedule-renewal-window.ts`), `preapproval-less-expiry`,
    `propagate-plan-price-changes`, `reactivation-supersession-reconcile`,
    `subscription-drift-reconcile`, `subscription-poll`, `trial-reconcile` (`jobs/trial-expiry.ts`) y
    `webhook-retry`;
  - `services/notification-retry.service.ts` (reintenta cinco tipos de billing; `F-1B-119`);
  - `routes/webhooks/mercadopago/` entero, `routes/webhooks/health.ts` y `routes/webhooks/admin/`
    (leen `billing_webhook_events` y `billing_webhook_dead_letter`), y `routes/billing/`;
  - los middlewares globales del cobro en `apps/api/src/utils/create-app.ts:180` (`billingMiddleware`),
    `:183` (`billingCustomerMiddleware`) y `:190` (`trialMiddleware`) (`entitlementMiddleware`, `:186`,
    lo evalúa el agente de autorización);
  - en la raíz de composición, `apps/api/src/index.ts:295`, `:303` y `:311`;
  - `reconcileSubscriptionLinkedEntities` (`services/subscription-linked-entities.service.ts:104`) y
    la visibilidad de commerce que maneja (`packages/service-core/src/services/commerce/commerce-visibility.ts:239`);
  - las plantillas de correo del cobro viejo en `packages/notifications/src/templates/{billing,subscription,addon}/`.

---

## Búsquedas de ausencia

Todas contra `origin/staging` `35e2d63e81` desde el worktree, o sobre las carpetas de diseño del
worktree. Cada una lleva su control positivo.

```text
# Factories en el diseño (F5-API-007): 0 para las seis
rg -c -F '<nombre>' HOS-1352…/docs/{nucleo,12-contrato-de-cobertura.md,16-fase-7-del-paraguas.md} HOS-1353… HOS-1354…
  createSimpleRoute 0 · createOpenApiRoute 0 · createListRoute 0 · createAdminListRoute 0 · ResponseFactory 0 · createProtectedRoute 0
  control: 'raíz de composición' → 27

# createOpenApiRoute en el código (F5-API-007)
git grep -l "\bcreateOpenApiRoute\b" origin/staging -- apps/api/src   → 0 archivos
  control: createCRUDRoute → 83, createAdminRoute → 418

# Interfaz de reloj (F5-API-006)
git grep -n -E "interface [A-Za-z]*Clock\b|type [A-Za-z]*Clock\b" origin/staging -- apps packages   → 0
  control: "interface [A-Za-z]*Service\b" en packages/service-core/src → hit (newsletter-campaign.service.ts:72)

# Correlación (F5-API-023)
git grep -n -i "correlationId\|correlation_id" origin/staging -- apps/api/src packages/logger/src packages/service-core/src   → 0
  control: "requestId" en apps/api/src/lib/request-context.ts → :33, :38

# Rebote duro fuera del newsletter (F5-API-021)
git grep -n -i -E "hard_?bounce" origin/staging -- packages/notifications/src packages/service-core/src apps/api/src
  → sólo routes/webhooks/brevo.ts y services/newsletter/newsletter-tracking.service.ts (el control es el propio hit)

# Outbox en el código (F5-API-020)
git grep -n -i 'outbox' origin/staging -- packages apps (sin tests) → 1: newsletter-delivery.service.ts:15

# Outbox como unidad (F5-API-020)
rg -c -i 'outbox' HOS-1353…/descomposicion.md HOS-1354…/descomposicion.md   → 0 y 0
  control: rg -c 'NUCLEO/07' HOS-1353…/descomposicion.md → 3 (se cita el catálogo, no la cola)

# Crons no-billing nombrados por el diseño (F5-API-015, -024)
rg -c -F '<job>' HOS-1353… HOS-1354… HOS-1352…/docs/{nucleo,12-…,16-…}   para los 47 nombres
  → sólo 'dunning' (3) y 'page-revalidation' (1); archive-abandoned-drafts 0, partner-* 0

# scripts/cutover (F5-API-004)
git ls-tree -d --name-only origin/staging scripts/   → sin 'cutover'
  control: git ls-tree -r --name-only origin/staging | grep wrangler.toml → infra/cloudflare/{posthog-proxy,sentry-tunnel}

# Rutas no-billing cableadas al cobro (F5-API-008), fuera de routes/billing y routes/webhooks
git grep -l -F "<patrón>" origin/staging -- apps/api/src/routes | grep -v -E '/test/|\.test\.|/routes/billing/|/routes/webhooks/' | wc -l
  "from '@qazuor/qzpay" 2 · "from '@repo/billing'" 93 · "middlewares/billing" 17 · "accommodation-publish-deps" 7
  control: mismo patrón compuesto sobre routes/billing → 28 archivos

# Uso de hora del sistema en crons (F5-API-006)
git grep -c -E "new Date\(\)|Date\.now\(\)" origin/staging -- apps/api/src/cron  → 50 archivos, 252 usos

# Conteo de este informe
rg -o '^- \*\*categoría\*\*: [A-Z]+' 03-api-rutas-y-crons.md | sort | uniq -c
```

## Lo que no pude cerrar

1. **Dónde vive el despachador del outbox** (cron de `node-cron` o worker de BullMQ como el
   newsletter): es la misma pregunta de F5-API-020 y la decide quien la tome.
2. **Qué unidad agrega la correlación y el tipo de actor** (F5-API-023) y **el huso y el id de
   corrida al contexto de los crons** (F5-API-009): ni `B1` (el reloj) ni ninguna otra fila los
   nombra. No los clasifico como contradicción porque el diseño no afirma quién; es el mismo hueco de
   dueño que el outbox, más chico.
3. **El horario real de `page-revalidation` en producción**: tomo el `0 */6 * * *` de `F-1B-017`
   (medido con `hops env-list`), no lo re-medí. Si cambió, cambia la cota de 6 h de F5-API-011, no su
   conclusión.
4. **`exchange-rate-fetch`**: el `CLAUDE.md` raíz lo lista como cron de billing y `F-1B-018` no; el
   diseño no lo nombra (cero apariciones de *«tipo de cambio»*/`exchange`). No lo clasifico: no es
   algo que el diseño toque ni suponga.
5. **El `search_index`** (vista materializada que refresca `search-index-refresh`) no tiene lectores
   en el código de las apps ni de `service-core` (sólo el cron y el registro). No lo toca el diseño;
   lo anoto porque el 4c habla de *«el buscador»* y ese buscador es el listado con filtros cacheado
   con `list-accom`, no esta vista.
6. **El aviso de cobertura *«después del commit»*** (`12-` §3) necesita un gancho post-commit en la
   capa de transacciones; es del contrato y de `packages/db`, fuera de esta área.

# SPEC-034 — On-Demand ISR Revalidation: Gap Analysis Report

> **Auditoría #1** — 2026-03-16 (pre-implementación / durante implementación)
> **Auditor**: Senior Tech Lead / Principal Engineer
> **Metodología**: Lectura exhaustiva de spec + código + contraste cruzado
> **Cobertura**: 100% de archivos declarados en spec + archivos relacionados no declarados
>
> **Auditoría #2** — 2026-03-16 (post-implementación — 86 tasks marcadas como complete)
> **Auditor**: Multi-agente paralelo (4 agentes especializados + 1 verificador cruzado)
> **Metodología**: Análisis exhaustivo multi-agente: service-core, DB/schemas, API/cron, admin UI/pages, verificación cruzada de conflictos
> **Cobertura**: Todos los archivos implementados por las 86 tasks de SPEC-034
>
> **Auditoría #3** — 2026-03-16 (verificación cruzada post-fixes)
> **Auditor**: Multi-agente paralelo (5 agentes especializados: spec-analyzer, api-expert, admin-expert, web-expert, tests/schemas-expert + 1 verificador cruzado)
> **Metodología**: Análisis exhaustivo independiente de spec vs código actual en todos los layers, con verificación puntual de cada gap previo
> **Cobertura**: Spec completa + API (routes, services, cron, adapters, env) + Admin (pages, components, hooks, i18n) + Web (astro config, ISR, pages, env) + Tests/Schemas (12 test files, 5 schema files, permissions, logger)
>
> **Auditoría #4** — 2026-03-16 (deep audit multi-agente exhaustivo)
> **Auditor**: Multi-agente paralelo (4 agentes especializados: backend-reviewer, web-reviewer, admin-ui-reviewer, tests-schemas-reviewer)
> **Metodología**: Verificación de TODOS los gaps abiertos de A1-A3 + descubrimiento de gaps nuevos mediante lectura exhaustiva de código
> **Cobertura**: Todos los archivos de implementación de SPEC-034 en todos los layers, con foco en gaps no verificados en auditorías previas
>
> **Auditoría #5** — 2026-03-16 (auditoría exhaustiva multi-experto con contraste profundo spec vs código)
> **Auditor**: Multi-agente paralelo (8 agentes especializados: spec-reader, codebase-isr-analyzer, web-architecture-analyzer, api-webhooks-analyzer, code-reviewer senior, service-hooks-verifier, test-coverage-analyzer, admin-ui-analyzer)
> **Metodología**: Lectura completa e independiente de spec + TODOS los archivos de implementación. Contraste cruzado línea por línea. Verificación de service hooks en los 8 servicios. Análisis exhaustivo de cobertura de tests. Revisión profunda de admin UI vs spec.
> **Cobertura**: 100% archivos de implementación SPEC-034 en todos los layers + verificación exhaustiva de cada gap previo + descubrimiento de gaps no detectados en auditorías anteriores
>
> **Auditoría #6** — 2026-03-16 (auditoría exhaustiva cross-layer con foco en contradicciones arquitecturales y completitud de hooks)
> **Auditor**: Multi-agente paralelo (4 agentes especializados: spec-vs-code cross-referencer, ISR-contradiction-analyzer, service-hooks-matrix-verifier, existing-gaps-reviewer + orchestrator senior)
> **Metodología**: (1) Lectura completa de spec + state.json + metadata.json. (2) Análisis exhaustivo de TODA la infraestructura ISR: Astro config, adapters, entity-path-mapper, service hooks en los 8 servicios. (3) Contraste profundo de regex ISR exclude vs paths generados por entity-path-mapper vs rutas reales de Astro. (4) Matriz de hooks completa: 8 servicios x 6 operaciones CRUD. (5) Revisión completa de los 40 gaps activos de A1-A5.
> **Cobertura**: 100% archivos de implementación + contraste cruzado ISR config vs entity-path-mapper vs Astro pages + verificación exhaustiva de hooks en los 8 servicios para 6 operaciones CRUD
>
> **Auditoría #7** — 2026-03-16 (auditoría exhaustiva multi-experto con 6 agentes especializados)
> **Auditor**: Multi-agente paralelo (6 agentes especializados: api-routes-auditor, service-layer-auditor, web-astro-auditor, admin-ui-auditor, service-hooks-tests-auditor, db-permissions-cron-auditor)
> **Metodología**: Cada agente leyó exhaustivamente TODOS los archivos de su capa, contrastando línea por línea contra los requerimientos del spec. Se priorizó descubrir gaps NUEVOS no identificados en las 6 auditorías previas (GAP-001 a GAP-075).
> **Cobertura**: 100% de archivos de implementación en todas las capas: API routes, service-core (RevalidationService, EntityPathMapper, adapters), web (Astro config, ISR, todas las páginas públicas), admin UI (página de revalidación, RevalidateEntityButton, hooks, HTTP adapter), service hooks (los 8 servicios x CRUD operations), tests (todos los test files), DB schemas, permissions, cron, env vars, i18n.
>
> **Auditoría #8** — 2026-03-16 (auditoría de consolidación con verificación de código exacto + contraste cruzado multi-agente)
> **Auditor**: Multi-agente paralelo (4 agentes especializados: spec-reader completo, gaps-inventory completo, ISR-infrastructure-auditor, admin-tests-schemas-auditor + 2 agentes de verificación cruzada puntual)
> **Metodología**: (1) Lectura completa de spec (~50k tokens) para inventario exhaustivo de requerimientos por sección. (2) Lectura completa de gaps file (~65k tokens) para inventario de los 85 gaps de A1-A7. (3) Auditoría independiente de infraestructura ISR: astro.config.mjs, RevalidationService, EntityPathMapper, 8 service hooks, DB schemas, API routes, cron, env, web pages. (4) Auditoría independiente de admin UI: página de revalidación, RevalidateEntityButton, hooks, HTTP adapter, i18n (es/en/pt), Zod schemas, 9 test files, permissions, logger, vercel.json. (5) Verificación cruzada puntual: existencia de rutas API (discrepancia entre agentes), y lectura de código exacto de los 10 gaps más críticos.
> **Cobertura**: 100% spec + 100% gaps previos + verificación con snippets de código exacto para los gaps más críticos. Resolución de discrepancias entre agentes.
>
> **Auditoría #9** — 2026-03-16 (auditoría exhaustiva multi-experto con 5 agentes especializados independientes)
> **Auditor**: Multi-agente paralelo (5 agentes especializados: ISR-config-infra-auditor, revalidation-service-auditor, API-DB-schemas-auditor, admin-UI-i18n-auditor, test-coverage-auditor)
> **Metodología**: Cada agente leyó exhaustivamente TODOS los archivos de su capa con lectura completa de código (no overviews simbólicos). Contraste línea por línea contra spec (~50k tokens). Verificación independiente de cada gap previo. Descubrimiento de gaps nuevos. Foco especial en: (1) regex ISR exclude vs locale routing, (2) service hooks matrix completa 8×6, (3) dead code analysis, (4) admin UI navigation/integration, (5) test coverage gaps con escenarios edge-case.
> **Cobertura**: 100% archivos implementación: astro.config.mjs, vercel.json, env schemas (api + web), Vercel/NoOp adapters + factory, RevalidationService completo, EntityPathMapper completo, 8 service hooks, 8 API routes, 2 DB schemas + 4 indexes + 2 models, 5 Zod schema files, 4 permissions, 8 seed configs, cron job, admin dashboard (4 files), RevalidateEntityButton, admin HTTP adapter, admin hooks, router/menu, 3 locale files (es/en/pt), 12 test files completos

---

## Executive Summary

### Auditoría #1 (2026-03-16 — durante implementación)

La implementación de SPEC-034 estaba **aproximadamente 60-65% completa** respecto a lo especificado. Las piezas fundamentales de infraestructura estaban en su lugar (DB schemas, modelos, adapters, schemas Zod, rutas API, admin UI, i18n, seed, cron job, service hooks). Sin embargo, había **brechas críticas y divergencias de diseño** que hacían la implementación funcionalmente incorrecta en varias dimensiones clave.

**Resumen cuantitativo Auditoría #1:**
- Gaps críticos (P1): 6
- Gaps altos (P2): 6
- Gaps medios (P3): 8
- Gaps bajos (P4): 5
- **Total: 25 gaps encontrados**

---

### Auditoría #2 (2026-03-16 — post-implementación, 86/86 tasks completadas)

La implementación post-completada está en aproximadamente **~80-85% real** de conformidad con el spec. La infraestructura base está correcta y funcional. Los gaps más graves de Auditoría #1 sobre la API del `RevalidationService` y `EntityPathMapper` **persisten en su mayoría** — la implementación adoptó una API simplificada que es funcional pero diverge de la spec en dimensiones importantes (no persiste logs, no lee config de DB, API de service hooks simplificada).

**Estado de gaps de Auditoría #1 en Auditoría #2:**
- ✅ Confirmados aún abiertos: GAP-003, GAP-004, GAP-005, GAP-010, GAP-011, GAP-012, GAP-015
- ⚠️ Necesitan verificación cruzada: GAP-001, GAP-002, GAP-006, GAP-008, GAP-014 (ver notas en cada gap)
- ❌ Resueltos/no aplicables: a determinar con verificación adicional

**Gaps nuevos encontrados en Auditoría #2 (no en Auditoría #1):**
- GAP-026: `_afterRestore` hook no implementado en ninguno de los 8 servicios
- GAP-027: GET /health no verifica conectividad real del adapter
- GAP-028: Sin tests unitarios para DB models (RevalidationConfigModel, RevalidationLogModel)
- GAP-029: Sin tests unitarios para Zod schemas de revalidación
- GAP-030: Tests de rutas API no verifican 401/403 explícitamente
- GAP-031: PATCH /config/:id no retorna 404 específico si la config no existe

**Resumen cuantitativo acumulado (Auditorías #1 + #2):**
- Gaps totales únicos: 31
- Confirmados aún abiertos: ≥ 7 (de Auditoría #1) + 6 nuevos = **≥ 13 gaps activos**

---

### Auditoría #3 (2026-03-16 — verificación cruzada exhaustiva post-fixes)

La implementación ha avanzado sustancialmente desde las auditorías anteriores. **15 gaps de A1/A2 fueron resueltos**, incluyendo los 6 críticos (P1) del core: EntityPathMapper, RevalidationService API, log persistence, config reading, adapter interface, y adapter factory. La conformidad con la spec pasó de ~80-85% a **~92-95%**.

**Gaps resueltos desde A2 (verificados con lectura de código):**
- ✅ GAP-001: EntityPathMapper ahora usa discriminated union `EntityChangeData` con URL slugs en inglés
- ✅ GAP-002: RevalidationService API correcta — `scheduleRevalidation(event: EntityChangeData)`
- ✅ GAP-004: Service escribe logs en `revalidation_log` (best-effort, fire-and-forget)
- ✅ GAP-005: Service lee `revalidation_config` con cache de 60s
- ✅ GAP-008: Adapter interface tiene `revalidate()` + `revalidateMany()`
- ✅ GAP-010: Cron usa `alreadyRevalidated` Set para prevenir doble-revalidación
- ✅ GAP-013: Factory activa Vercel para staging+production (no solo production)
- ✅ GAP-014: Service hooks pasan `EntityChangeData` completo (slug, destinationSlug, accommodationType, tagSlugs, etc.)
- ✅ GAP-020: Tests ahora validan implementación correcta (puesto que la impl fue corregida)
- ✅ GAP-026: `_afterRestore` implementado en servicios con datos completos
- ✅ GAP-028: Tests unitarios para DB models existen (revalidation-config.model.test.ts: 6.4KB)
- ✅ GAP-029: Tests unitarios para Zod schemas existen (revalidation-config.schema.test.ts: 13.7KB)

**Gaps de A1/A2 que SIGUEN ABIERTOS (verificados):**
- ⚠️ GAP-003: POST /revalidate/entity SIGUE ignorando entityId (llama revalidateByEntityType)
- ⚠️ GAP-006: ISR exclude patterns SIGUEN siendo demasiado amplios (excluyen detail pages)
- ⚠️ GAP-011: findLastCronEntry sin filtro por trigger='cron' (pendiente verificación manual)
- ⚠️ GAP-025: Sin test E2E Playwright
- ⚠️ GAP-027: GET /health sin probe real al adapter
- ⚠️ GAP-030: Tests de rutas sin 401/403 explícitos
- ⚠️ GAP-031: PATCH /config/:id sin 404 específico

**Gaps de A1/A2 pendientes de verificación manual (no se pudo confirmar estado definitivo):**
- GAP-007, GAP-009, GAP-012, GAP-015, GAP-016, GAP-017, GAP-018, GAP-019, GAP-021, GAP-022, GAP-023, GAP-024

**Gaps NUEVOS encontrados en Auditoría #3:**
- GAP-032: RevalidateEntityButton hardcodea Spanish text — no usa i18n
- GAP-033: RevalidateEntityButton no verifica permiso REVALIDATION_TRIGGER
- GAP-034: Sin tests unitarios para componentes/hooks de revalidación en admin
- GAP-035: Sin error boundaries en página de revalidación admin
- GAP-036: Gaps de accesibilidad en UI admin de revalidación
- GAP-037: Vercel adapter sin timeout en fetch
- GAP-038: Vercel adapter sin retry logic
- GAP-039: Ninguna página usa `Astro.revalidate` per-route
- GAP-040: Sin categorías de logger específicas para revalidación en @repo/logger
- GAP-041: Stale window (48h) y log retention (30d) hardcodeados, no configurables
- GAP-042: `destinos/index.astro` sigue con `prerender=true` (spec dice ISR)

**Resumen cuantitativo Auditoría #3:**
- Gaps resueltos de A1/A2: 15
- Gaps aún abiertos de A1/A2 (confirmados): 7
- Gaps de A1/A2 pendientes verificación manual: 12
- Gaps nuevos A3: 11
- **Total gaps activos (confirmados + nuevos): 18**
- **Total gaps pendientes verificación: 12**

---

### Auditoría #4 (2026-03-16 — deep audit multi-agente exhaustivo)

Auditoría profunda con 4 agentes especializados enfocada en: (1) verificar definitivamente TODOS los gaps abiertos de A1-A3 incluyendo los 12 pendientes de verificación manual, y (2) descubrir gaps nuevos mediante lectura exhaustiva de código.

**Resultado de verificación de gaps A1-A3:**

✅ **Resueltos (confirmados con lectura de código):**
- GAP-001: EntityPathMapper usa discriminated union `EntityChangeData` con URL slugs en inglés (hotel, hostel, cabin, apartment, camping, estancia)
- GAP-002: RevalidationService API correcta — `scheduleRevalidation` acepta `EntityChangeData`
- GAP-004: Service escribe logs en `revalidation_log` (best-effort, fire-and-forget)
- GAP-005: Service lee `revalidation_config` con cache de 60s TTL
- GAP-007: No se encontró `console.error`. Todos los archivos usan `@repo/logger` correctamente
- GAP-008: Adapter interface tiene `revalidate()` + `revalidateMany()`
- GAP-010: Cron usa `alreadyRevalidated` Set para prevenir doble-revalidación
- GAP-013: Factory activa Vercel para staging+production (no solo production)
- GAP-014: Service hooks pasan `EntityChangeData` completo (slug, destinationSlug, accommodationType, tagSlugs, etc.)
- GAP-026: `_afterRestore` implementado en todos los servicios con datos completos
- GAP-028: Tests unitarios para DB models existen
- GAP-029: Tests unitarios para Zod schemas existen

⚠️ **Siguen ABIERTOS (confirmados):**
- GAP-003 (CRITICAL, P1): POST /revalidate/entity SIGUE ignorando entityId
- GAP-006 (CRITICAL, P1): ISR exclude patterns SIGUEN siendo incorrectos
- GAP-025: Sin test E2E Playwright
- GAP-027: GET /health sin probe real al adapter
- GAP-030: Tests de rutas con assertions permisivas de status codes
- GAP-031: PATCH /config/:id sin test de 404
- GAP-032: RevalidateEntityButton hardcodea texto en español
- GAP-033: RevalidateEntityButton sin permission check REVALIDATION_TRIGGER
- GAP-034: Sin tests unitarios para componentes/hooks admin
- GAP-035: Sin error boundaries en página de revalidación admin
- GAP-042: `destinos/index.astro` sigue con `prerender=true` y `getStaticPaths`

**Gaps de A1/A2 previamente pendientes de verificación — RESUELTOS en A4:**
- GAP-007: ✅ Resuelto
- GAP-009, GAP-012, GAP-015, GAP-016, GAP-017, GAP-018, GAP-019, GAP-021, GAP-022, GAP-023, GAP-024: No re-verificados individualmente; los nuevos gaps GAP-043 a GAP-063 subsumen o redefinen los problemas restantes con mayor precisión

**Gaps NUEVOS encontrados en Auditoría #4:**
- GAP-043 (CRITICAL, P1): `revalidateByEntityType` no consulta DB — no genera paths de detalle
- GAP-044 (HIGH, P2): `writeLog` siempre almacena `entityType: 'unknown'`
- GAP-045 (HIGH, P2): Debounce keyed por `path` en vez de `entityType:entityId`
- GAP-046 (HIGH, P2): `revalidateByEntityType` hardcodea `trigger='cron'` incluso cuando es manual
- GAP-047 (HIGH, P2): Manual revalidation route no pasa `triggeredBy` ni `reason`
- GAP-048 (MEDIUM, P3): Config missing `maxCronRevalidations` y `logRetentionDays`
- GAP-049 (MEDIUM, P3): API route URLs no matchean spec
- GAP-050 (MEDIUM, P3): PUT vs PATCH mismatch + id vs entityType param
- GAP-051 (MEDIUM, P3): Logs endpoint missing `path`, `dateFrom`, `dateTo` filters
- GAP-052 (MEDIUM, P3): Admin logs tab sin pagination, filters, auto-refresh, sort
- GAP-053 (LOW, P4): Admin hooks sin `staleTime` per spec
- GAP-054 (LOW, P4): Admin page duplica query logic en vez de usar hooks exportados
- GAP-055 (LOW, P4): Missing 4th stat card (last revalidation)
- GAP-056 (LOW, P4): Log status badge muestra valor raw en vez de i18n
- GAP-057 (LOW, P4): RevalidateEntityButton missing `className` prop
- GAP-058 (LOW, P4): CLAUDE.md documenta `HOSPEDA_ISR_BYPASS_TOKEN` pero código usa `HOSPEDA_REVALIDATION_SECRET`
- GAP-059 (MEDIUM, P3): Service hooks test cubre solo 4 de 8 services
- GAP-060 (MEDIUM, P3): VercelRevalidationAdapter.revalidateMany sin batching (spec: batches de 10)
- GAP-061 (LOW, P4): HTTP adapter missing `revalidateByType` y `checkServiceHealth` methods
- GAP-062 (LOW, P4): Sin tests para ISR exclude patterns
- GAP-063 (LOW, P4): `destinos/[...path].astro` unsafe locale cast

**Resumen cuantitativo Auditoría #4:**
- Gaps de A1-A3 resueltos (confirmados en A4): 12
- Gaps de A1-A3 aún abiertos (confirmados en A4): 11
- Gaps nuevos A4: 21
- **Total gaps activos: 32**

---

### Auditoría #5 (2026-03-16 .. auditoría exhaustiva multi-experto con contraste profundo spec vs código)

Auditoría profunda con 8 agentes especializados ejecutándose en paralelo. Cada agente leyó de forma independiente la spec completa y TODOS los archivos de implementación, generando análisis cruzados desde diferentes perspectivas: arquitectura web, API/webhooks, service hooks, test coverage, admin UI, y code review senior.

**Resultado de verificación de gaps A1-A4:**

✅ **Resueltos adicionales (confirmados con lectura de código en A5):**
- GAP-011: `findLastCronEntry` AHORA filtra por `trigger='cron'` correctamente (verificado en revalidation-log.model.ts:58). Sin embargo, sigue siendo funcionalmente inoperante porque GAP-044 causa que todos los logs se escriban con `entityType: 'unknown'`.
- GAP-033: `RevalidateEntityButton` AHORA verifica permiso `REVALIDATION_TRIGGER` via `useHasAnyPermission([PermissionEnum.REVALIDATION_TRIGGER])` y retorna `null` si falta el permiso.

⚠️ **Siguen ABIERTOS (reconfirmados en A5 con lectura de código):**
- GAP-003 (CRITICAL, P1): POST /revalidate/entity SIGUE ignorando `entityId`. El handler destructura `entityId` del body pero NUNCA lo usa. Llama `service.revalidateByEntityType(entityType)` .. idéntico a /revalidate/type.
- GAP-006 (CRITICAL, P1): ISR exclude patterns en `astro.config.mjs` SIGUEN incorrectos. Los regex `/^\/alojamientos\/(.*)\/?$/` y `/^\/eventos\/(.*)\/?$/` excluyen TODAS las páginas de detalle del ISR caching (deben ser cacheadas). Los regex `/^\/tipo(\/.*)?$/` y `/^\/categoria(\/.*)?$/` NUNCA matchean nada (les falta el prefijo de locale y segmento padre).
- GAP-025 (LOW, P4): Sin test E2E Playwright para revalidación manual.
- GAP-027 (LOW, P4): GET /health sin probe real al adapter.
- GAP-030 (LOW, P4): Tests de rutas API sin verificación explícita de 401/403.
- GAP-031 (LOW, P4): PATCH /config/:id sin test de 404 específico.
- GAP-032 (LOW, P4): RevalidateEntityButton hardcodea textos en español en toasts (line 51, 57) en vez de usar i18n keys existentes.
- GAP-034 (LOW, P4): Sin tests unitarios para componentes/hooks admin de revalidación (0% coverage).
- GAP-035 (MEDIUM, P3): Sin error boundary wrapping la página de revalidación admin.
- GAP-042 (LOW, P4): `destinos/index.astro` sigue con `prerender=true`.
- GAP-043 (CRITICAL, P1): `revalidateByEntityType` NO consulta DB para obtener entidades individuales. Solo genera paths genéricos (listings). El cron job nunca revalida detail pages (`/alojamientos/hotel-paradise/`).
- GAP-044 (HIGH, P2): `writeLog` siempre almacena `entityType: 'unknown'` (hardcodeado en 2 call sites: líneas ~120 y ~185).
- GAP-045 (HIGH, P2): Debounce keyed por `path` (string) en vez de `entityType:entityId`.
- GAP-046 (HIGH, P2): `revalidateByEntityType` hardcodea `trigger='cron'` incluso para llamadas manuales.
- GAP-047 (HIGH, P2): POST /revalidate/manual NO pasa `triggeredBy` ni `reason` al service a pesar de tenerlos disponibles.
- GAP-048 (MEDIUM, P3): `RevalidationServiceConfig` missing `locales`, `maxCronRevalidations`, `logRetentionDays`.
- GAP-050 (MEDIUM, P3): PATCH /config/:id casting inseguro (`body as Record<string, unknown>`) sin allowlist de campos mutables.
- GAP-051 (MEDIUM, P3): GET /logs endpoint no mapea filtros `fromDate`/`toDate` (schema los define pero el handler no los forwardea al model).
- GAP-052 (MEDIUM, P3): LogsTab sin pagination, filtros, sorting, ni auto-refresh.
- GAP-053 (LOW, P4): Todas las queries en `useRevalidation.ts` sin `staleTime` (default 0).
- GAP-054 (LOW, P4): Admin page duplica inline queries en vez de usar hooks exportados.
- GAP-056 (LOW, P4): Status badge en LogsTab muestra valor raw (`success`/`failed`) sin i18n.
- GAP-058 (LOW, P4): CLAUDE.md web documenta `HOSPEDA_ISR_BYPASS_TOKEN` pero código usa `HOSPEDA_REVALIDATION_SECRET`.
- GAP-059 (MEDIUM, P3): Service hooks test cubre solo 4 de 8 services (faltan AccommodationReview, DestinationReview, Post, Amenity).
- GAP-060 (MEDIUM, P3): `VercelRevalidationAdapter.revalidateMany` sin batching (spec requiere chunks de 10 con 200ms delay).
- GAP-062 (LOW, P4): Sin tests para ISR exclude patterns.
- GAP-063 (LOW, P4): `destinos/[...path].astro` unsafe locale cast.

**Gaps NUEVOS encontrados en Auditoría #5:**

- **GAP-064 (CRITICAL, P1)**: RevalidationService API contract diverge de la spec. Método principal se llama `scheduleRevalidation` (no `revalidateEntity`). `revalidatePaths` usa positional args (no RO-RO) y retorna `void` (no `ReadonlyArray<RevalidationResult>`). `revalidateByEntityType` retorna `void` en vez de `ReadonlyArray<RevalidationResult>`. **Complejidad**: 3. **Solución**: Alinear method signatures, adoptar RO-RO, corregir return types.

- **GAP-065 (MEDIUM, P3)**: Adapter interface usa parámetros posicionales (`revalidate(path: string)`) en vez de RO-RO objects (`revalidate({ path })`). Viola el patrón mandatorio del proyecto. **Complejidad**: 2. **Solución**: Actualizar interface y todas las implementaciones.

- **GAP-066 (HIGH, P2)**: `AccommodationReviewService` y `DestinationReviewService` NO pasan slug del parent entity en sus hooks de revalidación. Todas las llamadas usan `{ entityType: 'accommodation_review' }` sin `accommodationSlug`. Esto significa que cuando se agrega una review a un alojamiento, la página de detalle del alojamiento NUNCA se revalida (solo el listing `/alojamientos/`). Mismo problema con destination reviews. **Complejidad**: 2. **Solución**: Resolver parent slug desde `entity.accommodationId`/`entity.destinationId` antes de llamar `scheduleRevalidation`.

- **GAP-067 (HIGH, P2)**: `getLocalizedPath` genera paths sin prefijo de locale para Spanish (`locale === 'es'` retorna `/alojamientos/` en vez de `/es/alojamientos/`). La web app usa SIEMPRE el prefijo de locale (`/es/alojamientos/`). Las requests de revalidación para Spanish (el locale default y más importante) van a URLs que NO existen como cached routes en Vercel .. ISR bypass token nunca llega a la página correcta. **Complejidad**: 1. **Solución**: Eliminar la excepción para `es`: siempre generar `/${locale}${path}`.

- **GAP-068 (MEDIUM, P3)**: `RevalidationServiceConfig` e `InitRevalidationParams` no tienen campo `locales`. Cuando se corrija GAP-043 (revalidateByEntityType consultando DB), no habrá lista de locales disponible para generar paths multi-idioma. **Complejidad**: 1. **Solución**: Agregar `locales` field, pasar desde `@repo/i18n` en initialization.

- **GAP-069 (LOW, P4)**: JSDoc en `revalidation-init.ts` (line 15) referencia `HOSPEDA_ISR_BYPASS_TOKEN` cuando la variable real es `HOSPEDA_REVALIDATION_SECRET`. Consistente con GAP-058. **Complejidad**: 1.

- **GAP-070 (HIGH, P2)**: Revalidation admin page (`/_authed/revalidation/`) NO tiene route-level permission guard. Cualquier usuario autenticado puede acceder sin permisos `REVALIDATION_*`. Debería tener `beforeLoad` guard verificando al menos uno de: `REVALIDATION_TRIGGER`, `REVALIDATION_CONFIG_VIEW`, `REVALIDATION_LOG_VIEW`. **Complejidad**: 1. **Solución**: Agregar `beforeLoad` guard similar a otras páginas admin.

- **GAP-071 (MEDIUM, P3)**: Manual tab solo soporta revalidación por paths. Falta modo de revalidación por entity type (dropdown de entity type + botón "Regenerar"). La spec (sección 9.2) describe DOS modos: path-based Y entity-type-based. **Complejidad**: 2. **Solución**: Agregar segundo formulario/modo en ManualTab con dropdown de entity types.

- **GAP-072 (MEDIUM, P3)**: `RevalidateEntityButton` NO está integrado en ninguna página de edición de entidades. El componente existe pero NUNCA se importa ni usa en: accommodation edit, destination edit, event edit, post edit. **Complejidad**: 2. **Solución**: Importar y renderizar el botón en cada página de edición de entidad.

- **GAP-073 (LOW, P4)**: Cron job `page-revalidation` NO está registrado en `apps/api/vercel.json`. Los otros 6 cron jobs sí están. Si el job se ejecuta via Hono middleware interno está bien, pero si depende de Vercel Cron, falta la configuración. **Complejidad**: 1.

- **GAP-074 (MEDIUM, P3)**: Sin test coverage para VercelRevalidationAdapter bajo condiciones adversas: timeout, rate limiting (429), partial success, auth failure (403). Solo se testea happy path (200) y error genérico. **Complejidad**: 2.

- **GAP-075 (LOW, P4)**: Publicaciones (`/publicaciones/[slug].astro`) usan `prerender = true` (full SSG). No se benefician de ISR on-demand. Si un post se edita, la web no se actualiza hasta el próximo build completo. **Complejidad**: 1 (cambiar a ISR) o deliberado (posts no cambian frecuentemente).

**Resumen cuantitativo Auditoría #5:**
- Gaps de A1-A4 resueltos adicionales en A5: 2 (GAP-011, GAP-033)
- Gaps de A1-A4 reconfirmados abiertos en A5: 28
- Gaps nuevos A5: 12 (GAP-064 a GAP-075)
- **Total gaps activos: 40**

**Ranking de impacto (Top 10 fixes más críticos):**

| # | Gap | Sev | Impacto |
|---|-----|-----|---------|
| 1 | GAP-006 | P1 | ISR exclude patterns bloquean caching de TODAS las detail pages de alojamientos y eventos |
| 2 | GAP-067 | P2 | Paths de revalidación para Spanish (locale default) apuntan a URLs inexistentes |
| 3 | GAP-043 | P1 | Cron job no revalida ninguna detail page (solo listings genéricos) |
| 4 | GAP-066 | P2 | Reviews de alojamientos/destinos no revalidan la detail page del parent |
| 5 | GAP-003 | P1 | POST /revalidate/entity idéntico a /revalidate/type .. entityId inútil |
| 6 | GAP-044 | P2 | Todos los audit logs tienen `entityType: 'unknown'` .. stats por tipo inservibles |
| 7 | GAP-047 | P2 | Manual revalidation sin traza de quién lo hizo ni por qué |
| 8 | GAP-070 | P2 | Cualquier usuario autenticado accede a la página de revalidación admin |
| 9 | GAP-064 | P1 | API contract del service diverge de spec (RO-RO, return types, method names) |
| 10 | GAP-060 | P3 | Sin batching: cron con 500+ paths = 500 requests simultáneos a Vercel |

---

## Spec Coverage Matrix

| Task | Requisito | Status | Notas |
|------|-----------|--------|-------|
| T-001 | astro.config.mjs con ISR + exclude patterns | ⚠️ Parcial | ISR configurado pero exclude patterns incorrectos (A4 confirma GAP-006 abierto) |
| T-002 | HOSPEDA_REVALIDATION_SECRET en .env.example | ✅ Completo | Presente en ambos archivos |
| T-003 | Env vars en ApiEnvSchema | ✅ Completo | Ambas variables presentes |
| T-004 | Env validation en web app | ⚠️ Parcial | Secret en schema pero falta helper `getRevalidationSecret()` |
| T-005 | REVALIDATION permissions en PermissionEnum | ✅ Completo | 4 permisos presentes |
| T-006 | revalidation_config DB schema | ✅ Completo | Schema correcto |
| T-007 | revalidation_log DB schema | ✅ Completo | 4 índices presentes |
| T-008 | DB schemas barrel + index.ts | ✅ Completo | Exportado correctamente |
| T-009 | RevalidationConfigModel | ✅ Completo [A4] | A4: Implementación correcta. Tests unitarios existen (GAP-028 resuelto). |
| T-010 | RevalidationLogModel | ⚠️ Parcial | `findLastCronEntry` no filtra por `trigger='cron'` (GAP-011, confirmado A2) |
| T-011 | DB models barrel + index.ts | ✅ Completo | Exportados |
| T-012 | Zod schemas revalidation-config | ✅ Completo | RevalidationEntityTypeEnum + schemas completos |
| T-013 | Zod schemas revalidation-log | ✅ Completo | Triggers y statuses definidos |
| T-014 | Zod schemas HTTP request/response | ✅ Completo | Todos los schemas presentes |
| T-015 | Schemas barrel + entities/index.ts | ✅ Completo | Exportados |
| T-016 | Seed data + seedRevalidationConfig | ✅ Completo | 8 entity types, función correcta |
| T-017 | Registro seed en required manifest | ✅ Completo | Registrado en step 16 |
| T-018 | RevalidationAdapter interface | ✅ Completo [A4] | A4: `revalidate()` + `revalidateMany()` presentes (GAP-008 resuelto). Falta batching en `revalidateMany` (GAP-060). |
| T-019 | NoOpAdapter + factory | ✅ Completo [A4] | A4: Factory activa Vercel para staging+production (GAP-013 resuelto). |
| T-020 | Tests para adapters | ✅ Completo | `adapters.test.ts` presente (confirmado A2: 155 líneas, 18 test cases) |
| T-021 | EntityPathMapper | ✅ Completo [A4] | A4: Discriminated union `EntityChangeData` con URL slugs en inglés (GAP-001 resuelto). |
| T-022 | Unit tests EntityPathMapper | ⚠️ Parcial | A2 confirma 212 líneas de tests presentes. A1: validan implementación incorrecta. |
| T-023 | RevalidationService | ⚠️ Parcial [A4] | A4: API correcta, logs persisten (GAP-004 resuelto), config leída (GAP-005 resuelto). Pero: writeLog entityType='unknown' (GAP-044), debounce por path no por entidad (GAP-045), revalidateByEntityType no consulta DB (GAP-043). |
| T-024 | initializeRevalidationService | ⚠️ Parcial | Implementado, idempotencia silenciosa (GAP-018). A2 confirma gap. |
| T-025 | Exports en service-core index.ts | ✅ Completo | `export * from './revalidation'` |
| T-026 | REVALIDATION perms en seed admin role | ✅ Completo | 4 permisos en admin role |
| T-027–036 | Page migrations (11 páginas SSR) | ✅ Completo | A2 confirma: 9 páginas verificadas, sin prerender ni getStaticPaths. |
| T-037 | ISR docs en CLAUDE.md | ⚠️ Conflicto A1/A2 | A1: URL incorrecta. A2: Sección ISR presente y completa. Posible que se corrigió post-A1. Verificar mención de HOSPEDA_ISR_BYPASS_TOKEN vs HOSPEDA_REVALIDATION_SECRET. |
| T-038 | Integration tests adapter factory | ✅ Completo | `revalidation-smoke.test.ts` |
| T-039–045 | Service hooks (8 services) | ✅ Completo [A4] | A4: Hooks implementados en 8 servicios incluyendo _afterRestore (GAP-026 resuelto). EntityChangeData completo (GAP-014 resuelto). |
| T-046 | Unit tests service hooks | ⚠️ Parcial [A4] | A4: Cubre 4 de 8 servicios. Faltan PostService, AccommodationReviewService, DestinationReviewService, AmenityService (GAP-059). |
| T-047 | API bootstrap `initializeRevalidationService` | ✅ Completo | En `index.ts` |
| T-048 | Revalidation router skeleton | ✅ Completo | `routes/revalidation/index.ts` |
| T-049 | Mount revalidation router en API | ✅ Completo | `/api/v1/admin/revalidation` |
| T-050 | Unit tests EntityPathMapper edge cases | ⚠️ Parcial | Tests validan implementación incorrecta |
| T-051 | Unit tests RevalidationService | ⚠️ Parcial | Tests validan API incorrecta |
| T-052 | RevalidationStatsService | ✅ Completo | `revalidation-stats.service.ts` |
| T-053 | Integration tests endpoints (auth/permissions) | ⚠️ Parcial | A2: 1088 líneas de tests presentes. Sin tests explícitos de 401/403 (GAP-030). |
| T-054 | Export tipos RevalidationService | ✅ Completo | Tipos exportados (confirmado A2) |
| T-055 | i18n keys (es/en/pt) | ⚠️ Parcial [A1] / ⚠️ Parcial [A2] | A2: 3 archivos JSON completos (es/en/pt). Página admin no consume los keys i18n (strings hardcodeados, GAP-023). |
| T-066 | POST /revalidate/manual | ⚠️ Parcial [A4] | Implementado pero no pasa `reason` ni `triggeredBy` (GAP-047 — redefinido en A4). |
| T-067 | POST /revalidate/entity | ❌ Crítico | A2 confirma: entityId recibido pero completamente ignorado (GAP-003 / GAP-026). Llama revalidateByEntityType sin usar entityId. |
| T-068 | POST /revalidate/type | ✅ Completo | Correcto (confirmado A2) |
| T-069 | GET/PATCH /revalidation/config | ✅ Completo [A2] | A2: Ambas rutas presentes. PATCH sin 404 específico (GAP-031). |
| T-070 | GET /revalidation/logs | ⚠️ Parcial [A4] | A4: Missing `path`, `dateFrom`, `dateTo` filters (GAP-051). Admin tab sin pagination/filters/auto-refresh (GAP-052). |
| T-071 | GET /revalidation/stats | ✅ Completo | Stats service correcto (confirmado A2: 3 queries, 30 días) |
| T-072 | GET /revalidation/health | ⚠️ Parcial [A2] | Endpoint presente pero no verifica conectividad real del adapter (GAP-027). |
| T-073 | RevalidateEntityButton | ✅ Completo | Componente presente |
| T-074 | Admin revalidation management page | ✅ Completo | Page con tabs |
| T-075 | TanStack Query hooks | ⚠️ Parcial [A4] | A4: Hooks existen pero sin `staleTime` (GAP-053). Page no usa hooks exportados (GAP-054). |
| T-076 | Revalidation en admin nav | ✅ Completo | En `administration.section.tsx` |
| T-078 | Config edit form | ✅ Completo | Inline en la página |
| T-079 | Logs table component | ✅ Completo | En la página |
| T-080 | Revalidation HTTP adapter (admin) | ⚠️ Parcial [A4] | A4: Missing `revalidateByType` and `checkServiceHealth` methods (GAP-061). |
| T-081 | E2E smoke test manual revalidation | ❌ Missing | No existe test Playwright |
| T-082–083 | Cron job page-revalidation | ✅ Completo | `pageRevalidationJob` implementado |
| T-084 | Registro cron job en registry | ✅ Completo | Registrado |
| T-085 | Unit tests page-revalidation cron | ✅ Completo | A2 confirma: 539 líneas, ~95% cobertura (interval skip, stale, cleanup, dry run, errors). |
| T-086 | Verificación cron integration | ❌ Missing | No documentado/verificado. A2 confirma que el job aparece en registry pero no hay test de "smoke" de integración real. |

---

## Gaps Detallados

---

### GAP-001: EntityPathMapper — API y URL slugs fundamentalmente incorrectos

> Auditoria #1 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: l (1-2d)
- **Area**: `packages/service-core/src/revalidation/entity-path-mapper.ts`

**Descripción**:
La spec define `getAffectedPaths()` con una firma que recibe un `EntityChangeEvent` (discriminated union con `entityType` + data contextual específica: `slug`, `destinationPath`, `isFeatured`, `type`, `category`, `tagSlugs`, etc.). La implementación actual recibe un `GetAffectedPathsParams` simplificado `{ entityType, entitySlug?, locales? }`.

Esta diferencia es fundamental porque:
1. La spec requiere `destinationPath` para resolver paths de destino cuando cambia un accommodation
2. La spec requiere `tagSlugs` para invalidar páginas de etiquetas cuando cambia un post
3. Los URL slugs en la implementación usan español (`departamento`, `cabana`) que NO coinciden con las rutas reales de la web app

**Evidencia**:
```typescript
// SPEC — discriminated union con data contextual:
data: { entityType: 'accommodation', slug, destinationPath, isFeatured, type }

// IMPL — simplificado, sin data contextual:
export interface GetAffectedPathsParams {
    readonly entityType: RevalidationEntityType;
    readonly entitySlug?: string;
    readonly locales?: readonly string[];
}

// URL slugs incorrectos en IMPL:
apartment: 'departamento',  // web usa '/alojamientos/tipo/apartment/'
cabin: 'cabana',            // web usa '/alojamientos/tipo/cabin/'
```

**Solución propuesta**: Reescribir `entity-path-mapper.ts` usando el discriminated union `EntityChangeData` de la spec. Corregir ACCOMMODATION_TYPE_TO_URL_SLUG para usar los slugs reales de la web app (`hotel`, `hostel`, `cabin`, `apartment`, `camping`, `estancia`). Actualizar todos los service hooks para pasar el data correcto (ver GAP-017).

**Recomendación**: fix_inline. Bloquea GAP-003, GAP-017, GAP-020, GAP-021.

> **✅ A4 — RESUELTO**: EntityPathMapper ahora usa discriminated union `EntityChangeData` con URL slugs en inglés (hotel, hostel, cabin, apartment, camping, estancia). Confirmado correcto.

---

### GAP-002: RevalidationService — API fundamentalmente diferente a la spec

> Auditoria #1 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: l (1-2d)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts`

**Descripción**:
La spec define una API clara para `RevalidationService` que la implementación no respeta en varios ejes:

| Aspecto | Spec | Implementación |
|---------|------|----------------|
| Constructor | `{ adapter, locales, debounceMs, maxCronRevalidations, logRetentionDays }` | `{ adapter, siteUrl, bypassToken, debounceMs }` |
| Método principal | `revalidateEntity(params: { event: EntityChangeEvent })` | `scheduleRevalidation(params: ScheduleRevalidationParams)` (diferente nombre y firma) |
| `revalidatePaths` | Retorna `ReadonlyArray<RevalidationResult>`, recibe `reason` y `triggeredBy` | Retorna `void`, no acepta `reason`/`triggeredBy` |
| Logging | Escribe en `revalidation_log` | No escribe logs |
| Config DB | Lee `revalidation_config` para respetar `enabled`, `debounceSeconds`, `autoRevalidateOnChange` | No lee config |
| Logger | `@repo/logger` | `console.error` |
| Debounce | Por entidad (1 timer por entityId) | Por path (N timers por entidad) |

**Solución propuesta**: Reescribir el servicio siguiendo la spec. Priorizar: (1) logging a `revalidation_log`, (2) lectura de config desde DB, (3) API correcta de métodos.

**Recomendación**: fix_inline. Bloquea GAP-004, GAP-005, GAP-013.

> **✅ A4 — RESUELTO**: RevalidationService API es correcta — `scheduleRevalidation` acepta `EntityChangeData`. Quedan sub-problemas específicos: GAP-044 (writeLog entityType='unknown'), GAP-045 (debounce por path), GAP-043 (revalidateByEntityType no consulta DB).

---

### GAP-003: POST /revalidate/entity hace type-revalidation, no entity-revalidation

> Auditoria #1 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: s (1-4h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` (línea ~136)

**Descripción**:
El endpoint `POST /revalidate/entity` debería revalidar todos los paths de una instancia específica (dado `entityType` + `entityId`). Sin embargo, llama a `service.revalidateByEntityType(entityType)` ignorando `entityId` completamente. Ambos endpoints `/revalidate/entity` y `/revalidate/type` hacen exactamente lo mismo.

**Evidencia**:
```typescript
// routes/revalidation/index.ts
await service.revalidateByEntityType(entityType); // entityId IGNORADO

// Body schema espera entityId:
export const RevalidateEntityRequestSchema = z.object({
    entityType: RevalidationEntityTypeEnum,
    entityId: z.string().min(1), // se parsea pero NUNCA se usa
    reason: z.string().max(500).optional(),
});
```

**Solución propuesta**: El endpoint debería: (1) buscar la entidad por ID en DB, (2) construir `EntityChangeData` con sus datos actuales, (3) llamar a `getAffectedPaths` con el evento completo, (4) revalidar esos paths. Depende de GAP-001.

**Recomendación**: fix_inline (depende de GAP-001 y GAP-002).

> **⚠️ A4 — SIGUE ABIERTO**: POST /revalidate/entity SIGUE ignorando entityId. Llama a `service.revalidateByEntityType(entityType)` — el entityId se destructura pero nunca se usa. Ambas rutas /revalidate/entity y /revalidate/type hacen revalidación idéntica de tipo completo.

---

### GAP-004: RevalidationService no persiste logs en revalidation_log

> Auditoria #1 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: m (4-8h)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts`

**Descripción**:
Ningún path de revalidación escribe registros en la tabla `revalidation_log`. La tabla existe, el model existe, los schemas están definidos, el admin panel tiene una pestaña de logs... pero siempre estará vacía. Consecuencias concretas:
- `RevalidationStatsService` siempre retorna zeros (stats inútiles)
- La pestaña "Logs" del admin siempre está vacía
- `findLastCronEntry` en el cron siempre retorna `undefined`, causando que el cron revalide TODAS las entidades en CADA ejecución, ignorando el `cronIntervalMinutes` configurado

**Evidencia**:
```typescript
// revalidation.service.ts — ninguna llamada a RevalidationLogModel:
async revalidatePaths(paths: readonly string[]): Promise<void> {
    const promises = paths.map((path) => this.adapter.revalidatePath({...}));
    const results = await Promise.allSettled(promises);
    // ← NO se escribe nada en revalidation_log
}
```

**Solución propuesta**: Agregar `private async logResults(...)` que escriba en `RevalidationLogModel.create()` después de cada operación. Implementar en `revalidatePaths`, `scheduleRevalidation` y `revalidateByEntityType`.

**Recomendación**: fix_inline (depende de GAP-002).

> **✅ A4 — RESUELTO**: Service escribe logs en `revalidation_log` (best-effort, fire-and-forget). Queda sub-problema: writeLog siempre almacena entityType='unknown' (GAP-044).

---

### GAP-005: RevalidationService no lee revalidation_config — toda la configuración admin es inoperante

> Auditoria #1 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: m (4-8h)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts`

**Descripción**:
El admin puede configurar en `revalidation_config`: `enabled`, `autoRevalidateOnChange`, `debounceSeconds`, `cronIntervalMinutes`. El `RevalidationService` NUNCA lee esta tabla. Consecuencias:
1. `enabled=false` no deshabilita la revalidación de ese tipo de entidad
2. `autoRevalidateOnChange=false` no previene que los hooks disparen revalidación automática
3. `debounceSeconds` se ignora (se usa el default hardcodeado)
4. Todo el UI de configuración admin es decorativo — no tiene efecto real

**Evidencia**:
```typescript
// scheduleRevalidation en impl actual:
scheduleRevalidation(params: ScheduleRevalidationParams): void {
    const paths = getAffectedPaths(params);
    for (const path of paths) {
        this.debouncePath(path); // debounce fijo, sin leer DB
    }
}
// No existe ningún configModel.findByEntityType(entityType) en el servicio
```

**Solución propuesta**: Agregar lectura de config en `scheduleRevalidation` con cache en memoria (TTL ~60s) para evitar DB calls por cada hook invocation.

**Recomendación**: fix_inline (depende de GAP-002).

> **✅ A4 — RESUELTO**: Service lee `revalidation_config` con cache de 60s TTL. Queda sub-problema: config missing `maxCronRevalidations` y `logRetentionDays` (GAP-048).

---

### GAP-006: ISR exclude patterns incorrectos en astro.config.mjs

> Auditoria #1 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: s (1-4h)
- **Area**: `apps/web/astro.config.mjs` (líneas 68-77)

**Descripción**:
Los exclude patterns implementados difieren de los de la spec y tienen fallos funcionales:

1. `/^\/alojamientos\/(.*)\/?$/` — excluye TODAS las rutas de alojamientos incluyendo páginas de detalle (`/es/alojamientos/hotel-ejemplo/`) que SÍ deben ser ISR-cacheadas
2. `/^\/eventos\/(.*)\/?$/` — mismo problema con eventos
3. `/^\/tipo(\/.*)?$/` y `/^\/categoria(\/.*)?$/` — sin prefijo de locale, no matchean URLs reales (`/es/alojamientos/tipo/hotel/`)
4. `/^\/mi-cuenta(\/.*)?$/` — sin locale prefix, no matchea `/es/mi-cuenta/`

**Evidencia**:
```js
// IMPL (incorrecto):
/^\/alojamientos\/(.*)\/?$/,   // Excluye /es/alojamientos/hotel-ejemplo/ ← MAL
/^\/eventos\/(.*)\/?$/,        // Excluye /es/eventos/festival-2026/ ← MAL
/^\/tipo(\/.*)?$/,             // No tiene context de ruta completa ← MAL
/^\/categoria(\/.*)?$/,        // No tiene context de ruta completa ← MAL

// SPEC (correcto):
/^\/[a-z]{2}\/alojamientos\/$/,          // Solo listing principal
/^\/[a-z]{2}\/eventos\/$/,               // Solo listing de eventos
/\/alojamientos\/tipo\/[^/]+\/$/,        // Solo páginas de tipo
/\/eventos\/categoria\/[^/]+\/$/,        // Solo páginas de categoría
```

**Solución propuesta**: Reemplazar los 8 exclude patterns con los de la spec. Verificar contra las rutas reales de la web app.

**Recomendación**: fix_inline.

> **⚠️ A4 — SIGUE ABIERTO**: ISR exclude patterns SIGUEN INCORRECTOS. `/^\/alojamientos\/(.*)\/?$/` y `/^\/eventos\/(.*)\/?$/` excluyen ALL paths incluyendo detail pages que deben ser ISR-cached. Los patterns `/^\/tipo(\/.*)?$/` y `/^\/categoria(\/.*)?$/` no matchean URLs reales (falta parent segment). Spec patterns usan `[a-z]{2}` locale prefix y `$` anchors solo en listing pages.

---

### GAP-007: console.error en RevalidationService viola coding standards

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: high
- **Priority**: P2
- **Complexity**: xs (< 1h)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts` (líneas 79, 100)

**Descripción**:
El proyecto prohíbe explícitamente `console.log` en apps y requiere `@repo/logger`. El servicio usa `console.error` en dos lugares, por lo que estos errores no aparecen en logs estructurados de producción (Sentry, etc.).

**Evidencia**:
```typescript
// línea 79:
console.error(`[RevalidationService] Failed to revalidate ${result.value.path}: ${result.value.error}`);
// línea 100:
console.error(`[RevalidationService] Failed to revalidate ${path}: ${result.error}`);
```

**Solución propuesta**: Reemplazar por `createLogger('revalidation-service')` e invocar `logger.error(...)`.

**Recomendación**: fix_inline.

> **✅ A4 — RESUELTO**: No se encontró `console.error` en ningún archivo de revalidación. Todos usan `@repo/logger` correctamente.

---

### GAP-008: RevalidationAdapter interface — firma difiere de la spec

> Auditoria #1 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: m (4-8h)
- **Area**: `packages/service-core/src/revalidation/adapters/revalidation.adapter.ts`

**Descripción**:
La spec define:
```typescript
interface RevalidationAdapter {
  revalidate(params: { readonly path: string }): Promise<RevalidationResult>;
  revalidateMany(params: { readonly paths: ReadonlyArray<string> }): Promise<ReadonlyArray<RevalidationResult>>;
}
```

La implementación define:
```typescript
interface RevalidationAdapter {
  revalidatePath(params: RevalidatePathParams): Promise<RevalidatePathResult>; // nombre distinto
  readonly name: string; // no en spec
}
// RevalidatePathParams incluye bypassToken + revalidationUrl — deben ser del constructor del adapter
```

El problema de diseño: `bypassToken` y `revalidationUrl` deberían ser configuración del adapter (constructor), no params del método. Cada llamada no debería re-pasar credenciales.

**Solución propuesta**: Renombrar `revalidatePath` → `revalidate`, mover `bypassToken`/`siteUrl` al constructor del adapter, agregar `revalidateMany` opcional.

**Recomendación**: fix_inline.

> **✅ A4 — RESUELTO**: Adapter interface tiene `revalidate()` + `revalidateMany()`. Queda sub-problema: `revalidateMany` sin batching (GAP-060).

---

### GAP-009: VercelRevalidationAdapter — HOSPEDA_SITE_URL sin required en producción

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: high
- **Priority**: P2
- **Complexity**: xs (< 1h)
- **Area**: `apps/api/src/utils/env.ts` + `apps/api/src/index.ts`

**Descripción**:
`HOSPEDA_SITE_URL` es opcional en `ApiEnvSchema`. En `index.ts`:
```typescript
siteUrl: env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar',
```

En producción sin esta variable, el servicio usará un dominio hardcodeado que puede ser incorrecto. No hay alerta. Debería ser required en producción similar a `HOSPEDA_CRON_SECRET`.

**Solución propuesta**: Agregar en el `superRefine` de `ApiEnvSchema`:
```typescript
if (data.NODE_ENV === 'production' && !data.HOSPEDA_SITE_URL) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'HOSPEDA_SITE_URL is required in production' });
}
```

**Recomendación**: fix_inline.

---

### GAP-010: Stale detection en cron puede revalidar el mismo entityType dos veces

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: high
- **Priority**: P2
- **Complexity**: s (1-4h)
- **Area**: `apps/api/src/cron/jobs/page-revalidation.job.ts`

**Descripción**:
El cron tiene dos loops independientes: (1) interval check, (2) stale detection (>48h). Si un entityType tiene `cronIntervalMinutes=60` y no ha corrido en 48h, ambos loops lo revalidan. Resultado: revalidación duplicada sin valor. La spec describe el stale detection como complemento al interval check, no loop independiente.

**Solución propuesta**: Rastrear qué entityTypes ya fueron revalidados en el primer loop y saltearlos en el segundo.

**Recomendación**: fix_inline.

> **✅ A4 — RESUELTO**: Cron usa `alreadyRevalidated` Set para prevenir doble-revalidación.

---

### GAP-011: findLastCronEntry no filtra por trigger='cron'

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: high
- **Priority**: P2
- **Complexity**: s (1-4h)
- **Area**: `packages/db/src/models/revalidation/revalidation-log.model.ts`

**Descripción**:
`findLastCronEntry` busca el último log para un entityType sin filtrar por `trigger='cron'`. Si un admin dispara revalidación manual de `accommodation`, eso actualizaría el "last entry" para ese tipo, y el cron creería que ya corrió recientemente, salteando la revalidación programada aunque el cron nunca haya ejecutado.

**Evidencia**:
```typescript
async findLastCronEntry(entityType: string): Promise<RevalidationLogRecord | undefined> {
    const results = await db.select().from(revalidationLog)
        .where(eq(revalidationLog.entityType, entityType)) // ← SIN filtro de trigger
        .orderBy(desc(revalidationLog.createdAt)).limit(1);
    return results[0];
}
```

**Solución propuesta**: Agregar `.where(and(eq(revalidationLog.entityType, entityType), eq(revalidationLog.trigger, 'cron')))`.

**Recomendación**: fix_inline.

---

### GAP-012: POST /revalidate/manual no pasa reason ni triggeredBy al servicio

> Auditoria #1 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: xs (< 1h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` (línea ~74)

**Descripción**:
La ruta extrae `reason` del body pero no lo pasa al servicio. El `triggeredBy` debería provenir del actor autenticado del request. Sin esta info, los logs de auditoría no tendrán quién disparó la revalidación manual.

**Evidencia**:
```typescript
const { paths } = body as { paths: string[]; reason?: string };
// reason extraído pero IGNORADO
await service.revalidatePaths(paths); // sin reason ni triggeredBy
```

**Solución propuesta**: Pasar `reason` y `triggeredBy` (del auth context) al método `revalidatePaths` una vez que tenga la firma correcta (GAP-002).

**Recomendación**: fix_inline (depende de GAP-002).

---

### GAP-013: Adapter factory usa Vercel solo en NODE_ENV=production — no funciona en staging

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: `packages/service-core/src/revalidation/adapters/adapter-factory.ts`

**Descripción**:
El factory solo usa `VercelRevalidationAdapter` cuando `nodeEnv === 'production'`. Un entorno staging con `NODE_ENV=staging` o `NODE_ENV=preview` y `HOSPEDA_REVALIDATION_SECRET` configurado usaría `NoOpAdapter` y nunca revalidaría en staging.

**Evidencia**:
```typescript
if (params.nodeEnv === 'production' && params.revalidationSecret) {
    return new VercelRevalidationAdapter();
}
return new NoOpRevalidationAdapter(); // staging con secret → NoOp ← MAL
```

**Solución propuesta**: Cambiar condición a:
```typescript
if (params.revalidationSecret && params.nodeEnv !== 'development' && params.nodeEnv !== 'test') {
    return new VercelRevalidationAdapter({ ... });
}
```

**Recomendación**: fix_inline.

> **✅ A4 — RESUELTO**: Factory activa Vercel para staging+production (no solo production).

---

### GAP-014: Service hooks usan API simplificada — entity data contextual perdida

> Auditoria #1 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: m (4-8h)
- **Area**: `accommodation.service.ts`, `destination.service.ts`, `event.service.ts`, `post.service.ts`, `accommodationReview.service.ts`, `destinationReview.service.ts`, `tag.service.ts`, `amenity.service.ts`

**Descripción**:
Los service hooks llaman a `scheduleRevalidation({ entityType, entitySlug })` con la API simplificada actual, perdiendo data contextual esencial:

- **AccommodationService**: No pasa `destinationPath` (paths de destino incorrectos), no pasa `type` (tipos listing no se invalidan)
- **PostService**: No pasa `tagSlugs` (páginas de etiquetas no se invalidan)
- **DestinationService**: No pasa path jerárquico correcto
- **TagService/AmenityService**: Solo invalida `/alojamientos/` listing, no los detalles específicos

**Evidencia**:
```typescript
// accommodation.service.ts _afterCreate:
getRevalidationService()?.scheduleRevalidation({
    entityType: 'accommodation',
    entitySlug: entity.slug, // ← sin destinationPath, sin type
});
```

**Solución propuesta**: Una vez corregido el EntityPathMapper (GAP-001), actualizar todos los hooks para pasar el `EntityChangeData` completo con todos los campos requeridos.

**Recomendación**: fix_inline (depende de GAP-001).

> **✅ A4 — RESUELTO**: Service hooks pasan `EntityChangeData` completo con slug, destinationSlug, accommodationType, tagSlugs, etc.

---

### GAP-015: GET /revalidation/logs — filtros de fecha y paginación no implementados

> Auditoria #1 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` (líneas ~296-308)

**Descripción**:
El handler construye un `filters` object sin manejo de fechas ni paginación:

```typescript
const filters: Record<string, unknown> = {};
if (query?.entityType) filters.entityType = query.entityType;
// ← Sin createdAfter, createdBefore, page, pageSize
```

La spec habla de "Paginated log listing". Sin paginación, una tabla con miles de logs podría degradar el performance o causar timeouts.

**Solución propuesta**: Implementar paginación y filtros de fecha. Puede requerir método custom en `RevalidationLogModel` dado que `BaseModel.findAll()` puede no soportar range queries de fecha.

**Recomendación**: fix_inline.

---

### GAP-016: RevalidationConfigModel.update usa cast type-unsafe

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` (línea ~265)

**Descripción**:
```typescript
const updated = await model.update({ id }, body as Record<string, unknown>);
```

El cast `as Record<string, unknown>` bypasea type safety. Viola el estándar "no `any` types". El `UpdateRevalidationConfigInputSchema` ya tiene el tipo correcto.

**Solución propuesta**: Usar el tipo inferido del schema: `const input: UpdateRevalidationConfigInput = body; await model.update({ id }, input);`

**Recomendación**: fix_inline.

---

### GAP-017: getLocaleFromParams — cast antes del null check en pages migradas

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/web/src/pages/[lang]/destinos/[...path].astro` (línea ~42)

**Descripción**:
En `destinos/[...path].astro` se hace cast `as SupportedLocale` antes del null check:
```typescript
const locale = getLocaleFromParams(Astro.params) as SupportedLocale;
// ← cast ANTES del null check
if (!locale) return Astro.redirect('/es/');
```

TypeScript no previene `null as SupportedLocale`. Si `getLocaleFromParams` retorna `null`, `locale` será `null` pero TypeScript no lo detectará.

**Solución propuesta**: Reordenar: obtener el valor, verificar null, luego castear:
```typescript
const rawLocale = getLocaleFromParams(Astro.params);
if (!rawLocale) return Astro.redirect('/es/');
const locale = rawLocale as SupportedLocale;
```

**Recomendación**: fix_inline.

---

### GAP-018: initializeRevalidationService — idempotencia silenciosa oculta misconfiguraciones

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: `packages/service-core/src/revalidation/revalidation-init.ts`

**Descripción**:
Si ya existe una instancia, retorna la existente silenciosamente ignorando los nuevos parámetros:
```typescript
export function initializeRevalidationService(params: InitRevalidationParams): RevalidationService {
    if (_instance !== undefined) return _instance; // ignora params silenciosamente
```

Esto puede ocultar bugs donde se re-inicializa con configuración diferente.

**Solución propuesta**: Agregar `logger.warn('RevalidationService already initialized, ignoring new params')` cuando se detecta re-inicialización. En tests, documentar que se debe llamar `_resetRevalidationService()` antes de cada test.

**Recomendación**: fix_inline.

---

### GAP-019: _resetRevalidationService exportada en producción

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: `packages/service-core/src/revalidation/` (barrel export)

**Descripción**:
La función `_resetRevalidationService` (marcada con `_` prefijo como convención "internal") está exportada en el barrel del módulo y disponible en producción vía `@repo/service-core`. Esta función existe solo para tests.

**Solución propuesta**: Mover la exportación a un archivo `test-utils.ts` separado que se importe solo en contextos de test, o documentar claramente que solo debe usarse en tests. Considerar eliminarla del export principal.

**Recomendación**: fix_inline.

---

### GAP-020: Tests de service hooks y EntityPathMapper validan implementación incorrecta

> Auditoria #1 — 2026-03-16

- **Type**: test_gap
- **Severity**: medium
- **Priority**: P3
- **Complexity**: m (4-8h)
- **Area**: `packages/service-core/test/revalidation/service-hooks.test.ts` + `entity-path-mapper.test.ts`

**Descripción**:
Los tests verifican el comportamiento actual que difiere de la spec:
- `service-hooks.test.ts`: Verifica que `scheduleRevalidation` se llama con `{ entityType }` (API simplificada)
- `entity-path-mapper.test.ts`: Verifica paths con slugs en español (`departamento`, `cabana`) que no coinciden con URLs reales de la web app

Los tests "pasan" pero validan comportamiento incorrecto.

**Solución propuesta**: Una vez corregidos GAP-001 y GAP-014, actualizar estos tests para verificar el comportamiento correcto: data contextual completa, URL slugs en inglés.

**Recomendación**: fix_inline (depende de GAP-001 y GAP-014).

---

### GAP-021: CLAUDE.md de web app documenta mecanismo ISR incorrecto

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/web/CLAUDE.md`

**Descripción**:
La documentación dice:
> "The API sends this token as the `x-prerender-revalidate` header when calling the Vercel revalidation URL (`HOSPEDA_SITE_URL/__revalidate/[path]`)."

No existe ningún endpoint `/__revalidate` en Vercel. El mecanismo correcto es hacer GET a la página directa con el header `x-prerender-revalidate`. También menciona `HOSPEDA_ISR_BYPASS_TOKEN` pero el nombre correcto es `HOSPEDA_REVALIDATION_SECRET`.

**Solución propuesta**: Corregir la documentación para describir correctamente el mecanismo de Vercel ISR.

**Recomendación**: fix_inline.

---

### GAP-022: Falta getRevalidationSecret() helper en web app lib/env.ts

> Auditoria #1 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/web/src/lib/env.ts`

**Descripción**:
T-004 especifica agregar `getRevalidationSecret()` helper. La variable existe en `serverEnvSchema` pero no hay función helper tipada para accederla. Viola el patrón establecido de acceso a env vars.

**Solución propuesta**: Agregar `export function getRevalidationSecret(): string | undefined { return getServerEnv().HOSPEDA_REVALIDATION_SECRET; }`.

**Recomendación**: fix_inline.

---

### GAP-023: Admin page usa strings hardcodeados en lugar de i18n

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: s (1-4h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx`

**Descripción**:
La página tiene strings hardcodeados en inglés/español mezclados:
```tsx
<h2 className="mb-2 font-bold text-2xl">ISR Revalidation</h2>
<TabsTrigger value="config">Configuración</TabsTrigger>
```

Los archivos i18n de revalidación fueron creados (T-055) pero la página no los consume. El estándar del proyecto requiere i18n en todos los textos UI.

**Solución propuesta**: Usar `useTranslations()` hook y los keys del archivo de revalidación i18n.

**Recomendación**: fix_inline.

---

### GAP-024: QUERY_KEYS duplicados entre useRevalidation.ts y la página admin

> Auditoria #1 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/admin/src/hooks/useRevalidation.ts` + `apps/admin/src/routes/_authed/revalidation/index.tsx`

**Descripción**:
`REVALIDATION_QUERY_KEYS` se define en el hook pero la página define sus propios `QUERY_KEYS` locales en lugar de importar los del hook. Esto viola el principio de Single Source of Truth para query keys.

**Solución propuesta**: La página debe importar y usar `REVALIDATION_QUERY_KEYS` del hook.

**Recomendación**: fix_inline.

---

### GAP-025: Falta test E2E Playwright (T-081)

> Auditoria #1 — 2026-03-16 | **Confirmado en Auditoría #2**

- **Type**: test_gap
- **Severity**: low
- **Priority**: P4
- **Complexity**: m (4-8h)
- **Area**: Tests E2E

**Descripción**:
T-081 especifica un Playwright test para el flujo completo de manual revalidation. No existe ningún test Playwright para revalidación.

A2: Confirmado. `apps/api/test/routes/revalidation.test.ts` es un test Vitest/Hono de API, no Playwright. No hay archivos `.spec.ts` o tests E2E para este flujo en admin ni web.

**Solución propuesta**: Crear test Playwright: (1) login como admin, (2) navegar a /revalidation, (3) disparar manual revalidation, (4) verificar que aparece entry en logs.

**Recomendación**: create_new_spec (agrupar con otros E2E tests que también faltan).

---

## Gaps Detectados en Auditoría #2

---

### GAP-026: `_afterRestore` no implementado en ninguno de los 8 servicios

> Auditoría #2 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: Todos los servicios con hooks de revalidación:
  `accommodation.service.ts`, `destination.service.ts`, `event.service.ts`, `post.service.ts`,
  `accommodationReview.service.ts`, `destinationReview.service.ts`, `tag.service.ts`, `amenity.service.ts`

**Descripción**:
Las tasks T-039 a T-045 implementaron `_afterCreate`, `_afterUpdate`, `_afterSoftDelete` y `_afterHardDelete` en los 8 servicios. Sin embargo, **ninguno implementa `_afterRestore`**, el hook que dispara cuando una entidad soft-deleted es restaurada.

La operación de restore hace visible nuevamente una entidad que estaba soft-deleted. Sin revalidación post-restore, la página de la entidad restaurada seguirá sirviendo un 404 (o datos desactualizados) hasta que expire el cache ISR (86400 segundos = 24 horas).

**Evidencia**:
```bash
# Verificación literal — grep en accommodation.service.ts: sin resultado
grep "_afterRestore" packages/service-core/src/services/accommodation/accommodation.service.ts
# (sin output)
```

Hooks implementados en AccommodationService: `_beforeCreate`, `_afterCreate`, `_afterUpdate`, `_beforeSoftDelete`, `_afterSoftDelete`, `_beforeHardDelete`, `_afterHardDelete`. Mismo patrón en los 7 servicios restantes — ninguno tiene `_afterRestore`.

**Impacto en producción**:
Un admin restaura un alojamiento que estaba eliminado → la página `alojamientos/mi-alojamiento` sigue dando 404 por hasta 24 horas. El admin ve el alojamiento en el panel como activo, los usuarios no pueden accederlo desde el web.

**Solución propuesta**:
Agregar `_afterRestore` en los 8 servicios con el mismo patrón de los otros hooks:
```typescript
protected override async _afterRestore(
    result: { count: number },
    _actor: Actor
): Promise<{ count: number }> {
    getRevalidationService()?.scheduleRevalidation({ entityType: 'accommodation' });
    return result;
}
```
Nota: `_afterRestore` solo recibe `{ count: number }`, no tiene el slug disponible. El patrón sin slug (revalida por tipo) es aceptable y consistente con `_afterSoftDelete`.

**Recomendación**: fix_inline. No merece SPEC. Una hora de trabajo para los 8 servicios.

> **✅ A4 — RESUELTO**: `_afterRestore` implementado en todos los servicios con datos completos.

---

### GAP-027: GET /health no verifica conectividad real del adapter

> Auditoría #2 — 2026-03-16

- **Type**: incomplete_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` (handler del endpoint `/health`)

**Descripción**:
El endpoint `GET /api/v1/admin/revalidation/health` retorna `{ status: 'operational', adapter: 'active' }` únicamente verificando si `getRevalidationService()` retorna un valor no-nulo. No realiza ningún request al adapter (Vercel ISR API) ni verifica que el `bypassToken` sea válido.

**Evidencia — código literal**:
```typescript
handler: async () => {
    const service = getRevalidationService();
    return {
        status: service ? ('operational' as const) : ('not_initialized' as const),
        adapter: service ? ('active' as const) : ('none' as const)
        // ← Sin ningún intento de conexión real al adapter
    };
}
```

**Impacto en producción**:
- Health check puede reportar `operational` aunque el `bypassToken` sea inválido o la API de Vercel esté caída.
- Si `HOSPEDA_REVALIDATION_SECRET` no está configurado en Vercel pero sí en la API, el health check pasa aunque todas las revalidaciones fallen silenciosamente.
- Dashboards de monitoreo basados en este endpoint dan falsos positivos.

**Solución propuesta**:

**Opción A (recomendada)**: Probe request al adapter:
```typescript
handler: async () => {
    const service = getRevalidationService();
    if (!service) return { status: 'not_initialized', adapter: 'none' };
    const probe = await service.revalidatePaths(['/__health-probe__']);
    return {
        status: probe.every(r => r.success !== false) ? 'operational' : 'degraded',
        adapter: 'active',
        adapterName: service.getAdapterName?.() ?? 'unknown',
        latencyMs: probe[0]?.durationMs
    };
}
```

**Opción B (mínima)**: Al menos exponer el nombre del adapter activo (Vercel vs NoOp) para que el operador sepa si hay revalidación real o no.

**Recomendación**: fix_inline.

> **⚠️ A4 — SIGUE ABIERTO**: GET /health envía request a `/__health-probe__` que es una página no existente. No prueba conectividad real del adapter.

---

### GAP-028: Sin tests unitarios para DB models de revalidación

> Auditoría #2 — 2026-03-16

- **Type**: test_gap
- **Severity**: high
- **Priority**: P2
- **Complexity**: m (4-8h)
- **Area**: `packages/db/src/models/revalidation/` (sin directorio de tests correspondiente)

**Descripción**:
Los modelos `RevalidationConfigModel` y `RevalidationLogModel` tienen métodos custom con lógica de query no trivial que no existe en `BaseModel`. Ninguno tiene tests. En el proyecto, otros packages sí tienen tests de models (ver `packages/db/test/billing/`).

Métodos sin tests:
- `RevalidationConfigModel.findByEntityType(entityType)` — query con WHERE clause
- `RevalidationConfigModel.findAllEnabled()` — query con WHERE enabled=true
- `RevalidationLogModel.deleteOlderThan(date)` — DELETE con WHERE createdAt < date
- `RevalidationLogModel.findLastCronEntry(entityType)` — ORDER BY desc LIMIT 1

Crítico: `findLastCronEntry` tiene el bug de GAP-011 (no filtra por trigger='cron') que solo tests revelarían.

**Solución propuesta**:
Crear en `packages/db/test/models/revalidation/`:
- `revalidation-config.model.test.ts`: Tests para findByEntityType (presente/ausente), findAllEnabled (mix enabled/disabled).
- `revalidation-log.model.test.ts`: Tests para deleteOlderThan (verifica count y que no borra logs nuevos), findLastCronEntry (con/sin entries, ordering, **filtrado por trigger 'cron'** para validar el fix de GAP-011).

**Recomendación**: fix_inline. Agrupar con GAP-029 en la misma iteración de cobertura.

> **✅ A4 — RESUELTO**: Tests unitarios para DB models existen.

---

### GAP-029: Sin tests unitarios para Zod schemas de revalidación

> Auditoría #2 — 2026-03-16

- **Type**: test_gap
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `packages/schemas/src/entities/revalidation/` (sin tests)

**Descripción**:
Los 5 archivos de schemas Zod de revalidación no tienen tests:
- `revalidation-config.schema.ts` — validaciones de rango (`cronIntervalMinutes: 1-10080`, `debounceSeconds: 0-300`)
- `revalidation-log.schema.ts` — enums RevalidationTriggerEnum, RevalidationStatusEnum
- `revalidation-config.crud.schema.ts` — PATCH schema con todos opcionales
- `revalidation-log.query.schema.ts` — filtros
- `revalidation.http.schema.ts` — paths array (1-100), reason (max 500 chars)

Las validaciones de rango son críticas: si están swapped (`min(300).max(1)`) TypeScript no lo detecta — solo tests de runtime lo revelan.

**Solución propuesta**:
Crear `packages/schemas/test/entities/revalidation/` con:
- Valid data → parse success para cada schema
- Invalid data (out of range, wrong type, missing required) → parse error
- Edge cases (min/max boundaries, null vs undefined vs optional)

**Recomendación**: fix_inline.

> **✅ A4 — RESUELTO**: Tests unitarios para Zod schemas existen.

---

### GAP-030: Tests de rutas API no verifican 401/403 explícitamente

> Auditoría #2 — 2026-03-16

- **Type**: test_gap
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/api/test/routes/revalidation.test.ts` (1088 líneas)

**Descripción**:
Los 1088 líneas de tests de rutas no incluyen casos que verifiquen:
1. **401 sin token**: Request sin header de autenticación → debe retornar 401.
2. **403 sin permiso**: Request con token válido pero usuario sin permiso `REVALIDATION_TRIGGER` → debe retornar 403.

Los tests asumen que el middleware de auth funciona pero no lo verifican para estos endpoints específicos. Los permisos `REVALIDATION_*` son nuevos — si no se asignaron al rol admin en seed, los endpoints serían inaccesibles para todos los admins y los tests actuales no lo detectarían.

**Evidencia**: Búsqueda en `revalidation.test.ts` — no hay tests con status code 401 o 403.

**Solución propuesta**:
Agregar por lo menos un test de autenticación y uno de autorización a cada suite de endpoint:
```typescript
it('returns 401 when unauthenticated', async () => {
    const res = await app.request('/api/v1/admin/revalidation/revalidate/manual', {
        method: 'POST',
        body: JSON.stringify({ paths: ['/test'] })
        // sin Authorization header
    });
    expect(res.status).toBe(401);
});
```

**Recomendación**: fix_inline.

> **⚠️ A4 — SIGUE ABIERTO**: Tests usan assertions permisivas como `expect([401, 403]).toContain(...)` o `expect([400, 401, 403, 422]).toContain(...)`. No hay tests con valid session + missing permission que asserten específicamente 403.

---

### GAP-031: PATCH /config/:id no retorna 404 específico si la config no existe

> Auditoría #2 — 2026-03-16

- **Type**: incomplete_implementation
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` (handler PATCH /config/:id)

**Descripción**:
El handler de `PATCH /config/:id` llama a `model.update(id, data)` directamente sin verificar primero si el registro existe. Si el ID no existe en DB, `update()` puede retornar un resultado vacío o el handler retorna una respuesta 200 sin datos válidos. No hay un 404 explícito.

**Solución propuesta**:
```typescript
const existing = await model.findById(id);
if (!existing) {
    return c.json({ error: 'Revalidation config not found' }, 404);
}
const updated = await model.update({ id }, data);
return c.json({ data: updated });
```

**Recomendación**: fix_inline. No merece SPEC.

> **⚠️ A4 — SIGUE ABIERTO**: Route returns 404 cuando findById retorna null, pero no hay test que cubra este caso.

---

## Test Coverage Analysis

### Auditoría #1

**Lo que estaba testeado:**
- `adapters.test.ts`: Tests correctos para VercelAdapter y NoOpAdapter
- `entity-path-mapper.test.ts`: Cobertura completa pero valida implementación incorrecta (ver GAP-020)
- `revalidation.service.test.ts`: Tests del servicio, valida API incorrecta
- `service-hooks.test.ts`: 4 de 8 services cubiertos, valida API simplificada incorrecta
- `page-revalidation.test.ts`: Tests unitarios exhaustivos del cron job
- `revalidation-smoke.test.ts`: Smoke test de integración
- `revalidation.test.ts` (routes): Tests de integración para los 8 endpoints API

**Lo que NO estaba testeado:**
- `RevalidationConfigModel.update()` (no hay tests del model específicamente)
- `RevalidationStatsService` con datos reales (solo lógica de cálculo)
- El comportamiento de doble revalidación del cron (GAP-010)
- Service hooks para `accommodationReview`, `destinationReview`, `post`, `amenity`
- Comportamiento de ISR con los exclude patterns corregidos
- Test E2E de flujo completo admin → API → Vercel (T-081)

**Calidad general A1: 7/10** — Tests presentes bien estructurados pero validan comportamiento que diverge del spec.

---

### Auditoría #2 (estado post-implementación)

**Inventario de archivos de test verificados:**

| Archivo | Líneas | Cobertura estimada | Notas |
|---------|--------|-------------------|-------|
| `packages/service-core/test/revalidation/revalidation.service.test.ts` | 503 | ~90% happy path | Fire-and-forget, debounce, timers |
| `packages/service-core/test/revalidation/entity-path-mapper.test.ts` | 212 | ~90% | 8 entity types, locales, deduplication |
| `packages/service-core/test/revalidation/adapters.test.ts` | 155 | ~95% | VercelAdapter + NoOp + factory |
| `packages/service-core/test/revalidation/service-hooks.test.ts` | 493 | ~70% | 4/8 servicios explícitos, fire-and-forget |
| `apps/api/test/routes/revalidation.test.ts` | 1088 | ~70% | 8 endpoints, sin 401/403 explícitos |
| `apps/api/test/cron/page-revalidation.test.ts` | 539 | ~95% | Interval, stale, cleanup, dry run, errors |
| `apps/api/test/cron/revalidation-smoke.test.ts` | 382 | ~95% | Smoke e2e de integración |
| **TOTAL** | **3372** | | |

**Gaps de cobertura confirmados en A2:**
- ❌ Sin tests para `RevalidationConfigModel` y `RevalidationLogModel` (GAP-028)
- ❌ Sin tests para los 5 Zod schemas de revalidación (GAP-029)
- ❌ Sin tests 401/403 en endpoints API (GAP-030)
- ❌ Sin cobertura de `_afterRestore` en service hooks (GAP-026 — el hook no existe)
- ❌ Sin test E2E Playwright (GAP-025 / T-081)
- ⚠️ `accommodationReview`, `destinationReview`, `tag`, `amenity` no están en `service-hooks.test.ts` (aunque los hooks están implementados)

**Calidad general A2: 7.5/10** — Más cobertura que A1, buena estructura y mocking. Los gaps son principalmente en DB/schemas y auth/authz.

---

## Security Assessment

### Positivo:
- Endpoints protegidos por `REVALIDATION_*` permissions vía `createAdminRoute`
- Bypass token manejado como variable de entorno, nunca hardcodeado
- Validación del token vía header estándar de Vercel

### Concerns:
1. **Sin rate limiting en revalidación manual**: El endpoint `/revalidate/manual` acepta hasta N paths sin throttling. Un admin comprometido podría abusar.
2. **HOSPEDA_REVALIDATION_SECRET opcional en producción**: Misconfiguration silenciosa — el NoOpAdapter "finge" revalidar sin alertar.
3. **triggeredBy no persiste**: Sin auditoría de quién disparó cada revalidación (crítico para compliance).

---

## Performance Concerns

1. **Potencial N+1 queries si se implementa la spec correctamente**: La spec muestra queries de entidades dentro de loops. Con 1000 accommodations → 1000 queries. Solución: batch queries.
2. **findLastCronEntry duplicado en cron**: 2x queries por entityType entre el interval check y stale detection (GAP-010).
3. **Debounce por path vs por entidad**: La implementación crea N timers por entidad (uno por path afectado). La spec crea 1 timer por entidad. Con 8 locales y 5 path types por accommodation = hasta 40 timers por entidad.
4. **NoOpAdapter sin logging**: En dev no hay visibilidad de qué se revalidaría.

---

## Architecture Concerns

1. **Acoplamiento adapter-service**: `siteUrl` y `bypassToken` están en el servicio y se pasan al adapter en cada call. La spec pone esta responsabilidad en el adapter (constructor). Viola separación de responsabilidades.
2. **Factory en service-core vs api**: La factory en `service-core` tiene conocimiento de variables de entorno (NODE_ENV), acoplando el paquete a configuración de infraestructura. La spec la ubicaba en `apps/api/src/lib/`.
3. **`_resetRevalidationService` disponible en producción**: Ver GAP-019.

---

## Priorización de Fixes

### Sprint inmediato (P1 — críticos funcionales):
| Gap | Título | Complejidad |
|-----|--------|-------------|
| GAP-001 | EntityPathMapper — URL slugs y API | L |
| GAP-002 | RevalidationService — API completa | L |
| GAP-006 | astro.config.mjs exclude patterns | S |
| GAP-003 | POST /revalidate/entity lógica incorrecta | S |
| GAP-004 | Logging a revalidation_log | M |
| GAP-005 | Lectura de revalidation_config | M |

### Sprint siguiente (P2 — funcionalidad incompleta):
| Gap | Título | Complejidad |
|-----|--------|-------------|
| GAP-007 | console.error → @repo/logger | XS |
| GAP-008 | Adapter interface alignment | M |
| GAP-009 | HOSPEDA_SITE_URL required en prod | XS |
| GAP-010 | Cron doble revalidación | S |
| GAP-011 | findLastCronEntry filtro trigger | S |
| GAP-012 | reason/triggeredBy en manual endpoint | XS |
| GAP-014 | Service hooks con data contextual | M |

### Backlog (P3/P4 — polish y docs):
GAP-013, GAP-015, GAP-016, GAP-017, GAP-018, GAP-019, GAP-020, GAP-021, GAP-022, GAP-023, GAP-024, GAP-025

---

## Plan de Acción — Auditoría #2

### Prioridad 1 — Antes del go-live (funcionalidad rota en producción)

Los gaps críticos de A1 (GAP-001 a GAP-006) siguen siendo el bloqueador principal si el spec define el comportamiento correcto. Sin embargo, la implementación adoptó una API simplificada que es **funcional pero incompleta**. Decisión requerida: ¿se acepta la API simplificada como diseño final o se corrige para seguir el spec?

Si se acepta el diseño actual como válido, los P1 pre-go-live son:

| Gap | Descripción | Complejidad | Acción |
|-----|-------------|-------------|--------|
| GAP-004 | No persiste logs en revalidation_log | M | SPEC nueva o fix inline |
| GAP-005 | No lee revalidation_config de DB | M | SPEC nueva o fix inline |
| GAP-003 | POST /revalidate/entity ignora entityId | S | Fix inline |
| GAP-006 | ISR exclude patterns (verificar A1 vs A2) | S | Verificar y corregir si aplica |
| GAP-015 | GET /logs sin paginación → riesgo OOM | S | Fix inline |

### Prioridad 2 — Sprint siguiente

| Gap | Descripción | Complejidad | Acción |
|-----|-------------|-------------|--------|
| GAP-026 | _afterRestore no implementado (8 servicios) | XS | Fix inline (1h) |
| GAP-027 | GET /health sin conectividad real | S | Fix inline |
| GAP-028 | Sin tests DB models revalidación | M | Fix inline |
| GAP-029 | Sin tests Zod schemas | S | Fix inline |
| GAP-030 | Tests sin 401/403 explícito | S | Fix inline |
| GAP-011 | findLastCronEntry sin filtro trigger='cron' | S | Fix inline |
| GAP-012 | reason/triggeredBy ignorados en manual | XS | Fix inline |

### Prioridad 3 — Backlog

| Gap | Descripción | Complejidad | Acción |
|-----|-------------|-------------|--------|
| GAP-031 | PATCH /config/:id sin 404 específico | XS | Fix inline |
| GAP-007 | console.error → @repo/logger | XS | Fix inline |
| GAP-009 | HOSPEDA_SITE_URL required en prod | XS | Fix inline |
| GAP-010 | Cron: doble revalidación por entidad | S | Fix inline |
| GAP-013 | Factory: staging no activa Vercel adapter | XS | Fix inline |
| GAP-023 | Admin page strings hardcodeados (no usa i18n) | S | Fix inline |
| GAP-024 | QUERY_KEYS duplicados | XS | Fix inline |
| GAP-025 | Sin test E2E Playwright | M | SPEC nueva |

### Ítems que requieren decisión del equipo antes de actuar

| Gap | Descripción | Decisión necesaria |
|-----|-------------|-------------------|
| ~~GAP-001~~ | ~~EntityPathMapper API/URL slugs~~ | ✅ RESUELTO en A3 — discriminated union implementado |
| ~~GAP-002~~ | ~~RevalidationService API~~ | ✅ RESUELTO en A3 — API correcta implementada |
| ~~GAP-014~~ | ~~Service hooks sin data contextual~~ | ✅ RESUELTO en A3 — EntityChangeData completo |
| ~~GAP-020~~ | ~~Tests validan implementación actual vs spec~~ | ✅ RESUELTO en A3 — tests validan impl correcta |
| GAP-006 | ISR exclude patterns | A3 CONFIRMA: Patterns siguen siendo demasiado amplios. Excluyen detail pages que deberían ser ISR. |

---

## Gaps Detectados en Auditoría #3

---

### GAP-032: RevalidateEntityButton hardcodea texto en español — no usa i18n

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: `apps/admin/src/components/RevalidateEntityButton.tsx`

**Descripción**:
El componente `RevalidateEntityButton` tiene strings hardcodeados en español que no usan el sistema de i18n del proyecto, a pesar de que existen keys de i18n definidas para revalidación en los 3 locales (es/en/pt).

**Evidencia**:
```typescript
// RevalidateEntityButton.tsx
label = 'Revalidar'                          // ← hardcoded Spanish default
"Revalidando..."                             // ← hardcoded loading text
"Páginas revalidadas correctamente"          // ← hardcoded success toast
"Error al revalidar las páginas"             // ← hardcoded error toast
```

Los keys correctos ya existen en los archivos i18n:
- `revalidation.actions.revalidateEntity`
- `revalidation.messages.revalidateSuccess`
- `revalidation.messages.revalidateError`

**Solución propuesta**:
Importar `useTranslations()` y reemplazar los strings hardcodeados:
```tsx
const { t } = useTranslations();
// label default: t('revalidation.actions.revalidateEntity')
// loading: t('revalidation.actions.revalidate') + '...'
// success toast: t('revalidation.messages.revalidateSuccess')
// error toast: t('revalidation.messages.revalidateError')
```

**Recomendación**: fix_inline.

> **⚠️ A4 — SIGUE ABIERTO**: Confirmado. `label='Revalidar'`, success/error toast messages en español. i18n keys existen pero componente no importa `useTranslations`.

---

### GAP-033: RevalidateEntityButton no verifica permiso REVALIDATION_TRIGGER

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: high
- **Priority**: P2
- **Complexity**: s (1-4h)
- **Area**: `apps/admin/src/components/RevalidateEntityButton.tsx`

**Descripción**:
El componente `RevalidateEntityButton` se coloca en páginas de detalle de entidades y permite disparar revalidación. Sin embargo, NO verifica si el usuario actual tiene el permiso `REVALIDATION_TRIGGER`. Cualquier admin autenticado que tenga acceso a una página de detalle de entidad puede disparar revalidaciones sin el permiso apropiado.

El endpoint API sí valida el permiso (`createAdminRoute` con `REVALIDATION_TRIGGER`), por lo que la request fallará con 403. Pero la experiencia de usuario es mala: el botón aparece, el usuario clickea, y recibe un error genérico sin entender por qué.

**Solución propuesta**:
Verificar el permiso antes de renderizar el botón:
```tsx
const { hasPermission } = useAuth();
if (!hasPermission(PermissionEnum.REVALIDATION_TRIGGER)) return null;
```

**Recomendación**: fix_inline.

> **⚠️ A4 — SIGUE ABIERTO**: Confirmado. Cualquier usuario autenticado con acceso a la página puede disparar revalidación sin permiso REVALIDATION_TRIGGER.

---

### GAP-034: Sin tests unitarios para componentes/hooks de revalidación en admin

> Auditoría #3 — 2026-03-16

- **Type**: test_gap
- **Severity**: medium
- **Priority**: P3
- **Complexity**: m (4-8h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/`, `apps/admin/src/hooks/useRevalidation.ts`, `apps/admin/src/components/RevalidateEntityButton.tsx`

**Descripción**:
No existen tests para ningún componente, hook o página de la funcionalidad de revalidación en el admin:

- `RevalidateEntityButton.tsx` — sin tests
- `useRevalidation.ts` (6 hooks TanStack Query) — sin tests
- Revalidation page (3 tabs: Config, Logs, Manual) — sin tests
- `revalidation-shared.tsx` (LoadingState, ErrorState, InlineNumberField, etc.) — sin tests
- `revalidation-http-adapter/index.ts` (6 API calls) — sin tests

**Impacto**: Regresiones en la UI de revalidación no serían detectadas automáticamente. Los hooks con lógica de cache invalidation (`onSuccess → invalidateQueries`) no están verificados.

**Solución propuesta**:
Crear tests mínimos con React Testing Library + MSW para:
1. RevalidateEntityButton: renders, triggers mutation, shows toast
2. useRevalidation hooks: query/mutation behaviors + cache invalidation
3. InlineNumberField: edit mode, validation, commit/cancel

**Recomendación**: fix_inline. No merece SPEC independiente, pero sí debería incluirse en un sprint de calidad frontend.

> **⚠️ A4 — SIGUE ABIERTO**: Confirmado. Sin tests para useRevalidation.ts, RevalidateEntityButton.tsx, revalidation-http-adapter.

---

### GAP-035: Sin error boundaries en página de revalidación admin

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: s (1-4h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx`

**Descripción**:
La página de revalidación no tiene error boundaries. Si una query/mutation de TanStack Query lanza una excepción inesperada (ej: API down, response malformado), toda la página crashea mostrando un error genérico de React en lugar de un fallback graceful.

Los componentes `ErrorState` existen para errores de query (`isError`), pero no cubren excepciones de rendering ni errores de mutación inesperados.

**Solución propuesta**:
Envolver cada tab en un `ErrorBoundary` de React con fallback que muestre `<ErrorState>` y un botón de retry.

**Recomendación**: fix_inline. Agrupar con otros improvements de calidad frontend.

> **⚠️ A4 — SIGUE ABIERTO**: Confirmado.

---

### GAP-036: Gaps de accesibilidad en UI admin de revalidación

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/`

**Descripción**:
Se identificaron los siguientes problemas de accesibilidad:

1. **Status badges sin aria-label**: Los badges de status (success/failed/skipped) dependen solo del color para transmitir significado. Un usuario con daltonismo o screen reader no puede distinguirlos.

2. **InlineNumberField sin anuncio a screen readers**: Al entrar en modo edición (click en el campo), no se anuncia el cambio de estado. Un screen reader no sabrá que ahora hay un input editable.

3. **Trigger badges sin texto alternativo**: Los badges de trigger type (manual/hook/cron/stale) son puramente visuales.

**Solución propuesta**:
1. Agregar `aria-label` a badges: `<Badge aria-label={t('revalidation.status.success')}>`
2. Agregar `role="status"` y `aria-live="polite"` al InlineNumberField cuando cambia a modo edición
3. Los trigger badges ya tienen texto visible; agregar `role="status"` para contexto semántico

**Recomendación**: fix_inline.

---

### GAP-037: Vercel adapter sin timeout en fetch

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: high
- **Priority**: P2
- **Complexity**: xs (< 1h)
- **Area**: `packages/service-core/src/revalidation/adapters/vercel-revalidation.adapter.ts`

**Descripción**:
El `VercelRevalidationAdapter` ejecuta `fetch(url, { headers })` sin timeout. Si Vercel responde lentamente (degradación, cold start extremo, o DNS issues), el fetch puede bloquear indefinidamente. En un contexto serverless donde la función tiene timeout de 10-30s, esto puede causar que el request del usuario falle por timeout del cron/hook.

Dado que `revalidateMany()` usa `Promise.allSettled()` con N fetches concurrentes, un Vercel lento puede causar N conexiones abiertas simultáneamente sin resolución.

**Evidencia**:
```typescript
// vercel-revalidation.adapter.ts
const response = await fetch(url, {
    method: 'GET',
    headers: { 'x-prerender-revalidate': this.bypassToken }
    // ← SIN AbortController, SIN signal timeout
});
```

**Solución propuesta**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout
try {
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'x-prerender-revalidate': this.bypassToken },
        signal: controller.signal,
    });
    // ...
} finally {
    clearTimeout(timeoutId);
}
```

**Recomendación**: fix_inline.

---

### GAP-038: Vercel adapter sin retry logic para requests fallidos

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `packages/service-core/src/revalidation/adapters/vercel-revalidation.adapter.ts`

**Descripción**:
Si un fetch falla (network error, 5xx, timeout), el adapter marca el path como `success: false` y sigue adelante. No hay retry. La revalidación de esa página no ocurrirá hasta el próximo trigger (hook, cron, o manual).

Para hooks automáticos (fire-and-forget), una falla silenciosa significa que el contenido stale persiste hasta la próxima actualización del mismo entity o hasta el cron interval (que puede ser 24h).

**Solución propuesta**:

**Opción A (mínima)**: Retry 1 vez con backoff de 1s para errores 5xx y network errors:
```typescript
async revalidate(path: string): Promise<RevalidatePathResult> {
    const result = await this.tryRevalidate(path);
    if (!result.success && this.isRetriable(result.error)) {
        await new Promise(r => setTimeout(r, 1000));
        return this.tryRevalidate(path);
    }
    return result;
}
```

**Opción B (robusta)**: Agregar una cola de paths fallidos que el cron re-intente periódicamente. Más complejo, requiere persistencia.

**Recomendación**: Opción A como fix_inline. Opción B como SPEC futura si se detectan problemas de reliability en producción.

---

### GAP-039: Ninguna página Astro usa `Astro.revalidate` per-route

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/web/src/pages/[lang]/**/*.astro`

**Descripción**:
Astro 5 permite configurar revalidación per-route con `export const revalidate = <seconds>`:
```astro
export const prerender = false;
export const revalidate = 3600; // Revalidate every hour
```

Ninguna página del web app usa esta directiva. Toda la configuración ISR se hace globalmente en `astro.config.mjs` con `expiration: 86400`. Esto significa que TODAS las páginas SSR tienen el mismo TTL de 24h.

**Impacto**: Páginas con contenido que cambia más frecuentemente (eventos próximos, homepage) comparten el mismo TTL que contenido estable (destinos, publicaciones).

**Solución propuesta**:
Considerar TTLs diferenciados per-route para:
- Eventos: `revalidate = 3600` (1h — fechas y estado cambian)
- Homepage: `revalidate = 3600` (1h — featured items cambian)
- Destinos: `revalidate = 86400` (24h — contenido estable)
- Publicaciones: `revalidate = 86400` (24h — contenido estable)

**Recomendación**: evaluar para SPEC futura. No es bloqueante para go-live ya que el cron + on-demand revalidation cubren el caso.

---

### GAP-040: Sin categorías de logger específicas para revalidación en @repo/logger

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: `packages/logger/src/categories.ts`

**Descripción**:
El paquete `@repo/logger` no define categorías específicas para revalidación. La búsqueda de `revalidation`, `isr`, `purge` y `cache` en `packages/logger/src/` retorna cero resultados.

El `RevalidationService` usa `createLogger('revalidation')` (verificar), pero si la categoría no está definida, puede:
1. Usar un logger genérico sin configuración específica de nivel
2. No aparecer en filtros de log de producción (Sentry categories)
3. No tener formato consistente con otros domain loggers

**Solución propuesta**:
Agregar categorías en `packages/logger/src/categories.ts`:
```typescript
'revalidation.service': { level: 'info' },
'revalidation.adapter': { level: 'info' },
'revalidation.cron': { level: 'info' },
'revalidation.hook': { level: 'debug' },
```

**Recomendación**: fix_inline.

---

### GAP-041: Stale window (48h) y log retention (30d) hardcodeados

> Auditoría #3 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: s (1-4h)
- **Area**: `apps/api/src/cron/jobs/page-revalidation.job.ts`

**Descripción**:
Dos constantes importantes del cron job están hardcodeadas como constantes y no son configurables:

1. `STALE_WINDOW_MS = 48 * 60 * 60 * 1000` (48 horas) — ventana para considerar un entityType como "stale" y forzar revalidación
2. Log cleanup cutoff = 30 días — retención de logs antes de limpieza automática

El `cronIntervalMinutes` SÍ es configurable vía admin (tabla `revalidation_config`), pero estos dos valores no.

**Impacto**: Si un operador necesita un stale window más agresivo (ej: 24h para contenido de alta frecuencia), o retención de logs más larga (ej: 90d para auditoría), requiere deploy de código.

**Solución propuesta**:
Mover a variables de entorno o a la tabla `revalidation_config`:
- `HOSPEDA_REVALIDATION_STALE_WINDOW_HOURS` (default: 48)
- `HOSPEDA_REVALIDATION_LOG_RETENTION_DAYS` (default: 30)

**Recomendación**: evaluar para SPEC futura. No bloqueante para go-live.

---

### GAP-042: `destinos/index.astro` sigue con `prerender=true` — spec dice ISR

> Auditoría #3 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/web/src/pages/[lang]/destinos/index.astro`

**Descripción**:
La spec (AC-005, item 3) define que `[lang]/destinos/index.astro` (listing de destinos) debe ser ISR-cached. Esto requiere que la página sea SSR (renderizada por request) para que Vercel la cache con ISR.

Sin embargo, la página actual tiene `export const prerender = true` (línea 2), lo que la hace completamente estática (SSG). Esto significa:
1. Los cambios en destinos (nuevos, editados, eliminados) NO se reflejan hasta el próximo build
2. El `RevalidationService` genera paths como `/es/destinos/` para revalidar, pero la página es estática y Vercel no puede revalidarla on-demand
3. El cron job revalida destinos sin efecto real

**Solución propuesta**:
Migrar `destinos/index.astro` de SSG a SSR siguiendo el mismo patrón de las otras páginas migradas:
1. Eliminar `export const prerender = true`
2. Eliminar `getStaticPaths()`
3. Agregar locale validation en frontmatter
4. Agregar data fetching dinámico
5. Verificar que ISR no excluya esta ruta (no matchea con exclude patterns actuales)

**Recomendación**: fix_inline. Seguir el mismo patrón de migración ya aplicado en las otras 9 páginas.

> **⚠️ A4 — SIGUE ABIERTO**: Confirmado. `destinos/index.astro` sigue con `prerender = true` y `getStaticPaths`. Debe migrarse a SSR para que ISR funcione.

---

## Auditoría #3 — Plan de Acción Actualizado

### Prioridad 1 — Bugs funcionales (producción rota si no se corrige)

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-003 | POST /revalidate/entity ignora entityId | S | ABIERTO (A1, A2, A3) |
| GAP-006 | ISR exclude patterns demasiado amplios | S | ABIERTO (A1, A3) |
| GAP-037 | Vercel adapter sin timeout en fetch | XS | NUEVO (A3) |

### Prioridad 2 — Funcionalidad incompleta / seguridad

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-033 | RevalidateEntityButton sin permission check | S | NUEVO (A3) |
| GAP-011 | findLastCronEntry sin filtro trigger='cron' | S | ABIERTO (A1) — verificar |
| GAP-030 | Tests de rutas sin 401/403 explícitos | S | ABIERTO (A2) |
| GAP-027 | GET /health sin probe real | S | ABIERTO (A2) |
| GAP-042 | destinos/index.astro sigue SSG | S | NUEVO (A3) |
| GAP-040 | Sin logger categories para revalidación | XS | NUEVO (A3) |

### Prioridad 3 — Calidad / polish

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-032 | RevalidateEntityButton hardcodea Spanish | XS | NUEVO (A3) |
| GAP-034 | Sin tests admin UI de revalidación | M | NUEVO (A3) |
| GAP-036 | Accesibilidad en admin revalidation UI | S | NUEVO (A3) |
| GAP-038 | Vercel adapter sin retry logic | S | NUEVO (A3) |
| GAP-031 | PATCH /config/:id sin 404 | XS | ABIERTO (A2) |
| GAP-025 | Sin test E2E Playwright | M | ABIERTO (A1, A2) |

### Prioridad 4 — Nice to have / futuro

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-035 | Sin error boundaries en admin revalidation | S | NUEVO (A3) |
| GAP-039 | Sin Astro.revalidate per-route | XS | NUEVO (A3) |
| GAP-041 | Stale window / log retention hardcodeados | S | NUEVO (A3) |

### Gaps de A1/A2 pendientes de verificación manual

Los siguientes gaps de A1/A2 no fueron verificados en A3 y necesitan revisión manual para confirmar si fueron resueltos:

| Gap | Descripción | Última auditoría |
|-----|-------------|-----------------|
| GAP-007 | console.error → @repo/logger | A1 |
| GAP-009 | HOSPEDA_SITE_URL required en prod | A1 |
| GAP-012 | reason/triggeredBy no pasados en manual endpoint | A1 |
| GAP-015 | GET /logs sin paginación/fecha | A1 |
| GAP-016 | Type-unsafe cast en PATCH config | A1 |
| GAP-017 | Locale cast antes de null check | A1 |
| GAP-018 | initializeRevalidationService idempotencia silenciosa | A1 |
| GAP-019 | _resetRevalidationService exportada en producción | A1 |
| GAP-021 | CLAUDE.md mecanismo ISR incorrecto | A1 |
| GAP-022 | Falta getRevalidationSecret() helper | A1 |
| GAP-023 | Admin page strings hardcodeados | A1 (parcialmente cubierto por GAP-032) |
| GAP-024 | QUERY_KEYS duplicados | A1 |

---

## Gaps Detectados en Auditoría #4

---

### GAP-043: `revalidateByEntityType` no consulta DB — no genera paths de detalle de entidades individuales

> Auditoría #4 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: l (1-2d)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts`

**Descripción**:
`revalidateByEntityType` NO consulta la base de datos para obtener todas las entidades de un tipo. Llama a `getAffectedPaths({ entityType } as EntityChangeData)` sin slugs ni contexto, generando solo paths de listing/categoría pero NO paths de detalle de entidades individuales. La spec requiere: consultar DB para todas las entidades del tipo, construir paths por entidad, deduplicar, y respetar `maxCronRevalidations`.

**Evidencia**:
```typescript
// revalidation.service.ts
async revalidateByEntityType(entityType: string): Promise<void> {
    const paths = getAffectedPaths({ entityType } as EntityChangeData);
    // ← Sin query a DB. Sin slugs. Solo genera listing pages.
    // Paths de detalle como /es/alojamientos/hotel-ejemplo/ NUNCA se generan.
    await this.revalidatePaths(paths);
}
```

**Impacto**: El cron job y la ruta POST /revalidate/type solo revalidan listing pages. Ninguna página de detalle individual se revalida por tipo. Esto es especialmente grave porque GAP-003 (POST /revalidate/entity) también está roto, dejando sin mecanismo de revalidación masiva funcional.

**Solución propuesta**: Inyectar entity-specific path resolvers (resolveAccommodationPaths, resolveDestinationPaths, etc.) que consulten DB models. Agregar límite `maxCronRevalidations`. Esto es arquitecturalmente complejo porque `RevalidationService` está en `service-core` que no depende de models específicos.

**Recomendación**: new_spec — Requiere cambio arquitectural significativo (inyección de dependencias de models o patrón resolver).

---

### GAP-044: `writeLog` siempre almacena `entityType: 'unknown'`

> Auditoría #4 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: m (4-8h)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts` (líneas 119-128, 184-191)

**Descripción**:
Cada log entry en `revalidation_log` se graba con `entityType: 'unknown'`. El método `revalidatePaths` recibe paths pero no el contexto de entidad que los generó. Esto hace que los filtros por entityType en la UI de logs sean inútiles.

**Evidencia**:
```typescript
// writeLog en revalidation.service.ts
private async writeLog(params: {
    paths: readonly string[];
    triggeredBy: string;
    reason: string;
    trigger: string;
    // ← NO recibe entityType
}): Promise<void> {
    // entityType siempre será 'unknown' o no se setea
}
```

**Solución propuesta**: Thread entityType a través de la firma de `revalidatePaths`: `revalidatePaths(paths, triggeredBy, reason, trigger, entityType?)`. Actualizar todos los call sites.

**Recomendación**: fix_inline.

---

### GAP-045: Debounce keyed por `path` en vez de `entityType:entityId`

> Auditoría #4 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: high
- **Priority**: P2
- **Complexity**: m (4-8h)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts` (líneas 154, 167)

**Descripción**:
La spec requiere debounce por identidad de entidad (`entityType:entityId`). La implementación debouncea cada path individual separadamente. Un solo cambio de entidad genera N paths (detalle + listing + tipo), cada uno con su propio timer. Esto causa N llamadas separadas al adapter en vez de 1 llamada batched por cambio de entidad.

**Evidencia**:
```typescript
// revalidation.service.ts
// Cada path individual tiene su propio timer:
for (const path of paths) {
    this.debouncePath(path); // key = path, no entityType:entityId
}
```

**Impacto**: Con 8 locales y 5 tipos de path por accommodation = hasta 40 timers y 40 llamadas al adapter por un solo cambio de entidad, en vez de 1.

**Solución propuesta**: Cambiar debounce key a `${entityType}:${entityId}`, recolectar todos los paths para ese key, batch-revalidar cuando el timer fire.

**Recomendación**: fix_inline.

---

### GAP-046: `revalidateByEntityType` hardcodea `trigger='cron'`

> Auditoría #4 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: xs (< 1h)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts` línea 87, `apps/api/src/routes/revalidation/index.ts` línea 211

**Descripción**:
Cuando `revalidateByEntityType` se llama desde la ruta manual `/revalidate/type`, el audit log registra incorrectamente `trigger='cron'` en vez de `trigger='manual'`. El método no acepta parámetro de trigger.

**Solución propuesta**: Agregar parámetro opcional `trigger` a `revalidateByEntityType`. La ruta pasa `'manual'`, el cron pasa `'cron'`.

**Recomendación**: fix_inline.

---

### GAP-047: Manual revalidation route no pasa `triggeredBy` ni `reason` al service

> Auditoría #4 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: xs (< 1h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` línea 83

**Descripción**:
El handler de POST /revalidate/manual llama a `service.revalidatePaths(paths)` sin pasar el `triggeredBy` (userId del actor autenticado) ni el `reason` del request body. El audit trail pierde trazabilidad de quién disparó la revalidación manual y por qué.

**Evidencia**:
```typescript
// routes/revalidation/index.ts
const { paths, reason } = body; // reason extraído
await service.revalidatePaths(paths); // ← reason y userId NO pasados
```

**Solución propuesta**: Pasar `reason` y actor `userId` desde el contexto de auth a `revalidatePaths`.

**Recomendación**: fix_inline.

---

### GAP-048: RevalidationServiceConfig missing `maxCronRevalidations` y `logRetentionDays`

> Auditoría #4 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts` (líneas 9-18)

**Descripción**:
La spec requiere `maxCronRevalidations` y `logRetentionDays` en la config del constructor. `logRetentionDays` (default 30) está hardcodeado en el cron job. `maxCronRevalidations` no existe en ningún lado.

**Solución propuesta**: Agregar ambos campos al config interface con defaults. Exponer via getter methods para que el cron job los lea. Mover el hardcoded 30d del cron al config del service.

**Recomendación**: fix_inline.

---

### GAP-049: API route URL paths no matchean spec

> Auditoría #4 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: xs (< 1h)
- **Area**: `apps/api/src/routes/revalidation/index.ts`

**Descripción**:
| Spec | Implementación |
|------|----------------|
| `/revalidate` | `/revalidate/manual` |
| `/revalidate-entity` | `/revalidate/entity` |
| `/revalidate-type` | `/revalidate/type` |

**Solución propuesta**: Renombrar rutas para matchear la convención de la spec. Actualizar admin HTTP adapter URLs.

**Recomendación**: fix_inline (coordinar con admin adapter).

---

### GAP-050: PUT vs PATCH mismatch + id vs entityType param en config route

> Auditoría #4 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` línea 266

**Descripción**:
La spec define `PUT /config/:entityType`. La implementación usa `PATCH /config/:id` (UUID). Diferente método HTTP y tipo de parámetro.

**Solución propuesta**: Cambiar a PUT, cambiar param de `:id` a `:entityType`, buscar config por entity type. Actualizar admin adapter.

**Recomendación**: fix_inline.

---

### GAP-051: Logs endpoint missing `path`, `dateFrom`, `dateTo` filters

> Auditoría #4 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `apps/api/src/routes/revalidation/index.ts` (log route handler)

**Descripción**:
La spec requiere 6 filtros (entityType, trigger, status, path, dateFrom, dateTo). La implementación tiene entityType, entityId, trigger, status pero le faltan `path` y filtros de rango de fecha.

**Solución propuesta**: Agregar filtro `path` con LIKE y cláusulas WHERE de rango de fecha al query de logs.

**Recomendación**: fix_inline.

---

### GAP-052: Admin logs tab sin pagination, filters, auto-refresh, sort

> Auditoría #4 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: m (4-8h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx` (logs tab section)

**Descripción**:
La spec requiere tabla paginada con filtros, auto-refresh cada 30s, y sorted por date desc. La implementación actual carga todos los logs de una vez sin controles.

**Solución propuesta**: Agregar filter controls (entityType select, trigger select, status select, date range pickers), pagination controls, `useQuery` con `refetchInterval: 30000`, sort por `createdAt` desc.

**Recomendación**: fix_inline.

---

### GAP-053: Admin hooks sin `staleTime` per spec

> Auditoría #4 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/admin/src/hooks/useRevalidation.ts`

**Descripción**:
La spec dice 5min staleTime para `useRevalidationConfigs()` y `useRevalidationStats()`. Ningún hook define staleTime. Default es 0, causando refetches innecesarios.

**Solución propuesta**: Agregar `staleTime: 5 * 60 * 1000` a las queries de configs y stats.

**Recomendación**: fix_inline.

---

### GAP-054: Admin page duplica query logic inline en vez de usar hooks exportados

> Auditoría #4 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: s (1-4h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx`

**Descripción**:
La página de revalidación importa directamente del HTTP adapter y crea `useMutation`/`useQuery` inline en vez de usar los hooks exportados en `useRevalidation.ts`. La cache invalidation está duplicada.

**Solución propuesta**: Refactorizar página para usar los hooks exportados. Mover cache invalidation + toast logic a los hooks.

**Recomendación**: fix_inline.

---

### GAP-055: Missing 4th stat card (last revalidation)

> Auditoría #4 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx` (manual tab stats section)

**Descripción**:
La spec requiere 4 cards: total, success rate, avg duration, last revalidation. Solo se renderizan 3.

**Solución propuesta**: Agregar 4to StatCard mostrando `stats.lastRevalidation` formateado como tiempo relativo.

**Recomendación**: fix_inline.

---

### GAP-056: Log status badge muestra valor raw en vez de traducción i18n

> Auditoría #4 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx` (línea ~307-311)

**Descripción**:
El trigger badge usa `t(...)` para traducción, pero el status badge renderiza `log.status` directamente. Los keys i18n existen para `revalidation.status.success/failed/skipped`.

**Solución propuesta**: Reemplazar `{log.status}` con `{t(\`revalidation.status.${log.status}\`)}`.

**Recomendación**: fix_inline.

---

### GAP-057: RevalidateEntityButton missing `className` prop

> Auditoría #4 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/admin/src/components/RevalidateEntityButton.tsx`

**Descripción**:
La spec define `Props: entityType, entityId, label?, className?`. La definición de tipo y JSX no incluyen `className`.

**Solución propuesta**: Agregar `className` a la interfaz de props y pasarlo al Button.

**Recomendación**: fix_inline.

---

### GAP-058: CLAUDE.md documenta `HOSPEDA_ISR_BYPASS_TOKEN` pero código usa `HOSPEDA_REVALIDATION_SECRET`

> Auditoría #4 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/web/CLAUDE.md`

**Descripción**:
Documentación stale. CLAUDE.md menciona `HOSPEDA_ISR_BYPASS_TOKEN` pero el nombre correcto en el código es `HOSPEDA_REVALIDATION_SECRET`. Confundirá a desarrolladores.

**Solución propuesta**: Reemplazar todas las referencias a `HOSPEDA_ISR_BYPASS_TOKEN` con `HOSPEDA_REVALIDATION_SECRET`.

**Recomendación**: fix_inline.

---

### GAP-059: Service hooks test cubre solo 4 de 8 services

> Auditoría #4 — 2026-03-16

- **Type**: test_gap
- **Severity**: medium
- **Priority**: P3
- **Complexity**: m (4-8h)
- **Area**: `packages/service-core/test/revalidation/service-hooks.test.ts`

**Descripción**:
El test cubre AccommodationService, DestinationService, EventService, TagService. Faltan: PostService (unique: `tagSlugs`), AccommodationReviewService (unique: `accommodationSlug`), DestinationReviewService (unique: `destinationSlug`), AmenityService. El comentario en el test diciendo "pattern is identical" es incorrecto — estos servicios tienen campos de contexto distintos.

**Solución propuesta**: Agregar test suites para los 4 servicios faltantes, especialmente testeando campos de contexto entity-specific.

**Recomendación**: fix_inline.

---

### GAP-060: VercelRevalidationAdapter.revalidateMany sin batching

> Auditoría #4 — 2026-03-16

- **Type**: spec_deviation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: s (1-4h)
- **Area**: `packages/service-core/src/revalidation/adapters/vercel-revalidation.adapter.ts`

**Descripción**:
La spec requiere "batches de 10, 200ms delay entre batches". La implementación actual usa `Promise.allSettled` corriendo todos los paths en paralelo sin batching. Podría overwhelm Vercel durante revalidaciones masivas del cron.

**Solución propuesta**: Implementar chunked iteration: split paths en grupos de 10, await cada grupo, delay 200ms entre grupos.

**Recomendación**: fix_inline.

---

### GAP-061: HTTP adapter missing `revalidateByType` y `checkServiceHealth` methods

> Auditoría #4 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/admin/src/lib/revalidation-http-adapter/index.ts`

**Descripción**:
La spec lista 8 funciones en el admin HTTP adapter. La implementación tiene 6. Faltan `revalidateByType` (para botón "revalidate all of type") y `checkServiceHealth` (para display de health status).

**Solución propuesta**: Agregar ambos métodos usando los schema contracts existentes.

**Recomendación**: fix_inline.

---

### GAP-062: Sin tests para ISR exclude patterns

> Auditoría #4 — 2026-03-16

- **Type**: test_gap
- **Severity**: low
- **Priority**: P4
- **Complexity**: s (1-4h)
- **Area**: `apps/web/test/` (archivo nuevo necesario)

**Descripción**:
Los regexes en `astro.config.mjs` son la configuración ISR más crítica. No existe ningún test unitario que verifique que detail pages no son excluidas mientras listing pages sí lo son.

**Solución propuesta**: Crear archivo de test que importe/duplique los patterns y assert inclusion/exclusion para todas las categorías de URL.

**Recomendación**: fix_inline.

---

### GAP-063: `destinos/[...path].astro` unsafe locale cast

> Auditoría #4 — 2026-03-16

- **Type**: undeclared_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: xs (< 1h)
- **Area**: `apps/web/src/pages/[lang]/destinos/[...path].astro` línea 42

**Descripción**:
Cast `as SupportedLocale` antes del null check. Otras páginas hacen check primero, luego cast. Patrón inconsistente.

**Solución propuesta**: Mover cast después del null guard.

**Recomendación**: fix_inline.

---

## Auditoría #4 — Plan de Acción Actualizado

### Prioridad 1 — Bugs funcionales críticos (producción rota)

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-003 | POST /revalidate/entity ignora entityId | S | ABIERTO (A1-A4) |
| GAP-006 | ISR exclude patterns incorrectos | S | ABIERTO (A1-A4) |
| GAP-043 | revalidateByEntityType no consulta DB — sin paths de detalle | L | NUEVO (A4) — **requiere new_spec** |

### Prioridad 2 — Funcionalidad incompleta / audit trail roto

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-044 | writeLog entityType='unknown' | M | NUEVO (A4) |
| GAP-045 | Debounce por path en vez de por entidad | M | NUEVO (A4) |
| GAP-046 | revalidateByEntityType hardcodea trigger='cron' | XS | NUEVO (A4) |
| GAP-047 | Manual route no pasa triggeredBy/reason | XS | NUEVO (A4) |
| GAP-033 | RevalidateEntityButton sin permission check | S | ABIERTO (A3-A4) |
| GAP-027 | GET /health sin probe real | S | ABIERTO (A2-A4) |
| GAP-030 | Tests con assertions permisivas 401/403 | S | ABIERTO (A2-A4) |

### Prioridad 3 — Spec deviations / calidad

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-048 | Config missing maxCronRevalidations/logRetentionDays | S | NUEVO (A4) |
| GAP-049 | API route URLs no matchean spec | XS | NUEVO (A4) |
| GAP-050 | PUT vs PATCH mismatch en config route | S | NUEVO (A4) |
| GAP-051 | Logs endpoint missing path/date filters | S | NUEVO (A4) |
| GAP-052 | Admin logs tab sin pagination/filters/auto-refresh | M | NUEVO (A4) |
| GAP-059 | Service hooks test 4/8 services | M | NUEVO (A4) |
| GAP-060 | revalidateMany sin batching | S | NUEVO (A4) |
| GAP-042 | destinos/index.astro sigue SSG | S | ABIERTO (A3-A4) |
| GAP-032 | RevalidateEntityButton hardcodea Spanish | XS | ABIERTO (A3-A4) |
| GAP-034 | Sin tests admin UI revalidación | M | ABIERTO (A3-A4) |
| GAP-025 | Sin test E2E Playwright | M | ABIERTO (A1-A4) |
| GAP-031 | PATCH /config/:id sin 404 test | XS | ABIERTO (A2-A4) |

### Prioridad 4 — Polish / nice to have

| Gap | Título | Complejidad | Estado |
|-----|--------|-------------|--------|
| GAP-053 | Admin hooks sin staleTime | XS | NUEVO (A4) |
| GAP-054 | Admin page duplica query logic | S | NUEVO (A4) |
| GAP-055 | Missing 4th stat card | XS | NUEVO (A4) |
| GAP-056 | Log status badge sin i18n | XS | NUEVO (A4) |
| GAP-057 | RevalidateEntityButton missing className | XS | NUEVO (A4) |
| GAP-058 | CLAUDE.md env var name stale | XS | NUEVO (A4) |
| GAP-061 | HTTP adapter missing 2 methods | XS | NUEVO (A4) |
| GAP-062 | Sin tests ISR exclude patterns | S | NUEVO (A4) |
| GAP-063 | Unsafe locale cast en destinos | XS | NUEVO (A4) |
| GAP-035 | Sin error boundaries admin | S | ABIERTO (A3-A4) |

---

## Resumen Ejecutivo Auditoría #4

**Estado general**: La SPEC-034 se mantiene en **~90-92%** de conformidad. Los gaps críticos del core resueltos en A3 (EntityPathMapper, RevalidationService API, log persistence, config reading) siguen resueltos. Sin embargo, A4 descubrió **21 nuevos gaps** que A1-A3 no detectaron, incluyendo 1 crítico (GAP-043: revalidateByEntityType no consulta DB) y 4 altos (GAP-044 a GAP-047: problemas de audit trail y debounce).

**Hallazgo más importante de A4**: El sistema de revalidación por tipo (usado por cron y admin manual) es fundamentalmente incompleto — solo genera paths de listing pages, no de entidades individuales (GAP-043). Combinado con GAP-003 (entity revalidation rota), no existe un mecanismo funcional de revalidación masiva en la implementación actual.

**Bloqueantes para producción** (3 gaps):
1. **GAP-006** (A1-A4): ISR exclude patterns excluyen detail pages
2. **GAP-003** (A1-A4): POST /revalidate/entity ignora entityId
3. **GAP-043** (A4): revalidateByEntityType no genera paths de detalle — requiere new_spec por complejidad arquitectural

**Resumen cuantitativo acumulado (A1+A2+A3+A4):**
- Gaps totales identificados: 63
- Gaps resueltos (confirmados): 31
- Gaps activos: 32
  - Críticos (P1): 3
  - Altos (P2): 4
  - Medios (P3): 13
  - Bajos (P4): 12

---

## Resumen Ejecutivo Auditoría #3

**Estado general**: La SPEC-034 pasó de ~80-85% (A2) a **~92-95%** de conformidad. Los 6 gaps críticos (P1) de A1 fueron todos resueltos. El sistema de revalidación ISR es funcionalmente correcto en su core (service, adapters, hooks, DB, schemas, cron, admin UI).

**Bloqueantes para producción** (3 gaps):
1. **GAP-006**: ISR exclude patterns excluyen detail pages — las páginas de detalle de alojamientos y eventos NO se cachean con ISR, haciendo el sistema parcialmente inefectivo
2. **GAP-003**: POST /revalidate/entity no funciona como se espera — revalida TODO el tipo en vez de solo la entidad
3. **GAP-037**: Sin timeout en fetch — riesgo de bloqueo en producción si Vercel es lento

**Decisión requerida**: ¿Se corrigen los 3 bloqueantes inline, o se genera una SPEC formal para un "SPEC-034 Phase 2 — ISR Polish"?

---

## Gaps Detallados — Auditoría #5

---

### GAP-064: RevalidationService API contract diverge fundamentalmente de la spec

> Auditoría #5 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: critical
- **Priority**: P1
- **Complexity**: 3 (refactor con impacto en 40+ call sites)
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts`

**Descripción**:
La spec (sección 5.6) define la API pública de RevalidationService con firmas RO-RO y return types específicos. La implementación diverge en múltiples ejes:

| Aspecto | Spec | Implementación |
|---------|------|----------------|
| Hook entry point | `revalidateEntity({ event })` | `scheduleRevalidation(event, reason?)` |
| revalidatePaths | `({ paths, reason, triggeredBy }) → ReadonlyArray<RevalidationResult>` | `(paths[], triggeredBy?, reason?, trigger?) → void` |
| revalidateByEntityType | `({ entityType }) → ReadonlyArray<RevalidationResult>` | `(entityType) → void` |
| RO-RO pattern | Sí (object params) | No (positional args) |

**Evidencia** (revalidation.service.ts):
```typescript
// Actual - positional args, void return:
async revalidatePaths(paths: readonly string[], triggeredBy?: string, reason?: string, trigger: RevalidationTrigger = 'hook'): Promise<void>
// Spec - RO-RO, returns results:
async revalidatePaths(params: { readonly paths, readonly reason, readonly triggeredBy }): Promise<ReadonlyArray<RevalidationResult>>
```

**Impacto**: Los callers no reciben resultados de la revalidación. POST /revalidate/manual no puede retornar breakdown de éxito/fallo al admin. El RO-RO violation rompe convención del proyecto.

**Solución propuesta**: Alinear method signatures con spec: adoptar RO-RO params, corregir return types, renombrar `scheduleRevalidation` a `revalidateEntity` (o mantener nombre actual documentando la divergencia intencionada). Actualizar los ~40 call sites en service hooks para usar `void revalidateEntity(...)`.

**Recomendación**: fix_inline. Coordinar con GAP-043 y GAP-068.

---

### GAP-065: Adapter interface usa parámetros posicionales violando RO-RO

> Auditoría #5 — 2026-03-16

- **Type**: code_quality
- **Severity**: medium
- **Priority**: P3
- **Complexity**: 2
- **Area**: `packages/service-core/src/revalidation/adapters/revalidation.adapter.ts`

**Descripción**:
La spec define `revalidate({ path })` y `revalidateMany({ paths })`. La implementación usa `revalidate(path: string)` y `revalidateMany(paths: readonly string[])`. Viola el patrón RO-RO mandatorio del proyecto. También el tipo de retorno se llama `RevalidatePathResult` en vez de `RevalidationResult` (spec).

**Solución propuesta**: Actualizar interface a RO-RO + renombrar tipo de retorno. Actualizar ambas implementaciones (Vercel + NoOp).

**Recomendación**: fix_inline. Baja prioridad pero mantiene consistencia.

---

### GAP-066: AccommodationReviewService y DestinationReviewService no pasan slug del parent en revalidation hooks

> Auditoría #5 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: 2
- **Area**: `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` (líneas 169-171, 176-179, 233-236) + `packages/service-core/src/services/destinationReview/destinationReview.service.ts` (líneas 130-132, 137-140, 196-199)

**Descripción**:
Ambos services llaman `scheduleRevalidation({ entityType: 'accommodation_review' })` (o `'destination_review'`) SIN pasar el slug del alojamiento/destino padre. El spec y el entity-path-mapper requieren `accommodationSlug` / `destinationSlug` para generar el path de la detail page del parent.

**Evidencia** (accommodationReview.service.ts:169-171):
```typescript
getRevalidationService()?.scheduleRevalidation({
    entityType: 'accommodation_review',
    // Missing: accommodationSlug ← necesario para revalidar /alojamientos/{slug}/
});
```

**Impacto user-facing**: Cuando un usuario agrega una review a un alojamiento, la página de detalle del alojamiento (que muestra la nueva review) NO se revalida. Solo se revalida el listing genérico `/alojamientos/`. El usuario no ve su review reflejada hasta la próxima revalidación automática (24h TTL o cron).

**Solución propuesta**: Resolver `accommodationSlug` desde `entity.accommodationId` via lookup a AccommodationModel antes de llamar `scheduleRevalidation`. Aplicar el patrón capture similar a `_lastRestoredAccommodation` que ya existe en AccommodationService. Mismo patrón para DestinationReviewService.

**Recomendación**: fix_inline. Impacto directo en UX.

---

### GAP-067: getLocalizedPath genera paths inválidos para Spanish (locale default)

> Auditoría #5 — 2026-03-16

- **Type**: wrong_implementation
- **Severity**: high
- **Priority**: P2
- **Complexity**: 1
- **Area**: `packages/service-core/src/revalidation/entity-path-mapper.ts` (líneas 351-354)

**Descripción**:
La función `getLocalizedPath` tiene una excepción para el locale Spanish:

```typescript
export function getLocalizedPath(path: string, locale: string): string {
    if (locale === 'es') return path;       // Returns '/alojamientos/' SIN /es/ prefix
    return `/${locale}${path}`;
}
```

La web app de Astro usa `trailingSlash: 'always'` y TODAS las rutas incluyen el prefijo de locale: `/es/alojamientos/`, `/en/alojamientos/`, `/pt/alojamientos/`. La ruta `/alojamientos/` sin locale NO es una cached route válida en Vercel .. es un redirect a `/es/alojamientos/`.

**Impacto**: TODAS las revalidation requests para contenido en Spanish (el locale default y más usado en Argentina) apuntan a URLs inexistentes. El bypass token se envía a una URL que redirige, no a la cached page. Las páginas en Spanish NUNCA se revalidan on-demand.

**Solución propuesta**: Eliminar la excepción: `return \`/${locale}${path}\`;` para todos los locales incluyendo `es`.

**Recomendación**: fix_inline. **BLOQUEANTE para producción**. Fix trivial (1 línea).

---

### GAP-068: Config e init params missing campo `locales`

> Auditoría #5 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: 1
- **Area**: `packages/service-core/src/revalidation/revalidation.service.ts` (líneas 9-18) + `revalidation-init.ts` (líneas 11-30)

**Descripción**:
Spec define `RevalidationServiceConfig.locales: ReadonlyArray<string>`. Ni el config ni el init params tienen este campo. Esto bloquea la corrección de GAP-043 (revalidateByEntityType con DB queries), que necesita generar paths para todos los locales.

**Solución propuesta**: Agregar `locales` a ambas interfaces. En `initializeRevalidationService`, pasar locales desde `@repo/i18n` (`SUPPORTED_LOCALES`).

**Recomendación**: fix_inline. Prerequisito para GAP-043.

---

### GAP-069: JSDoc en revalidation-init.ts referencia env var incorrecta

> Auditoría #5 — 2026-03-16

- **Type**: documentation
- **Severity**: low
- **Priority**: P4
- **Complexity**: 1
- **Area**: `packages/service-core/src/revalidation/revalidation-init.ts` (línea 15)

**Descripción**:
JSDoc dice `HOSPEDA_ISR_BYPASS_TOKEN` pero la variable correcta es `HOSPEDA_REVALIDATION_SECRET`. Consistente con GAP-058 (CLAUDE.md web).

**Solución propuesta**: Corregir JSDoc.

**Recomendación**: fix_inline.

---

### GAP-070: Revalidation admin page sin route-level permission guard

> Auditoría #5 — 2026-03-16

- **Type**: security
- **Severity**: high
- **Priority**: P2
- **Complexity**: 1
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx`

**Descripción**:
La página de revalidación admin está bajo `/_authed/` (requiere autenticación) pero NO verifica permisos `REVALIDATION_*`. Cualquier usuario autenticado (incluso un owner sin permisos de revalidación) puede:
- Ver todas las configs de revalidación
- Ver todos los audit logs
- Ver estadísticas del sistema
- Disparar revalidación manual

La spec (sección 9.1) indica que la página es accesible solo a usuarios con permisos de revalidación.

**Solución propuesta**: Agregar `beforeLoad` guard en la route config verificando al menos uno de: `REVALIDATION_TRIGGER`, `REVALIDATION_CONFIG_VIEW`, `REVALIDATION_LOG_VIEW`. Opcionalmente, condicionar cada tab a su permiso específico.

**Recomendación**: fix_inline. Impacto de seguridad.

---

### GAP-071: Manual tab sin modo de revalidación por entity type

> Auditoría #5 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: 2
- **Area**: `apps/admin/src/routes/_authed/revalidation/index.tsx` (ManualTab)

**Descripción**:
La spec (sección 9.2) describe DOS modos de revalidación manual:
1. Por paths específicos (textarea con paths separados por comas) .. **implementado**
2. Por entity type (dropdown de entity type + botón "Regenerar") .. **NO implementado**

También falta dialog de confirmación: "Esto regenerará X páginas de tipo Y. ¿Continuar?"

**Solución propuesta**: Agregar segundo formulario con dropdown de entity types que llame a POST /revalidate/type. Agregar confirmation dialog antes de ejecutar.

**Recomendación**: fix_inline.

---

### GAP-072: RevalidateEntityButton no integrado en entity edit pages

> Auditoría #5 — 2026-03-16

- **Type**: missing_implementation
- **Severity**: medium
- **Priority**: P3
- **Complexity**: 2
- **Area**: `apps/admin/src/components/RevalidateEntityButton.tsx` + entity edit pages

**Descripción**:
El componente `RevalidateEntityButton` está implementado y funciona correctamente (con permission check, loading state, toasts). Sin embargo, NO está importado ni usado en ninguna página de edición de entidades:
- `apps/admin/src/routes/_authed/accommodations/$id_.edit.tsx` .. no
- `apps/admin/src/routes/_authed/destinations/$id_.edit.tsx` .. no
- `apps/admin/src/routes/_authed/events/$id_.edit.tsx` .. no
- `apps/admin/src/routes/_authed/posts/$id_.edit.tsx` .. no

**Solución propuesta**: Importar y renderizar `<RevalidateEntityButton entityType="accommodation" entityId={id} />` en cada página de edición, típicamente junto al botón de guardado.

**Recomendación**: fix_inline.

---

### GAP-073: Cron job page-revalidation no registrado en vercel.json

> Auditoría #5 — 2026-03-16

- **Type**: possible_issue
- **Severity**: low
- **Priority**: P4
- **Complexity**: 1
- **Area**: `apps/api/vercel.json`

**Descripción**:
Los 6 cron jobs existentes (trial-expiry, addon-expiry, notification-schedule, webhook-retry, exchange-rate-fetch, dunning) están registrados en `apps/api/vercel.json` bajo `"crons"`. El job `page-revalidation` NO está. Si el scheduling depende de Vercel Cron (no de un loop interno), el job nunca se ejecutará en producción.

**Solución propuesta**: Verificar si el cron se ejecuta via Vercel Cron o via mecanismo interno. Si es Vercel Cron, agregar entry: `{ "path": "/api/cron/page-revalidation", "schedule": "0 * * * *" }`.

**Recomendación**: Verificar mecanismo y fix_inline si es necesario.

---

### GAP-074: VercelRevalidationAdapter sin tests para condiciones adversas

> Auditoría #5 — 2026-03-16

- **Type**: test_gap
- **Severity**: medium
- **Priority**: P3
- **Complexity**: 2
- **Area**: `packages/service-core/test/revalidation/adapters.test.ts`

**Descripción**:
Los tests actuales cubren happy path (HTTP 200) y error genérico (network failure). Faltan tests para:
- Timeout scenarios (request hanging)
- Rate limiting (HTTP 429)
- Partial success en revalidateMany (algunos paths 200, otros 404/500)
- Auth failure (HTTP 403)
- Service down (HTTP 500+)

**Solución propuesta**: Agregar test cases para cada escenario usando mock de `fetch`.

**Recomendación**: fix_inline. Mejora robustez de tests.

---

### GAP-075: Publicaciones usan prerender=true en vez de ISR

> Auditoría #5 — 2026-03-16

- **Type**: design_decision
- **Severity**: low
- **Priority**: P4
- **Complexity**: 1
- **Area**: `apps/web/src/pages/[lang]/publicaciones/[slug].astro`

**Descripción**:
Las páginas de publicaciones (`/publicaciones/[slug].astro`) usan `export const prerender = true` (full SSG). Esto significa que no se benefician de ISR on-demand: si un post se edita, la web no se actualiza hasta el próximo full rebuild/deploy. Los service hooks de PostService llaman `scheduleRevalidation` pero el bypass token no tiene efecto sobre páginas pre-rendered (no cached por ISR).

**Solución propuesta**: Dos opciones:
1. **Migrar a ISR**: Remover `prerender = true` para que las publicaciones usen ISR como el resto de entidades. Las revalidation hooks de PostService ya están implementadas.
2. **Dejar como está**: Si las publicaciones no cambian frecuentemente y se prefiere build-time rendering por performance. Documentar la decisión.

**Recomendación**: design_decision. Consultar con product owner.

---

## Resumen Ejecutivo Auditoría #5

**Estado general**: La implementación de SPEC-034 tiene la infraestructura base correcta (DB, schemas, adapters, cron, admin UI, i18n, service hooks en 8 servicios). Sin embargo, hay **4 bugs de producción que hacen el sistema parcial o completamente inefectivo**:

1. **GAP-067 (NUEVO A5)**: Spanish locale paths sin prefijo `/es/` .. NINGUNA revalidación funciona para el locale default de Argentina
2. **GAP-006 (A1-A5)**: ISR exclude patterns excluyen detail pages del cache .. las páginas más importantes no se cachean
3. **GAP-043 (A4-A5)**: Cron no revalida detail pages .. solo listings genéricos
4. **GAP-066 (NUEVO A5)**: Reviews no revalidan parent detail page .. UX rota para el flujo de reviews

**Hallazgo crítico de A5**: GAP-067 (getLocalizedPath para Spanish) NO fue detectado en las 4 auditorías previas. Es un bug de 1 línea que causa que el 100% de las revalidaciones para el locale default (Spanish/Argentina) fallen silenciosamente. Combinado con GAP-006 (exclude patterns), el sistema ISR es actualmente **no funcional en producción**.

**Bloqueantes para producción** (5 gaps):
1. **GAP-067** (A5): getLocalizedPath genera paths sin /es/ prefix .. fix: 1 línea
2. **GAP-006** (A1-A5): ISR exclude patterns incorrectos .. fix: reemplazar 8 regex
3. **GAP-043** (A4-A5): revalidateByEntityType sin DB queries .. fix: implementar resolvers (depende de GAP-068)
4. **GAP-003** (A1-A5): POST /revalidate/entity ignora entityId .. fix: implementar entity lookup
5. **GAP-044** (A4-A5): writeLog entityType='unknown' .. fix: threading entityType through call chain

**Clasificación de TODOS los gaps activos por acción recomendada:**

| Acción | Gaps | Count |
|--------|------|-------|
| Fix inline (quick) | GAP-067, GAP-058, GAP-069, GAP-032, GAP-042, GAP-053, GAP-056 | 7 |
| Fix inline (medium) | GAP-006, GAP-044, GAP-047, GAP-066, GAP-070, GAP-045, GAP-046, GAP-050, GAP-051, GAP-060, GAP-065, GAP-071, GAP-072, GAP-073 | 14 |
| Fix inline (complex) | GAP-003, GAP-064, GAP-068, GAP-052, GAP-035 | 5 |
| Requiere new_spec | GAP-043 (DB resolvers para revalidateByEntityType) | 1 |
| Test gaps | GAP-025, GAP-030, GAP-031, GAP-034, GAP-059, GAP-062, GAP-074 | 7 |
| Design decisions | GAP-075 | 1 |
| Low priority / nice-to-have | GAP-027, GAP-054, GAP-055, GAP-057, GAP-061, GAP-063 | 6 |

**Resumen cuantitativo acumulado (A1+A2+A3+A4+A5):**
- Gaps totales identificados: 75
- Gaps resueltos (confirmados): 33
- **Gaps activos: 40** (incluye 2 adicionales resueltos en A5 sobre A4's 32)
  - Críticos (P1): 4 (GAP-003, GAP-006, GAP-043, GAP-064)
  - Altos (P2): 7 (GAP-044, GAP-045, GAP-046, GAP-047, GAP-066, GAP-067, GAP-070)
  - Medios (P3): 15 (GAP-035, GAP-048, GAP-050, GAP-051, GAP-052, GAP-059, GAP-060, GAP-065, GAP-068, GAP-071, GAP-072, GAP-073, GAP-074, GAP-049, GAP-041)
  - Bajos (P4): 14 (GAP-025, GAP-027, GAP-030, GAP-031, GAP-032, GAP-034, GAP-042, GAP-053, GAP-054, GAP-055, GAP-056, GAP-058, GAP-062, GAP-063, GAP-069, GAP-075)

**Decisión requerida**:
1. ¿Se corrigen los 5 bloqueantes de producción inline (GAP-067, GAP-006, GAP-043, GAP-003, GAP-044)?
2. ¿Se genera una SPEC formal "SPEC-034-Phase2 — ISR Production Readiness" para agrupar los 40 gaps activos?
3. ¿Se acepta que publicaciones (`/publicaciones/`) queden como SSG (GAP-075) o se migran a ISR?

---

## Auditoría #6 (2026-03-16 .. auditoría exhaustiva cross-layer con foco en contradicciones arquitecturales y completitud de hooks)

### Metodología A6

4 agentes especializados ejecutándose en paralelo:
1. **Spec-vs-Code Cross-Referencer**: Lectura completa de spec + contraste contra cada archivo de implementación en DB, service-core, API routes, cron, admin UI, schemas, seeds, permissions
2. **ISR Contradiction Analyzer**: Análisis profundo de la contradicción entre ISR exclude patterns en `astro.config.mjs`, paths generados por `entity-path-mapper.ts`, y rutas reales de Astro pages
3. **Service Hooks Matrix Verifier**: Verificación de hooks en los 8 servicios para las 6 operaciones CRUD (create, update, softDelete, hardDelete, restore, updateVisibility)
4. **Existing Gaps Reviewer**: Lectura completa del archivo de gaps (2765 líneas) para evitar duplicados

### Resultado de verificación de gaps A1-A5

**Los 40 gaps activos de A5 fueron RECONFIRMADOS.** No se encontró ningún gap previamente abierto que haya sido resuelto desde A5.

### Gaps NUEVOS encontrados en Auditoría #6

---

#### GAP-076 (HIGH, P2) — `_afterUpdateVisibility` hook NO implementado en NINGUNO de los 8 servicios [A6]

**Tipo**: missing_implementation
**Severidad**: HIGH (P2)
**Complejidad**: 2 (S)

**Descripción**: Cuando la visibilidad de una entidad cambia (published ↔ hidden/draft), NO se dispara revalidación ISR. Los 8 servicios (accommodation, destination, event, post, tag, amenity, accommodationReview, destinationReview) implementan hooks para create/update/softDelete/hardDelete/restore, pero **ninguno** implementa `_afterUpdateVisibility`.

**Impacto**: Si un admin cambia un alojamiento de "published" a "draft" (o viceversa), la página de detalle y los listings siguen mostrando el estado anterior hasta la próxima revalidación por cron (60-240 min según entity type). Esto es particularmente grave para:
- Publicar un nuevo alojamiento: el listing no se actualiza
- Ocultar contenido ofensivo: sigue visible en la web hasta el próximo cron cycle

**Evidencia**: Grep exhaustivo en los 8 archivos de servicio. `_afterUpdateVisibility` no aparece en ninguno. El base class `BaseCrudHooks` define el hook pero con implementación vacía (no-op).

**Solución propuesta**: Implementar `_afterUpdateVisibility` en los 8 servicios, con el mismo patrón fire-and-forget usado en `_afterUpdate`:
```typescript
protected async _afterUpdateVisibility(entity: TEntity, _actor: Actor): Promise<TEntity> {
    getRevalidationService()?.scheduleRevalidation({
        entityType: 'accommodation',
        slug: entity.slug,
        // ... context fields
    });
    return entity;
}
```

**Recomendación**: fix_inline .. es un patrón repetitivo idéntico al de `_afterUpdate` en cada servicio.

---

#### GAP-077 (MEDIUM, P3) — Soft/hard delete hooks pasan contexto reducido (pierden slug) [A6]

**Tipo**: incomplete_implementation
**Severidad**: MEDIUM (P3)
**Complejidad**: 2 (S)

**Descripción**: En la mayoría de servicios, los hooks `_afterSoftDelete` y `_afterHardDelete` pasan contexto mínimo a `scheduleRevalidation` (solo `entityType`), perdiendo el `slug` de la entidad eliminada. Esto significa que al eliminar una entidad, solo se revalidan los listings genéricos pero NO la página de detalle específica (que debería mostrar 404 o redirect).

**Impacto**: La página de detalle de una entidad eliminada sigue sirviendo contenido cacheado (ISR 24h) hasta que expire naturalmente o un cron la revalide. Para contenido ofensivo eliminado, esto es un problema serio.

**Evidencia**: Comparación de contexto pasado en hooks de accommodation service:
- `_afterCreate`: pasa `slug`, `destinationSlug`, `accommodationType` (completo)
- `_afterSoftDelete`: pasa solo `entityType` (mínimo)

**Solución propuesta**: Preservar el slug de la entidad antes de la eliminación (disponible en el parámetro `entity` del hook) y pasarlo a `scheduleRevalidation`:
```typescript
protected async _afterSoftDelete(entity: TEntity, _actor: Actor): Promise<TEntity> {
    getRevalidationService()?.scheduleRevalidation({
        entityType: 'accommodation',
        slug: entity.slug,           // <-- agregar
        destinationSlug: entity.destinationSlug,  // <-- agregar si aplica
    });
    return entity;
}
```

**Recomendación**: fix_inline .. el entity tiene todos los datos disponibles en el hook.

---

#### GAP-078 (MEDIUM, P3) — Error handling inconsistente en service hooks de revalidación [A6]

**Tipo**: code_quality
**Severidad**: MEDIUM (P3)
**Complejidad**: 2 (S)

**Descripción**: Solo `AccommodationService` tiene try-catch explícito alrededor de la resolución de destination slug antes de llamar `scheduleRevalidation`. Los otros 7 servicios (destination, event, post, tag, amenity, accommodationReview, destinationReview) llaman `scheduleRevalidation` sin try-catch. Si `getRevalidationService()` retorna un servicio cuyo `scheduleRevalidation` lanza una excepción inesperada, el hook `_afterCreate`/`_afterUpdate` propagaría el error, potencialmente bloqueando la operación CRUD principal.

**Impacto**: En la práctica, `scheduleRevalidation` está diseñado como fire-and-forget (no debería lanzar). Pero si hay un bug en el path mapper o en la config cache, una excepción no manejada podría causar que un `create` o `update` falle por un side-effect de revalidación.

**Evidencia**:
- `accommodation.service.ts`: tiene `try { ... } catch` en el bloque de destination slug resolution
- `destination.service.ts`, `event.service.ts`, `post.service.ts`, `tag.service.ts`, `amenity.service.ts`, `accommodationReview.service.ts`, `destinationReview.service.ts`: llamada directa sin try-catch

**Solución propuesta**: Envolver cada llamada a `scheduleRevalidation` en try-catch silencioso:
```typescript
try {
    getRevalidationService()?.scheduleRevalidation({ ... });
} catch (error) {
    logger.warn('Revalidation scheduling failed (non-blocking)', { error });
}
```

**Recomendación**: fix_inline .. patrón defensivo simple y repetitivo.

---

#### GAP-079 (HIGH, P2) — ISR exclude regex NO matchea rutas con prefijo de locale en/pt (en/pt detail pages se cachean incorrectamente) [A6]

**Tipo**: critical_bug
**Severidad**: HIGH (P2)
**Complejidad**: 1 (XS)

**Descripción**: Amplificación de GAP-006. Los regex de ISR exclude en `astro.config.mjs` solo matchean paths SIN prefijo de locale:
- `/^\/alojamientos\/(.*)\/?$/` matchea `/alojamientos/hotel-paradise/` pero NO `/en/alojamientos/hotel-paradise/`
- `/^\/eventos\/(.*)\/?$/` matchea `/eventos/festival/` pero NO `/pt/eventos/festival/`

**Impacto**: Las páginas de detalle en inglés (`/en/alojamientos/hotel-paradise/`) y portugués (`/pt/alojamientos/hotel-paradise/`) se cachean en ISR durante 24 horas, sirviendo potencialmente contenido stale. Solo las versiones en español se excluyen correctamente.

Combinado con GAP-067 (paths de revalidación para español van sin `/es/` prefix):
- **Spanish**: revalidation target `/alojamientos/hotel/` .. ISR exclude matchea (excluye del cache) .. revalidation es no-op (no hay nada que revalidar)
- **English**: revalidation target `/en/alojamientos/hotel/` .. ISR exclude NO matchea .. la página SE cachea 24h .. revalidation funciona pero el exclude debería haberla excluido

**Esto significa que el ISR caching está en un estado inconsistente**:
- ES: excluido del cache (correcto para SSR, pero entity-path-mapper intenta revalidar URLs inexistentes)
- EN/PT: cacheado 24h (incorrecto si la intención es SSR, o correcto si la intención es ISR-cached)

**Evidencia**: Lectura de `astro.config.mjs` líneas 73-76 + verificación de que las rutas de Astro pages usan siempre el patrón `[lang]/alojamientos/[slug].astro`.

**Solución propuesta**: Depende de la DECISIÓN ARQUITECTURAL (ver GAP-080):
- **Si detail pages deben ser SSR puro**: Corregir regex para incluir locale prefix: `/^\/[a-z]{2}\/alojamientos\/[^/]+\/$/`
- **Si detail pages deben ser ISR-cached**: Remover las líneas 73-74 del exclude, permitir caching en las 3 locales

**Recomendación**: Requiere decisión arquitectural primero (GAP-080).

---

#### GAP-080 (CRITICAL, P1) — Contradicción spec vs implementación: ¿detail pages son ISR-cached o SSR puro? [A6]

**Tipo**: design_decision
**Severidad**: CRITICAL (P1)
**Complejidad**: N/A (decisión, no código)

**Descripción**: Hay una contradicción FUNDAMENTAL entre la spec y la implementación actual:

**La spec dice** (sección 5.1, apps/web/CLAUDE.md):
> "ISR-cached pages (revalidated on entity changes):
> - `/alojamientos/` .. accommodation list, type filters (`/tipo/*`), and **detail pages**"

**La implementación dice** (`astro.config.mjs` línea 73):
```javascript
exclude: [/^\/alojamientos\/(.*)\/?$/]  // Excluye detail pages del ISR cache
```

**Esto significa que**:
- El entity-path-mapper genera paths de detalle para revalidación
- El adapter hace HTTP calls con el bypass token a esos paths
- Pero Vercel NUNCA los cachea porque están excluidos del ISR
- Todas las llamadas de revalidación a detail pages son completamente inútiles (wasted bandwidth + misleading logs)

**Impacto**: Depende de cuál es la intención correcta:

| Opción | Pros | Contras |
|--------|------|---------|
| **A. Detail pages = ISR-cached** (como dice la spec) | Faster page loads para visitantes recurrentes. Revalidación on-demand funcional. Menor carga en API. | Riesgo de contenido stale si revalidación falla. Más complejidad operacional. |
| **B. Detail pages = SSR puro** (como está implementado) | Siempre contenido fresco. Sin riesgo de stale content. Más simple operacionalmente. | Más lento (cada request = API call). Mayor carga en API. Entity-path-mapper genera paths inútiles. |

**Solución propuesta**:
- Si **Opción A**: Remover líneas 73-74 del ISR exclude. Los detail pages se cachean 24h y se revalidan on-demand cuando cambian.
- Si **Opción B**: Remover detail page paths del entity-path-mapper (no generar `/alojamientos/[slug]/`). Actualizar spec y CLAUDE.md para reflejar que solo listings se cachean.

**Recomendación**: Decisión arquitectural requerida del usuario. Mi recomendación técnica es **Opción A** (ISR-cached) porque:
1. Es lo que dice la spec
2. Los detail pages son los más visitados
3. El sistema de revalidación ya genera los paths correctos
4. SSR puro para detail pages desperdicia latencia en datos que cambian raramente

---

#### GAP-081 (MEDIUM, P3) — Listing pages con query params permitidos en ISR cache [A6]

**Tipo**: potential_bug
**Severidad**: MEDIUM (P3)
**Complejidad**: 1 (XS)

**Descripción**: Las páginas de listing (`/[lang]/alojamientos/`, `/[lang]/eventos/`) usan query parameters para filtros (q, sortBy, page, types, priceMin, etc.) y NO están excluidas del ISR cache. ISR de Vercel cachea por PATH sin considerar query params .. todas las variantes de query param sirven la misma página cacheada.

**Impacto**: En la práctica, estas páginas son SSR (server-rendered on every request) porque Astro las marca sin `prerender`, así que Vercel no las cachea de facto. Pero semánticamente, el ISR config las permite como cacheables, lo cual es incorrecto si alguna vez se habilita caché agresivo.

**Evidencia**: `alojamientos/index.astro` es SSR (sin prerender), usa query params para `Astro.url.searchParams`. ISR exclude no las menciona.

**Solución propuesta**: Agregar listings con query params al ISR exclude:
```javascript
/^\/[a-z]{2}\/alojamientos\/$/,    // listing principal
/^\/[a-z]{2}\/eventos\/$/,          // listing principal
```
O alternativamente, si la intención es que los listings SE cacheen (sin query params), dejar como está pero documentar que los query params se ignoran en ISR.

**Recomendación**: fix_inline o design_decision (documentar intención).

---

#### GAP-082 (LOW, P4) — Entity-path-mapper genera revalidation calls a páginas excluidas del ISR [A6]

**Tipo**: waste / optimization
**Severidad**: LOW (P4)
**Complejidad**: 2 (S)

**Descripción**: Consecuencia directa de GAP-080. Si la decisión es mantener detail pages como SSR puro (Opción B), entonces el entity-path-mapper genera paths para ~60% de las URLs que nunca se benefician de revalidación. Cada cambio a un accommodation genera ~12 paths (4 por locale x 3 locales), de los cuales solo ~4 (listings) son realmente ISR-cached. Las ~8 calls restantes (detail + type filter) son wasted.

**Impacto**: No es funcional (no causa bugs), pero:
- Logs de revalidación muestran "success" para paths que no están cacheados (misleading)
- ~66% de las HTTP calls del adapter son inútiles (waste de bandwidth)
- Stats en admin dashboard inflan el número de "successful revalidations"

**Solución propuesta**: Depende de GAP-080:
- Si **Opción A (ISR-cached)**: No aplica (todas las calls son útiles)
- Si **Opción B (SSR puro)**: Filtrar paths generados contra una lista de paths realmente ISR-cached, o remover detail paths del mapper

**Recomendación**: Resolver después de GAP-080.

---

#### GAP-083 (LOW, P4) — Review services pasan contexto mínimo (solo entityType, sin parent slug) [A6]

**Tipo**: incomplete_implementation
**Severidad**: LOW (P4) .. subsumido parcialmente por GAP-066 (HIGH)
**Complejidad**: 2 (S)

**Descripción**: Extensión de GAP-066 con mayor detalle. `AccommodationReviewService` y `DestinationReviewService` pasan `{ entityType: 'accommodation_review' }` sin `accommodationSlug` ni `accommodationId`. Esto significa que:
1. El entity-path-mapper recibe un event sin slug
2. Solo genera listing pages genéricas (`/alojamientos/`)
3. La detail page del alojamiento donde se agregó la review NO se revalida

**Evidencia**: Hooks `_afterCreate` en ambos review services pasan `{ entityType: 'accommodation_review' }` (o `destination_review`). El entity-path-mapper tiene un case para `accommodation_review` que necesita `accommodationSlug` para generar la detail page path.

**Solución propuesta**: Ya cubierta en GAP-066. Resolver parent slug desde el `entity.accommodationId` (o `destinationId`).

**Recomendación**: Subsumido por GAP-066. Cerrar como duplicado o mantener como nota de detalle.

---

#### GAP-084 (MEDIUM, P3) — Permissions de revalidación no seeded en role permissions [A6]

**Tipo**: missing_implementation (potential)
**Severidad**: MEDIUM (P3)
**Complejidad**: 1 (XS)

**Descripción**: Los 4 permisos de revalidación están definidos en `PermissionEnum` pero no se verificó si están seeded en `packages/seed/src/required/rolePermissions.seed.ts`. Si no están asignados a ningún rol, ningún usuario admin puede usar la funcionalidad de revalidación (todas las rutas retornan 403).

**Evidencia**: Los permisos `REVALIDATION_TRIGGER`, `REVALIDATION_CONFIG_VIEW`, `REVALIDATION_CONFIG_EDIT`, `REVALIDATION_LOG_VIEW` existen en el enum. Falta verificar si se asignan a roles ADMIN/SUPER_ADMIN en el seed.

**Solución propuesta**: Verificar `rolePermissions.seed.ts`. Si faltan, agregar los 4 permisos al rol SUPER_ADMIN y los 3 de lectura (VIEW + LOG_VIEW + TRIGGER) al rol ADMIN.

**Recomendación**: Verificar y fix_inline si falta.

---

#### GAP-085 (LOW, P4) — Cron page-revalidation job posiblemente no registrado en Vercel cron config [A6]

**Tipo**: deployment_gap
**Severidad**: LOW (P4)
**Complejidad**: 1 (XS)

**Descripción**: Extensión de GAP-073. El cron job `page-revalidation` existe en `apps/api/src/cron/jobs/` pero su presencia en `vercel.json` cron config no fue confirmada. Si el job depende de Vercel Cron triggers (en vez de un scheduler interno de Hono), no se ejecutará en producción.

**Evidencia**: El job está registrado en `apps/api/src/cron/registry.ts` y tiene schedule configurable via `HOSPEDA_REVALIDATION_CRON_SCHEDULE`. Pero la ejecución depende de cómo el cron system está montado (Vercel Cron vs middleware interno).

**Solución propuesta**: Verificar `apps/api/vercel.json` y confirmar que el endpoint del cron job está listado. Si no, agregar la entrada.

**Recomendación**: Subsumido por GAP-073. Verificar y cerrar o mantener.

---

### Resumen cuantitativo Auditoría #6

- Gaps de A1-A5 reconfirmados abiertos: **40** (todos siguen abiertos)
- Gaps nuevos A6: **10** (GAP-076 a GAP-085)
- **Total gaps activos: 46**
  - Note: GAP-083 subsumido por GAP-066, GAP-085 subsumido por GAP-073 .. conteo neto: **44 gaps activos únicos**

### Ranking de impacto actualizado (Top 12 fixes más críticos)

| # | Gap | Sev | Audit | Impacto | Effort |
|---|-----|-----|-------|---------|--------|
| 1 | GAP-080 | P1 | A6 | **DECISIÓN ARQUITECTURAL**: ¿detail pages ISR o SSR? Bloquea GAP-006, GAP-079, GAP-082 | 0 (decisión) |
| 2 | GAP-006 | P1 | A3 | ISR exclude patterns bloquean caching de TODAS las detail pages (si se decide ISR) | 30 min |
| 3 | GAP-067 | P2 | A5 | Paths de revalidación para Spanish apuntan a URLs inexistentes (100% de AR falla) | 5 min |
| 4 | GAP-043 | P1 | A4 | Cron job no revalida ninguna detail page (solo listings) | Requiere new_spec |
| 5 | GAP-076 | P2 | A6 | `_afterUpdateVisibility` missing: cambios de visibilidad no revalidan | 1 h |
| 6 | GAP-066 | P2 | A5 | Reviews no revalidan detail page del parent | 1 h |
| 7 | GAP-079 | P2 | A6 | EN/PT detail pages se cachean pero ES no (inconsistencia cross-locale) | 30 min |
| 8 | GAP-003 | P1 | A1 | POST /revalidate/entity ignora entityId | 2 h |
| 9 | GAP-044 | P2 | A4 | Audit logs siempre `entityType: 'unknown'` | 1 h |
| 10 | GAP-077 | P3 | A6 | Soft/hard delete pierden slug .. detail page no se revalida | 1 h |
| 11 | GAP-078 | P3 | A6 | Error handling inconsistente en hooks (puede bloquear CRUD) | 1 h |
| 12 | GAP-070 | P2 | A5 | Admin revalidation page sin route-level permission guard | 30 min |

### Clasificación actualizada de TODOS los gaps activos por acción recomendada

| Acción | Gaps | Count |
|--------|------|-------|
| **Decisión arquitectural** | GAP-080 (ISR vs SSR para detail pages) | 1 |
| **Fix inline (quick, <30 min)** | GAP-067, GAP-058, GAP-069, GAP-032, GAP-042, GAP-053, GAP-056, GAP-079 | 8 |
| **Fix inline (medium, 30min-2h)** | GAP-006, GAP-044, GAP-047, GAP-066, GAP-070, GAP-045, GAP-046, GAP-050, GAP-051, GAP-060, GAP-065, GAP-071, GAP-072, GAP-073, GAP-076, GAP-077, GAP-078 | 17 |
| **Fix inline (complex, >2h)** | GAP-003, GAP-064, GAP-068, GAP-052, GAP-035 | 5 |
| **Requiere new_spec** | GAP-043 (DB resolvers para revalidateByEntityType) | 1 |
| **Verificar primero** | GAP-084 (permissions seed), GAP-081 (listing ISR intent) | 2 |
| **Test gaps** | GAP-025, GAP-030, GAP-031, GAP-034, GAP-059, GAP-062, GAP-074 | 7 |
| **Depende de GAP-080** | GAP-082 (wasted calls si SSR) | 1 |
| **Design decisions** | GAP-075 (publicaciones SSG vs ISR) | 1 |
| **Low priority / nice-to-have** | GAP-027, GAP-054, GAP-055, GAP-057, GAP-061, GAP-063, GAP-083, GAP-085 | 8 |

### Resumen cuantitativo acumulado (A1+A2+A3+A4+A5+A6)

- Gaps totales identificados: **85**
- Gaps resueltos (confirmados): **33**
- Gaps subsumidos/duplicados: **2** (GAP-083 por GAP-066, GAP-085 por GAP-073)
- **Gaps activos: 44** (netos, sin duplicados)
  - Críticos (P1): **5** (GAP-003, GAP-006, GAP-043, GAP-064, GAP-080)
  - Altos (P2): **9** (GAP-044, GAP-045, GAP-046, GAP-047, GAP-066, GAP-067, GAP-070, GAP-076, GAP-079)
  - Medios (P3): **18** (GAP-035, GAP-041, GAP-048, GAP-049, GAP-050, GAP-051, GAP-052, GAP-059, GAP-060, GAP-065, GAP-068, GAP-071, GAP-072, GAP-073, GAP-074, GAP-077, GAP-078, GAP-081, GAP-084)
  - Bajos (P4): **12** (GAP-025, GAP-027, GAP-030, GAP-031, GAP-032, GAP-034, GAP-042, GAP-053, GAP-054, GAP-055, GAP-056, GAP-058, GAP-062, GAP-063, GAP-069, GAP-075, GAP-082)

### Production Readiness Assessment

**Estado actual**: ❌ NO PRODUCTION-READY

**Bloqueadores de producción** (5 gaps que DEBEN resolverse antes de deploy):
1. **GAP-080**: Decisión ISR vs SSR para detail pages (bloquea todo lo demás)
2. **GAP-067**: Spanish paths sin `/es/` prefix (100% de revalidaciones AR fallan)
3. **GAP-006**: ISR exclude regex incorrectos (caching inconsistente cross-locale)
4. **GAP-076**: `_afterUpdateVisibility` missing (cambios de visibilidad no revalidan)
5. **GAP-044**: Audit logs con `entityType: 'unknown'` (sistema ciego operacionalmente)

**Esfuerzo estimado para production-ready**:
- Decisiones arquitecturales: 1 sesión de review
- Quick fixes (8 gaps): ~2 horas
- Medium fixes (17 gaps): ~12-15 horas
- Complex fixes (5 gaps): ~8-10 horas
- Test gaps (7 gaps): ~6-8 horas
- **Total estimado: ~30-35 horas de engineering (3-5 días focused)**

### Decisiones requeridas (actualizadas)

1. **GAP-080 (NUEVA, BLOQUEANTE)**: ¿Detail pages (`/alojamientos/[slug]`, `/eventos/[slug]`, `/publicaciones/[slug]`) deben ser ISR-cached o SSR puro? Esto determina si GAP-006 se corrige "abriendo" el cache o "cerrando" las calls.
2. ¿Se corrigen los 5 bloqueantes de producción inline (GAP-067, GAP-006, GAP-043, GAP-003, GAP-044)?
3. ¿Se genera una SPEC formal "SPEC-034-Phase2 .. ISR Production Readiness" para agrupar los 44 gaps activos?
4. ¿Se acepta que publicaciones (`/publicaciones/`) queden como SSG (GAP-075) o se migran a ISR?
5. **GAP-081 (NUEVA)**: ¿Los listing pages (`/alojamientos/`, `/eventos/`) con query params deben excluirse del ISR?

---

### Auditoría #7 (2026-03-16 — auditoría exhaustiva multi-experto con 6 agentes especializados)

> **Auditor**: Multi-agente paralelo (6 agentes especializados: api-routes-auditor, service-layer-auditor, web-astro-auditor, admin-ui-auditor, service-hooks-tests-auditor, db-permissions-cron-auditor)
> **Metodología**: Cada agente leyó exhaustivamente TODOS los archivos de su capa, contrastando línea por línea contra los requerimientos del spec. Se priorizó descubrir gaps NUEVOS no identificados en las 6 auditorías previas (GAP-001 a GAP-075).
> **Cobertura**: 100% de archivos de implementación en todas las capas: API routes, service-core (RevalidationService, EntityPathMapper, adapters), web (Astro config, ISR, todas las páginas públicas), admin UI (página de revalidación, RevalidateEntityButton, hooks, HTTP adapter), service hooks (los 8 servicios x CRUD operations), tests (todos los test files), DB schemas, permissions, cron, env vars, i18n.

**Resultado**: Se encontraron **49 gaps nuevos** no identificados en auditorías previas, además de confirmar ~40 gaps abiertos de A1-A6. Los gaps nuevos incluyen problemas arquitecturales críticos (ISR exclude patterns sin prefijo de locale, adapter sin timeout/retry/batching, debounce key strategy incorrecta) y gaps funcionales significativos (stats tab ausente, logs tab sin filtros/paginación, RevalidateEntityButton sin integrar en páginas de entidades).

**Resumen cuantitativo Auditoría #7:**
- Gaps nuevos P1 (Críticos): 14
- Gaps nuevos P2 (Importantes): 17
- Gaps nuevos P3 (Moderados): 14
- Gaps nuevos P4 (Menores): 4
- **Total gaps nuevos: 49**
- Gaps existentes confirmados abiertos: ~40
- **Total gaps activos estimado: ~89**

---

## Gaps Nuevos — Auditoría #7

### P1 — Críticos (Bloquean funcionalidad correcta o seguridad)

---

#### GAP-076 — ISR exclude patterns sin prefijo de locale: nunca matchean rutas reales
- **Auditoría**: #7 (web-astro-auditor)
- **Severidad**: P1 (CRITICO — Seguridad + Funcionalidad)
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/web/astro.config.mjs` líneas 69-76
- **Descripción**: Todas las rutas del sitio tienen prefijo de locale (`/es/`, `/en/`, `/pt/`). Los patrones de exclusión ISR (`/^\/mi-cuenta(.*)$/`, `/^\/auth(.*)$/`, etc.) no incluyen el prefijo de locale, por lo que **nunca matchean ninguna ruta real**. Consecuencia doble: (1) páginas de auth/mi-cuenta NO se excluyen de ISR y podrían ser cacheadas por Vercel (riesgo de seguridad — respuestas autenticadas servidas a otros usuarios), (2) páginas de detalle de alojamientos/eventos que SÍ deberían ser ISR-cacheadas son correctamente NO excluidas, pero por la razón incorrecta.
- **Solución propuesta**: Cambiar todos los patrones a `/^\/[a-z]{2}\/mi-cuenta(\/.*)?$/`, `/^\/[a-z]{2}\/auth(\/.*)?$/`, etc. Remover los patrones que excluyen detail pages (alojamientos/eventos) que SÍ deben ser ISR.
- **Recomendación**: Fix directo inmediato (no requiere SPEC nueva). Es un bug de seguridad.

---

#### GAP-077 — Adapter interface viola RO-RO: revalidate y revalidateMany usan parámetros escalares
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P1
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/revalidation/adapters/revalidation.adapter.ts` líneas 57, 67
- **Descripción**: El spec define `revalidate(params: { readonly path: string })` y `revalidateMany(params: { readonly paths: ReadonlyArray<string> })`. La implementación usa `revalidate(path: string)` y `revalidateMany(paths: readonly string[])`. Viola el patrón RO-RO obligatorio del proyecto. Se propaga a VercelRevalidationAdapter y NoOpRevalidationAdapter.
- **Solución propuesta**: Cambiar firmas a RO-RO en interface + ambas implementaciones + todos los callers en RevalidationService.
- **Recomendación**: Fix directo (parte de la remediación de SPEC-034).

---

#### GAP-078 — Debounce key usa `path` en lugar de `entityType:entityId`
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P1
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/revalidation/revalidation.service.ts` líneas 153-167
- **Descripción**: El spec requiere debounce keyed por `entityType:entityId`. La implementación usa `path` como clave del mapa `pendingTimers`. Si una entidad tiene 15 paths afectados (3 locales x 5 páginas), se crean 15 timers independientes en lugar de 1. Además, sin `entityId` en el `EntityChangeEvent`, es imposible implementar correctamente este debounce.
- **Solución propuesta**: Cambiar la firma de `scheduleRevalidation` para recibir `EntityChangeEvent` (con `entityId` y `operation`), usar `${entityType}:${entityId}` como clave del mapa de debounce.
- **Recomendación**: Fix directo (parte de la remediación de SPEC-034).

---

#### GAP-079 — `writeLog` hardcodea `entityType: 'unknown'`, nunca loguea entityId
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P1
- **Complejidad**: S (< 4h)
- **Archivo**: `packages/service-core/src/revalidation/revalidation.service.ts` líneas 120, 185
- **Descripción**: Ambas llamadas a `writeLog` pasan `entityType: 'unknown'` literalmente. En `debouncePath` (línea 185), el closure tiene acceso al `event` original con el entityType real pero no lo usa. `entityId` nunca se loguea. El audit trail es inútil para diagnósticos.
- **Solución propuesta**: Pasar `entityType` y `entityId` del evento original a `writeLog`. Requiere resolver GAP-078 primero (necesita `entityId` en el evento).
- **Recomendación**: Fix directo junto con GAP-078.

---

#### GAP-080 — `revalidateByEntityType` viola RO-RO y retorna void en lugar de resultados
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P1
- **Complejidad**: S (< 4h)
- **Archivo**: `packages/service-core/src/revalidation/revalidation.service.ts` líneas 85-88
- **Descripción**: El spec define `revalidateByEntityType(params: { readonly entityType: string }): Promise<ReadonlyArray<RevalidationResult>>`. La implementación usa `revalidateByEntityType(entityType): Promise<void>`. Dos violaciones: parámetro escalar (no RO-RO) y retorna void (el cron job no puede obtener resultados para logging).
- **Solución propuesta**: Cambiar firma a RO-RO + retornar resultados de revalidación.
- **Recomendación**: Fix directo (parte de la remediación de SPEC-034).

---

#### GAP-081 — Cron job `page-revalidation` NO registrado en vercel.json
- **Auditoría**: #7 (db-permissions-cron-auditor)
- **Severidad**: P1 (CRITICO — funcionalidad rota en producción)
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/api/vercel.json` (ausencia en array `crons`)
- **Descripción**: Los 6 otros cron jobs están registrados en vercel.json (trial-expiry, addon-expiry, notification-schedule, webhook-retry, exchange-rate-fetch, dunning). El job `page-revalidation` está ausente. Con `HOSPEDA_CRON_ADAPTER=vercel` (producción), el job **nunca se ejecuta**: no hay revalidación periódica, no hay detección de stale, no hay cleanup de logs.
- **Solución propuesta**: Agregar `{ "path": "/api/v1/cron/page-revalidation", "schedule": "0 * * * *" }` al array `crons` de vercel.json.
- **Recomendación**: Fix directo inmediato. Bloqueante para producción.

---

#### GAP-082 — AccommodationReviewService: hooks no pasan `accommodationSlug`
- **Auditoría**: #7 (service-hooks-tests-auditor)
- **Severidad**: P1
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts`
- **Descripción**: Los 5 hooks CRUD (`_afterCreate`, `_afterUpdate`, `_afterSoftDelete`, `_afterRestore`, `_afterHardDelete`) llaman `scheduleRevalidation({ entityType: 'accommodation_review' })` sin `accommodationSlug`. El path mapper para `accommodation_review` necesita `accommodationSlug` para generar `/alojamientos/{slug}/`. Sin él, solo genera la página de listing. La página de detalle del alojamiento cuya rating cambió NO se revalida.
- **Solución propuesta**: En cada hook, resolver el slug del alojamiento padre via `accommodationId` → lookup en DB → obtener `slug`. Pasar como `{ entityType: 'accommodation_review', accommodationSlug }`.
- **Recomendación**: Fix directo (parte de la remediación de SPEC-034).

---

#### GAP-083 — DestinationReviewService: hooks no pasan `destinationSlug` — CERO revalidaciones
- **Auditoría**: #7 (service-hooks-tests-auditor)
- **Severidad**: P1
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/services/destinationReview/destinationReview.service.ts`
- **Descripción**: Misma falla que GAP-082 pero MÁS GRAVE. El path mapper para `destination_review` con `destinationSlug: undefined` retorna **array vacío** (verificado por tests: `'returns empty when destinationSlug not provided'`). Esto significa que **NINGUNA página se revalida** en ningún evento de lifecycle de destination_review. El revalidador es efectivamente no-op para reviews de destinos.
- **Solución propuesta**: Igual que GAP-082: resolver slug del destino padre en cada hook.
- **Recomendación**: Fix directo inmediato. Funcionalidad completamente rota.

---

#### GAP-084 — auth/forgot-password.astro usa `prerender = true` en contexto SSR
- **Auditoría**: #7 (web-astro-auditor)
- **Severidad**: P1
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/web/src/pages/[lang]/auth/forgot-password.astro` línea 2
- **Descripción**: Con `output: 'server'`, `prerender = true` genera HTML estático en build time. Si la página auth depende de datos dinámicos (tokens, mensajes de error, redirección), el HTML estático no los reflejará. Combinado con GAP-076 (auth pages no excluidas de ISR), esta página podría ser cacheada indefinidamente.
- **Solución propuesta**: Remover `prerender = true`. Las páginas de auth deben ser siempre SSR.
- **Recomendación**: Fix directo.

---

#### GAP-085 — Admin: Stats tab completamente ausente
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P1
- **Complejidad**: M (4-8h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/index.tsx`
- **Descripción**: El spec requiere un tab dedicado "Stats" con métricas agregadas: success rate, avg duration, breakdown por entity type, breakdown por trigger. No existe como tab. Solo hay 3 StatCards embebidas dentro del Manual tab sin breakdowns.
- **Solución propuesta**: Crear tab "Stats" con visualización de métricas completas incluyendo breakdowns por entity type y trigger.
- **Recomendación**: Fix directo (parte de la remediación de SPEC-034).

---

#### GAP-086 — Admin: Logs tab sin filtros, sin paginación, sin sorting, sin auto-refresh
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P1
- **Complejidad**: L (1-2d)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/index.tsx` + `apps/admin/src/lib/revalidation-http-adapter/index.ts`
- **Descripción**: El spec requiere filtros (entityType, trigger, status, path, dateFrom, dateTo), paginación, sorting y auto-refresh. La implementación actual llama `getRevalidationLogs()` sin ningún parámetro. No hay UI de filtros, no hay paginación, no hay controles de sort, no hay `refetchInterval`. El HTTP adapter tampoco acepta parámetros.
- **Solución propuesta**: (1) Agregar parámetros de filtro/paginación al HTTP adapter, (2) crear componentes de filtro, (3) integrar paginación y sorting con TanStack Table, (4) agregar `refetchInterval: 30000`.
- **Recomendación**: Fix directo (parte de la remediación de SPEC-034).

---

#### GAP-087 — Admin: Manual tab sin modo entity-type revalidation
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P1
- **Complejidad**: M (4-8h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/index.tsx`
- **Descripción**: El spec requiere DOS modos en el manual tab: (1) path-based (implementado) y (2) entity-type revalidation con selector de tipo (NO implementado). Falta un selector de entity type + botón para revalidar todas las páginas de ese tipo en batch.
- **Solución propuesta**: Agregar sección con `<Select>` de entity types + botón "Revalidar todo" con confirmation dialog.
- **Recomendación**: Fix directo.

---

#### GAP-088 — Admin: Ruta /revalidation sin beforeLoad permission guard
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P1
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/index.tsx` líneas 41-43
- **Descripción**: La ruta `createFileRoute('/_authed/revalidation/')` no tiene `beforeLoad` con verificación de `REVALIDATION_CONFIG_VIEW`. Cualquier usuario con `ACCESS_PANEL_ADMIN` puede ver la página completa de revalidación. El sidebar sí verifica permisos para mostrar el link, pero la ruta no lo hace.
- **Solución propuesta**: Agregar `beforeLoad` con check de `REVALIDATION_CONFIG_VIEW` similar a otras rutas protegidas del admin.
- **Recomendación**: Fix directo.

---

#### GAP-089 — RevalidateEntityButton sin integrar en NINGUNA página de entidades
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P1
- **Complejidad**: M (4-8h)
- **Archivo**: Múltiples archivos de rutas de entidades en `apps/admin/src/routes/_authed/`
- **Descripción**: El spec requiere que el botón "Regenerar página" aparezca en las páginas de detail/edit de accommodation, destination, event y post. Ninguna de las 8 rutas relevantes lo importa o usa. El componente existe pero está huérfano.
- **Solución propuesta**: Importar e integrar `RevalidateEntityButton` en las 8 rutas de detail/edit de las 4 entidades.
- **Recomendación**: Fix directo.

---

### P2 — Importantes (Degradan funcionalidad o calidad)

---

#### GAP-090 — VercelAdapter: sin timeout 10s, sin retry x3 con backoff, sin batching chunks de 10
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P2
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/revalidation/adapters/vercel-revalidation.adapter.ts`
- **Descripción**: El spec requiere: (1) fetch con 10s timeout via AbortController, (2) 3 retries con exponential backoff, (3) revalidateMany en chunks de 10 con 100ms delay entre chunks. La implementación actual: (1) no tiene timeout, (2) no tiene retry, (3) usa `Promise.allSettled` paralelo sin chunking.
- **Solución propuesta**: Implementar AbortController con signal timeout, retry loop con backoff, y chunking en revalidateMany.
- **Recomendación**: Fix directo.

---

#### GAP-091 — Debounce default 5s vs spec 30s
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P2
- **Complejidad**: XS (< 1h)
- **Archivo**: `packages/service-core/src/revalidation/revalidation.service.ts` línea 54
- **Descripción**: `this.debounceMs = config.debounceMs ?? 5000` vs spec `config.debounceMs ?? 30000`. Sin config en DB, el debounce es 6x más agresivo.
- **Solución propuesta**: Cambiar `5000` a `30000`.
- **Recomendación**: Fix directo.

---

#### GAP-092 — `scheduleRevalidation` recibe `EntityChangeData` en lugar de `EntityChangeEvent`
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P2
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/revalidation/revalidation.service.ts` línea 74
- **Descripción**: El spec define `EntityChangeEvent` como wrapper: `{ entityId, operation, data: EntityChangeData }`. La implementación recibe `EntityChangeData` directamente sin `entityId` ni `operation`. Es la causa raíz de GAP-078 y GAP-079.
- **Solución propuesta**: Definir `EntityChangeEvent` interface, cambiar firma de `scheduleRevalidation`.
- **Recomendación**: Fix directo junto con GAP-078/GAP-079.

---

#### GAP-093 — `EntityChangeData` diverge semánticamente del spec
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P2
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/revalidation/entity-path-mapper.ts` líneas 55-155
- **Descripción**: Múltiples divergencias: (1) accommodation usa `destinationSlug` en lugar de `destinationPath` jerárquico, (2) no hay campo `isFeatured` en ningún tipo, (3) tag/amenity no tienen `accommodationSlugs`/`destinationPaths` para revalidar páginas individuales, (4) destination no tiene `path` jerárquico, (5) destination_review usa `destinationSlug` en lugar de `destinationPath`.
- **Solución propuesta**: Alinear tipos con el spec. Evaluar impacto en todos los service hooks que pasan datos.
- **Recomendación**: SPEC formal nueva recomendada para evaluar si `isFeatured` y path jerárquico son necesarios o si el spec es demasiado ambicioso.

---

#### GAP-094 — `destinos/index.astro` usa `prerender=true` (SSG puro, no ISR)
- **Auditoría**: #7 (web-astro-auditor)
- **Severidad**: P2
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/web/src/pages/[lang]/destinos/index.astro` línea 2
- **Descripción**: Página de listado de destinos es SSG puro. Nuevos destinos no se reflejan hasta el próximo deploy. El spec requiere ISR.
- **Solución propuesta**: Remover `prerender = true` y `getStaticPaths`, agregar `Astro.revalidate` con TTL apropiado.
- **Recomendación**: Fix directo.

---

#### GAP-095 — `Astro.revalidate` no usado en NINGUNA página
- **Auditoría**: #7 (web-astro-auditor)
- **Severidad**: P2
- **Complejidad**: S (< 4h)
- **Archivo**: Todo `apps/web/src/pages/`
- **Descripción**: El spec requiere per-route revalidation intervals via `Astro.revalidate`. Cero usos en todo el codebase. Todas las páginas ISR usan el mismo TTL de 24h sin granularidad.
- **Solución propuesta**: Agregar `Astro.revalidate` en cada página ISR con TTL apropiado al tipo de contenido (ej: eventos = 3600s, posts = 86400s).
- **Recomendación**: Fix directo.

---

#### GAP-096 — `eventos/index.astro` cacheada 24h con contenido time-sensitive
- **Auditoría**: #7 (web-astro-auditor)
- **Severidad**: P2
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/web/src/pages/[lang]/eventos/index.astro`
- **Descripción**: Acepta `?timeframe=upcoming|past`. Con ISR global de 24h, eventos "próximos" que ya pasaron permanecen visibles como tales hasta 24h.
- **Solución propuesta**: Usar `Astro.revalidate` con TTL corto (3600s = 1h) para esta página.
- **Recomendación**: Fix directo (parte de GAP-095).

---

#### GAP-097 — Admin: sin confirmation dialog para batch operations
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P2
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/components/revalidation-shared.tsx` líneas 197-211
- **Descripción**: El spec requiere confirmación para operaciones batch. El submit llama directamente `mutation.mutate()` sin confirmación, incluso cuando `parsedCount` podría ser decenas de paths.
- **Solución propuesta**: Agregar `AlertDialog` antes de ejecutar revalidaciones con más de N paths.
- **Recomendación**: Fix directo.

---

#### GAP-098 — RevalidateEntityButton: sin permission check REVALIDATION_TRIGGER
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P2
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/admin/src/components/RevalidateEntityButton.tsx`
- **Descripción**: El componente no importa ni usa `PermissionEnum`, `useAuth`, ni ningún hook de permisos. Se renderiza para cualquier usuario autenticado.
- **Solución propuesta**: Agregar hook de permisos, renderizar condicionalmente según `REVALIDATION_TRIGGER`.
- **Recomendación**: Fix directo.

---

#### GAP-099 — RevalidateEntityButton: hardcoded strings sin i18n
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P2
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/admin/src/components/RevalidateEntityButton.tsx` líneas 44, 51, 57, 71
- **Descripción**: Strings "Revalidar", "Páginas revalidadas correctamente", "Error al revalidar las páginas", "Revalidando..." hardcodeados en español.
- **Solución propuesta**: Usar `useTranslations()` con claves de `@repo/i18n`.
- **Recomendación**: Fix directo.

---

#### GAP-100 — Admin: accesibilidad — sin aria-labels en Switches, InlineNumberField, sin aria-live
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P2
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/index.tsx` + `revalidation-shared.tsx`
- **Descripción**: (1) `<Switch>` del ConfigTab sin `aria-label` — screen readers no distinguen entre entity types, (2) `InlineNumberField` sin `aria-label` contextual, (3) no hay `aria-live` region para anuncios de estado de mutaciones.
- **Solución propuesta**: Agregar `aria-label={t('revalidation.config.enabledFor', { entity: config.entityType })}` etc.
- **Recomendación**: Fix directo.

---

#### GAP-101 — Admin: sin error boundary en página de revalidación
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P2
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/index.tsx`
- **Descripción**: No usa `EntityErrorBoundary` ni `QueryErrorBoundary` que existen en `apps/admin/src/lib/error-boundaries/`. Un error en un tab puede crashear toda la página.
- **Solución propuesta**: Envolver cada `<TabsContent>` con un error boundary.
- **Recomendación**: Fix directo.

---

#### GAP-102 — Tests: service-hooks.test.ts cubre solo 4 de 8 servicios
- **Auditoría**: #7 (service-hooks-tests-auditor)
- **Severidad**: P2
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/test/revalidation/service-hooks.test.ts`
- **Descripción**: Solo cubre Accommodation, Destination, Event, Tag. Falta Post (comportamiento diferente con tagSlugs), Amenity, AccommodationReview (necesita probar que pasa accommodationSlug), DestinationReview (necesita probar que pasa destinationSlug). Estos tests habrían detectado GAP-082/GAP-083.
- **Solución propuesta**: Agregar tests para los 4 servicios faltantes con aserciones específicas de los campos únicos.
- **Recomendación**: Fix directo.

---

#### GAP-103 — Tests: API route tests sin aserciones hard de 401/403
- **Auditoría**: #7 (service-hooks-tests-auditor)
- **Severidad**: P2
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/api/test/routes/revalidation.test.ts`
- **Descripción**: Todos los tests envuelven aserciones en `try/catch` y aceptan 401/403 como válidos: `expect([400, 401, 403]).toContain(res.status)`. No hay test que envíe request sin token y aserte `expect(res.status).toBe(401)` específicamente. Un bug en auth que retorne 200 pasaría el test.
- **Solución propuesta**: Agregar tests dedicados: (1) sin token → 401, (2) token sin permiso → 403, (3) token con permiso → 200.
- **Recomendación**: Fix directo.

---

#### GAP-104 — Tests: sin tests para componentes/hooks de admin revalidation
- **Auditoría**: #7 (service-hooks-tests-auditor)
- **Severidad**: P2
- **Complejidad**: M (4-8h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/` y `apps/admin/src/hooks/useRevalidation.ts`
- **Descripción**: No existe ningún `*.test.tsx` o `*.test.ts` para los componentes de revalidation, la ruta, el hook, ni el HTTP adapter.
- **Solución propuesta**: Crear tests unitarios para `useRevalidation.ts`, `RevalidateEntityButton`, y el HTTP adapter.
- **Recomendación**: Fix directo.

---

#### GAP-105 — Tests: sin test E2E para flujo de manual revalidation
- **Auditoría**: #7 (service-hooks-tests-auditor)
- **Severidad**: P2
- **Complejidad**: L (1-2d)
- **Archivo**: Ausencia total
- **Descripción**: La spec requiere un test E2E Playwright para el flujo completo de manual revalidation desde el admin.
- **Solución propuesta**: Crear test E2E que: login admin → navegar a /revalidation → ingresar paths → submit → verificar toast de éxito → verificar entrada en logs.
- **Recomendación**: Postergar para SPEC dedicada de testing E2E.

---

#### GAP-106 — RevalidateEntityButton: sin prop className
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P2
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/admin/src/components/RevalidateEntityButton.tsx`
- **Descripción**: El tipo `RevalidateEntityButtonProps` no incluye `className`. El componente no puede ser posicionado o estilado desde el sitio de uso.
- **Solución propuesta**: Agregar `readonly className?: string` al tipo y `className={cn('...', className)}` al Button.
- **Recomendación**: Fix directo.

---

### P3 — Moderados (Divergencias de arquitectura o calidad)

---

#### GAP-107 — ManualRevalidateRequestSchema no valida formato de paths (leading slash)
- **Auditoría**: #7 (api-routes-auditor)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `packages/schemas/src/entities/revalidation/revalidation.http.schema.ts` línea 12
- **Descripción**: El schema valida `z.string().min(1)` pero no valida formato. Paths sin leading slash, URLs externas, paths con `../` son todos aceptados.
- **Solución propuesta**: Cambiar a `z.string().min(1).startsWith('/')` o regex más estricto.
- **Recomendación**: Fix directo.

---

#### GAP-108 — GET /health requiere auth admin, spec dice "no auth"
- **Auditoría**: #7 (api-routes-auditor)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/api/src/routes/revalidation/index.ts` línea 367
- **Descripción**: El spec dice `GET /health - no auth`. La implementación usa `createAdminRoute()` con auth completo. Herramientas de monitoreo externo no pueden llamar al endpoint.
- **Solución propuesta**: Evaluar si health check debe ser público. Si sí, cambiar a `createPublicRoute()`.
- **Recomendación**: Consultar con el equipo — depende de la estrategia de monitoreo.

---

#### GAP-109 — GET /logs: filtro `path` ausente en schema, naming `fromDate`/`toDate` vs spec `dateFrom`/`dateTo`
- **Auditoría**: #7 (api-routes-auditor)
- **Severidad**: P3
- **Complejidad**: S (< 4h)
- **Archivo**: `packages/schemas/src/entities/revalidation/revalidation-log.query.schema.ts`
- **Descripción**: (1) El filtro `path` no existe en el schema ni en el handler. (2) Los campos de fecha usan `fromDate`/`toDate` (implementación) vs `dateFrom`/`dateTo` (spec). Rompe la interfaz documentada.
- **Solución propuesta**: Agregar `path: z.string().optional()` al schema. Evaluar renombrar a `dateFrom`/`dateTo` para alinear con spec.
- **Recomendación**: Fix directo.

---

#### GAP-110 — Sin rate limiting específico en endpoints POST de revalidación
- **Auditoría**: #7 (api-routes-auditor)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/api/src/routes/revalidation/index.ts`
- **Descripción**: Los 3 endpoints POST no tienen `customRateLimit`. Un admin o token comprometido podría saturar Vercel ISR con miles de requests de bypass. `/revalidate/type` es especialmente riesgoso.
- **Solución propuesta**: Agregar `customRateLimit: { requests: 10, windowMs: 60000 }` a los 3 endpoints POST.
- **Recomendación**: Fix directo.

---

#### GAP-111 — RevalidationService no expone métodos admin (getConfig, getLogs, getStats, getHealth)
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P3
- **Complejidad**: M (4-8h)
- **Archivo**: `packages/service-core/src/revalidation/revalidation.service.ts`
- **Descripción**: Solo implementa `scheduleRevalidation`, `revalidateByEntityType`, `revalidatePaths`. Los métodos admin que las rutas API necesitan consumir no están en el service.
- **Solución propuesta**: Evaluar si los métodos admin deben estar en RevalidationService o si las rutas pueden acceder directamente a los models (pattern actual).
- **Recomendación**: Evaluar — el pattern actual funciona pero diverge del spec.

---

#### GAP-112 — entity-path-mapper no genera `/{lang}/destinos/{path}/alojamientos/` para accommodations
- **Auditoría**: #7 (service-layer-auditor)
- **Severidad**: P3
- **Complejidad**: S (< 4h)
- **Archivo**: `packages/service-core/src/revalidation/entity-path-mapper.ts` líneas 194-225
- **Descripción**: El spec requiere que un cambio de accommodation también revalide la página de listado de alojamientos dentro del destination (`/destinos/{destPath}/alojamientos/`). La implementación genera `/destinos/{destinationSlug}/` pero no `/destinos/{destinationSlug}/alojamientos/`.
- **Solución propuesta**: Agregar path adicional en el mapper para accommodations con destinationSlug.
- **Recomendación**: Fix directo.

---

#### GAP-113 — Cron job usa `process.env` directo en vez de objeto `env` tipado
- **Auditoría**: #7 (db-permissions-cron-auditor)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/api/src/cron/jobs/page-revalidation.job.ts` línea 39
- **Descripción**: Usa `process.env.HOSPEDA_REVALIDATION_CRON_SCHEDULE ?? '0 * * * *'` en lugar de `env.HOSPEDA_REVALIDATION_CRON_SCHEDULE`. Saltea la validación Zod.
- **Solución propuesta**: Usar el objeto `env` tipado de `src/utils/env.ts`.
- **Recomendación**: Fix directo.

---

#### GAP-114 — HOSPEDA_REVALIDATION_SECRET optional en schemas sin warning en producción
- **Auditoría**: #7 (db-permissions-cron-auditor + web-astro-auditor)
- **Severidad**: P3
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/api/src/utils/env.ts` línea 274 + `apps/web/src/env.ts` línea 22
- **Descripción**: `z.string().min(32).optional()` en ambos schemas. Si no configurada en producción, el sistema usa NoOpAdapter silenciosamente. No hay warning visible. El spec menciona este riesgo pero no se implementó validación.
- **Solución propuesta**: Agregar warning en logger durante startup si NODE_ENV=production y la variable está ausente. O hacerla required en producción con `z.string().min(32)` condicional.
- **Recomendación**: Fix directo.

---

#### GAP-115 — Admin: hooks exportados (useRevalidationConfigs, etc.) no usados en index.tsx
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/admin/src/routes/_authed/revalidation/index.tsx` + `apps/admin/src/hooks/useRevalidation.ts`
- **Descripción**: `useRevalidation.ts` exporta hooks reutilizables pero `index.tsx` usa `useQuery` inline. Los hooks exportados son huérfanos.
- **Solución propuesta**: Refactorizar `index.tsx` para usar los hooks exportados.
- **Recomendación**: Fix directo.

---

#### GAP-116 — Admin: RevalidateEntityButton no usa hook exportado useRevalidateEntity
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/admin/src/components/RevalidateEntityButton.tsx`
- **Descripción**: Usa `useMutation` inline en lugar del hook `useRevalidateEntity` de `useRevalidation.ts`. El hook tiene `onSuccess` con invalidación de logs query, el componente no.
- **Solución propuesta**: Refactorizar para usar el hook exportado.
- **Recomendación**: Fix directo.

---

#### GAP-117 — Admin logs: HTTP adapter getRevalidationLogs sin parámetros de filtro
- **Auditoría**: #7 (admin-ui-auditor)
- **Severidad**: P3
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/admin/src/lib/revalidation-http-adapter/index.ts`
- **Descripción**: `getRevalidationLogs()` no acepta parámetros. Incluso si se agregaran filtros en la UI, el adapter no puede enviarlos al API.
- **Solución propuesta**: Agregar parámetros de filtro, paginación y sorting al adapter. Prerequisito de GAP-086.
- **Recomendación**: Fix directo.

---

#### GAP-118 — vercel.json sin Cache-Control para assets estáticos
- **Auditoría**: #7 (web-astro-auditor)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/web/vercel.json`
- **Descripción**: No define headers `Cache-Control` para `/_astro/*` (assets estáticos hasheados). Oportunidad perdida de optimización.
- **Solución propuesta**: Agregar `Cache-Control: public, max-age=31536000, immutable` para `/_astro/*`.
- **Recomendación**: Fix directo.

---

#### GAP-119 — CLAUDE.md documenta env var con nombre incorrecto (HOSPEDA_ISR_BYPASS_TOKEN)
- **Auditoría**: #7 (db-permissions-cron-auditor — confirma GAP-058 sigue abierto)
- **Severidad**: P3
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/web/CLAUDE.md` + JSDoc en `packages/service-core/src/revalidation/`
- **Descripción**: Documentación usa `HOSPEDA_ISR_BYPASS_TOKEN`, código real usa `HOSPEDA_REVALIDATION_SECRET`. Confirmación de que GAP-058 sigue sin resolver + JSDoc en 4 archivos de service-core también usan el nombre viejo.
- **Solución propuesta**: Actualizar CLAUDE.md y todos los JSDoc que referencian el nombre viejo.
- **Recomendación**: Fix directo.

---

#### GAP-120 — Tests: VercelAdapter sin tests de timeout, retry, rate-limiting (429)
- **Auditoría**: #7 (service-hooks-tests-auditor)
- **Severidad**: P3
- **Complejidad**: S (< 4h)
- **Archivo**: `packages/service-core/test/revalidation/adapters.test.ts`
- **Descripción**: Tests cubren success y failure pero no timeout (AbortSignal), retry logic, ni respuesta 429 del rate limiting de Vercel.
- **Solución propuesta**: Agregar tests para timeout, retry, y 429 una vez que la implementación de GAP-090 esté completa.
- **Recomendación**: Fix directo después de GAP-090.

---

### P4 — Menores (Polish, docs, edge cases)

---

#### GAP-121 — POST de revalidación retorna 201 Created en vez de 200 OK
- **Auditoría**: #7 (api-routes-auditor)
- **Severidad**: P4
- **Complejidad**: S (< 4h)
- **Archivo**: `apps/api/src/utils/route-factory.ts` línea 402
- **Descripción**: La factory hardcodea `statusCode: 201` para todos los POST. Los endpoints de revalidación son acciones (triggers), no creación de recursos. Semánticamente deberían retornar 200.
- **Solución propuesta**: Agregar opción `successStatus` a la factory o override específico en los routes de revalidación.
- **Recomendación**: Postergar — funciona correctamente, solo semántica HTTP.

---

#### GAP-122 — PATCH /config/:id mezcla c.json() y throw para error handling
- **Auditoría**: #7 (api-routes-auditor)
- **Severidad**: P4
- **Complejidad**: XS (< 1h)
- **Archivo**: `apps/api/src/routes/revalidation/index.ts` líneas 282-289
- **Descripción**: Primer check "not found" usa `return c.json(...)`, segundo check post-update usa `throw new Error(...)`. Inconsistencia de error handling.
- **Solución propuesta**: Unificar usando `ResponseFactory.error()` consistente.
- **Recomendación**: Fix directo (parte de GAP-031).

---

#### GAP-123 — Rol EDITOR sin permisos de revalidación
- **Auditoría**: #7 (db-permissions-cron-auditor)
- **Severidad**: P4
- **Complejidad**: XS (< 1h)
- **Archivo**: `packages/seed/src/required/rolePermissions.seed.ts`
- **Descripción**: EDITOR no tiene REVALIDATION_TRIGGER. Un editor que publica contenido no puede forzar revalidación manual. Posible omisión intencional.
- **Solución propuesta**: Evaluar si EDITOR debería tener REVALIDATION_TRIGGER. Consultar con PO.
- **Recomendación**: Consultar — puede ser intencional.

---

#### GAP-124 — i18n: variables `succeededSuffix`/`failedSuffix` solo en locale ES
- **Auditoría**: #7 (db-permissions-cron-auditor)
- **Severidad**: P4
- **Complejidad**: XS (< 1h)
- **Archivo**: `packages/i18n/src/locales/es/revalidation.json` vs `en/revalidation.json`
- **Descripción**: Locale ES usa variables de interpolación para pluralización del adjetivo que EN no usa. Si el componente pasa o no esas variables, uno de los dos locales puede mostrar texto incorrecto.
- **Solución propuesta**: Verificar el componente que renderiza el toast y alinear las variables.
- **Recomendación**: Fix directo.

---

## Resumen Consolidado — Estado Total Post-Auditoría #7

### Métricas

| Categoría | Cantidad |
|-----------|----------|
| Gaps totales identificados (A1-A7) | ~124 |
| Gaps resueltos (A1-A6) | ~35 |
| Gaps activos confirmados (A1-A6) | ~40 |
| **Gaps nuevos A7** | **49** |
| **Total gaps activos estimado** | **~89** |

### Distribución por severidad (solo gaps activos)

| Severidad | A1-A6 activos | A7 nuevos | Total activo |
|-----------|--------------|-----------|-------------|
| P1 (Crítico) | 5 | 14 | ~19 |
| P2 (Importante) | 12 | 17 | ~29 |
| P3 (Moderado) | 15 | 14 | ~29 |
| P4 (Menor) | 8 | 4 | ~12 |
| **Total** | **~40** | **49** | **~89** |

### Top 10 Gaps Más Críticos para Producción

| # | GAP | Descripción | Impacto |
|---|-----|-------------|---------|
| 1 | GAP-076 | ISR exclude sin locale prefix — auth pages cacheables (SEGURIDAD) | Respuestas autenticadas servidas a otros usuarios |
| 2 | GAP-081 | Cron page-revalidation no registrado en vercel.json | Sin revalidación periódica ni cleanup en producción |
| 3 | GAP-083 | DestinationReview: CERO revalidaciones (path mapper retorna array vacío) | Reviews de destinos nunca refrescan las páginas |
| 4 | GAP-082 | AccommodationReview: detail page no se revalida | Rating promedio desactualizado indefinidamente |
| 5 | GAP-078 | Debounce por path en vez de entityType:entityId | 15 timers por entidad, debounce ineficiente |
| 6 | GAP-079 | Audit logs con entityType: 'unknown' siempre | Diagnósticos imposibles |
| 7 | GAP-086 | Admin logs tab sin filtros/paginación/sorting | Página admin inusable para volumen real |
| 8 | GAP-089 | RevalidateEntityButton no integrado en ninguna página | Feature visible pero no accesible |
| 9 | GAP-090 | VercelAdapter sin timeout/retry/batching | Revalidaciones masivas pueden colapsar |
| 10 | GAP-088 | Ruta /revalidation sin permission guard | Cualquier admin puede ver/disparar revalidaciones |

### Recomendación General

Los **49 gaps nuevos** de esta auditoría se dividen en:

1. **Fixes directos inmediatos** (bloqueantes para producción): GAP-076, GAP-081, GAP-082, GAP-083, GAP-084, GAP-088 — Estos deben resolverse ANTES de cualquier deploy. No requieren SPEC nueva.

2. **Fixes directos de la remediación SPEC-034**: GAP-077 a GAP-080, GAP-085 a GAP-087, GAP-089 a GAP-106 — Son parte de completar la implementación del spec existente. Se resuelven como tareas adicionales del SPEC-034.

3. **Requieren evaluación/SPEC nueva**: GAP-093 (EntityChangeData semántica), GAP-108 (health público), GAP-123 (permisos EDITOR) — Necesitan discusión con PO/equipo.

4. **Postergar**: GAP-105 (E2E test), GAP-121 (HTTP status 201 vs 200) — No bloquean funcionalidad.

---

## Auditoría #8 — 2026-03-16 (Consolidación con verificación de código exacto)

### Metodología

6 agentes especializados ejecutados en paralelo:

1. **Spec Reader**: Lectura completa de la spec (~50k tokens) generando inventario exhaustivo de los 17 sections con TODOS los requerimientos, method signatures, DB schemas, API routes, admin UI components, configs, tests, edge cases.
2. **Gaps Inventory**: Lectura completa del gaps file (~65k tokens) inventariando los 85 gaps de A1-A7 con estado actual.
3. **ISR Infrastructure Auditor**: Lectura de astro.config.mjs, RevalidationService, EntityPathMapper, adapters, 8 service hooks, DB schemas, API routes, cron job, env vars, 10 web pages.
4. **Admin/Tests/Schemas Auditor**: Lectura de admin revalidation page, RevalidateEntityButton, useRevalidation hooks, HTTP adapter, i18n (es/en), Zod schemas, 9 test files, permissions, logger, vercel.json.
5. **API Routes Verifier**: Verificación puntual de existencia y estructura de rutas API de revalidación.
6. **Critical Gaps Verifier**: Lectura de código exacto para los 10 gaps más críticos con snippets verificables.

### Resolución de discrepancias entre agentes

| Discrepancia | Agente A | Agente B | Resolución |
|---|---|---|---|
| ¿Existen rutas API de revalidación? | ISR Auditor: "NO encontré rutas" | API Verifier: "8 rutas en `/api/v1/admin/revalidation`" | **RESUELTAS**: Las rutas EXISTEN. El ISR Auditor buscó con glob incorrecto. Verificado: `apps/api/src/routes/revalidation/index.ts` contiene 8 endpoints registrados en `apps/api/src/routes/index.ts` línea 229. |
| ¿`getLocalizedPath` es correcto? | Critical Verifier: "correcto, skip /es/" | Spec (sección 4.5): "All pages under `[lang]/`, Spanish at `/es/alojamientos/`" | **GAP-067 CONFIRMADO ABIERTO**: Las web pages usan `[lang]` param, URLs reales son `/es/alojamientos/hotel/`. `getLocalizedPath('es')` retorna `/alojamientos/hotel/` SIN `/es/` prefix. Revalidation requests para Spanish van a URLs inexistentes. |

### Verificación de gaps críticos con código exacto

#### GAP-006/076 — ISR exclude patterns (P1, CONFIRMADO ABIERTO)

**Código real** (`astro.config.mjs` líneas 68-77):
```javascript
exclude: [
    /^\/mi-cuenta(\/.*)?$/,         // ❌ No matchea /es/mi-cuenta/
    /^\/auth(\/.*)?$/,               // ❌ No matchea /es/auth/
    /^\/busqueda(\/.*)?$/,           // ❌ No matchea /es/busqueda
    /^\/feedback(\/.*)?$/,           // ❌ No matchea /es/feedback
    /^\/alojamientos\/(.*)\/?$/,     // ❌ No matchea /es/alojamientos/ NI detail pages
    /^\/eventos\/(.*)\/?$/,          // ❌ No matchea /es/eventos/ NI detail pages
    /^\/tipo(\/.*)?$/,               // ❌ Nunca matchea nada (falta /alojamientos/ prefix)
    /^\/categoria(\/.*)?$/,          // ❌ Nunca matchea nada (falta /eventos/ prefix)
]
```

**Spec dice** (sección 5.2):
```javascript
exclude: [
    /\/mi-cuenta\//,                           // ✅ Sin anchor, matchea como substring
    /\/auth\//,                                // ✅ Sin anchor
    /\/busqueda/,                              // ✅ Sin anchor
    /\/feedback/,                              // ✅ Sin anchor
    /^\/[a-z]{2}\/alojamientos\/$/,            // ✅ Con locale prefix, solo listing
    /^\/[a-z]{2}\/eventos\/$/,                 // ✅ Con locale prefix, solo listing
    /\/alojamientos\/tipo\/[^/]+\/$/,          // ✅ Sin anchor start, matchea tipo pages
    /\/eventos\/categoria\/[^/]+\/$/,          // ✅ Sin anchor start, matchea categoria pages
]
```

**Impacto CRÍTICO**: TODOS los regex anchored (`^`) están rotos porque no incluyen el locale prefix `[lang]/`. Esto significa que:
- **SEGURIDAD**: Páginas de auth (`/es/auth/login`) y cuenta (`/es/mi-cuenta/`) NO están excluidas del ISR cache. Respuestas autenticadas pueden cachearse y servirse a otros usuarios.
- **Funcionalidad**: Listings con query params (`/es/alojamientos/?type=HOTEL`) NO están excluidos. ISR cachea la primera variante y sirve resultados incorrectos para otras queries.
- **Tipo/Categoría**: Los patterns `/^\/tipo/` y `/^\/categoria/` NUNCA matchean nada.
- **Severidad**: P1 (bloqueante, riesgo de seguridad)
- **Complejidad**: 1 (corregir los 8 regex)
- **Solución**: Reemplazar con los patterns de la spec (sin anchor `^` donde no corresponde, con locale prefix donde sí)

#### GAP-067 — Spanish locale path sin /es/ prefix (P2, CONFIRMADO ABIERTO)

**Código real** (`entity-path-mapper.ts` líneas 351-354):
```typescript
export function getLocalizedPath(path: string, locale: string): string {
    if (locale === 'es') return path;       // ❌ Retorna /alojamientos/hotel/ sin /es/
    return `/${locale}${path}`;             // ✅ Retorna /en/alojamientos/hotel/ para en
}
```

**Impacto**: Spanish es el locale default y más importante (mercado argentino). TODAS las revalidation requests para Spanish van a URLs sin `/es/` prefix. Vercel ISR cache keys incluyen el locale prefix, así que las requests no invalidan el cache correcto.
- **Severidad**: P2 (alta, afecta 100% de revalidaciones en español)
- **Complejidad**: 1 (eliminar la excepción `if (locale === 'es')`)
- **Solución**: `return \`/${locale}${path}\`` siempre

#### GAP-066/082/083 — Review services sin parent slug (P2, CONFIRMADO ABIERTO)

**AccommodationReviewService** (`accommodationReview.service.ts` líneas 167-173):
```typescript
protected async _afterCreate(entity: AccommodationReview): Promise<AccommodationReview> {
    await this.recalculateAndUpdateAccommodationStats(entity.accommodationId);
    getRevalidationService()?.scheduleRevalidation({
        entityType: 'accommodation_review'     // ❌ Sin accommodationSlug
    });
    return entity;
}
```

**DestinationReviewService** (`destinationReview.service.ts` líneas 128-134):
```typescript
protected async _afterCreate(entity: DestinationReview): Promise<DestinationReview> {
    await this.recalculateAndUpdateDestinationStats(entity.destinationId);
    getRevalidationService()?.scheduleRevalidation({
        entityType: 'destination_review'       // ❌ Sin destinationSlug
    });
    return entity;
}
```

**Impacto**: Cuando se agrega/modifica/borra una review, la detail page del parent (alojamiento/destino) NUNCA se revalida. El rating promedio y listado de reviews queda desactualizado hasta el ISR expiration de 24h.
- **Severidad**: P2 (funcionalidad core rota)
- **Complejidad**: 2 (resolver parent slug desde entity.accommodationId/destinationId antes de llamar scheduleRevalidation)
- **Solución**: Cargar accommodation/destination por ID, extraer slug, pasar como `accommodationSlug`/`destinationSlug`

#### GAP-044/079 — writeLog siempre usa entityType: 'unknown' (P2, CONFIRMADO ABIERTO)

**Código real** (`revalidation.service.ts` líneas 118-127 y 183-191):
```typescript
void this.writeLog({
    path: result.path,
    entityType: 'unknown',     // ❌ HARDCODEADO en ambos call sites
    trigger,
    // ...
});
```

**Impacto**: TODOS los audit logs tienen `entityType: 'unknown'`. Stats por entity type, diagnóstico de problemas por tipo, y métricas en el admin son inservibles.
- **Severidad**: P2
- **Complejidad**: 1 (pasar el entityType real del evento al writeLog)

#### GAP-043 — revalidateByEntityType no consulta DB (P1, CONFIRMADO ABIERTO)

**Código real** (`revalidation.service.ts` líneas 85-88):
```typescript
async revalidateByEntityType(entityType: EntityChangeData['entityType']): Promise<void> {
    const paths = getAffectedPaths({ entityType } as EntityChangeData);
    // ❌ Cast forzado sin slug ni datos. Solo genera paths genéricos (listings)
    await this.revalidatePaths(paths, 'system', undefined, 'cron');
}
```

**Impacto**: El cron job NUNCA revalida detail pages (solo listings genéricos como `/es/alojamientos/`). Si una revalidación automática falla silenciosamente, el cron safety net no la cubre para pages de detalle.
- **Severidad**: P1
- **Complejidad**: 3 (debe consultar DB por entity type, resolver datos para cada entidad, construir EntityChangeData completo)

#### GAP-076 (A6) — _afterUpdateVisibility sin revalidación (P2, CONFIRMADO ABIERTO)

**Búsqueda**: `_afterUpdateVisibility` NO está implementado en NINGUNO de los 8 servicios con revalidation calls.

**Impacto**: Cambiar visibilidad de una entidad (publish/unpublish) no dispara revalidación. La página sigue mostrando contenido oculto o no muestra contenido publicado.
- **Severidad**: P2
- **Complejidad**: 2 (agregar hook en los 8 servicios, similar pattern a _afterUpdate)

#### GAP-060/090 — VercelAdapter sin batching (P3, CONFIRMADO ABIERTO)

**Código real** (`vercel-revalidation.adapter.ts` líneas 93-106):
```typescript
async revalidateMany(paths: readonly string[]): Promise<readonly RevalidatePathResult[]> {
    const settled = await Promise.allSettled(
        paths.map((path) => this.revalidate(path))    // ❌ TODO en paralelo, sin chunks
    );
    // ...
}
```

**Spec dice**: Chunks de 10 con 200ms delay entre chunks.

**Impacto**: Con 500+ paths (cron batch), se disparan 500+ requests HTTP simultáneos a Vercel. Puede causar rate limiting (429) o saturar el serverless function.
- **Severidad**: P3
- **Complejidad**: 2 (implementar chunking con delay como dice la spec)

#### GAP-070/088 — Admin page sin permission guard (P2, CONFIRMADO ABIERTO)

**Código real** (`routes/_authed/revalidation/index.tsx`):
```typescript
export const Route = createFileRoute('/_authed/revalidation/')({
    component: RevalidationPage,
    // ❌ Sin beforeLoad con permission check
});
```

**Impacto**: Cualquier usuario autenticado (incluso sin permisos REVALIDATION_*) puede acceder a la página de revalidación. Los endpoints API sí validan permisos, pero el usuario ve la UI completa.
- **Severidad**: P2
- **Complejidad**: 1 (agregar `beforeLoad` guard verificando REVALIDATION_* permissions)

#### GAP-042 — destinos/index.astro sigue con prerender=true (P4, CONFIRMADO ABIERTO)

**Código real** (`destinos/index.astro` líneas 1-2):
```astro
---
export const prerender = true;
```

**Impacto**: La página de listado de destinos es full SSG, no se beneficia de ISR on-demand. Nuevos destinos no aparecen hasta el siguiente build.
- **Severidad**: P4 (el cron revalidation no la cubriría de todas formas porque es prerender)
- **Complejidad**: 1 (migrar a SSR como otras listing pages)

### Gaps nuevos descubiertos en A8

#### GAP-124 (MEDIUM, P3) — Missing Portuguese (pt) locale for revalidation i18n [A8]

**Hallazgo**: El admin agent confirmó que solo existen `es/revalidation.json` (87 keys) y `en/revalidation.json` (87 keys). NO existe `pt/revalidation.json`.

**Impacto**: Usuarios admin con locale PT ven fallback a español o keys sin traducir en la página de revalidación.
- **Severidad**: P3
- **Complejidad**: 1 (copiar en.json, traducir al portugués)
- **Solución directa**: Crear `packages/i18n/src/locales/pt/revalidation.json` con las 87 keys traducidas.
- **Encontrado en**: A8

#### GAP-125 (LOW, P4) — RevalidationStatsService exists but may duplicate logic [A8]

**Hallazgo**: El API routes verifier encontró que las stats se computan via un `RevalidationStatsService` importado como `../../services/revalidation-stats.service`. La spec describe computar stats inline en el handler con queries al log model.

**Impacto**: No es un bug, pero introduce una capa extra no mencionada en la spec. Verificar que el service genera las mismas métricas que la spec requiere (`last24h`, `last7d`, `byTrigger`, `byEntityType`, `lastRevalidation`, `lastCronRun`).
- **Severidad**: P4 (verificar conformidad, no necesariamente un problema)
- **Complejidad**: 1
- **Encontrado en**: A8

### Resumen cuantitativo Auditoría #8

**Verificación de gaps A1-A7:**

| Estado | Cantidad | Gaps |
|---|---|---|
| ✅ Confirmados RESUELTOS en A8 | 33+ | (mismos que A7, sin cambios nuevos) |
| ⚠️ Confirmados AÚN ABIERTOS con código exacto | 10 principales | GAP-006/076, GAP-067, GAP-066/082/083, GAP-044/079, GAP-043, GAP-076(vis), GAP-060/090, GAP-070/088, GAP-042, GAP-032 |
| 🔄 Discrepancia resuelta | 1 | API routes SÍ existen (8 endpoints confirmados) |

**Gaps nuevos A8:**
- GAP-124 (P3): Missing PT locale for revalidation i18n
- GAP-125 (P4): RevalidationStatsService extra layer vs spec

**Total gaps activos estimado**: ~89 (de A7) + 2 nuevos - 0 resueltos = **~91 gaps activos**

### Top 15 Gaps Más Críticos — Ranking Consolidado A8

| # | GAP(s) | Sev | Descripción | Complejidad | Acción |
|---|--------|-----|-------------|-------------|--------|
| 1 | GAP-006/076 | **P1** | ISR exclude regex sin locale prefix — auth pages cacheables (SEGURIDAD) | 1 | Fix directo inmediato |
| 2 | GAP-067 | **P2** | getLocalizedPath omite `/es/` — 100% revalidaciones Spanish rotas | 1 | Fix directo inmediato |
| 3 | GAP-043 | **P1** | revalidateByEntityType no consulta DB — cron no revalida detail pages | 3 | Fix directo (requiere DB queries) |
| 4 | GAP-066/082/083 | **P2** | Review services sin parent slug — detail pages nunca se revalidan tras review | 2 | Fix directo |
| 5 | GAP-044/079 | **P2** | writeLog siempre entityType:'unknown' — audit logs inservibles | 1 | Fix directo |
| 6 | GAP-076(vis) | **P2** | _afterUpdateVisibility sin revalidación — publish/unpublish no refresca | 2 | Fix directo |
| 7 | GAP-070/088 | **P2** | Admin page sin permission guard — cualquier autenticado accede | 1 | Fix directo |
| 8 | GAP-060/090 | **P3** | VercelAdapter sin batching — 500+ requests simultáneos en cron | 2 | Fix directo |
| 9 | GAP-032 | **P4** | RevalidateEntityButton hardcodea Spanish en toasts | 1 | Fix directo |
| 10 | GAP-042 | **P4** | destinos/index.astro sigue prerender=true | 1 | Fix directo |
| 11 | GAP-124 | **P3** | Missing PT locale para revalidation i18n | 1 | Fix directo |
| 12 | GAP-047 | **P2** | Manual route no pasa triggeredBy/reason al service | 1 | Fix directo |
| 13 | GAP-046 | **P2** | revalidateByEntityType hardcodea trigger='cron' para llamadas manuales | 1 | Fix directo |
| 14 | GAP-052/086 | **P3** | Admin logs tab sin pagination/filtros/sorting | 3 | Fix directo (spec completo) |
| 15 | GAP-064 | **P1** | RevalidationService API diverge de spec (RO-RO, return types) | 3 | Evaluar si alinear o documentar divergencia |

### Clasificación de gaps para acción

#### 1. Fixes bloqueantes para producción (resolver ANTES de deploy)

| GAP | Fix | Justificación |
|-----|-----|---------------|
| GAP-006/076 | Corregir 8 regex en astro.config.mjs | **SEGURIDAD**: auth pages cacheables |
| GAP-067 | Eliminar excepción `if (locale === 'es')` en getLocalizedPath | 100% revalidaciones Spanish rotas |
| GAP-070/088 | Agregar beforeLoad permission guard en admin page | Cualquier autenticado accede a ISR admin |

#### 2. Fixes de alta prioridad (resolver en sprint actual)

| GAP | Fix | Justificación |
|-----|-----|---------------|
| GAP-043 | revalidateByEntityType debe consultar DB | Cron safety net no cubre detail pages |
| GAP-066/082/083 | Review services deben resolver parent slug | Reviews no refrescan detail pages |
| GAP-044/079 | Pasar entityType real al writeLog | Audit logs completamente inservibles |
| GAP-076(vis) | Implementar _afterUpdateVisibility en 8 servicios | Publish/unpublish no refresca |
| GAP-047 | Pasar triggeredBy/reason en manual route | Sin trazabilidad de quién revalida |
| GAP-046 | Pasar trigger correcto en revalidateByEntityType | Logs muestran 'cron' para llamadas manuales |

#### 3. Fixes de prioridad media (completar implementación)

| GAP | Fix | Justificación |
|-----|-----|---------------|
| GAP-060/090 | Implementar chunking con delay en VercelAdapter | Rate limiting con batches grandes |
| GAP-032 | Usar i18n keys en RevalidateEntityButton | Hardcoded Spanish en toasts |
| GAP-042 | Migrar destinos/index.astro a SSR | Listado de destinos no se beneficia de ISR |
| GAP-124 | Crear PT locale para revalidation i18n | Admin PT incompleto |
| GAP-052/086 | Admin logs tab con pagination/filtros | Página inusable con volumen real |
| GAP-064 | Alinear RevalidationService API con spec (RO-RO) | Divergencia de contrato documentada |
| GAP-048 | Agregar maxCronRevalidations y logRetentionDays a config | Valores hardcodeados |
| GAP-051 | Logs endpoint debe forwardear dateFrom/dateTo al model | Filtros por fecha no funcionan |

#### 4. Fixes de baja prioridad (backlog)

Todos los gaps P4 restantes: GAP-025, GAP-027, GAP-030, GAP-031, GAP-034, GAP-053, GAP-054, GAP-055, GAP-056, GAP-058, GAP-062, GAP-063, GAP-069, GAP-073, GAP-075, GAP-125, y los ~40 gaps adicionales de A7.

#### 5. Requieren evaluación/SPEC nueva

| GAP | Tema | Razón |
|-----|------|-------|
| GAP-064 | RO-RO compliance del RevalidationService | La implementación funciona pero diverge de la spec. Evaluar si alinear (breaking change) o documentar divergencia como decisión técnica. |
| GAP-043 | revalidateByEntityType con DB queries | Requiere diseño: queries por tipo, resolución de datos completos, batching. Podría ser un mini-spec. |

---

### Auditoría #9 (2026-03-16 — auditoría exhaustiva multi-experto con 5 agentes especializados independientes)

> **Auditoría #9** — 2026-03-16 (auditoría exhaustiva multi-experto con contraste profundo spec vs código actual)
> **Auditor**: Multi-agente paralelo (5 agentes especializados: ISR-config-infra-auditor, revalidation-service-auditor, API-DB-schemas-auditor, admin-UI-i18n-auditor, test-coverage-auditor)
> **Metodología**: Cada agente leyó exhaustivamente TODOS los archivos de su capa con lectura completa (no overviews). Contraste línea por línea contra spec. Verificación independiente de cada gap previo relevante. Descubrimiento de gaps nuevos no detectados en las 8 auditorías previas.
> **Cobertura**: 100% archivos de implementación: astro.config.mjs, vercel.json, env schemas, Vercel/NoOp adapters, adapter factory, RevalidationService (641 líneas service + 431 líneas mapper), 8 service hooks (lectura completa de los 8 servicios), API routes (8 endpoints), DB schemas (2 tablas + 4 indexes + 2 models), Zod schemas (5 archivos), permissions (4 permisos), seed data (8 configs), cron job (174 líneas), admin UI (4 archivos), i18n (3 locales), admin HTTP adapter, admin hooks, router/menu, 12 test files (lectura completa)

**Estado de gaps A1-A8 verificados en A9:**

✅ **Confirmados RESUELTOS (verificación con lectura de código completa):**
- GAP-001, GAP-002, GAP-004, GAP-005, GAP-007, GAP-008, GAP-010, GAP-013, GAP-014, GAP-020, GAP-026, GAP-028, GAP-029
- Service hooks: todos los 8 servicios implementan `_afterCreate`, `_afterUpdate`, `_afterSoftDelete`, `_afterHardDelete`, `_afterRestore` con revalidación
- RO-RO pattern: servicio sigue RO-RO correctamente
- Debouncing: funcional con `pendingTimers` Map y clearTimeout (5s default, configurable)
- Config cache: 60s TTL implementado correctamente
- Error handling: fire-and-forget correcto, errores logueados sin bloquear CRUD
- Fire-and-forget: `scheduleRevalidation()` usa `void this.resolveConfigAndSchedule()` + `.catch()`
- Adapter factory: Vercel para prod/staging con secret, NoOp para dev/test/missing secret
- DB schema: ambas tablas correctas con todos los campos e indexes requeridos
- Zod schemas: completos (8 entity types en enum, config/log/http schemas)
- Permissions: 4 permisos definidos correctamente en `PermissionEnum`
- Seed data: 8 entity types con defaults correctos
- Cron job: registrado, con interval-based revalidation + stale detection + log cleanup
- API routes: 8 endpoints montados bajo `/api/v1/admin/revalidation`
- i18n: ES (87 keys) y EN (87 keys) completos
- Initialization: singleton en `apps/api/src/index.ts` con env var check

⚠️ **Confirmados AÚN ABIERTOS (con verificación de código exacto en A9):**

Todos los gaps del Top 15 de A8 siguen abiertos. Se agregan nuevos gaps descubiertos en A9.

**Gaps NUEVOS encontrados en Auditoría #9:**

#### GAP-126 (CRITICAL, P1) — ISR exclude patterns no excluyen index pages de alojamientos/eventos [A9]

**Hallazgo**: El pattern `/^\/alojamientos\/(.*)\/?$/` requiere al menos un carácter después de `/alojamientos/`, por lo que NO matchea `/alojamientos/` (index page sin slug). Lo mismo aplica para `/^\/eventos\/(.*)\/?$/`.

**Código actual** (astro.config.mjs, líneas 73-74):
```javascript
/^\/alojamientos\/(.*)\/?$/,  // Matchea /alojamientos/slug/ pero NO /alojamientos/
/^\/eventos\/(.*)\/?$/,        // Matchea /eventos/slug/ pero NO /eventos/
```

**Impacto**: Las index pages de alojamientos y eventos (que usan 11+ query params para filtros: sortBy, page, priceMin, priceMax, capacity, etc.) SERÁN cacheadas por ISR. Como ISR ignora query params, diferentes combinaciones de filtros compartirán el mismo cache entry, mostrando resultados incorrectos a los usuarios.

- **Severidad**: P1 CRITICAL
- **Complejidad**: 1 (cambiar `(.*)` por `(.*)?` o usar pattern más amplio)
- **Solución directa**: Cambiar patterns a `/^(\/(en|pt))?\/alojamientos(\/.*)?$/` y `/^(\/(en|pt))?\/eventos(\/.*)?$/` que matchean tanto index como detail pages
- **Encontrado en**: A9

#### GAP-127 (HIGH, P2) — ISR exclude patterns tipo/categoria son over-broad y no tienen path prefix [A9]

**Hallazgo**: Los patterns actuales `/^\/tipo(\/.*)?$/` y `/^\/categoria(\/.*)?$/` matchean CUALQUIER URL que empiece con `/tipo/` o `/categoria/` en todo el sitio, no solo las rutas de alojamientos/eventos.

**Código actual** (astro.config.mjs, líneas 75-76):
```javascript
/^\/tipo(\/.*)?$/,       // Matchea /tipo/* GLOBALMENTE
/^\/categoria(\/.*)?$/,  // Matchea /categoria/* GLOBALMENTE
```

**Spec dice**: Las rutas son `/alojamientos/tipo/[type]/` y `/eventos/categoria/[category]/`.

**Impacto**: Over-exclusion puede excluir páginas que no deberían ser excluidas si en el futuro se crean rutas con `/tipo/` o `/categoria/` en otros contextos. Además, no manejan locale prefix.

- **Severidad**: P2
- **Complejidad**: 1
- **Solución directa**: Cambiar a `/^(\/(en|pt))?\/alojamientos\/tipo(\/.*)?$/` y `/^(\/(en|pt))?\/eventos\/categoria(\/.*)?$/`
- **Encontrado en**: A9

#### GAP-128 (HIGH, P2) — Vercel adapter no valida bypassToken en constructor [A9]

**Hallazgo**: El constructor de `VercelRevalidationAdapter` acepta cualquier valor para `bypassToken` sin validación. Si se pasa un string vacío o whitespace, el adapter se crea sin error pero las revalidaciones fallarán silenciosamente en runtime.

**Código actual** (vercel-revalidation.adapter.ts):
```typescript
constructor(config: VercelRevalidationAdapterConfig) {
    this.bypassToken = config.bypassToken;  // No validation
    this.siteUrl = config.siteUrl;
}
```

- **Severidad**: P2
- **Complejidad**: 1 (agregar validación en constructor)
- **Solución directa**: `if (!config.bypassToken?.trim()) throw new Error('...')`
- **Encontrado en**: A9

#### GAP-129 (HIGH, P2) — No hay warning si adapter es NoOp en producción [A9]

**Hallazgo**: Si `HOSPEDA_REVALIDATION_SECRET` no está configurado en producción, el `createRevalidationAdapter` factory retorna `NoOpRevalidationAdapter` silenciosamente. No hay log de warning. ISR no funcionará y nadie se enterará.

**Código actual** (adapter-factory.ts):
```typescript
if (isNonLocalEnv && hasSecret) {
    return new VercelRevalidationAdapter({ ... });
}
return new NoOpRevalidationAdapter();  // Silent fallback — no warning
```

- **Severidad**: P2
- **Complejidad**: 1
- **Solución directa**: Agregar `logger.warn('Revalidation disabled in production: missing revalidationSecret')` antes del return NoOp en producción
- **Encontrado en**: A9

#### GAP-130 (MEDIUM, P3) — Astro config lee env var directamente, no a través del schema validado [A9]

**Hallazgo**: `astro.config.mjs` lee `process.env.HOSPEDA_REVALIDATION_SECRET` directamente, bypasseando el schema Zod validado en `src/env.ts`. Si la variable falta, `bypassToken` será `undefined` silenciosamente y ISR no activará on-demand revalidation.

**Código actual** (astro.config.mjs, línea 67):
```javascript
bypassToken: process.env.HOSPEDA_REVALIDATION_SECRET,
```

**Impacto**: El schema valida `min(32)` pero astro.config.mjs no usa esa validación. Un secret de 10 chars pasará en el config pero fallará en las revalidaciones.

- **Severidad**: P3
- **Complejidad**: 1
- **Solución directa**: Documentar que astro.config.mjs no puede importar el schema validado (limitación de Astro config). Agregar comment explicativo.
- **Encontrado en**: A9

#### GAP-131 (HIGH, P2) — POST /revalidate/entity no extrae actor para triggeredBy [A9]

**Hallazgo**: El endpoint POST /revalidate/entity recibe el contexto (`c`) pero nunca extrae el `actor` para pasar `triggeredBy` al servicio. Lo mismo aplica para POST /revalidate/type.

**Código actual** (routes/revalidation/index.ts):
```typescript
// revalidateEntityRoute handler
handler: async (_c, _params, body) => {  // _c never used!
    const { entityType, entityId, reason } = body;
    // triggeredBy is never extracted from auth context
```

**Contraste**: El endpoint POST /revalidate/manual SÍ extrae correctamente el actor (línea 62).

- **Severidad**: P2
- **Complejidad**: 1
- **Solución directa**: Extraer actor con `getActorFromContext(c)` y pasar `triggeredBy: actor?.id`
- **Nota**: Este gap subsume y precisa GAP-047 de A4
- **Encontrado en**: A9

#### GAP-132 (HIGH, P2) — PATCH /config/:id usa id (UUID) en lugar de entityType como path param [A9]

**Hallazgo**: La spec define `PUT /config/:entityType` pero la implementación usa `PATCH /config/{id}` con UUID primary key.

**Discrepancia dual**:
1. Verbo HTTP: PUT (spec) vs PATCH (code)
2. Path param: `:entityType` (spec) vs `{id}` (code)

- **Severidad**: P2 (API contract divergence)
- **Complejidad**: 1
- **Solución**: Documentar la divergencia como decisión técnica (PATCH con UUID es más RESTful para partial updates) O alinear con spec. Ambas opciones son válidas.
- **Encontrado en**: A9

#### GAP-133 (CRITICAL, P1) — RevalidateEntityButton es dead code — no integrado en entity edit pages [A9]

**Hallazgo**: El componente `RevalidateEntityButton` existe pero NO está importado ni renderizado en NINGUNA entity edit page del admin. Grep confirma 0 importaciones del componente fuera de su propio archivo.

**Páginas afectadas**:
- Accommodation edit page: no usa el botón
- Destination edit page: no usa el botón
- Event edit page: no usa el botón
- Post edit page: no usa el botón

- **Severidad**: P1 (feature completa no funcional — los admins no pueden revalidar desde entity pages)
- **Complejidad**: 2 (integrar en 4 edit pages con props correctas)
- **Solución directa**: Importar y renderizar en cada entity edit page
- **Encontrado en**: A9

#### GAP-134 (CRITICAL, P1) — Revalidation dashboard no aparece en sidebar menu [A9]

**Hallazgo**: La página `/revalidation/` existe y funciona, pero NO tiene entrada en el sidebar menu (`apps/admin/src/lib/menu.ts`). El array `menuTree` no incluye ningún item para revalidation.

**Impacto**: Los admins no pueden encontrar ni navegar al dashboard de revalidación desde la UI. Solo accesible via URL directa.

- **Severidad**: P1
- **Complejidad**: 1 (agregar menu item con permission guard)
- **Solución directa**: Agregar entry en la sección "Admin" del menu:
  ```typescript
  { titleKey: 'admin-menu.admin.revalidation', to: '/revalidation', permission: PermissionEnum.REVALIDATION_CONFIG_VIEW }
  ```
  También agregar i18n key `admin-menu.admin.revalidation` en es/en/pt
- **Encontrado en**: A9

#### GAP-135 (HIGH, P2) — RevalidateEntityButton missing useTranslations — no puede usar i18n [A9]

**Hallazgo**: El componente no importa ni usa el hook `useTranslations()`. Los keys de i18n existen en los locale files pero el componente hardcodea strings en español directamente.

**Strings hardcoded**:
- `'Páginas revalidadas correctamente'` (toast success)
- `'Error al revalidar las páginas'` (toast error)
- `'Revalidando...'` (pending state)
- `'Revalidar'` (default label)

**i18n keys disponibles** (revalidation.json):
- `revalidation.messages.revalidateSuccess`
- `revalidation.messages.revalidateError`
- `revalidation.actions.revalidate`

- **Severidad**: P2
- **Complejidad**: 1
- **Solución directa**: Import `useTranslations`, reemplazar hardcoded strings con calls a `t()`
- **Nota**: Este gap precisa y complementa GAP-032 de A3
- **Encontrado en**: A9

#### GAP-136 (MEDIUM, P3) — PT locale file existence disputed — needs definitive check [A9]

**Hallazgo**: El admin-UI auditor de A9 confirmó que los 3 locales (es/en/pt) existen con 87 keys cada uno. Sin embargo, GAP-124 de A8 reportó que PT no existía. Esto requiere verificación definitiva.

**Nota**: Si PT existe, GAP-124 queda resuelto. Si no existe, GAP-124 sigue abierto con P3.

- **Severidad**: P3 (verificar)
- **Complejidad**: 1
- **Encontrado en**: A9

#### GAP-137 (MEDIUM, P3) — Entity path mapper genera rutas que no existen en Astro [A9]

**Hallazgo**: El mapper genera paths como `/publicaciones/etiqueta/{tagSlug}/` para posts con tags. Sin embargo, no se verificó si existe la ruta Astro correspondiente `[lang]/publicaciones/etiqueta/[tag]/index.astro`.

**Impacto**: Si la ruta no existe, las revalidaciones para tag filter pages harán requests a URLs que retornan 404. No es un bug funcional (la revalidación fallará gracefully) pero es ineficiente y genera ruido en los logs.

- **Severidad**: P3
- **Complejidad**: 1 (verificar y eliminar paths sin ruta correspondiente)
- **Encontrado en**: A9

#### GAP-138 (MEDIUM, P3) — Service hooks test coverage only 4/8 services [A9]

**Hallazgo**: `service-hooks.test.ts` solo cubre AccommodationService, DestinationService, EventService, TagService. Faltan tests para:
- PostService hooks
- AccommodationReviewService hooks
- DestinationReviewService hooks
- AmenityService hooks

- **Severidad**: P3
- **Complejidad**: 2
- **Solución directa**: Agregar tests para los 4 servicios faltantes, siguiendo el mismo patrón de los tests existentes
- **Nota**: Subsume GAP-059 de A4
- **Encontrado en**: A9

#### GAP-139 (MEDIUM, P3) — Config cache TTL sin test de expiración [A9]

**Hallazgo**: El servicio tiene cache de 60s TTL para configs, pero los tests no verifican que el cache expira correctamente. Falta test que:
1. Fetch config (cache miss → DB query)
2. Fetch config again within 60s (cache hit → no DB query)
3. Advance time 61s
4. Fetch config again (cache expired → DB query again)

- **Severidad**: P3
- **Complejidad**: 2
- **Solución directa**: Agregar test con `vi.useFakeTimers()` + `vi.advanceTimersByTime(61_000)`
- **Encontrado en**: A9

#### GAP-140 (MEDIUM, P3) — Adapter test missing empty paths array edge case [A9]

**Hallazgo**: No existe test para `revalidateMany([])`. Debería ser no-op sin hacer HTTP calls.

- **Severidad**: P3
- **Complejidad**: 1
- **Solución directa**: Agregar test `revalidateMany([])` → expect no fetch calls, return `[]`
- **Encontrado en**: A9

#### GAP-141 (MEDIUM, P3) — Cron test missing "first-ever run" scenario [A9]

**Hallazgo**: Los tests del cron job no cubren el escenario de primera ejecución donde no existen log entries previas. `findLastCronEntry` retornaría `undefined` y el comportamiento no está testeado.

- **Severidad**: P3
- **Complejidad**: 1
- **Solución directa**: Agregar test donde `findLastCronEntry` retorna `undefined` → job debería revalidar normalmente
- **Encontrado en**: A9

#### GAP-142 (LOW, P4) — Stale detection boundary test missing exact 48h [A9]

**Hallazgo**: Tests cubren 24h (not stale) y 72h (stale) pero no el boundary exacto de 48h. Posible off-by-one.

- **Severidad**: P4
- **Complejidad**: 1
- **Encontrado en**: A9

#### GAP-143 (LOW, P4) — Admin logs stats error state silently hidden [A9]

**Hallazgo**: En el ManualTab del admin dashboard, si el fetch de stats falla, los stat cards simplemente no se muestran (sin error message). El admin no sabe por qué las estadísticas están vacías.

- **Severidad**: P4
- **Complejidad**: 1
- **Solución directa**: Agregar estado de error visible cuando `statsError` es truthy
- **Encontrado en**: A9

#### GAP-144 (LOW, P4) — Admin menu i18n key missing for revalidation [A9]

**Hallazgo**: No existe key `admin-menu.admin.revalidation` en los locale files. Necesario cuando se fixee GAP-134 (agregar menu item).

- **Severidad**: P4 (bloqueado por GAP-134)
- **Complejidad**: 1
- **Encontrado en**: A9

#### GAP-145 (LOW, P4) — Test schema missing boundary for cronIntervalMinutes=0 and debounceSeconds=301 [A9]

**Hallazgo**: Schema tests validan min=1 y max=10080 para cronIntervalMinutes, pero no testean explícitamente el boundary 0 (debería rechazar). Igual para debounceSeconds > 300.

- **Severidad**: P4
- **Complejidad**: 1
- **Encontrado en**: A9

#### GAP-146 (LOW, P4) — Destination service missing revalidation hooks in _afterCreate and _afterUpdate [A9]

**Hallazgo**: DestinationService tiene hooks de revalidación en `_afterSoftDelete`, `_afterHardDelete`, `_afterRestore`, `_afterUpdateVisibility`. Sin embargo, los hooks `_afterCreate` y `_afterUpdate` NO llaman `scheduleRevalidation`. Cuando se crea o actualiza un destino, las páginas de destino y listado de alojamientos NO se revalidan automáticamente.

**Contraste**: AccommodationService, EventService, PostService, TagService, AmenityService SÍ implementan revalidación en `_afterCreate` y `_afterUpdate`.

- **Severidad**: P4 (destinations change less frequently, but still a gap)
- **Complejidad**: 1
- **Solución directa**: Agregar `getRevalidationService()?.scheduleRevalidation({ entityType: 'destination', slug: entity.slug })` en `_afterCreate` y `_afterUpdate`
- **Encontrado en**: A9

### Resumen cuantitativo Auditoría #9

**Verificación de gaps A1-A8:**

| Estado | Cantidad | Notas |
|---|---|---|
| ✅ Confirmados RESUELTOS | 33+ | Mismos que A7-A8, sin regresiones |
| ⚠️ Confirmados AÚN ABIERTOS | Top 15 de A8 | Todos confirmados con lectura de código completa |
| 🔍 GAP-124 requiere verificación definitiva | 1 | Discrepancia entre agentes sobre existencia de PT locale |

**Gaps nuevos A9:**
- P1 CRITICAL: 3 (GAP-126, GAP-133, GAP-134)
- P2 HIGH: 5 (GAP-127, GAP-128, GAP-129, GAP-131, GAP-135)
- P3 MEDIUM: 6 (GAP-130, GAP-136, GAP-137, GAP-138, GAP-139, GAP-140, GAP-141)
- P4 LOW: 5 (GAP-142, GAP-143, GAP-144, GAP-145, GAP-146)
- **Total nuevos A9: 19 gaps**

**Total gaps activos estimado**: ~91 (de A8) + 19 nuevos - 0 resueltos = **~110 gaps activos**

### Top 20 Gaps Más Críticos — Ranking Consolidado A9

| # | GAP(s) | Sev | Descripción | Complejidad | Acción |
|---|--------|-----|-------------|-------------|--------|
| 1 | GAP-006/076 | **P1** | ISR exclude regex sin locale prefix — auth pages cacheables (SEGURIDAD) | 1 | Fix directo inmediato |
| 2 | GAP-126 | **P1** | ISR exclude no cubre index pages alojamientos/eventos — filtros cacheados incorrectamente | 1 | Fix directo inmediato |
| 3 | GAP-134 | **P1** | Dashboard revalidación no aparece en sidebar menu — inaccesible | 1 | Fix directo inmediato |
| 4 | GAP-133 | **P1** | RevalidateEntityButton es dead code — no integrado en entity pages | 2 | Fix directo |
| 5 | GAP-043 | **P1** | revalidateByEntityType no consulta DB — cron no revalida detail pages | 3 | Fix directo (requiere DB queries) |
| 6 | GAP-067 | **P2** | getLocalizedPath omite `/es/` — 100% revalidaciones Spanish rotas | 1 | Fix directo inmediato |
| 7 | GAP-070/088 | **P2** | Admin page sin beforeLoad permission guard | 1 | Fix directo inmediato |
| 8 | GAP-066/082/083 | **P2** | Review services sin parent slug — detail pages no se revalidan tras review | 2 | Fix directo |
| 9 | GAP-044/079 | **P2** | writeLog siempre entityType:'unknown' — audit logs inservibles | 1 | Fix directo |
| 10 | GAP-131 | **P2** | POST /revalidate/entity no extrae actor para triggeredBy | 1 | Fix directo |
| 11 | GAP-076(vis) | **P2** | _afterUpdateVisibility sin revalidación en algunos servicios | 2 | Fix directo |
| 12 | GAP-127 | **P2** | ISR tipo/categoria patterns over-broad, sin path prefix | 1 | Fix directo |
| 13 | GAP-128 | **P2** | Vercel adapter no valida bypassToken en constructor | 1 | Fix directo |
| 14 | GAP-129 | **P2** | Sin warning si adapter es NoOp en producción | 1 | Fix directo |
| 15 | GAP-135 | **P2** | RevalidateEntityButton no usa useTranslations — hardcodes Spanish | 1 | Fix directo |
| 16 | GAP-046 | **P2** | revalidateByEntityType hardcodea trigger='cron' para llamadas manuales | 1 | Fix directo |
| 17 | GAP-132 | **P2** | PATCH /config/:id usa UUID en lugar de entityType (spec divergence) | 1 | Documentar o alinear |
| 18 | GAP-060/090 | **P3** | VercelAdapter sin batching — 500+ requests simultáneos | 2 | Fix directo |
| 19 | GAP-042 | **P3** | destinos/index.astro sigue prerender=true | 1 | Fix directo |
| 20 | GAP-052/086 | **P3** | Admin logs tab sin pagination/filtros/sorting | 3 | Fix directo |

### Clasificación de gaps para acción — Actualizada A9

#### 1. Fixes BLOQUEANTES para producción (resolver ANTES de deploy)

| GAP | Fix | Justificación |
|-----|-----|---------------|
| GAP-006/076 | Corregir 8 regex en astro.config.mjs con locale prefix `(\/(en\|pt))?` | **SEGURIDAD**: auth pages cacheables para EN/PT |
| GAP-126 | Cambiar regex para incluir index pages de alojamientos/eventos | Filtros de búsqueda cacheados incorrectamente |
| GAP-127 | Cambiar regex tipo/categoria para incluir path prefix | Over-broad exclusion |
| GAP-067 | Verificar que getLocalizedPath genera prefijo correcto para ES | 100% revalidaciones Spanish dependen de esto |
| GAP-070/088 | Agregar beforeLoad permission guard en admin page | Cualquier autenticado accede a ISR admin |
| GAP-134 | Agregar revalidation al sidebar menu | Dashboard inaccesible sin URL directa |

#### 2. Fixes de alta prioridad (resolver en sprint actual)

| GAP | Fix | Justificación |
|-----|-----|---------------|
| GAP-043 | revalidateByEntityType debe consultar DB para generar detail paths | Cron safety net incompleto |
| GAP-133 | Integrar RevalidateEntityButton en 4 entity edit pages | Feature completa no funcional |
| GAP-066/082/083 | Review services deben resolver parent slug antes de revalidar | Reviews no refrescan detail pages |
| GAP-044/079 | Pasar entityType real al writeLog | Audit logs inservibles |
| GAP-131 | Extraer actor en entity/type routes para triggeredBy | Sin trazabilidad |
| GAP-135 | Agregar useTranslations al RevalidateEntityButton | Hardcoded Spanish |
| GAP-128 | Validar bypassToken en constructor de Vercel adapter | Fail silencioso en runtime |
| GAP-129 | Agregar warning si NoOp en producción | ISR desactivado silenciosamente |
| GAP-076(vis) | Verificar _afterUpdateVisibility en todos los servicios | Publish/unpublish no refresca |
| GAP-046 | Pasar trigger correcto en revalidateByEntityType | Logs muestran trigger incorrecto |

#### 3. Fixes de prioridad media (completar implementación)

| GAP | Fix | Justificación |
|-----|-----|---------------|
| GAP-060/090 | Implementar chunking con delay en VercelAdapter | Rate limiting con batches grandes |
| GAP-042 | Migrar destinos/index.astro a SSR | No se beneficia de ISR |
| GAP-052/086 | Admin logs tab con pagination/filtros/sorting | Inusable con volumen real |
| GAP-138 | Tests de hooks para 4 servicios faltantes | Cobertura incompleta |
| GAP-139 | Test de expiración de config cache TTL | Comportamiento no verificado |
| GAP-140 | Test edge case revalidateMany([]) | Guard para empty input |
| GAP-141 | Test primer-run del cron (sin logs previos) | Escenario no cubierto |
| GAP-137 | Verificar existencia de ruta /publicaciones/etiqueta/ | Revalidaciones a URLs 404 |
| GAP-130 | Documentar limitación de astro.config.mjs vs env schema | Claridad para mantenimiento |
| GAP-132 | Documentar PATCH vs PUT divergencia | API contract documentado |
| GAP-136 | Verificar definitivamente existencia de PT locale | Discrepancia entre auditorías |
| GAP-064 | Alinear o documentar RO-RO divergencia | Contrato API |
| GAP-146 | Agregar revalidación en DestinationService _afterCreate/_afterUpdate | Destinos sin auto-revalidación |

#### 4. Fixes de baja prioridad (backlog)

GAP-142, GAP-143, GAP-144, GAP-145, y todos los gaps P4 restantes de A1-A8.

#### 5. Requieren evaluación / SPEC nueva

| GAP | Tema | Razón |
|-----|------|-------|
| GAP-043 | revalidateByEntityType con DB queries | Requiere diseño: queries por tipo de entidad, resolución de slugs, batching con rate limiting. Candidato a mini-spec. |
| GAP-064 | RO-RO compliance del RevalidationService | Evaluar si alinear (breaking change) o documentar como decisión técnica. |
| GAP-132 | PATCH vs PUT + UUID vs entityType | Decidir si alinear con spec o documentar divergencia. Ambas opciones válidas. |

---

## Decisiones de Revisión — Sesión 2026-03-16

### Gap 1/28: ISR Exclude Patterns + Locale Paths (GAP-006/067/076/079/126/127)
- **Decisión:** HACER
- **Hallazgo de verificación:** GAP-067 (getLocalizedPath) es FALSO POSITIVO.. es correcto que Spanish no use prefijo (es el default locale de Astro). GAP-006 (ISR exclude patterns) es PARCIALMENTE ABIERTO: los regex funcionan para Spanish (sin prefijo) pero NO para en/pt (con prefijo `/en/`, `/pt/`). Páginas de auth y mi-cuenta en en/pt NO se excluyen del ISR cache.
- **Solución:** Actualizar los 8 regex en `astro.config.mjs` para incluir prefijo de locale opcional `(\/(?:en|pt))?` al inicio de cada pattern.
- **Complejidad:** XS (<1h)

### Gap 2/28: Cron page-revalidation NO registrado en vercel.json (GAP-073/081/085)
- **Decisión:** HACER
- **Solución:** Agregar `{ "path": "/api/v1/cron/page-revalidation", "schedule": "0 * * * *" }` al array `crons` de `apps/api/vercel.json`.
- **Complejidad:** XS (<30 min)

### Gap 3/28: Revalidation dashboard no aparece en sidebar del admin (GAP-134)
- **Decisión:** HACER
- **Solución:** Agregar entry en `apps/admin/src/lib/menu.ts` con permission guard `REVALIDATION_CONFIG_VIEW` + agregar i18n key `admin-menu.admin.revalidation` en es/en/pt.
- **Complejidad:** XS (<30 min)

### Gap 4/28: POST /revalidate/entity ignora entityId (GAP-003)
- **Decisión:** HACER
- **Solución:** Implementar entity lookup por tipo+ID en DB, construir EntityChangeData con datos reales (slug, destinationSlug, etc.), llamar scheduleRevalidation con evento completo para revalidar solo los paths de esa entidad específica.
- **Complejidad:** S-M (2-4h)

### Gap 5/28: revalidateByEntityType no consulta DB (GAP-043)
- **Decisión:** HACER — Opción A (resolver pattern)
- **Solución:** Inyectar `entityResolver` con método `resolveByType(entityType)` al service durante `initializeRevalidationService()`. El API layer provee la implementación concreta con models reales. El service usa el resolver para obtener EntityChangeData[] de cada entidad publicada del tipo, genera paths completos (incluyendo detail pages), y revalida. Sigue el mismo patrón de inyección del adapter.
- **Complejidad:** L (1-2 días)

### Gap 6/28: writeLog siempre almacena entityType: 'unknown' (GAP-044/079)
- **Decisión:** HACER
- **Solución:** Thread entityType a través de la cadena: scheduleRevalidation → debouncePath → revalidatePaths → writeLog. El entityType ya está disponible en el evento original, solo hay que pasarlo en cada call site.
- **Complejidad:** S (1-2h)

### Gap 28/28: Test gaps consolidados (GAP-030/062/074/025/034/139/140/141)
- **Decisión:** HACER TODO
- **Solución:** (1) API route tests: agregar tests dedicados sin-token→401, sin-permiso→403. (2) ISR exclude: crear test unitario que valide regex patterns contra URLs reales. (3) Adapter: agregar tests timeout/429/partial-success/503. (4) E2E: crear test Playwright login→/revalidation→submit→verify logs. (5) Admin UI: tests unitarios para useRevalidation hooks, RevalidateEntityButton, HTTP adapter. (6) Tests menores: config cache TTL expiration, revalidateMany([]), first-ever cron run.
- **Complejidad:** L (1-2 días)

### Gap 27/28: API route URLs y verbo HTTP no matchean spec (GAP-049/050/132)
- **Decisión:** HACER Opción B (documentar divergencia)
- **Hallazgo:** La implementación actual (sub-paths `/revalidate/manual`, PATCH con `:id` UUID) ES consistente con las convenciones del proyecto. La spec proponía hyphens y PUT que NO son idiomáticos. La implementación es correcta, la spec estaba desalineada.
- **Solución:** Documentar la divergencia como decisión técnica en la spec. No cambiar código.
- **Complejidad:** XS (<30 min, solo documentación)

### Gap 26/28: Accessibility gaps en admin revalidation UI (GAP-036/100)
- **Decisión:** HACER
- **Solución:** Agregar aria-label contextual a switches (con entity type name), badges (status/trigger text). Agregar role="status" y aria-live="polite" al InlineNumberField en modo edición.
- **Complejidad:** S (1-2h)

### Gap 25/28: Manual tab sin modo entity-type revalidation (GAP-071/087)
- **Decisión:** HACER
- **Solución:** Agregar segundo formulario en ManualTab con Select de entity types + botón "Regenerar todo" que llame POST /revalidate/type. Agregar AlertDialog de confirmación antes de ejecutar.
- **Complejidad:** S-M (2-4h)

### Gap 24/28: Config missing locales, maxCronRevalidations, logRetentionDays (GAP-048/068)
- **Decisión:** HACER
- **Solución:** Agregar `locales` (desde @repo/i18n SUPPORTED_LOCALES), `maxCronRevalidations` (default 500), `logRetentionDays` (default 30) a RevalidationServiceConfig e InitRevalidationParams. Exponer via getters para que el cron los lea. Mover hardcoded 30d del cron al config.
- **Complejidad:** S (1-2h)

### Gap 23/28: RO-RO violations en service y adapter API (GAP-064/065/080)
- **Decisión:** HACER
- **Solución:** Alinear firmas de revalidatePaths, revalidateByEntityType, adapter.revalidate y adapter.revalidateMany a RO-RO pattern. Corregir return types de void a ReadonlyArray&lt;RevalidationResult&gt;. Actualizar ~20-30 call sites.
- **Complejidad:** M (4-8h)

### Gap 22/28: Logs endpoint missing filtros de path y fecha (GAP-051/109)
- **Decisión:** HACER
- **Solución:** Agregar filtro `path` (LIKE) al schema y handler. Forwardear fromDate/toDate como cláusulas WHERE de rango de fecha al model query. Prerequisito de Gap 19 (admin logs tab).
- **Complejidad:** S (1-2h)

### Gap 21/28: Error handling inconsistente en hooks de revalidación (GAP-078 A6)
- **Decisión:** HACER
- **Solución:** Envolver cada llamada a scheduleRevalidation en try-catch silencioso con `logger.warn('Revalidation scheduling failed (non-blocking)', { error })` en los 7 servicios que no lo tienen. Patrón defensivo para que un bug en revalidación nunca bloquee CRUD.
- **Complejidad:** XS-S (<1h)

### Gap 20/28: Debounce por path + default 5s vs 30s (GAP-045/091)
- **Decisión:** HACER COMPLETO
- **Solución:** (1) Cambiar debounce key a `${entityType}:${entityId}`, recolectar todos los paths para ese key, batch-revalidar cuando el timer fire. Cuando entityId no disponible, usar entityType como key. (2) Cambiar default de 5000 a 30000.
- **Complejidad:** M (4-8h)

### Gap 19/28: Admin logs tab sin pagination, filtros, sorting ni auto-refresh (GAP-052/086)
- **Decisión:** HACER
- **Solución:** (1) Agregar params filtro/paginación al HTTP adapter, (2) crear filter UI (selects entityType/trigger/status + date range), (3) integrar paginación y sorting con TanStack Table, (4) agregar refetchInterval: 30000.
- **Complejidad:** M-L (4-8h)

### Gap 18/28: auth/forgot-password.astro con prerender=true (GAP-084 A7)
- **Decisión:** HACER
- **Solución:** Remover `prerender = true` de auth/forgot-password.astro. Páginas de auth deben ser SSR para consistencia y seguridad.
- **Complejidad:** XS (<30 min)

### Gap 17/28: destinos/index.astro sigue con prerender=true (GAP-042/094)
- **Decisión:** HACER
- **Solución:** Migrar a SSR: remover `prerender = true` y `getStaticPaths()`, agregar locale validation y data fetching dinámico. Seguir patrón de las otras 9 páginas ya migradas.
- **Complejidad:** S (1-2h)

### Gap 16/28: Admin page sin permission guard específico (GAP-070/088)
- **Decisión:** HACER
- **Solución:** Agregar `beforeLoad` guard en la ruta verificando `REVALIDATION_CONFIG_VIEW`. Opcionalmente condicionar tabs individuales a permisos específicos.
- **Complejidad:** XS (<30 min)

### Gap 15/28: Manual routes no pasan triggeredBy/reason al service (GAP-047/131)
- **Decisión:** HACER
- **Solución:** Pasar triggeredBy (userId del actor via getActorFromContext) y reason a revalidatePaths en los 3 endpoints POST de revalidación. Extraer actor donde falta.
- **Complejidad:** XS (<1h)

### Gap 14/28: revalidateByEntityType hardcodea trigger='cron' (GAP-046)
- **Decisión:** HACER
- **Solución:** Agregar parámetro `trigger` a `revalidateByEntityType`. La ruta manual pasa `'manual'`, el cron pasa `'cron'`.
- **Complejidad:** XS (<30 min)

### Gap 13/28: NoOp adapter sin warning en producción (GAP-129)
- **Decisión:** HACER
- **Solución:** Agregar `logger.warn('ISR revalidation DISABLED: missing HOSPEDA_REVALIDATION_SECRET')` en adapter factory cuando retorna NoOp en env no-local (production/staging).
- **Complejidad:** XS (<30 min)

### Gap 12/28: VercelAdapter sin timeout, sin batching, sin validación de token (GAP-037/060/090/128)
- **Decisión:** HACER
- **Solución:** (1) AbortController con 10s timeout en cada fetch, (2) chunking en revalidateMany: batches de 10 con 200ms delay entre batches, (3) validar bypassToken en constructor (throw si vacío/whitespace).
- **Complejidad:** S-M (2-4h)

### Gap 11/28: RevalidateEntityButton: i18n, permisos y className (GAP-032/033/057/098/099/106/135)
- **Decisión:** HACER
- **Solución:** En RevalidateEntityButton.tsx: (1) importar useTranslations() y usar keys existentes para strings, (2) agregar useHasAnyPermission([REVALIDATION_TRIGGER]) y retornar null si falta, (3) agregar className prop y pasarlo al Button.
- **Complejidad:** XS (<1h)

### Gap 10/28: RevalidateEntityButton no integrado en entity edit pages (GAP-072/089/133)
- **Decisión:** HACER
- **Solución:** Importar y renderizar `<RevalidateEntityButton entityType="..." entityId={id} />` en las 4 entity edit pages (accommodation, destination, event, post), junto al botón de guardado.
- **Complejidad:** S (1-2h)

### Gap 9/28: Delete hooks pierden contexto de slug (GAP-077 A6)
- **Decisión:** HACER
- **Solución:** En _afterSoftDelete y _afterHardDelete de cada servicio, pasar slug (y destinationSlug/accommodationType si aplica) del entity al scheduleRevalidation. El entity ya tiene los datos disponibles en el parámetro del hook.
- **Complejidad:** XS-S (<1h)

### Gap 7/28: Review services no pasan parent slug (GAP-066/082/083)
- **Decisión:** HACER
- **Solución:** En AccommodationReviewService y DestinationReviewService, resolver slug del parent via entity.accommodationId/destinationId → lookup en DB → pasar como accommodationSlug/destinationSlug al scheduleRevalidation en todos los hooks (_afterCreate, _afterUpdate, _afterSoftDelete, _afterHardDelete, _afterRestore).
- **Complejidad:** S (1-2h)

### Gap 8/28: _afterUpdateVisibility no implementado (GAP-076 A6)
- **Decisión:** HACER
- **Solución:** Agregar `_afterUpdateVisibility` con revalidation call (fire-and-forget) en los 8 servicios: accommodation, destination, event, post, tag, amenity, accommodationReview, destinationReview. Mismo patrón que `_afterUpdate`.
- **Complejidad:** S (1-2h)

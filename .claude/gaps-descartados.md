# Gaps Descartados - SPEC-021

Decisiones tomadas en sesión de revisión del 2026-03-08.

## GAP-27: COMPLEX user trial auto-start nunca implementado

- **Severidad:** MEDIUM
- **Razón de descarte:** Decisión de producto intencional. El código hardcodea `planSlug = 'owner-basico'` con comentarios explicando que es deliberado. No es un bug.
- **Fecha:** 2026-03-08

## GAP-NEW-09: Env var name sin prefijo HOSPEDA_ en docs

- **Severidad:** LOW
- **Razón de descarte:** Cubierto por SPEC-035 (env vars cleanup). El código de producción ya usa los prefijos correctos. Solo quedan docs por actualizar, que es scope de SPEC-035.
- **Fecha:** 2026-03-08

## SPEC-023 Gap #3: 24 tests skipeados en schemas (meta-tracking)

- **Severidad:** MEDIUM
- **Razón de descarte:** Cubierto completamente por Gap #26 (razones stale, fixtures desactualizados) y Gap #42 (UserBookmark fields inexistentes). No requiere acción por separado.
- **Fecha:** 2026-03-09

## SPEC-023 Gap #46: Total monorepo skip count 81 (meta-tracking)

- **Severidad:** INFO
- **Razón de descarte:** Gap de meta-tracking sin acción propia. Los gaps individuales (#3, #4, #14, #15, #26) ya cubren todos los items accionables.
- **Fecha:** 2026-03-09

## SPEC-023 Gap #38: `as any` en base CRUD classes (6 usos)

- **Severidad:** LOW
- **Razón de descarte:** Limitación estructural de TypeScript generics en `BaseCrudService<TEntity>`. Los 6 `as any` (create, update, soft delete, hard delete, restore, findById) son necesarios porque el tipo exacto no se puede narrowear dentro de la clase base genérica. El refactor sería de complejidad 8/10 con beneficio marginal ya que los tipos se validan en capas superiores. Todos tienen `biome-ignore` comments documentando el motivo.
- **Fecha:** 2026-03-09

## SPEC-023 Gap #20: JS chunks excesivamente grandes

- **Severidad:** MEDIUM
- **Razón de descarte:** Verificado con build real. Los chunks grandes son `vendor-react` (1.1MB, inevitable), `lib-utils` (554KB) y `components-entity` (401KB). Estos últimos tienen circular deps que causan agrupamiento subóptimo, pero para un admin panel (no público) los tamaños son aceptables. El refactoring de circular deps es scope de SPEC-022 (Frontend Quality).
- **Fecha:** 2026-03-09

## SPEC-023 Gap #32: Migration 0018 no committed

- **Severidad:** HIGH
- **Razón de descarte:** Falso positivo. El archivo `packages/db/src/migrations/0018_perfect_the_fallen.sql` ya está committed en git. Verificado con `git ls-files`. El snapshot de git status al inicio de sesión era un artefacto.
- **Fecha:** 2026-03-09

## GAP-4TH-15: billing_subscription_events.metadata NOT NULL mismatch (PARCIAL)

- **Severidad:** HIGH
- **Razón de descarte parcial:** El agente de verificación encontró que el schema tiene `.notNull().default({})` correctamente. Sin embargo, se incluye en Batch F para verificar y alinear migration si es necesario.
- **Fecha:** 2026-03-08
- **Nota:** Se mantiene en Batch F como verificación, no como descarte total.

---

## SPEC-036 Gaps Descartados (sesión 2026-03-10)

### GAP-036-015: No debounce en blur validation

- **Severidad:** LOW
- **Razón de descarte:** YAGNI. Zod validation es sincrónica y toma <1ms. Los schemas del proyecto son simples. Agregar debounce introduce complejidad innecesaria (timers, cleanup, edge cases con submit durante debounce) sin beneficio real.
- **Fecha:** 2026-03-10

### GAP-036-018: Feedback form usa Zod con custom mapping

- **Severidad:** LOW
- **Razón de descarte:** YAGNI. Paquete self-contained (`packages/feedback`) que funciona correctamente con su propio `mapZodMessage()`. Migrar al sistema unificado de validation.json no agrega valor.
- **Fecha:** 2026-03-10

### GAP-036-019: Auth UI forms no usan Zod client-side

- **Severidad:** LOW
- **Razón de descarte:** By design. Better Auth maneja su propia validación built-in. Agregar Zod encima sería duplicar lógica sin beneficio.
- **Fecha:** 2026-03-10

---

## SPEC-042 Gaps Descartados (sesión 2026-03-17)

### GAP-042-02: Astro emite style hashes que rompen Sentry Session Replay

- **Severidad:** HIGH
- **Razón de descarte:** Falso positivo. Workaround ya implementado (no se configura styleDirective en astro.config.mjs). Además, experimental.csp se deshabilita por decisión en GAP-042-03.
- **Fecha:** 2026-03-17

### GAP-042-47: SPEC-045/046/047 no existen como archivos de spec

- **Severidad:** HIGH
- **Razón de descarte:** Ya resuelto. SPEC-046/047 fusionadas en SPEC-042 Phase 1.1/1.2/1.3. SPEC-045 tiene directorio creado.
- **Fecha:** 2026-03-17

### GAP-042-49: Sin validación de coherencia entre meta tag CSP y HTTP header CSP

- **Severidad:** MEDIUM
- **Razón de descarte:** Se resuelve automáticamente con GAP-042-03 (deshabilitar experimental.csp). Sin meta tag, CSP es 100% HTTP header, no hay dual-policy.
- **Fecha:** 2026-03-17

---

## SPEC-057 Gaps Descartados (sesión 2026-03-31)

### GAP-057-017: userId Exposed in PublicSchema for Review Entities

- **Severidad:** MEDIUM
- **Razón de descarte:** Decisión de producto intencional. Reviewer attribution es un feature, no un bug. Exponer userId en PublicSchema de reviews es consistente con el patrón de Post (authorId). Las plataformas de reviews muestran quién escribió la review.
- **Fecha:** 2026-03-31

### GAP-057-031: Review Entities Missing Admin CREATE Routes

- **Severidad:** LOW
- **Razón de descarte:** Intencional. Reviews son user-generated content; admins moderan (update/delete) pero no crean reviews en nombre de usuarios. Consistente con el modelo de datos del dominio.
- **Fecha:** 2026-03-31

---

## SPEC-054 Gaps Descartados (sesión 2026-04-05)

### GAP-054-018: Implicit reliance on backend 'all' default for status filter

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Informacional puro. Patrón REST estándar (no enviar param = no filtrar). No hay bug, acción, ni deuda técnica.
- **Fecha:** 2026-04-05

### GAP-054-024: filtersEqual function doesn't use RO-RO pattern

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Firma posicional es más natural y legible para un comparador puro de 2 argumentos. Excepción justificada a la convención RO-RO.
- **Fecha:** 2026-04-05

### GAP-054-025: Chips row layout classes split between FilterBar and ActiveFilterChips

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Resultado visual idéntico. Split de clases entre componentes es razonable.
- **Fecha:** 2026-04-05

### GAP-054-026: Barrel exports incomplete (internal components not exported)

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Encapsulación correcta. No exportar componentes internos desde el barrel es buen diseño y previene uso fuera de contexto.
- **Fecha:** 2026-04-05

### GAP-054-051: buildFilterParamUpdate not re-exported from barrel

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Encapsulación correcta. Solo se usa internamente por useFilterState, no hay consumidor externo. Mismo criterio que GAP-054-026.
- **Fecha:** 2026-04-05

### GAP-054-054: FilterBoolean ignores allLabelKey from config

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Se resuelve por diseño con GAP-054-032 (discriminated union). allLabelKey no aplica a BooleanFilterConfig. Ninguna config actual necesita un label distinto de "All" para boolean.
- **Fecha:** 2026-04-05

### GAP-054-055: requestAnimationFrame in ActiveFilterChips untestable in jsdom

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Informacional puro, no es un bug de producción. Tests de focus se pueden resolver con vi.spyOn(window, 'requestAnimationFrame') o vi.runAllTimersAsync().
- **Fecha:** 2026-04-05

### GAP-054-031: buildFilterChips O(n*m) sort complexity

- **Severidad:** Very Low (P4)
- **Razón de descarte:** Impacto negligible con 3-5 filtros por entidad. Optimización prematura.
- **Fecha:** 2026-04-05

# SPEC-039: Type Safety Audit — `as unknown as X` Double Cast

## Metadata

- **ID**: SPEC-039
- **Status**: draft
- **Created**: 2026-03-16
- **Priority**: medium
- **Effort**: large (2-3 días)
- **Relacionado con**: SPEC-020 (auditoría de `as any`)

---

## Overview

El patrón `as unknown as SomeType` es un **double cast** que bypasea el sistema de tipos de TypeScript de forma idéntica a `as any`. La única diferencia es sintáctica: mientras `as any` es explícito en su intención de evadir el type checker, `as unknown as T` lo hace de manera encubierta, dando una falsa sensación de que el código está tipado.

SPEC-020 auditó y eliminó usos de `as any` explícito en el monorepo. Sin embargo, el patrón `as unknown as X` no fue cubierto. Se identificaron **~90+ instancias** en archivos fuente (excluyendo tests) distribuidas en:

- `apps/admin/src`: ~22 instancias (feature configs, components, routes)
- `packages/db/src`: ~29 instancias (Drizzle models, adapters)
- `apps/api/src`: ~14 instancias (services, routes, middlewares, utils)
- `apps/web/src`: ~13 instancias (components Astro/React, pages)
- `packages/service-core/src`: ~10 instancias (base CRUD, services)

Este spec define el proceso de auditoría, categorización y remediación de todas las instancias.

---

## Problem Statement

### Por qué es un problema técnico real

**1. Equivalencia funcional con `as any`**

```typescript
// Estos dos son funcionalmente idénticos:
const x = foo as any as Bar;         // explícito
const y = foo as unknown as Bar;     // encubierto (este spec)
```

Ambos instruyen al compilador a ignorar cualquier incompatibilidad de tipos. El type checker no verifica que `foo` sea compatible con `Bar`.

**2. Riesgo de runtime crashes**

Cuando `foo` no es realmente del tipo `Bar`, el código falla en runtime. TypeScript hubiera prevenido esto con tipado correcto. Los double casts son especialmente peligrosos cuando:
- Se aplican a datos que vienen de la red (respuestas de API)
- Se aplican a resultados de queries de base de datos con JOINs
- Se usan para "hacer callar" al compilador en lugar de corregir el tipo

**3. Deuda técnica acumulada**

Cada instancia de `as unknown as X` representa una de estas situaciones:
- **Bug latente**: el tipo real no coincide con el cast (riesgo de runtime)
- **Tipo mal definido**: la definición del tipo no refleja la realidad del dato
- **Limitación de librería**: Drizzle u otras libs con tipos complejos que requieren workarounds
- **Atajo de developer**: se prefirió silenciar el error antes de corregirlo

**4. Erosión de la confianza en el type system**

Un codebase con muchos double casts pierde las garantías que TypeScript ofrece. Los errores de tipos dejan de ser detectados en compile time y aparecen como crashes en producción.

---

## Categorization Framework

Cada instancia encontrada debe clasificarse en una de estas tres categorías:

### Categoría A: Genuine Bug / Runtime Risk (DEBE CORREGIRSE)

Instancias donde el tipo real del valor no es compatible con el tipo al que se castea. El compilador hubiera detectado una incompatibilidad real si el double cast no existiera.

**Señales de identificación**:
- Cast de un tipo de API/respuesta HTTP a un tipo de dominio
- Cast de resultado de query Drizzle con JOIN a un tipo de entidad
- Cast de `unknown` o datos no validados a un tipo estructurado
- El IDE muestra error si se elimina el cast

**Remediación**: Corregir el tipo, agregar validación con Zod, o usar type guards.

**Ejemplos encontrados**:
```typescript
// apps/web — dato de API casteado a tipo de dominio
const fetched = result.data.bookmarks as unknown as Bookmark[];

// apps/admin/billing — dato de respuesta sin validación
const events = eventsData as unknown as WebhookEvent[];
```

### Categoría B: Drizzle ORM Limitation (PUEDE DOCUMENTARSE)

Instancias donde Drizzle genera tipos complejos (intersecciones de selects, JOINs, subqueries) que no son estructuralmente compatibles con los tipos de dominio, aunque en runtime el dato sí lo sea.

**Señales de identificación**:
- Aparece en archivos `*.model.ts` dentro de `packages/db/src/models/`
- El cast es de `DrizzleResult<...>` o similar a un tipo de entidad (`Accommodation`, `User`, etc.)
- Existe una limitación conocida de Drizzle (los tipos inferidos de queries con relaciones son estructuralmente distintos a los tipos de entidad definidos en schemas)

**Remediación**: Documentar con comentario explicativo + considerar Zod parse para validar en runtime.

**Ejemplos encontrados**:
```typescript
// packages/db — resultado de query Drizzle con relaciones
return result as unknown as Destination | null;
return { items: items as unknown as User[], total };
```

### Categoría C: Legitimate Workaround (REFACTORIZAR O DOCUMENTAR)

Instancias donde hay una incompatibilidad de tipos genuina entre dos sistemas bien definidos, pero que es intencional y no representa riesgo de runtime. Generalmente ocurre en adapters, factories o cuando se trabaja con tipos genéricos con constraints imposibles de satisfacer directamente.

**Señales de identificación**:
- Aparece en adapters entre dos sistemas (QZPay adapter, route factory)
- El double cast existe para compatibilizar dos tipos bien definidos donde la incompatibilidad es de variance o generics, no de estructura
- Existe una justificación arquitectónica documentada

**Remediación**: Agregar comentario explicativo con la justificación. Evaluar si es posible refactorizar los tipos para evitar el cast.

**Ejemplos encontrados**:
```typescript
// packages/db/billing — adapter entre sistemas
db as unknown as Parameters<typeof createQZPayDrizzleAdapter>[0]

// apps/api — route factory con tipos genéricos
return routes as unknown as AppOpenAPI;
```

---

## Scope

### In Scope

- Todos los archivos fuente (no tests) con el patrón `as unknown as` en:
  - `apps/admin/src/**/*.{ts,tsx}`
  - `apps/api/src/**/*.ts`
  - `apps/web/src/**/*.{ts,tsx,astro}`
  - `packages/db/src/**/*.ts`
  - `packages/service-core/src/**/*.ts`
- Clasificación de cada instancia en Categoría A, B o C
- Corrección de todas las instancias Categoría A
- Documentación de instancias Categoría B con comentarios explicativos
- Refactoring o documentación de instancias Categoría C

### Out of Scope

- Archivos de tests (`**/*.test.ts`, `**/*.test.tsx`, `test/**`)
- Packages que no son código fuente del monorepo (`node_modules`, builds)
- El patrón `as any` (cubierto por SPEC-020)
- Cambios a schemas Zod en `@repo/schemas` (pueden surgir como subtarea)
- Cambios a tipos en `@repo/db` que impliquen migración de base de datos

---

## User Stories

**US-1**: Como developer trabajando en el monorepo, quiero que el type checker capture incompatibilidades reales de tipos en los archivos de modelos y servicios, para detectar bugs en compile time en lugar de runtime.

**US-2**: Como developer revisando código en PR, quiero que los lugares donde se usa un workaround de tipos estén documentados con comentarios explicativos, para entender rápidamente si es intencional o un bug.

**US-3**: Como developer nuevo en el proyecto, quiero que los archivos de feature config del admin (`*.config.ts`) tengan tipos correctos sin double casts, para poder entender y extender el sistema de EntityList sin confusión.

**US-4**: Como tech lead, quiero que las instancias clasificadas como "riesgo de runtime" sean eliminadas y reemplazadas por código con tipos correctos o validación Zod, para tener garantías reales de type safety en producción.

---

## Acceptance Criteria

### AC-1: Audit Completo
- [ ] Se produce un inventario completo de todas las instancias de `as unknown as` en archivos fuente (no tests)
- [ ] Cada instancia está clasificada en Categoría A, B o C con justificación

### AC-2: Categoría A Eliminada
- [ ] Cero instancias de Categoría A (Genuine Bug / Runtime Risk) quedan en el codebase
- [ ] Cada instancia corregida tiene un test que verifica el comportamiento en el tipo correcto
- [ ] TypeScript compila sin errores (`pnpm typecheck` pasa)

### AC-3: Categoría B Documentada
- [ ] Cada instancia de Categoría B tiene un comentario en el formato `// DRIZZLE-LIMITATION: <explicación breve>`
- [ ] Se evalúa si Zod parse es viable en cada caso; si lo es, se implementa

### AC-4: Categoría C Documentada o Refactorizada
- [ ] Cada instancia de Categoría C tiene un comentario en el formato `// TYPE-WORKAROUND: <justificación>`
- [ ] Se evalúa si el workaround es eliminable; si lo es, se refactoriza

### AC-5: CI Pasa
- [ ] `pnpm typecheck` pasa sin errores
- [ ] `pnpm lint` pasa sin errores (Biome)
- [ ] `pnpm test` pasa con cobertura >= 90% en archivos modificados

### AC-6: Regresión Prevenida
- [ ] Se agrega una regla de Biome o script de CI que detecte nuevas instancias de `as unknown as` y requiera justificación

---

## Implementation Phases

### Phase 1: Audit & Categorize (Día 1)

**Objetivo**: Producir un inventario completo con cada instancia clasificada.

**Pasos**:

1. Ejecutar búsqueda exhaustiva del patrón en todos los archivos fuente:
   ```bash
   rg "as unknown as" apps/*/src packages/*/src --type ts --type tsx -n
   ```

2. Para cada instancia, determinar:
   - ¿Cuál es el tipo real del valor antes del cast?
   - ¿Cuál es el tipo destino?
   - ¿Son compatibles estructuralmente?
   - ¿Qué pasa en runtime si no lo son?

3. Clasificar en A / B / C y documentar en `.claude/tasks/SPEC-039-type-safety-double-cast/audit.md`

4. Priorizar instancias Categoría A por riesgo de runtime (datos de red primero, adapters después)

**Criterio de finalización**: Audit file creado con 100% de instancias clasificadas.

---

### Phase 2: Fix Runtime Risk Instances — Categoría A (Días 1-2)

**Objetivo**: Eliminar todas las instancias que representan riesgo de runtime.

**Estrategias de corrección** (en orden de preferencia):

**Estrategia 1: Corregir el tipo**
Si el tipo destino es incorrecto, corregirlo para que refleje la realidad:
```typescript
// Antes (incorrecto — el tipo ListItem no es compatible con el tipo full)
listItemSchema: DestinationListItemSchema as unknown as z.ZodSchema<Destination>

// Después — usar el tipo correcto
listItemSchema: DestinationListItemSchema as z.ZodSchema<DestinationListItem>
```

**Estrategia 2: Validar con Zod parse**
Si el dato viene de fuentes externas (API, red), validar en runtime:
```typescript
// Antes
const events = eventsData as unknown as WebhookEvent[];

// Después
const events = WebhookEventArraySchema.parse(eventsData);
```

**Estrategia 3: Type guard explícito**
Si no hay schema Zod disponible, usar type guards:
```typescript
// Antes
const bookmarks = result.data.bookmarks as unknown as Bookmark[];

// Después
function isBookmarkArray(val: unknown): val is Bookmark[] {
  return Array.isArray(val) && val.every(isBookmark);
}
const bookmarks = isBookmarkArray(result.data.bookmarks)
  ? result.data.bookmarks
  : [];
```

**Pasos**:

1. Trabajar instancia por instancia en orden de prioridad (datos de red > adapters > utils)
2. Para cada corrección: (a) eliminar el cast, (b) verificar que TypeScript compile, (c) agregar/actualizar test
3. Commit atómico por subsistema (admin, api, web, service-core)

---

### Phase 3: Fix or Document Remaining — Categorías B y C (Días 2-3)

**Objetivo**: Documentar limitaciones de Drizzle y justificar workarounds legítimos.

**Para Categoría B (Drizzle)**:

1. Agregar comentario explicativo encima de cada cast:
   ```typescript
   // DRIZZLE-LIMITATION: Drizzle infers complex intersection types for JOIN queries
   // that are structurally equivalent to `Destination` but not assignable without cast.
   // Runtime safety: the query selects exactly the fields defined in Destination.
   return result as unknown as Destination | null;
   ```

2. Evaluar si el dato puede validarse con Zod post-query (especialmente para datos que luego se exponen por API)

**Para Categoría C (Workarounds)**:

1. Agregar comentario explicativo:
   ```typescript
   // TYPE-WORKAROUND: AppOpenAPI is a branded type that wraps Hono's router.
   // The billing sub-router is structurally compatible but not assignable due to
   // TypeScript's nominal typing of the generic parameters.
   return routes as unknown as AppOpenAPI;
   ```

2. Evaluar refactoring del tipo para eliminar la necesidad del cast

**Pasos**:

1. Procesar todos los archivos `packages/db/src/models/**` (Categoría B)
2. Procesar adapters y route factories (Categoría C)
3. Commit por package

---

## Files to Audit (Initial List)

### apps/admin/src — ~22 instancias

**Feature configs** (Categoría A probable — `listItemSchema` con tipo incorrecto):
- `src/features/destinations/config/destinations.config.ts` (línea 26)
- `src/features/posts/config/posts.config.ts` (línea 21)
- `src/features/event-locations/config/event-locations.config.ts` (línea 24)
- `src/features/owner-promotions/config/owner-promotions.config.ts` (línea 24)
- `src/features/events/config/events.config.ts` (línea 16)
- `src/features/users/config/users.config.ts` (línea 25)
- `src/features/amenities/config/amenities.config.ts` (línea 21)
- `src/features/event-organizers/config/event-organizers.config.ts` (línea 24)
- `src/features/accommodations/config/accommodations.config.ts` (línea 25)
- `src/features/features/config/features.config.ts` (línea 21)
- `src/features/tags/config/tags.config.ts` (línea 21)
- `src/features/attractions/config/attractions.config.ts` (línea 21)
- `src/features/sponsors/config/sponsors.config.ts` (línea 21)

**Components/routes** (Categoría A probable — datos de API sin validación):
- `src/routes/_authed/billing/webhook-events.tsx` (líneas 71, 79)
- `src/routes/_authed/billing/notification-logs.tsx` (línea 61)
- `src/components/entity-pages/EntityCreateContent.tsx` (línea 240)
- `src/routes/_authed.tsx` (línea 99)
- `src/routes/_authed/analytics/debug.tsx` (líneas 18, 25)
- `src/features/billing-subscriptions/SubscriptionDetailsDialog.tsx` (línea 69)
- `src/features/exchange-rates/components/RateHistoryView.tsx` (línea 319)
- `src/lib/validation/validate-form.ts` (línea 26)
- `src/lib/factories/createBaseColumns.ts` (línea 275)

### apps/api/src — ~14 instancias

**Utils/caches** (Categoría C probable — adapters entre sistemas):
- `src/utils/logger.ts` (línea 81) — logger type adapter
- `src/utils/user-permissions-cache.ts` (línea 93)
- `src/utils/role-permissions-cache.ts` (línea 84)
- `src/utils/route-factory.ts` (línea 211)

**Middlewares** (Categoría C — acceso a propiedades custom en contexto Hono):
- `src/middlewares/validation.ts` (línea 36)

**Routes** (Categoría A/C — evaluar):
- `src/routes/billing/index.ts` (línea 124)
- `src/routes/event/public/getByLocation.ts` (línea 33)
- `src/routes/event/public/getByAuthor.ts` (línea 31)
- `src/routes/event/public/getByOrganizer.ts` (línea 39)
- `src/routes/webhooks/mercadopago/router.ts` (línea 82)

**Services** (Categoría A/B — evaluar):
- `src/services/billing-settings.service.ts` (líneas 185, 192, 254, 261)

### packages/db/src — ~29 instancias

**Models** (Categoría B probable — limitación Drizzle con JOINs):
- `src/models/user/user.model.ts` (líneas 73, 77, 203)
- `src/models/user/rUserPermission.model.ts` (línea 41)
- `src/models/destination/destination.model.ts` (líneas 64, 97)
- `src/models/destination/rDestinationAttraction.model.ts` (línea 39)
- `src/models/destination/destinationReview.model.ts` (líneas 64, 79)
- `src/models/event/event.model.ts` (línea 46)
- `src/models/sponsorship/sponsorshipLevel.model.ts` (líneas 36, 95)
- `src/models/exchange-rate/exchange-rate.model.ts` (líneas 115, 168, 192, 259)
- `src/models/accommodation.model.ts` (línea 45)
- `src/models/accommodation/accommodationReview.model.ts` (líneas 68, 83)
- `src/models/accommodation/rAccommodationFeature.model.ts` (línea 85)
- `src/models/accommodation/accommodation.model.ts` (líneas 111, 208, 245, 259)
- `src/utils/logger.ts` (línea 53)

**Billing adapter** (Categoría C — adapter entre Drizzle y QZPay):
- `src/billing/drizzle-adapter.ts` (líneas 110, 116)

### apps/web/src — ~13 instancias

**Pages y sections** (Categoría A probable — datos de API sin validación):
- `src/pages/[lang]/alojamientos/[slug].astro` (líneas 65, 175)
- `src/pages/[lang]/alojamientos/index.astro` (línea 109)
- `src/pages/[lang]/alojamientos/tipo/[type]/index.astro` (línea 122)
- `src/pages/[lang]/destinos/[...path].astro` (línea 55)
- `src/components/sections/DestinationsSection.astro` (línea 31)
- `src/components/sections/PostsSection.astro` (línea 33)
- `src/components/sections/EventsSection.astro` (línea 31)
- `src/components/sections/AccommodationsSection.astro` (línea 36)
- `src/components/destination/DestinationFilters.client.tsx` (línea 108)
- `src/components/account/UserFavoritesList.client.tsx` (línea 96)
- `src/components/account/UserReviewsList.client.tsx` (líneas 174, 175)

### packages/service-core/src — ~10 instancias

**Base CRUD** (Categoría B/C — tipos genéricos con constraints):
- `src/base/base.crud.write.ts` (líneas 140, 165, 410, 483)
- `src/base/base.crud.admin.ts` (línea 88)

**Services** (Categoría A/B — evaluar):
- `src/services/eventOrganizer/eventOrganizer.service.ts` (líneas 52, 56)
- `src/services/tag/tag.service.ts` (línea 337)
- `src/services/accommodation/accommodation.service.ts` (línea 783)
- `src/utils/service-logger.ts` (línea 51)

---

## Risk Assessment

### Riesgo Alto

- **Regresiones en feature configs del admin**: Los 13 archivos `*.config.ts` que castean `ListItemSchema as unknown as z.ZodSchema<FullEntity>` probablemente tienen un bug real. Corregirlos puede requerir cambios en el tipo genérico de `EntityConfig` o `EntityList`. Impacto: todas las páginas de lista del admin.
- **Drizzle models**: Modificar los casts en `packages/db/src/models/` puede exponer que los tipos de entidad definidos en `@repo/schemas` no coinciden exactamente con lo que Drizzle retorna. Puede requerir actualizaciones a schemas.

### Riesgo Medio

- **Base CRUD genérico**: `base.crud.write.ts` usa casts para construir objetos parciales de entidades genéricas. Corregirlos requiere entender el sistema de generics de `BaseCrudService`.
- **Route factories en API**: `route-factory.ts` y los routers de billing/webhooks usan casts para compatibilizar tipos de Hono. Pueden requerir refactoring de los tipos genéricos de Hono.

### Riesgo Bajo

- **Logger adapters**: Los casts en `logger.ts` (api, db, service-core) son todos del mismo patrón: adaptar un logger genérico a una interfaz tipada. Son seguros de documentar.
- **Web sections**: Los casts en Astro sections son probablemente corregibles alineando los tipos de las props de los mappers con los tipos de las respuestas de API.

### Mitigación

- Trabajar en branches por package/app (no un solo branch gigante)
- Correr `pnpm typecheck` y `pnpm test` después de cada grupo de cambios
- No modificar tests que pasen actualmente a menos que sea necesario
- Si un cast en `packages/db` requiere cambiar un schema, abrir issue separado (fuera de scope)

---

## Definition of Done

1. **Audit completo**: `.claude/tasks/SPEC-039-type-safety-double-cast/audit.md` existe con todas las instancias clasificadas (A/B/C) y justificadas.

2. **Cero instancias Categoría A**: `rg "as unknown as" apps/*/src packages/*/src` no retorna ninguna línea sin un comentario `// TYPE-WORKAROUND:` o `// DRIZZLE-LIMITATION:` explicativo. Las que eran Categoría A fueron corregidas y eliminadas.

3. **100% instancias documentadas**: Todas las instancias Categoría B y C tienen un comentario explicativo.

4. **CI verde**:
   - `pnpm typecheck` pasa sin errores
   - `pnpm lint` pasa sin errores
   - `pnpm test` pasa, cobertura >= 90% en archivos modificados

5. **Regresión prevenida**: Se agrega un check en CI (Biome lint rule o script custom) que detecte `as unknown as` sin comentario justificativo y falle el build.

6. **Spec actualizado**: Este spec pasa de `draft` a `completed` con un resumen de resultados en el campo de metadata.

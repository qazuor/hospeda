# GAP Report: SPEC-052 — Type-Safe Entity Filters via Generics

> **Spec Origin**: `.claude/specs/SPEC-052-type-safe-entity-filters/spec.md`
> **Implementation commits**: `61d23cc4`, `d1835351`, `97dc1949` (2026-04-08)
> **Audit Passes Completed**: 5
> **Last Audit**: 2026-04-08 (Pasada #5)

---

## Estado General de la Implementacion

**SPEC-052 esta COMPLETAMENTE implementada.** Los 3 commits del 2026-04-08 cubrieron los 5 pasos definidos en la spec.

### Acceptance Criteria — Verificacion Exhaustiva

| AC de la spec | Estado | Evidencia |
|---|---|---|
| `EntityFilters<TSchema>` exportado desde `@repo/schemas` | ✅ DONE | `packages/schemas/src/common/admin-search.schema.ts:137-140` |
| `AdminSearchBaseKeys` type exportado | ✅ DONE | `admin-search.schema.ts:116` |
| `ADMIN_SEARCH_BASE_KEYS` const exportada | ✅ DONE | `admin-search.schema.ts:122-124` |
| `AdminSearchExecuteParams<T>` generico con default `Record<string, unknown>` | ✅ DONE | `packages/service-core/src/types/index.ts:169-184` |
| `adminSearchSchema` tipo `ZodObject<ZodRawShape>` (no bare `ZodType`) | ✅ DONE | `base.crud.permissions.ts:49` |
| Barrel export chain intacta | ✅ DONE | `common/index.ts:20` -> `src/index.ts:2` |
| AccommodationService override tipado sin `as` cast | ✅ DONE | `accommodation.service.ts:278-298` |
| EventService override tipado sin `as` cast | ✅ DONE | `event.service.ts:385-419` |
| AccommodationReviewService override tipado sin `as` cast | ✅ DONE | `accommodationReview.service.ts:183-203` |
| DestinationReviewService override tipado sin `as` cast | ✅ DONE | `destinationReview.service.ts:166-186` |
| SponsorshipService override tipado sin `as` cast | ✅ DONE (ver GAP-002) | `sponsorship.service.ts:176-186` |
| UserService override tipado sin `as` cast | ✅ DONE (ver GAP-004) | `user.service.ts:396-416` |
| 10 servicios sin override funcionan sin cambios | ✅ DONE | Verificado los 10 |
| `super._executeAdminSearch()` compila sin casts adicionales | ✅ DONE | Todos los overrides |
| Zero nuevos `as` type assertions | ✅ DONE | 0 nuevos `as` casts |

---

## Pasada #1 de Auditoria — Gaps Encontrados

> **Metodo**: Exploracion exhaustiva con 3 agentes paralelos analizando schemas, service-core, tests, edge cases y cross-cutting concerns.

---

### GAP-052-001: Sin tests service-specific para los 6 overrides de `_executeAdminSearch`

> **Auditoria**: Pasada #1

**Descripcion**

Los 6 servicios que overridean `_executeAdminSearch()` contienen logica SQL custom no-trivial:

| Servicio | Logica custom | Riesgo |
|---|---|---|
| AccommodationService | JSONB extraction `price->>'price'` via `sql\`\`` | SQL generation incorrecta silenciosa |
| EventService | JSONB extraction `date->>'start'` y `date->>'end'` (4 conditions) | 4 condiciones de fecha sin test |
| AccommodationReviewService | `gte`/`lte` en `averageRating` con `.toString()` cast | Cast incorrecto pasa desapercibido |
| DestinationReviewService | Igual que AccommodationReview | Idem |
| SponsorshipService | Column remapping `sponsorshipStatus` → `status` | Remap silencioso si falla |
| UserService | ILIKE partial match + bypass de `super._executeAdminSearch()` | El bypass puede perderse en un refactor |

Ningun servicio tiene tests en `test/services/{nombre}/` que ejerciten su override de `_executeAdminSearch`.

**Evidencia**

```
packages/service-core/test/services/accommodation/ — 0 archivos con adminList/executeAdminSearch
packages/service-core/test/services/event/          — 0 archivos con adminList/executeAdminSearch
packages/service-core/test/services/accommodationReview/ — 0 archivos con adminList/executeAdminSearch
packages/service-core/test/services/destinationReview/   — 0 archivos con adminList/executeAdminSearch
packages/service-core/test/services/sponsorship/    — 0 archivos con adminList/executeAdminSearch
packages/service-core/test/services/user/           — 0 archivos con adminList/executeAdminSearch
```

Solo existen tests base en:
- `test/base/crud/adminList.test.ts` (31 tests, base class behavior)
- `test/base/crud/executeAdminSearch.test.ts` (15 tests, merging/routing logic)
- `test/base/crud/adminListPermissionChain.test.ts` (permission chain)

**Contradiccion con la Spec**

La spec en la seccion "Existing Test Coverage" afirma:

> *"The 6 services with overrides already have tests covering their adminList() / _executeAdminSearch() behavior from SPEC-049."*

**Esto es incorrecto.** SPEC-049 produjo el commit `82b49ae1` que crea `adminList.test.ts` y `executeAdminSearch.test.ts` — ambos tests de BASE CLASS, no de servicios concretos. Ningun test verifica la logica SQL concreta de los 6 overrides.

**Impacto**

- La logica JSONB (`price->>'price'`, `date->>'start'`) puede estar mal formada y no se detectaria hasta produccion
- El remapping `sponsorshipStatus` → `status` en SponsorshipService no tiene cobertura
- El bypass de `super._executeAdminSearch()` en UserService no esta testeado

**Soluciones Propuestas**

**Opcion 1 (Recomendada)**: Crear SPEC nueva `SPEC-XXX: Service-Level AdminSearch Tests` que cubra los 6 overrides con integration tests usando mocks del modelo y verificando las condiciones SQL generadas.

**Opcion 2**: Agregar tests directamente como fix en esta SPEC (dado que la spec lo declara como ya hecho).

**Prioridad**: P1 | **Severidad**: HIGH | **Complejidad**: Medium
**Accion**: SPEC nueva recomendada — requiere setup de fixtures por servicio y estrategia de mock del modelo

**DECISION (2026-04-08)**: ✅ HACER — Opcion A. Fix directo en el contexto de SPEC-052, sin abrir spec nueva. Agregar tests de servicio en `packages/service-core/test/services/{nombre}/` para los 6 overrides.

---

### GAP-052-002: SponsorshipService re-introduce `Record<string, unknown>` en el intermedio

> **Auditoria**: Pasada #1

**Descripcion**

En `sponsorship.service.ts:181`, el code usa un tipo explicito `Record<string, unknown>` para la variable intermedia `mappedFilters`, perdiendo toda la type safety ganada con `EntityFilters`:

```ts
// Linea 181 — pierde type safety aqui
const mappedFilters: Record<string, unknown> = { ...otherFilters };
if (sponsorshipStatus) {
    mappedFilters.status = sponsorshipStatus;
}
return super._executeAdminSearch({ ...rest, entityFilters: mappedFilters });
```

En este punto, `otherFilters` seria del tipo `Omit<SponsorshipEntityFilters, 'sponsorshipStatus'>` = `{ sponsorUserId?: string; targetType?: SponsorshipTargetTypeEnum; targetId?: string }`. Al abrirlo en `Record<string, unknown>`, TypeScript deja de proteger ese objeto.

**Evidencia**

```
packages/service-core/src/services/sponsorship/sponsorship.service.ts:181
```

**Nota**: La spec misma propone este patron. Entonces el codigo matchea la spec. El gap es de diseno en la spec.

**Impacto**

Bajo en runtime (los datos estan validados por Zod antes de llegar aca). El impacto es en type-safety puro: si se agrega un campo a `SponsorshipAdminSearchSchema`, TypeScript no alertara si hay un error en el manejo del campo en este service.

**Soluciones Propuestas**

**Opcion 1 (Minimal)**: Usar un tipo intermedio mas especifico para preservar los otros campos:

```ts
type MappedSponsorshipFilters = Omit<SponsorshipEntityFilters, 'sponsorshipStatus'> & {
    status?: SponsorshipStatusEnum;
};
const mappedFilters: MappedSponsorshipFilters = { ...otherFilters };
if (sponsorshipStatus) {
    mappedFilters.status = sponsorshipStatus;
}
return super._executeAdminSearch({
    ...rest,
    entityFilters: mappedFilters as Record<string, unknown> // un solo cast, scoped
});
```

**Opcion 2 (Simple)**: Dejar como esta. El `Record<string, unknown>` es el ultimo paso antes de pasar al super, que igual espera `Record<string, unknown>`. No es peor que el estado previo a SPEC-052.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: Low
**Accion**: Fix directo en el service, sin necesidad de SPEC nueva

---

### GAP-052-003: `ADMIN_SEARCH_BASE_KEYS` es dead code

> **Auditoria**: Pasada #1

**Descripcion**

La constante runtime `ADMIN_SEARCH_BASE_KEYS` fue exportada desde `@repo/schemas` pero no se consume en ninguna parte del codebase:

```ts
// packages/schemas/src/common/admin-search.schema.ts:122-124
export const ADMIN_SEARCH_BASE_KEYS: readonly AdminSearchBaseKeys[] = Object.keys(
    AdminSearchBaseSchema.shape
) as AdminSearchBaseKeys[];
```

Busqueda de `ADMIN_SEARCH_BASE_KEYS` en el codebase: **0 importaciones** fuera de la definicion y archivos de spec.

**Evidencia**

```
packages/schemas/src/common/admin-search.schema.ts:122 — definicion
.claude/specs/SPEC-052-type-safe-entity-filters/spec.md — solo en spec docs
```

**Nota**: La spec dice "Useful for documentation, runtime utilities, or dynamic key filtering" — es una exportacion anticipada para uso futuro.

**Impacto**

Nulo en runtime. Es dead code exportado, pero inofensivo. Aumenta el surface area del public API de `@repo/schemas` con algo que nadie usa.

**Soluciones Propuestas**

**Opcion 1**: Dejar como esta — la intencion de la spec es tenerlo disponible para uso futuro.

**Opcion 2**: Remover y restaurar cuando realmente se necesite.

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: No requiere SPEC nueva. Decision de product/tech: mantener o remover.

**DECISION (2026-04-08)**: ❌ DESCARTAR — Dejar como esta. La constante es inofensiva y puede ser util en el futuro para runtime utilities o dynamic key filtering.

---

### GAP-052-004: UserService email ILIKE sin escape de wildcards SQL

> **Auditoria**: Pasada #1

**Descripcion**

En `user.service.ts:407`, el filtro de email por ILIKE interpola el valor directamente sin escapar los wildcards `%` y `_`:

```ts
// Linea 407 — wildcard injection
additionalConditions.push(ilike(userTable.email, `%${email}%`));
```

Si un admin ingresa `%` como filtro de email, matchea todos los registros. Si ingresa `a_b@`, matchea cualquier email donde el tercer caracter puede ser cualquier cosa. No es SQL injection (Drizzle parametriza), pero si es **wildcard injection semantica**.

**Evidencia**

```
packages/service-core/src/services/user/user.service.ts:407
```

**Nota**: La spec reconoce esto explicitamente y lo delega a SPEC-055:

> *"The `ilike(userTable.email, `%${email}%`)` pattern is vulnerable to LIKE wildcard injection... This is a pre-existing issue tracked by SPEC-055 (Like Wildcard Escaping) and is NOT in scope for this spec."*

**Accion necesaria**: Verificar que SPEC-055 exista y cubra especificamente el `UserService.email` ILIKE. Si SPEC-055 no existe o no cubre esto, crear la referencia.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: N/A (trackeado por SPEC-055)
**Accion**: Verificar existencia de SPEC-055 y que incluya este caso especifico

---

### GAP-052-005: Spec status "draft" aunque implementacion esta completa

> **Auditoria**: Pasada #1

**Descripcion**

El archivo `spec.md` linea 3 aun dice `Status: draft` a pesar de que los 3 commits de implementacion ya estan en `main`.

**Evidencia**

```
.claude/specs/SPEC-052-type-safe-entity-filters/spec.md:3 — > **Status**: draft
Commits: 61d23cc4, d1835351, 97dc1949 — todos en main, mergeados 2026-04-08
```

**Impacto**

El indice de specs (`index.json`) puede estar desactualizado. Cualquier herramienta que lea el status para decidir que specs estan pendientes mostrara SPEC-052 como incompleta.

**Solucion**

Actualizar la linea 3 a `> **Status**: completed`.

**Prioridad**: P1 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: Fix directo — 1 linea en spec.md

**DECISION (2026-04-08)**: ✅ HACER — Fix inmediato. Cambiar `Status: draft` → `Status: completed` en spec.md linea 3.

---

### GAP-052-006: Sin task tracking files en `.claude/tasks/`

> **Auditoria**: Pasada #1

**Descripcion**

No existen archivos de tracking de tareas para SPEC-052 en `.claude/tasks/`. La spec fue implementada directamente sin pasar por el workflow formal de task tracking.

**Evidencia**

```
.claude/tasks/SPEC-052*  — 0 archivos
```

**Impacto**

No afecta el codigo ni la calidad. Solo afecta la trazabilidad del workflow.

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: No amerita accion retroactiva. Notar para futuras specs.

---

### GAP-052-007: Type aliases `XxxEntityFilters` sin JSDoc en los 6 servicios

> **Auditoria**: Pasada #1

**Descripcion**

Los 6 servicios definen type aliases locales como:

```ts
// accommodation.service.ts:96 — sin JSDoc
type AccommodationEntityFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;
```

No tienen ningun comentario JSDoc ni descripcion de que campos incluye el tipo. Alguien leyendo el codigo tiene que ir a buscar el schema para entender que hay ahi.

**Evidencia**

```
accommodation.service.ts:96
event.service.ts:59
accommodationReview.service.ts:52
destinationReview.service.ts:39
sponsorship.service.ts:35
user.service.ts:48
```

**La spec dice**: No menciona JSDoc para estos type aliases en ningun momento.

**Impacto**

Bajo. Es un issue de documentacion/DX, no funcional.

**Solucion directa**

Agregar 1-liner JSDoc a cada uno:

```ts
/** Entity-specific filter fields for accommodation admin search (type, destinationId, ownerId, isFeatured, minPrice, maxPrice). */
type AccommodationEntityFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;
```

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: Fix directo, no requiere SPEC nueva

---

## Pasada #2 de Auditoria — Gaps Encontrados

> **Metodo**: 3 agentes exploratorios paralelos (schemas/barrel-exports, service-core/6-overrides, tests/edge-cases/cross-refs). Contraste exhaustivo spec vs codigo linea por linea.

### Estado de Gaps de Pasada #1

| Gap ID | Estado en Pasada #2 | Detalle |
|---|---|---|
| GAP-052-001 | **SIN FIX** | Sigue sin tests service-specific para los 6 overrides |
| GAP-052-002 | **RECLASIFICADO ACEPTABLE** (Pasada #3) | `Record<string, unknown>` en `mappedFilters` es necesidad pragmatica para el super call post-remapping. No es regression |
| GAP-052-003 | **SIN FIX** | `ADMIN_SEARCH_BASE_KEYS` sigue sin consumidores |
| GAP-052-004 | **CONFIRMADO DELEGADO** | SPEC-055 existe en `.claude/specs/SPEC-055-like-wildcard-escaping/spec.md` (status: draft). Cubre el patron general de ILIKE injection |
| GAP-052-005 | **SIN FIX** | `spec.md:3` sigue diciendo `Status: draft` |
| GAP-052-006 | **SIN FIX** | Sin task tracking files (low priority, no accion requerida) |
| GAP-052-007 | **RESUELTO** (Pasada #3) | Los 6 servicios ahora tienen JSDoc en sus type aliases. Verificados: accommodation:95, event:58, accommodationReview:51, destinationReview:38, sponsorship:34, user:47 |

---

### GAP-052-008: SPEC-052 no esta en `index.json`

> **Auditoria**: Pasada #2

**Descripcion**

El archivo `.claude/specs/index.json` no contiene ninguna entrada para SPEC-052. El directorio de la spec existe en `SPEC-052-type-safe-entity-filters/` y la implementacion esta completa en 3 commits, pero el indice de specs no la incluye.

**Evidencia**

```
.claude/specs/index.json — 14 entries, ninguna con specId "SPEC-052"
.claude/specs/SPEC-052-type-safe-entity-filters/ — directorio existe
Commits 61d23cc4, d1835351, 97dc1949 — todos en main
```

**Impacto**

Cualquier herramienta o workflow que lea `index.json` para enumerar specs no vera SPEC-052. Afecta trazabilidad y tooling de specs.

**Solucion**

Agregar entrada: `{"specId": "SPEC-052", "title": "Type-Safe Entity Filters via Generics", "type": "refactor", "complexity": "medium", "status": "completed", "path": "SPEC-052-type-safe-entity-filters"}`

**Prioridad**: P2 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: Fix directo — agregar linea a index.json

**DECISION (2026-04-08)**: ✅ HACER — Fix inmediato. Agregar entry de SPEC-052 como `completed` en `.claude/specs/index.json`.

---

### GAP-052-009: Billing promo-code ILIKE wildcard injection no trackeada en SPEC-055

> **Auditoria**: Pasada #2

**Descripcion**

El servicio de promo-codes de billing tiene el mismo patron vulnerable de ILIKE wildcard injection que `UserService`, pero NO esta mencionado en SPEC-055 ni en ningun gap report previo.

**Evidencia**

```
packages/service-core/src/services/billing/promo-code/promo-code.crud.ts:370
  ilike(billingPromoCodes.code, `%${codeSearch}%`)
```

Patron identico a `user.service.ts:407`: interpola directamente sin escapar wildcards `%` y `_`.

**Impacto**

Un admin ingresando `%` como busqueda de promo code matchearia todos los codigos. Menos sensible que la busqueda de emails pero misma clase de bug.

**Otros servicios con `$ilike` (patron diferente, cubierto por SPEC-055 Problem 2)**:
- `eventOrganizer.service.ts:134,166,169` — usa `$ilike` object syntax (broken, otro problema)
- `postSponsor.service.ts:101,105,123,126,151,154` — usa `$ilike` object syntax
- `eventLocation.service.ts:146-148,173-175,204-217` — usa `$ilike` object syntax

**Solucion**

Asegurar que SPEC-055 incluya explicitamente `promo-code.crud.ts:370` en su scope.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: N/A (trackeado por SPEC-055)
**Accion**: Verificar/actualizar scope de SPEC-055 para incluir este caso

---

### GAP-052-010: Sin tests de verificacion de tipos compile-time para `EntityFilters`

> **Auditoria**: Pasada #2

**Descripcion**

El type utility `EntityFilters<TSchema>` es el deliverable central de SPEC-052, pero no existe ningun test que verifique que computa los tipos correctamente. No se encontraron usos de `expectTypeOf`, `assertType`, `tsd`, ni ninguna utilidad de type-testing en todo el monorepo.

**Evidencia**

```
Busqueda de expectTypeOf, assertType, tsd en **/*.test.ts — 0 resultados
```

**Impacto**

Un refactor futuro podria romper `EntityFilters` silenciosamente. TypeScript solo lo detectaria si alguien usa el tipo de una manera que trigger un error de compilacion. Ningun test valida que, por ejemplo, `EntityFilters<typeof AccommodationAdminSearchSchema>` produce exactamente `{type?: AccommodationTypeEnum; destinationId?: string; ...}`.

**Soluciones Propuestas**

**Opcion 1 (Recomendada)**: Agregar type-level tests usando `expectTypeOf` de Vitest (disponible desde vitest 0.25+):

```ts
import { expectTypeOf } from 'vitest';
import type { EntityFilters } from '@repo/schemas';
import type { AccommodationAdminSearchSchema } from '@repo/schemas';

it('EntityFilters computes correct fields for AccommodationAdminSearchSchema', () => {
    expectTypeOf<EntityFilters<typeof AccommodationAdminSearchSchema>>()
        .toHaveProperty('minPrice');
    expectTypeOf<EntityFilters<typeof AccommodationAdminSearchSchema>>()
        .not.toHaveProperty('page');
});
```

**Opcion 2**: Incluir en la SPEC nueva de tests (GAP-052-001) junto con los tests de service overrides.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: Low
**Accion**: Incluir en SPEC nueva de testing (junto con GAP-052-001) o como fix directo

**DECISION (2026-04-08)**: ✅ HACER — Fix directo. Agregar type-level tests en `packages/schemas/test/` usando `expectTypeOf` de Vitest para `EntityFilters` y los schemas principales.

---

### GAP-052-011: `queryBooleanParam()` doble `.optional()` redundante

> **Auditoria**: Pasada #2

**Descripcion**

La funcion `queryBooleanParam()` encadena `.optional()` dos veces:

```ts
// packages/schemas/src/common/query-helpers.ts:15-16
z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined;
    return val === 'true' || val === true || val === '1';
}, z.boolean().optional()).optional();
//              ^^^^^^^^^^^  ^^^^^^^^^^^
//              inner         outer — redundante
```

En Zod, `T | undefined | undefined` se simplifica a `T | undefined`, asi que no hay impacto funcional ni de tipos. Pero es codigo semanticamente redundante.

**Impacto**

Nulo. No afecta runtime ni tipos. Issue puramente de claridad de codigo.

**Solucion**

Remover uno de los dos `.optional()`.

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: Fix directo, no requiere SPEC nueva. Nota: esto NO es scope de SPEC-052, es un hallazgo colateral.

**DECISION (2026-04-08)**: ✅ HACER — Fix directo. Remover el `.optional()` externo redundante en `packages/schemas/src/common/query-helpers.ts:16`.

---

### GAP-052-012: Tests base usan `AdminSearchExecuteParams` sin parametro generico

> **Auditoria**: Pasada #2

**Descripcion**

Los dos archivos de test base de admin search importan y usan `AdminSearchExecuteParams` sin tipo generico:

```ts
// adminList.test.ts:21
import type { AdminSearchExecuteParams } from '../../src/types/index.js';

// executeAdminSearch.test.ts:13
import type { AdminSearchExecuteParams } from '../../src/types/index.js';
```

Ningun test en todo el monorepo instancia `AdminSearchExecuteParams<SomeSpecificType>` para verificar que el generico funciona end-to-end.

**Impacto**

El parametro generico de `AdminSearchExecuteParams<T>` (segundo deliverable central de SPEC-052) tiene cero cobertura de tests. Una regresion que rompa el generico no seria detectada.

**Solucion**

Agregar al menos un test que use `AdminSearchExecuteParams<{category: string}>` y verifique que `entityFilters.category` es type-checked.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: Low
**Accion**: Incluir en SPEC nueva de testing (junto con GAP-052-001 y GAP-052-010)

**DECISION (2026-04-08)**: ✅ HACER — Fix directo. Agregar test en `executeAdminSearch.test.ts` que instancie `AdminSearchExecuteParams<{email: string}>` y verifique el comportamiento con tipo concreto.

---

## Verificaciones de la Pasada #2 que NO encontraron problemas

Las siguientes areas fueron auditadas exhaustivamente y confirmadas como correctas:

| Area Verificada | Resultado |
|---|---|
| `EntityFilters<TSchema>` definicion y constraint `ZodObject<ZodRawShape>` | PASS — matchea spec exactamente |
| `AdminSearchBaseKeys` derivacion de `keyof z.infer<typeof AdminSearchBaseSchema>` | PASS |
| Barrel exports chain (`admin-search.schema.ts` → `common/index.ts` → `src/index.ts`) | PASS — todos accesibles via `@repo/schemas` |
| Los 8 campos base de `AdminSearchBaseSchema` no cambiaron desde la spec | PASS |
| Los 16 AdminSearchSchemas usan patron `.extend({})` (compatible con `EntityFilters`) | PASS |
| `DestinationReviewAdminSearchSchema` `.transform()` es field-level, no object-level | PASS — no produce `ZodEffects` |
| `EventOrganizerAdminSearchSchema` empty extend → `EntityFilters` = `{}` | PASS |
| `AdminSearchExecuteParams<TEntityFilters = Record<string, unknown>>` con default correcto | PASS |
| `adminSearchSchema` property es `ZodObject<ZodRawShape>` con imports correctos | PASS |
| Base `_executeAdminSearch()` usa `AdminSearchExecuteParams` sin parametrizar | PASS |
| 6 service overrides: todos tipados con `AdminSearchExecuteParams<XxxEntityFilters>` | PASS |
| 0 nuevos `as` casts en entityFilters en los 6 servicios | PASS |
| 0 `@ts-ignore` o `@ts-expect-error` en `packages/service-core/src/` | PASS |
| 10 servicios sin override no fueron modificados accidentalmente | PASS (3 verificados) |
| 16 API routes admin list siguen patron estandar `service.adminList(actor, query)` | PASS |
| SPEC-059 no implementada aun — consistente, no hay conflicto | PASS |
| 3 commits de implementacion verificados en git log | PASS |

---

## Pasada #3 de Auditoria — Gaps Encontrados

> **Metodo**: 3 agentes exploratorios paralelos (schemas/barrel-exports, service-core/6-overrides-deep, tests/cross-cutting/process). Verificacion exhaustiva de gaps previos + busqueda de nuevos.

### Estado de Gaps Previos en Pasada #3

| Gap ID | Estado en Pasada #3 | Detalle |
|---|---|---|
| GAP-052-001 | **SIN FIX** | Sigue sin tests service-specific. Confirmado: zero archivos nuevos desde pasada #2 |
| GAP-052-002 | **RECLASIFICADO ACEPTABLE** | `Record<string, unknown>` en `mappedFilters` es necesidad pragmatica para super call post-remapping, no type safety regression |
| GAP-052-003 | **SIN FIX** | `ADMIN_SEARCH_BASE_KEYS` sigue sin consumidores en todo el monorepo |
| GAP-052-004 | **CONFIRMADO DELEGADO** | SPEC-055 cubre UserService email ILIKE. Status: draft |
| GAP-052-005 | **SIN FIX** | `spec.md:3` sigue diciendo `Status: draft` |
| GAP-052-006 | **SIN FIX** | Sin task tracking files (no requiere accion) |
| GAP-052-007 | **RESUELTO** | TODOS los 6 servicios ahora tienen JSDoc en sus type aliases |
| GAP-052-008 | **SIN FIX** | SPEC-052 sigue sin entry en `index.json` |
| GAP-052-009 | **RESUELTO** | Verificado: SPEC-055 ya incluye `promo-code.crud.ts:370` en su scope (6 referencias en el spec) |
| GAP-052-010 | **SIN FIX** | Zero uso de `expectTypeOf` en el monorepo. vitest 3.1.3 lo soporta pero no se usa |
| GAP-052-011 | **SIN FIX** | `queryBooleanParam()` sigue con doble `.optional()`. Confirmado: no existe `queryDateParam`, asi que es caso aislado |
| GAP-052-012 | **SIN FIX** | Tests base siguen usando `AdminSearchExecuteParams` sin generico |

### Correccion a report previo

**GAP-052-001 descripcion actualizada**: La tabla original mencionaba `.toString()` cast en AccommodationReviewService y DestinationReviewService (`gte(accommodationReviews.averageRating, minRating.toString())`). Esto ya **NO existe** en el codigo actual.. ambos servicios pasan `minRating`/`maxRating` directamente a `gte()`/`lte()` sin conversion. El riesgo de "cast incorrecto" listado en la tabla de pasada #1 ya no aplica.

---

### GAP-052-013: Servicios adicionales no listados en la spec

> **Auditoria**: Pasada #3

**Descripcion**

La spec lista 16 servicios: 6 con override y 10 sin override. Sin embargo, existen 5 servicios adicionales que no fueron mencionados en la spec:

| Servicio | Archivo | Override? |
|---|---|---|
| `ExchangeRateService` | `exchange-rate/exchange-rate.service.ts` | No |
| `PostSponsorshipService` | `postSponsorship/postSponsorship.service.ts` | No |
| `UserBookmarkService` | `userBookmark/userBookmark.service.ts` | No |
| `SponsorshipPackageService` | `sponsorship/sponsorshipPackage.service.ts` | No |
| `SponsorshipLevelService` | `sponsorship/sponsorshipLevel.service.ts` | No |

Ninguno overridea `_executeAdminSearch()`, asi que no requieren cambios de tipado. Pero la spec deberia documentarlos para completitud.

**Impacto**

Nulo en runtime ni tipos. Es un gap de documentacion/completitud de la spec.

**Solucion**

Actualizar la tabla "Services That Use Default `_executeAdminSearch()`" en la spec para incluir los 5 servicios faltantes (total: 15 sin override, no 10).

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: Fix directo en spec.md, no requiere SPEC nueva

---

### GAP-052-014: Integration tests de API no validan comportamiento de filtros entity-specific

> **Auditoria**: Pasada #3

**Descripcion**

Los integration tests existentes en `apps/api/test/` para admin list endpoints solo validan:
- HTTP reachability (status codes 200, 401, 403)
- Auth y permisos
- Formato de respuesta basico

NO validan que los filtros entity-specific funcionen correctamente:

| Filtro | Archivo de service | Lo que NO se testea |
|---|---|---|
| `minPrice`/`maxPrice` | accommodation.service.ts | Que la query JSONB `price->>'price'` genere resultados correctos |
| `startDateAfter`/`endDateBefore` | event.service.ts | Que las 4 condiciones de fecha JSONB funcionen |
| `minRating`/`maxRating` | accommodationReview.service.ts | Que `gte`/`lte` en `averageRating` filtre correctamente |
| `email` (ILIKE) | user.service.ts | Que el partial match funcione (y no matchee de mas) |
| `sponsorshipStatus` remap | sponsorship.service.ts | Que `sponsorshipStatus` → `status` produzca resultados correctos |

**Evidencia**

```
apps/api/test/routes/admin/admin-list-routes.test.ts — solo testea reachability y auth
apps/api/test/integration/sponsorship/admin-list.test.ts — sponsorship-specific pero sin filtros
apps/api/test/integration/accommodation-reviews/admin-crud.test.ts — CRUD basico
apps/api/test/integration/destination-reviews/admin-crud.test.ts — CRUD basico
```

**Impacto**

Un bug en la logica SQL (JSONB extraction, rating comparison, ILIKE pattern) pasaria desapercibido. La unica forma de detectarlo seria manualmente en produccion o que cause un error 500.

**Relacion con GAP-052-001**

Este gap complementa GAP-052-001 (unit tests de service overrides). GAP-052-001 pide tests a nivel service con mocks del modelo. GAP-052-014 pide tests a nivel API con base de datos real. Ambos son necesarios para cobertura completa, pero si solo se puede hacer uno, GAP-052-001 (unit tests) tiene mayor ROI.

**Soluciones Propuestas**

**Opcion 1 (Recomendada)**: Incluir en la SPEC nueva de testing propuesta en GAP-052-001. Agregar una seccion de integration tests que pase query params reales por HTTP y verifique que los resultados filtrados son correctos.

**Opcion 2**: Agregar a la SPEC de integration tests existente (SPEC-041: Admin Integration Tests) como extension.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: Medium (requiere fixtures/seed de datos)
**Accion**: Incluir en SPEC nueva de testing (junto con GAP-052-001)

**DECISION (2026-04-08)**: ✅ HACER — Fix directo. Agregar integration tests en `apps/api/test/integration/` que pasen query params reales via HTTP y verifiquen resultados filtrados con DB real.

---

### Verificaciones de la Pasada #3 que NO encontraron problemas

| Area Verificada | Resultado |
|---|---|
| Zero `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` en service-core/src/ | PASS |
| Zero `as` casts sobre entityFilters en todo service-core/src/ | PASS |
| 16 AdminSearchSchemas todos usan `.extend({})` (no `.merge()`, `.and()`) | PASS |
| AdminSearchBaseSchema tiene exactamente 8 campos (no cambio desde spec) | PASS |
| Barrel export chain completa: admin-search.schema.ts → common/index.ts → src/index.ts | PASS |
| Los 16 entity admin-search schemas re-exportados correctamente | PASS |
| DestinationReview `.transform()` en status es field-level, no object-level | PASS |
| EventOrganizerAdminSearchSchema empty extend → `EntityFilters` = `{}` | PASS |
| `adminSearchSchema` property es `ZodObject<ZodRawShape>` con imports correctos | PASS |
| SPEC-059 no implementada (status: draft) — no conflictos con _ctx parameter | PASS |
| 5 servicios adicionales (ExchangeRate, PostSponsorship, UserBookmark, SponsorshipPackage, SponsorshipLevel) no tienen override ni requieren cambios | PASS |
| `queryDateParam` no existe — no hay issue de doble .optional() en date params | PASS |
| AccommodationReview y DestinationReview ya NO usan `.toString()` en minRating/maxRating | PASS (correccion a report previo) |

---

## Resumen Ejecutivo

### Implementacion

SPEC-052 esta **completamente implementada** y matchea todos los acceptance criteria. Los 3 commits cubren los 5 pasos del spec.

### Gaps por Categoria (Acumulado Pasada #1 + #2 + #3)

| Categoria | Gaps Abiertos | Severidad Maxima |
|---|---|---|
| Testing | GAP-052-001, GAP-052-010, GAP-052-012, GAP-052-014 | HIGH |
| Security (delegado) | GAP-052-004 | MEDIUM (trackeado en SPEC-055) |
| Mantenimiento | GAP-052-003, GAP-052-011 | LOW |
| Process/Docs | GAP-052-005, GAP-052-006, GAP-052-008, GAP-052-013 | LOW |

### Gaps Resueltos

| Gap ID | Resuelto en | Detalle |
|---|---|---|
| GAP-052-002 | Pasada #3 | Reclasificado como ACEPTABLE (pragmatic necessity) |
| GAP-052-007 | Pasada #3 | Todos los 6 servicios tienen JSDoc |
| GAP-052-009 | Pasada #3 | SPEC-055 ya cubre promo-code.crud.ts |

### Accion Inmediata Recomendada

1. **GAP-052-005 + GAP-052-008 + GAP-052-013**: Fix trivial — actualizar `Status: draft` a `Status: completed` en spec.md, agregar entry a index.json, actualizar lista de servicios en spec
2. **GAP-052-001 + GAP-052-010 + GAP-052-012 + GAP-052-014**: Abrir SPEC nueva para tests de service overrides + type-level tests + integration filter tests — el cluster de testing es el unico gap con riesgo real de bugs silenciosos en produccion
3. **GAP-052-011**: Fix trivial opcional — remover el `.optional()` redundante en `queryBooleanParam()`

### Gaps que NO Requieren Accion Nueva

- **GAP-052-002**: Reclasificado ACEPTABLE — necesidad pragmatica para super call
- **GAP-052-004**: Ya trackeado en SPEC-055 (status: draft)
- **GAP-052-006**: Cosmetic, no amerita accion retroactiva
- **GAP-052-003**: Dead code inofensivo, decision de product/tech
- **GAP-052-007**: RESUELTO
- **GAP-052-009**: RESUELTO

---

## Pasada #4 de Auditoria — Gaps Encontrados

> **Metodo**: 3 agentes exploratorios paralelos (schemas-layer, service-core-layer, tests/process/cross-cutting). Audito exhaustivo de cada override con lectura completa, verificacion de barrel chain, git commits, cross-dependencies con SPEC-055/SPEC-059, y busqueda de nuevos servicios.

### Estado de Gaps Previos en Pasada #4

| Gap ID | Estado en Pasada #4 | Detalle |
|---|---|---|
| GAP-052-001 | **SIN FIX** | Sigue sin tests service-specific. 0 archivos nuevos desde pasada #3. Solo existen tests base (adminList.test.ts, executeAdminSearch.test.ts) |
| GAP-052-002 | **ACEPTABLE** (desde Pasada #3) | `Record<string, unknown>` en `mappedFilters` es necesidad pragmatica |
| GAP-052-003 | **SIN FIX** | `ADMIN_SEARCH_BASE_KEYS` tiene 0 consumidores en runtime. Grep confirma: solo definicion + docs |
| GAP-052-004 | **CONFIRMADO DELEGADO** | SPEC-055 existe (status: draft). No implementada aun |
| GAP-052-005 | **SIN FIX** | `spec.md:3` sigue diciendo `Status: draft` |
| GAP-052-006 | **SIN FIX** | Sin task tracking files (low, no accion requerida) |
| GAP-052-007 | **RESUELTO** (desde Pasada #3) | JSDoc en los 6 type aliases confirmado |
| GAP-052-008 | **SIN FIX** | index.json tiene 10 entries (SPEC-009/014/019/025/026/028/029/047/049/062), SPEC-052 ausente |
| GAP-052-009 | **RESUELTO** (desde Pasada #3) | SPEC-055 cubre promo-code.crud.ts |
| GAP-052-010 | **SIN FIX** | 0 usos de `expectTypeOf` en tests reales. Solo aparece en docs/guides (testing.md). Vitest 3.1.3 lo soporta nativamente |
| GAP-052-011 | **SIN FIX** | `query-helpers.ts:15-16` sigue con `z.boolean().optional()).optional()` — doble wrap redundante |
| GAP-052-012 | **SIN FIX** | Base tests usan `AdminSearchExecuteParams` sin generico. 0 tests instancian `AdminSearchExecuteParams<SpecificType>` |
| GAP-052-013 | **RECLASIFICADO ACEPTABLE** | Los 5 servicios adicionales (ExchangeRate, PostSponsorship, UserBookmark, SponsorshipPackage, SponsorshipLevel) NO tienen `adminSearchSchema` seteado. Estan correctamente fuera de scope. La tabla de 10 servicios sin override es precisa para servicios que participan en admin search |
| GAP-052-014 | **SIN FIX** | 0 integration tests ejercitan filtros entity-specific (minPrice, startDateAfter, email ILIKE, sponsorshipStatus remap) |

---

### GAP-052-015: `AdminSearchBaseKeys` type exportado pero solo usado internamente

> **Auditoria**: Pasada #4

**Descripcion**

El type `AdminSearchBaseKeys` (linea 116 de `admin-search.schema.ts`) se exporta publicamente desde `@repo/schemas` pero solo se usa dentro del mismo archivo:
- Como tipo del array `ADMIN_SEARCH_BASE_KEYS` (linea 122)
- Como key del `Omit` dentro de `EntityFilters` (linea 140)

Ningun consumidor externo importa `AdminSearchBaseKeys` directamente.

**Evidencia**

```
Grep de "AdminSearchBaseKeys" en todo el monorepo:
  packages/schemas/src/common/admin-search.schema.ts:116 — definicion
  packages/schemas/src/common/admin-search.schema.ts:122 — uso en ADMIN_SEARCH_BASE_KEYS
  packages/schemas/src/common/admin-search.schema.ts:140 — uso en EntityFilters
  .claude/specs/ — solo docs
```

**Impacto**

Nulo. El type es un building block interno de `EntityFilters`. Exportarlo no causa dano pero incrementa el API surface publico innecesariamente. A diferencia de `ADMIN_SEARCH_BASE_KEYS` (dead code runtime), este type SI se usa internamente.

**Solucion**

**Opcion 1**: Dejar como esta — es un type utility que podria ser util para consumidores avanzados.

**Opcion 2**: No exportarlo (dejarlo como type local). Requeriria verificar que ningun barrel export lo referencie explicitamente (actualmente pasa via `export *`).

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: Decision de product/tech. No requiere SPEC nueva.

**DECISION (2026-04-08)**: ❌ DESCARTAR — Dejar exportado. Es un type utility que puede ser util para consumidores avanzados que construyan sobre `EntityFilters`.

---

### GAP-052-016: Acceptance criteria checkboxes sin marcar en spec.md

> **Auditoria**: Pasada #4

**Descripcion**

Los 11 acceptance criteria en `spec.md` (lineas 488-499) usan `- [ ]` (checkbox vacio) a pesar de que la implementacion esta completa y todos los criterios se cumplen:

```
- [ ] `EntityFilters<TSchema>` utility type is exported from `@repo/schemas`...
- [ ] `AdminSearchExecuteParams<TEntityFilters>` is generic with default...
- [ ] `adminSearchSchema` property type is `ZodObject<ZodRawShape>`...
...11 items, todos sin marcar
```

**Evidencia**

```
.claude/specs/SPEC-052-type-safe-entity-filters/spec.md:488-499 — todos `- [ ]`
```

La auditoria de Pasada #4 verifico cada criterio contra el codigo y todos pasan (ver tabla al inicio de este reporte).

**Impacto**

Bajo. Los checkboxes sin marcar dan la impresion de que la spec no esta completada. Junto con GAP-052-005 (status: draft), refuerza la falsa senal de "incompleto".

**Solucion**

Marcar los 11 items como `- [x]`.

**Prioridad**: P2 | **Severidad**: LOW | **Complejidad**: Trivial
**Accion**: Fix directo — actualizar spec.md

**DECISION (2026-04-08)**: ✅ HACER — Fix inmediato. Marcar los 11 AC checkboxes como `- [x]` en spec.md.

---

### Verificaciones de la Pasada #4 que NO encontraron problemas

| Area Verificada | Resultado |
|---|---|
| `EntityFilters<TSchema>` definicion: `Omit<z.infer<TSchema>, AdminSearchBaseKeys>` con constraint `ZodObject<ZodRawShape>` | PASS |
| `AdminSearchBaseSchema` tiene exactamente 8 campos (sin cambios desde spec) | PASS |
| Barrel chain: `admin-search.schema.ts` → `common/index.ts:20` → `src/index.ts:2` | PASS |
| 16 AdminSearchSchemas, todos usan `.extend({})` (no `.merge()`, `.and()`) | PASS |
| DestinationReview `.transform()` en status es field-level, no object-level | PASS |
| EventOrganizerAdminSearchSchema empty extend → `EntityFilters` = `{}` | PASS |
| `AdminSearchExecuteParams<T = Record<string, unknown>>` con JSDoc (lineas 165-184) | PASS |
| `adminSearchSchema` es `ZodObject<ZodRawShape>`, `ZodType` ya no se importa en base.crud.permissions.ts | PASS |
| Base `_executeAdminSearch()` usa `AdminSearchExecuteParams` sin parametrizar (linea 422) | PASS |
| `adminList()` cast `parseResult.data as Record<string, unknown>` sigue en linea 324 | PASS |
| 6 overrides: todos con `AdminSearchExecuteParams<XxxEntityFilters>`, 0 `as` casts, JSDoc en type alias | PASS |
| AccommodationService: JSONB `price->>'price'` extraction correcta, no `as` cast | PASS |
| EventService: 4 condiciones JSONB date correctas, no `as` cast | PASS |
| AccommodationReviewService: `gte`/`lte` sin `.toString()`, no `as` cast | PASS |
| DestinationReviewService: `gte`/`lte` sin `.toString()`, no `as` cast | PASS |
| SponsorshipService: remap `sponsorshipStatus` → `status`, tipo intermedio `Record<string, unknown>` (aceptado) | PASS |
| UserService: ILIKE email, bypass de super (intencional per spec), no `as` cast | PASS |
| 0 `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` en service-core/src/ | PASS |
| 0 nuevos `as` casts en entityFilters (solo 1 necesario en `ADMIN_SEARCH_BASE_KEYS` array cast) | PASS |
| 5 servicios adicionales sin `adminSearchSchema` — correctamente fuera de scope | PASS |
| Affected Files table en spec.md — 100% precisa vs commits reales | PASS |
| 10 servicios sin override — tabla precisa, todos tienen `adminSearchSchema` sin override | PASS |
| SPEC-059 no implementada (status: draft) — cross-dependency aun relevante, sin conflicto actual | PASS |
| SPEC-055 existe (status: draft) — cubre UserService email ILIKE y promo-code ILIKE | PASS |
| `queryDateParam` no existe — confirmado, se usa `z.coerce.date().optional()` inline | PASS |
| 3 commits (61d23cc4, d1835351, 97dc1949) verificados: 9 archivos tocados, matchean spec exactamente | PASS |
| 10 commits posteriores no revirtieron cambios SPEC-052 | PASS |

---

## Resumen Ejecutivo (Actualizado Pasada #4)

### Implementacion

SPEC-052 esta **completamente implementada** y matchea todos los acceptance criteria. Los 3 commits cubren los 5 pasos del spec. Zero regresiones detectadas.

### Gaps por Categoria (Acumulado Pasada #1 + #2 + #3 + #4)

| Categoria | Gaps Abiertos | IDs | Severidad Maxima |
|---|---|---|---|
| Testing | 4 gaps | GAP-052-001, GAP-052-010, GAP-052-012, GAP-052-014 | HIGH |
| Security (delegado) | 1 gap | GAP-052-004 | MEDIUM (SPEC-055) |
| Mantenimiento | 2 gaps | GAP-052-003, GAP-052-011 | LOW |
| Process/Docs | 4 gaps | GAP-052-005, GAP-052-006, GAP-052-008, GAP-052-016 | LOW |
| API Surface | 1 gap | GAP-052-015 | LOW |

### Gaps Resueltos / Reclasificados

| Gap ID | Estado | Detalle |
|---|---|---|
| GAP-052-002 | **ACEPTABLE** (Pasada #3) | Pragmatic necessity para super call |
| GAP-052-007 | **RESUELTO** (Pasada #3) | JSDoc en 6 type aliases |
| GAP-052-009 | **RESUELTO** (Pasada #3) | SPEC-055 cubre promo-code |
| GAP-052-013 | **RECLASIFICADO ACEPTABLE** (Pasada #4) | Servicios sin adminSearchSchema, correctamente fuera de scope |

### Accion Inmediata Recomendada (Priorizada)

1. **TRIVIAL FIX** (GAP-052-005 + GAP-052-008 + GAP-052-016): Actualizar spec status a `completed`, agregar entry a `index.json`, marcar 11 acceptance criteria como `[x]`
2. **SPEC NUEVA** (GAP-052-001 + GAP-052-010 + GAP-052-012 + GAP-052-014): Test coverage para service overrides, type-level tests con `expectTypeOf`, integration tests con filtros entity-specific — **unico cluster con riesgo real de bugs silenciosos en produccion**
3. **TRIVIAL OPCIONAL** (GAP-052-011): Remover `.optional()` redundante en `queryBooleanParam()`
4. **DECISION TECH** (GAP-052-003 + GAP-052-015): Mantener o remover exports que nadie consume

### Gaps que NO Requieren Accion

- **GAP-052-002**: Pragmatic necessity (ACEPTABLE)
- **GAP-052-004**: Delegado a SPEC-055 (draft)
- **GAP-052-006**: Cosmetic, no amerita accion retroactiva
- **GAP-052-013**: Servicios fuera de scope (ACEPTABLE)

---

## Pasada #5 de Auditoria — Gaps Encontrados

> **Metodo**: 3 agentes exploratorios paralelos (schemas-layer/type-system-correctness, service-core/6-overrides-lectura-completa/base-class, tests/process/cross-deps/code-quality). Verificacion exhaustiva con foco en areas potencialmente pasadas por alto en pasadas previas. Confirmacion manual de hallazgos criticos via grep directo.

### Estado de Gaps Previos en Pasada #5

| Gap ID | Estado en Pasada #5 | Detalle |
|---|---|---|
| GAP-052-001 | **SIN FIX** | Sigue sin tests service-specific. 0 archivos nuevos |
| GAP-052-002 | **ACEPTABLE** (desde Pasada #3) | Pragmatic necessity |
| GAP-052-003 | **SIN FIX** | `ADMIN_SEARCH_BASE_KEYS` sigue sin consumidores |
| GAP-052-004 | **CONFIRMADO DELEGADO** | SPEC-055 (status: draft) |
| GAP-052-005 | **SIN FIX** | `spec.md:3` sigue diciendo `Status: draft` |
| GAP-052-006 | **SIN FIX** | Sin task tracking files (no requiere accion) |
| GAP-052-007 | **RESUELTO** (desde Pasada #3) | JSDoc en 6 type aliases |
| GAP-052-008 | **ESCALADO** | index.json ahora tiene 15 entries (SPEC-058 agregada como completed, SPEC-052 sigue ausente — demostrablemente inconsistente) |
| GAP-052-009 | **RESUELTO** (desde Pasada #3) | SPEC-055 cubre promo-code.crud.ts |
| GAP-052-010 | **AMPLIADO** | No solo EntityFilters — el monorepo entero tiene zero adopcion de `expectTypeOf` pese a que las guias en `testing.md` (schemas/docs y config/docs) lo documentan explicitamente |
| GAP-052-011 | **SIN FIX** | `queryBooleanParam()` sigue con doble `.optional()` |
| GAP-052-012 | **SIN FIX** | Base tests usan `AdminSearchExecuteParams` sin generico |
| GAP-052-013 | **ACEPTABLE** (desde Pasada #4) | Servicios fuera de scope correctamente |
| GAP-052-014 | **SIN FIX** | 0 integration tests para filtros entity-specific |
| GAP-052-015 | **SIN FIX** | `AdminSearchBaseKeys` solo usado internamente |
| GAP-052-016 | **SIN FIX** | AC checkboxes siguen sin marcar en spec.md |

---

### GAP-052-017: UserService `_executeAdminSearch` bypass total de `super._executeAdminSearch()` — riesgo de mantenimiento

> **Auditoria**: Pasada #5

**Descripcion**

`UserService._executeAdminSearch()` es el UNICO de los 6 servicios con override que NO llama a `super._executeAdminSearch()`. En cambio, reimplementa manualmente toda la logica de busqueda llamando directamente a `this.model.findAll()`:

```ts
// user.service.ts:396-416 — reimplementacion manual
const { where, entityFilters, pagination, sort, search, extraConditions } = params;
const { email, ...simpleFilters } = entityFilters;
const additionalConditions: SQL[] = [...(extraConditions ?? [])];
if (search) additionalConditions.push(search);
if (email) additionalConditions.push(ilike(userTable.email, `%${email}%`));
const mergedWhere = { ...where, ...simpleFilters };
return this.model.findAll(mergedWhere, { ...pagination, sortBy: sort.sortBy, sortOrder: sort.sortOrder }, ...);
```

Los otros 5 servicios con override siguen el patron estandar:
```ts
return super._executeAdminSearch({ ...rest, entityFilters: simpleFilters, extraConditions });
```

**Riesgos concretos**

1. Si `getDefaultListRelations()` de UserService alguna vez retorna relaciones (hoy retorna `undefined`), el override silenciosamente usaria `findAll` en lugar de `findAllWithRelations`, perdiendo las relaciones sin ningun error
2. La logica de merge `{ ...where, ...simpleFilters }` esta duplicada desde la base class. Un cambio en la base no se propagaria automaticamente
3. Duplica el manejo del parametro `search` (la base class lo maneja internamente cuando se llama a super, UserService lo agrega manualmente a `additionalConditions` en la linea 403)

**Nota**: El bypass es intencional y documentado en la spec (seccion "Edge Cases: UserService Full Override Pattern"). La razon es que necesita ILIKE en email + manejo custom de `search`. Sin embargo, el riesgo de mantenimiento no estaba categorizado como un gap propio.

**Evidencia**

```
packages/service-core/src/services/user/user.service.ts:396-416 — override completo sin super call
packages/service-core/src/services/user/user.service.ts:81-83 — getDefaultListRelations() retorna undefined (seguro hoy)
```

**Soluciones Propuestas**

**Opcion 1 (Minimal)**: Agregar comentario en el override documentando explicitamente por que NO se llama a super y los prerequisitos para que sea seguro:
```ts
// NOTE: Does NOT call super._executeAdminSearch() by design.
// Prerequisite: getDefaultListRelations() MUST return undefined.
// If relations are ever added, this override must be updated to use findAllWithRelations.
// Reason: needs ILIKE for email and custom search condition merging.
```

**Opcion 2**: Refactorizar para llamar a super cuando sea posible, extrayendo solo el ILIKE a un `_executeAdminSearch` mas delgado.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: Low (fix: documentar) / Medium (fix: refactorizar)
**Accion**: Fix directo de documentacion, sin SPEC nueva. Si se quiere refactorizar, agregar a SPEC nueva de testing.

**DECISION (2026-04-08)**: ✅ HACER — Opcion B. Refactorizar `UserService._executeAdminSearch()` para llamar a `super._executeAdminSearch()` cuando sea posible, extrayendo el ILIKE de email como `extraConditions` para pasar al super.

---

### GAP-052-018: UserService, SponsorshipService y PostSponsorService sin `_canAdminList` override — posible gap de permisos

> **Auditoria**: Pasada #5

**Descripcion**

De los 16 servicios con `adminSearchSchema`, **13** tienen un override de `_canAdminList` que agrega una verificacion adicional de permisos via `checkCanAdminList(actor)`:

```ts
// Patron estandar (13 servicios)
protected async _canAdminList(actor: Actor): Promise<void> {
    await super._canAdminList(actor);
    checkCanAdminList(actor);  // <-- verificacion adicional entity-specific
}
```

Los **3 servicios restantes** NO tienen este override:
- `UserService` (`user/user.service.ts`)
- `SponsorshipService` (`sponsorship/sponsorship.service.ts`)
- `PostSponsorService` (`postSponsor/postSponsor.service.ts`)

Ademas, ni `user/user.permissions.ts`, `sponsorship/sponsorship.permissions.ts`, ni `postSponsor/postSponsor.permissions.ts` tienen una funcion `checkCanAdminList` definida.

**Impacto**

Para estos 3 servicios, `adminList()` solo ejecuta el check base:
```ts
// base.crud.permissions.ts:191-197
// Solo verifica ACCESS_PANEL_ADMIN || ACCESS_API_ADMIN, luego delega a _canList
```

No hay una verificacion entity-specific adicional. Esto puede ser **intencional** (quizas para users/sponsorships el acceso general de admin es suficiente), pero no esta documentado como una decision explicita. Para UserService esto es especialmente sensible dado que expone datos de todos los usuarios del sistema.

**Evidencia**

```
Grep de "_canAdminList" en services/:
  13 archivos con override (feature, destinationReview, accommodationReview, destination, tag,
  amenity, eventLocation, attraction, ownerPromotion, event, post, postSponsor, accommodation)

NOTA: postSponsor.service.ts TIENE _canAdminList (2 ocurrencias), confirmado en grep.
Los que NO lo tienen son: user.service.ts, sponsorship.service.ts (0 ocurrencias).
```

**Correccion post-verificacion**: El grep muestra que `postSponsor` tiene 2 ocurrencias de `_canAdminList`. Solo **UserService** y **SponsorshipService** estan definitivamente sin override.

**Soluciones Propuestas**

**Opcion 1**: Verificar si la ausencia es intencional y documentarla con un comentario en el service:
```ts
// AdminList uses base class _canAdminList check only (ACCESS_PANEL_ADMIN || ACCESS_API_ADMIN).
// No entity-specific permission required for user listing.
```

**Opcion 2**: Si es un gap real, agregar `checkCanAdminList` a `user.permissions.ts` y `sponsorship.permissions.ts` y el override correspondiente.

**Prioridad**: P1 | **Severidad**: MEDIUM | **Complejidad**: Low
**Accion**: Verificacion manual requerida para determinar si es intencional. Si es un gap real, fix directo sin SPEC nueva.

**DECISION (2026-04-08)**: ✅ HACER — Opcion B. Agregar `checkCanAdminList` a `user.permissions.ts` y `sponsorship.permissions.ts` y el override `_canAdminList` correspondiente en ambos services.

---

### GAP-052-019: SPEC-059 no documenta la coordinacion necesaria con el bypass de UserService

> **Auditoria**: Pasada #5

**Descripcion**

SPEC-059 (Service-Layer Transaction Support) agrega un parametro `_ctx: ServiceContext` a `_executeAdminSearch()` en todos los servicios para threading de contexto de transaccion. El spec de SPEC-059 menciona SPEC-052 como cross-dependency, pero NO menciona el hecho de que `UserService._executeAdminSearch()` bypasea `super._executeAdminSearch()` y llama directamente a `this.model.findAll()`.

**Consecuencia**: Cuando SPEC-059 se implemente, los 5 servicios que llaman a `super._executeAdminSearch()` automaticamente recibiran el contexto de transaccion. UserService, al no llamar al super, NO lo recibira a menos que se actualice explicitamente su override. Esto crearia una situacion donde el admin list de users corre fuera de transacciones mientras todos los demas servicios corren dentro.

**Evidencia**

```
.claude/specs/SPEC-059*/spec.md — menciona SPEC-052 pero no menciona UserService bypass
packages/service-core/src/services/user/user.service.ts:396-416 — no llama a super
```

**Soluciones Propuestas**

**Opcion 1 (Recomendada)**: Agregar una nota de coordinacion en SPEC-059 explicitando que UserService.`_executeAdminSearch` necesita actualizacion especial cuando se agregue `_ctx`.

**Opcion 2**: Resolver GAP-052-017 primero (refactorizar UserService para llamar a super), eliminando el problema de raiz para SPEC-059.

**Prioridad**: P2 | **Severidad**: MEDIUM | **Complejidad**: Trivial (update de spec)
**Accion**: Actualizar SPEC-059 spec.md con nota de coordinacion. No requiere SPEC nueva.

**DECISION (2026-04-08)**: ❌ DESCARTAR — GAP-052-017 Opcion B (refactorizar UserService para llamar a super) elimina este problema de raiz. No tiene sentido documentar una coordinacion para un bypass que va a dejar de existir.

---

### GAP-052-020: No existen helpers `queryDateParam` / `queryNumberParam` — inconsistencia con `queryBooleanParam`

> **Auditoria**: Pasada #5

**Descripcion**

`packages/schemas/src/common/query-helpers.ts` contiene SOLO la funcion `queryBooleanParam()`. La razon de su existencia es documentada: `z.coerce.boolean()` tiene comportamiento peligroso (convierte `"false"` a `true`), justificando un helper.

Sin embargo, `z.coerce.date()` y `z.coerce.number()` tambien tienen edge cases problematicos:
- `z.coerce.number()` convierte `""` a `0` en lugar de fallar
- `z.coerce.date()` acepta strings no-ISO como `"01/15/2026"` dependiendo del entorno JS

Los 16 AdminSearchSchemas usan `z.coerce.date().optional()` y `z.coerce.number().int()...optional()` directamente inline. Esto crea una inconsistencia: boolean tiene proteccion helper, date/number no.

**Ejemplo del riesgo**

```ts
// event.admin-search.schema.ts
startDateAfter: z.coerce.date().optional()
// Si alguien pasa "01-15-2026" (formato US), se parsea a fecha valida en algunos entornos
// y falla en otros (dependencia de runtime del motor JS)
```

**Evidencia**

```
packages/schemas/src/common/query-helpers.ts — solo queryBooleanParam, nada mas
Busqueda de z.coerce.date() en schemas/: 8+ usos directos inline
Busqueda de z.coerce.number() en schemas/: 6+ usos directos inline
```

**Nota**: Este gap es COLATERAL a SPEC-052. No es un problema de la spec en si, sino un hallazgo de la auditoria.

**Soluciones Propuestas**

**Opcion 1 (Minimal)**: No hacer nada. El comportamiento actual es funcional y los edge cases son poco probables para admin inputs.

**Opcion 2**: Crear `queryDateParam()` que force ISO 8601 validation y `queryNumberParam()` que rechace strings vacios.

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Low
**Accion**: Decision de tech/product. Si se decide implementar, abrir SPEC nueva independiente.

**DECISION (2026-04-08)**: ✅ HACER — Fix directo. Crear `queryDateParam()` (fuerza ISO 8601) y `queryNumberParam()` (rechaza strings vacios) en `packages/schemas/src/common/query-helpers.ts`.

---

### GAP-052-021: Extraccion redundante de paginacion en los 16 route handlers de admin list

> **Auditoria**: Pasada #5

**Descripcion**

Todos los 16 admin list route handlers tienen este patron:

```ts
// apps/api/src/routes/accommodation/admin/list.ts:34-46
const { page, pageSize } = extractPaginationParams(query || {});  // Parse #1
const result = await accommodationService.adminList(actor, query || {});  // Parse #2 (interno via Zod)
const paginatedResponse = getPaginationResponse(result.total, page, pageSize, result.data);
```

La paginacion se parsea DOS veces:
1. `extractPaginationParams(query)` en el route handler, solo para calcular los metadatos de respuesta (`getPaginationResponse`)
2. `AdminSearchSchema.safeParse(validatedPassthrough)` dentro de `service.adminList()`, para la query real a la DB

Ambos parsean el MISMO `query` object. Si los defaults o maximos difieren entre `extractPaginationParams` y el schema Zod, los metadatos de paginacion en la respuesta no coincidirian con los datos realmente retornados.

**Evidencia**

```
apps/api/src/routes/accommodation/admin/list.ts:34,37,45
apps/api/src/routes/event/admin/list.ts — patron identico
(16 route handlers con el mismo patron)
```

**Impacto**

Bajo en el estado actual (ambos parsean los mismos valores). Fragil si los defaults divergen en el futuro.

**Soluciones Propuestas**

**Opcion 1**: Obtener `page`/`pageSize` desde el resultado del servicio en lugar de re-parsearlos:
```ts
const result = await service.adminList(actor, query || {});
const paginatedResponse = getPaginationResponse(result.total, result.page, result.pageSize, result.data);
// Requiere que adminList() retorne page/pageSize en su output
```

**Opcion 2**: Dejar como esta. El riesgo es bajo y la refactorizacion involucra cambiar 16 routes + el tipo de retorno de adminList.

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Medium (16 routes + tipo de retorno)
**Accion**: No requiere SPEC nueva inmediata. Notar para considerar en un refactor de routes futuro.

**DECISION (2026-04-08)**: ⏸ POSTERGAR — Documentado en `.claude/gaps-postergados.md`. Considerar en un refactor de routes futuro si los defaults de paginacion divergen.

---

### GAP-052-022: `list()` en base.crud.read.ts tiene patron paralelo de `as Record<string, unknown>` sin mejora

> **Auditoria**: Pasada #5

**Descripcion**

El metodo `list()` en `packages/service-core/src/base/base.crud.read.ts` (lineas 184-209) tiene 4 casts `as Record<string, unknown>` sobre `processedOptions` para extraer `where`, `search`, `sortBy`, y `sortOrder`. Esto es el mismo patron que `adminList()` tenia antes de SPEC-052 para `entityFilters`.

```ts
// base.crud.read.ts:184-209
const where = (processedOptions as Record<string, unknown>).where as Record<string, unknown>;
const search = (processedOptions as Record<string, unknown>).search as SQL | undefined;
// ... etc
```

SPEC-052 mejoró el tipo safety de `adminList()/_executeAdminSearch()` mediante generics. El metodo `list()/_executeSearch()` tiene el mismo problema pero no fue incluido en el scope de SPEC-052 (correctamente — era out of scope).

**Impacto**

Nulo en runtime. Es un gap de oportunidad para una SPEC futura que aplique el mismo patron de generics a `list()/_executeSearch()`. No urgente.

**Evidencia**

```
packages/service-core/src/base/base.crud.read.ts:184-209 — 4 `as Record<string, unknown>` casts en list()
```

**Soluciones Propuestas**

**Opcion 1**: Abrir SPEC nueva aplicando el mismo patron de generics a `list()/_executeSearch()` (equivalente a SPEC-052 para la ruta de busqueda publica).

**Opcion 2**: Dejar como esta — lower priority, misma arquitectura.

**Prioridad**: P3 | **Severidad**: LOW | **Complejidad**: Medium
**Accion**: Notar para SPEC futura. No urgente.

**DECISION (2026-04-08)**: 📋 NUEVA SPEC — Abrir SPEC nueva aplicando el mismo patron de generics de SPEC-052 al metodo `list()/_executeSearch()` en `base.crud.read.ts`. Equivalente a SPEC-052 para la ruta de busqueda publica.

---

### Verificaciones de la Pasada #5 que NO encontraron problemas

| Area Verificada | Resultado |
|---|---|
| Los 16 AdminSearchSchemas usan `.extend({})` (no `.merge()`, `.and()`, `.pipe()`) | PASS |
| Ningun schema aplica `.transform()`/`.refine()`/`.superRefine()` a nivel objeto | PASS |
| `EntityFilters` constraint `ZodObject<ZodRawShape>` es correcto para los 16 schemas | PASS |
| `AdminSearchBaseSchema` tiene exactamente 8 campos (sin cambios) | PASS |
| Barrel export chain completa para los 16 schemas | PASS |
| postSponsor.service.ts SI tiene `_canAdminList` override (correccion a claim inicial del agente) | PASS |
| 0 `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` en service-core/src/ | PASS |
| 0 `as` casts sobre entityFilters en los 6 servicios con override | PASS |
| 0 `biome-ignore` nuevos relacionados a SPEC-052 | PASS |
| `getDefaultListRelations()` de UserService retorna `undefined` (bypass de super es seguro hoy) | PASS |
| 3 commits de implementacion SPEC-052 sin reversion en commits posteriores | PASS |
| SPEC-059 status: draft (sin implementar, no hay conflicto activo) | PASS |
| SPEC-055 status: draft (cubre UserService ILIKE y promo-code ILIKE) | PASS |
| No hay nuevos servicios con `adminSearchSchema` desde la pasada #4 | PASS |

---

## Resumen Ejecutivo (Actualizado Pasada #5)

### Implementacion

SPEC-052 esta **completamente implementada** y matchea todos los acceptance criteria. Los 3 commits cubren los 5 pasos del spec. Zero regresiones detectadas en 5 pasadas de auditoria.

### Gaps por Categoria (Acumulado Pasada #1 al #5)

| Categoria | Gaps Abiertos | IDs | Severidad Maxima |
|---|---|---|---|
| Testing | 4 gaps | GAP-052-001, GAP-052-010, GAP-052-012, GAP-052-014 | HIGH |
| Permissions | 1 gap | GAP-052-018 | MEDIUM (necesita verificacion) |
| Code Quality / Maintenance | 2 gaps | GAP-052-017, GAP-052-022 | MEDIUM |
| Cross-Dependency | 2 gaps | GAP-052-004, GAP-052-019 | MEDIUM |
| Consistency | 1 gap | GAP-052-020 | LOW |
| Code Quality (Routes) | 1 gap | GAP-052-021 | LOW |
| Mantenimiento | 2 gaps | GAP-052-003, GAP-052-011 | LOW |
| Process/Docs | 3 gaps | GAP-052-005, GAP-052-008, GAP-052-016 | LOW |
| API Surface | 1 gap | GAP-052-015 | LOW |

### Gaps Resueltos / Reclasificados (historico)

| Gap ID | Estado | Detalle |
|---|---|---|
| GAP-052-002 | **ACEPTABLE** (Pasada #3) | Pragmatic necessity para super call en SponsorshipService |
| GAP-052-007 | **RESUELTO** (Pasada #3) | JSDoc en 6 type aliases |
| GAP-052-009 | **RESUELTO** (Pasada #3) | SPEC-055 cubre promo-code.crud.ts |
| GAP-052-013 | **RECLASIFICADO ACEPTABLE** (Pasada #4) | Servicios sin adminSearchSchema, correctamente fuera de scope |

### Accion Inmediata Recomendada (Priorizada)

1. **VERIFICAR + FIX** (GAP-052-018): Confirmar si UserService y SponsorshipService deben tener `_canAdminList` override. Si es un gap real de permisos, fix inmediato sin SPEC nueva.
2. **TRIVIAL FIX** (GAP-052-005 + GAP-052-008 + GAP-052-016 + GAP-052-023): Actualizar `Status: draft` → `completed`, agregar entry a `index.json`, marcar 11 AC como `[x]`
3. **SPEC NUEVA** (GAP-052-001 + GAP-052-010 + GAP-052-012 + GAP-052-014): Cluster de testing — service overrides tests, type-level tests con `expectTypeOf`, integration tests con filtros entity-specific
4. **DOCUMENTAR** (GAP-052-017): Agregar comentario explicativo en UserService override sobre prerequisitos del bypass
5. **COORDINAR** (GAP-052-019): Actualizar SPEC-059 para mencionar el UserService bypass

### Gaps que NO Requieren Accion Nueva

- **GAP-052-002**: Pragmatic necessity (ACEPTABLE)
- **GAP-052-004**: Delegado a SPEC-055 (draft)
- **GAP-052-006**: Cosmetic, no amerita accion retroactiva
- **GAP-052-013**: Servicios fuera de scope (ACEPTABLE)
- **GAP-052-003, GAP-052-011, GAP-052-015**: Dead code / trivial — decision de product/tech
- **GAP-052-020, GAP-052-021, GAP-052-022**: Oportunidades de mejora futura, no urgente

---

## Historial de Pasadas de Auditoria

| Pasada | Fecha | Metodo | Gaps encontrados | Nuevos | Fijados/Reclasificados |
|---|---|---|---|---|---|
| #1 | 2026-04-08 | 4 agentes exploratorios paralelos (schemas, service-core, tests/edge-cases, sponsorship/user deep-dive) | 7 gaps (1 HIGH, 2 MEDIUM, 4 LOW) | 7 | 0 |
| #2 | 2026-04-08 | 3 agentes exploratorios paralelos (schemas/barrels, service-core/6-overrides, tests/edge-cases/cross-refs). Contraste linea por linea spec vs codigo | 12 gaps acumulados (1 HIGH, 4 MEDIUM, 7 LOW) | 5 | 0 (1 parcial) |
| #3 | 2026-04-08 | 3 agentes exploratorios paralelos (schemas/barrel-exports, service-core/6-overrides-deep, tests/cross-cutting/process). Verificacion de gaps previos + nuevos hallazgos | 14 gaps totales (1 HIGH, 3 MEDIUM, 6 LOW) + 3 resueltos + 1 reclasificado | 2 | 3 (GAP-007, GAP-009, GAP-002 reclasificado) |
| #4 | 2026-04-08 | 3 agentes exploratorios paralelos (schemas-layer completo, service-core 6-overrides lectura completa, tests/process/cross-cutting con SPEC-055/059 cross-deps). Verificacion exhaustiva de 16 AdminSearchSchemas, barrel chain, git commits, todos los acceptance criteria | 16 gaps totales (1 HIGH, 3 MEDIUM, 8 LOW) + 4 resueltos/reclasificados | 2 (GAP-015, GAP-016) | 1 (GAP-013 reclasificado ACEPTABLE) |
| #5 | 2026-04-08 | 3 agentes exploratorios paralelos (schemas/type-system, service-core/base-class/todos-los-overrides-lectura-completa, tests/process/cross-deps/code-quality) + verificacion manual directa de hallazgos criticos via grep | 23 gaps totales (1 HIGH, 6 MEDIUM, 16 LOW) + 4 resueltos + 2 escalados/ampliados | 7 (GAP-017 al GAP-023) | 0 nuevos fijados |

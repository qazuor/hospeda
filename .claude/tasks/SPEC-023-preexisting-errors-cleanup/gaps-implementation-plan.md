# SPEC-023 Gaps - Implementation Plan

> Generated: 2026-03-09
> Status: APPROVED
> Total gaps: 30 (of 47 original, 5 descartados, 6 resueltos/info, 1 postergado, 5 cubiertos por otros)

## Execution Order

```
Batch A (quick fixes) → Batch B (schemas) → Batch C (tests schema/service) →
Batch D (code quality) → Batch E (infra & validation) → Batch F (prod fixes) →
Batch G (test coverage heavy) → Batch H (refactoring)
```

---

## Batch A: Quick Fixes (~1 hora)

Sin dependencias entre sí. Pueden ejecutarse en paralelo.

### A.1 - Gap #25: i18n key `lastUpdatedLabel` faltante

- **Archivos a modificar**:
  - `packages/i18n/src/locales/en/terms.json` - agregar key
  - `packages/i18n/src/locales/pt/terms.json` - agregar key
- **Cambio**: Agregar `"lastUpdatedLabel"` con traducciones:
  - en: `"Last updated"`
  - pt: `"Última atualização"`
- **Referencia**: `packages/i18n/src/locales/es/terms.json:108` tiene `"lastUpdatedLabel": "Última actualización"`
- **Verificación**: `pnpm --filter @repo/i18n test`

### A.2 - Gap #2: Eliminar `apps/web/.claude/`

- **Acción**: `rm -rf apps/web/.claude/`
- **Razón**: Directorio de configuración de Claude Code creado accidentalmente en app web. Solo debe existir `.claude/` en root del monorepo.
- **Archivos a eliminar**:
  - `apps/web/.claude/settings.local.json`
  - `apps/web/.claude/.log/notifications.log`
- **Verificación**: `ls apps/web/.claude/` debe fallar

### A.3 - Gap #27: Eliminar zombie schema file

- **Archivo a eliminar**: `packages/schemas/src/entities/accommodation/accommodation.query.optimized.schema.ts`
- **Razón**: Archivo huérfano no referenciado en ningún `index.ts`. Exporta nombres que duplican el schema canónico (`AccommodationListItemSchema`, etc.).
- **Pre-check**: Confirmar con grep que no hay imports de este archivo
- **Verificación**: `pnpm --filter @repo/schemas typecheck`

### A.4 - Gap #39: Redundant biome-ignore en db.test.ts

- **Archivo**: `packages/db/test/utils/db.test.ts`
- **Línea 18**: Eliminar `// biome-ignore lint/suspicious/noExplicitAny: intentional test teardown cast`
- **Razón**: Ya existe `@ts-expect-error` en línea 16 que cubre el mismo caso. El biome-ignore es redundante.
- **Verificación**: `pnpm --filter @repo/db lint`

### A.5 - Gap #9: eslint-disable → biome-ignore

- **Archivo 1**: `apps/api/src/cron/bootstrap.ts:52`
  - Eliminar: `// eslint-disable-next-line @typescript-eslint/no-var-requires`
  - El `await import('node-cron')` es un dynamic import válido, no necesita suppression
- **Archivo 2**: `packages/service-core/src/services/event/event.normalizers.ts:38,51`
  - Eliminar ambos: `// eslint-disable-next-line @typescript-eslint/no-unused-vars`
  - Las variables ya usan `_prefix` (`_adminInfo`), Biome no las marca
  - Verificar que `locationId` y `organizerId` en línea 51 necesitan `_` prefix
- **Verificación**: `pnpm lint`

### A.6 - Gap #7: Astro build warnings (headers en prerender)

- **Archivos**:
  - `apps/web/src/pages/404.astro:29`
  - `apps/web/src/pages/500.astro:29`
- **Cambio**: Ambos archivos ya tienen `export const prerender = false`, así que los headers SÍ están disponibles en runtime. El warning ocurre solo si hay pages que importan layouts que acceden headers durante prerender.
- **Investigar**: Verificar si el warning realmente ocurre con el build actual. Si `prerender = false`, no debería haber warning.
- **Si persiste**: Eliminar el fallback `parseAcceptLanguage(Astro.request.headers.get('accept-language'))` y usar solo el `[lang]` param de la URL, con `DEFAULT_LOCALE` como fallback final.
- **Verificación**: `pnpm --filter hospeda-web build` sin warnings de headers

### A.7 - Gap #5: Documentar excepción web coverage

- **Archivo**: `.github/workflows/ci.yml` (alrededor de línea 126)
- **Cambio**: Agregar excepción para `apps/web` en el check de coverage 90%. Opciones:
  - Agregar condición: si el paquete es `hospeda-web`, threshold = 80
  - O documentar en comentario que web tiene threshold propio en `vitest.config.ts`
- **Archivo complementario**: `apps/web/vitest.config.ts` - agregar comentario explicando por qué 80% es aceptable (Astro SSG)
- **Verificación**: CI workflow no falla por coverage de web

---

## Batch B: Schema Fixes (~45 min)

Corrige `.pick()` y filter schemas rotos. Prerequisito para Batch C (tests).

### B.1 - Gap #41: AmenitySummarySchema `.pick()` bug

- **Archivo**: `packages/schemas/src/entities/amenity/amenity.query.schema.ts:314-326`
- **Cambio**:
  ```ts
  // ANTES:
  export const AmenitySummarySchema = AmenitySchema.pick({
      id: true, slug: true, name: true, description: true,
      category: true,    // NO EXISTE
      icon: true,
      usageCount: true   // NO EXISTE
  });

  // DESPUES:
  export const AmenitySummarySchema = AmenitySchema.pick({
      id: true, slug: true, name: true, description: true,
      type: true,        // Campo correcto (era "category")
      icon: true
  });
  ```
- **Nota**: `usageCount` se elimina del pick. Si se necesita en vistas de resumen, agregar via `.extend()` en un paso separado.
- **Verificación**: `pnpm --filter @repo/schemas typecheck && pnpm --filter @repo/schemas test`

### B.2 - Gap #42: UserBookmarkListItemSchema y UserBookmarkSummarySchema `.pick()` bug

- **Archivo**: `packages/schemas/src/entities/userBookmark/userBookmark.query.schema.ts`
- **Cambio en UserBookmarkListItemSchema (líneas 141-150)**:
  ```ts
  // ANTES:
  export const UserBookmarkListItemSchema = UserBookmarkSchema.pick({
      id: true, userId: true, entityId: true, entityType: true,
      notes: true,      // NO EXISTE
      isPrivate: true,  // NO EXISTE
      createdAt: true, updatedAt: true
  });

  // DESPUES:
  export const UserBookmarkListItemSchema = UserBookmarkSchema.pick({
      id: true, userId: true, entityId: true, entityType: true,
      name: true, description: true,
      createdAt: true, updatedAt: true
  });
  ```
- **Cambio en UserBookmarkSummarySchema (líneas 189-196)**:
  ```ts
  // ANTES: pick con notes: true (no existe)
  // DESPUES: reemplazar notes por name
  ```
- **Verificación**: `pnpm --filter @repo/schemas typecheck && pnpm --filter @repo/schemas test`
- **Efecto cascada**: Desbloquea 3 tests skipeados de UserBookmark

### B.3 - Gap #43: AttractionFiltersSchema phantom fields

- **Archivo**: `packages/schemas/src/entities/attraction/attraction.query.schema.ts`
- **Cambio en AttractionFiltersSchema (líneas 28-60)**:
  - Eliminar: `category`, `subcategory`, `isAccessible`, `isIndoor`, `isOutdoor`, `isFree`, `hasEntryFee`, `tags`, `isOperational`, `isTemporarilyClosed`
  - Mantener: `name`, `slug`, `isFeatured`, `isBuiltin`, `lifecycleState`, `destinationId` (campos que SÍ existen)
- **Cambio en HttpAttractionSearchSchema (líneas 266-300)**:
  - Eliminar: `city`, `country`, `hasCoordinates`, `minVisitorsPerYear`, `maxVisitorsPerYear`, `isOpen`, `acceptsReservations`
  - Mantener: `q`, `name`, `slug`, `isFeatured`, `isBuiltin`, `lifecycleState`, `createdAfter`, `createdBefore`, `destinationId`, `hasDescription`, `hasMedia`
- **Pre-check**: Grep para confirmar que ningún route/service usa estos campos eliminados
- **Verificación**: `pnpm --filter @repo/schemas typecheck && pnpm --filter @repo/schemas test`

### B.4 - Gap #44: AmenityFiltersSchema phantom fields

- **Archivo**: `packages/schemas/src/entities/amenity/amenity.query.schema.ts:28-60`
- **Cambio**:
  - Renombrar `category` → `type` (campo real en AmenitySchema)
  - Eliminar: `minUsageCount`, `maxUsageCount`, `isUnused`, `isPopular`, `popularityThreshold`, `categories`
  - Mantener: `name`, `slug`, `type` (renombrado), `icon`, `hasIcon`, `hasDescription`, `createdAfter`, `createdBefore`, `nameStartsWith`, `nameEndsWith`, `nameContains`, `descriptionContains`
- **Pre-check**: Grep para confirmar que ningún route/service usa los campos eliminados
- **Verificación**: `pnpm --filter @repo/schemas typecheck && pnpm --filter @repo/schemas test`

---

## Batch C: Tests Schema & Service-Core (~3-5 horas)

Depende de Batch B (schemas corregidos).

### C.1 - Gap #26: 24 schema tests con razones stale

- **Directorio**: `packages/schemas/test/entities/`
- **Sub-tareas por entidad**:
  1. **Amenity (6 tests)**: Actualizar fixtures para incluir `displayWeight`, `lifecycleState`, `type`. Unskip tests.
  2. **Attraction (9 tests)**: Actualizar fixtures para incluir `displayWeight`, `lifecycleState`. Corregir field names en tests. Unskip.
  3. **Event (2 tests)**: Corregir fixtures que usan `startDate` → `date`. Unskip.
  4. **UserBookmark (3 tests)**: Tras fix de B.2, actualizar fixtures con `name`/`description` en vez de `notes`/`isPrivate`. Unskip.
  5. **Destination (1 test)**: Verificar si `climate` se eliminó del schema. Si no existe, eliminar del test fixture y de cualquier `.pick()`. Unskip.
  6. **debug-helpers (2 tests)**: Fix `NewEntityInputSchema.omit()` para manejar schemas sin system fields.
- **Verificación**: `pnpm --filter @repo/schemas test` -- todos los 24 deben pasar, 0 skips

### C.2 - Gap #14: 5 service-core tests skipeados

- **Archivos**:
  1. `packages/service-core/test/amenity/updateVisibility.test.ts` - AmenityType no tiene visibility → eliminar test o adaptar
  2. `packages/service-core/test/userBookmark/getByName.test.ts` - verificar si el método existe, si no, eliminar test
  3. `packages/service-core/test/userBookmark/getBySlug.test.ts` - idem
  4. `packages/service-core/test/destination/count.test.ts:46` - re-evaluar caso edge, unskip o documentar
  5. `packages/service-core/test/destination/list.test.ts:59` - idem
- **Verificación**: `pnpm --filter @repo/service-core test`

### C.3 - Gap #15: 1 cron test skipeado

- **Archivo**: `apps/api/test/routes/cron-routes.test.ts:269`
- **Acción**: Unskip el test. Si falla, investigar causa y arreglar o convertir a `.todo` con razón documentada.
- **Verificación**: `pnpm --filter hospeda-api test`

---

## Batch D: Code Quality Cleanup (~1.5 horas)

Sin dependencias entre sí.

### D.1 - Gaps #10/#13/#22: biome-ignore placeholders vacíos (~57 ocurrencias)

- **Distribución**:
  - `packages/seed/` (9)
  - `packages/schemas/test/` (15)
  - `packages/icons/test/` (2)
  - `packages/i18n/scripts/` (5)
  - `apps/admin/` (1)
  - `apps/api/` (1)
  - `packages/service-core/` (1)
  - Producción (8): `apps/api/src/types.ts:61`, `apps/admin/.../EntitySelectField.tsx:429`, `packages/service-core/src/base/base.service.ts:54`, `packages/i18n/scripts/generate-types.ts` (5x)
- **Acción**: Reemplazar `<explanation>` placeholder con razón real del por qué se ignora la regla
- **Método**: `grep -rn "biome-ignore.*<explanation>" packages/ apps/` para encontrar todos, luego editar cada uno
- **Verificación**: `pnpm lint` sin warnings de biome-ignore

### D.2 - Gap #18: console.* → @repo/logger

- **Archivo 1**: `packages/service-core/src/services/exchange-rate/clients/exchange-rate-api.client.ts:129`
  - `console.info(...)` → `logger.info(...)` (agregar import de @repo/logger)
- **Archivo 2**: `packages/billing/src/adapters/mercadopago.ts:168`
  - `console.warn(...)` → `logger.warn(...)` (agregar import)
- **Archivo 3**: `packages/billing/src/validation/config-validator.ts:269-272`
  - `console.warn(...)` (2x) → `logger.warn(...)` (agregar import)
- **Pre-check**: Verificar que @repo/logger está en dependencies de cada package
- **Verificación**: `pnpm lint` (biome tiene regla `noConsoleLog`)

### D.3 - Gap #34: Direct @phosphor-icons → @repo/icons

- **Paso 1**: Agregar `UserSwitchIcon` a `packages/icons/src/index.ts`
  ```ts
  export { UserSwitch as UserSwitchIcon } from '@phosphor-icons/react';
  ```
- **Paso 2**: Actualizar `apps/admin/src/features/users/components/ImpersonateButton.tsx:14`
  ```ts
  // ANTES: import { UserSwitch } from '@phosphor-icons/react';
  // DESPUES: import { UserSwitchIcon } from '@repo/icons';
  ```
  Y reemplazar `<UserSwitch` → `<UserSwitchIcon` en el JSX
- **Paso 3**: Actualizar `apps/admin/src/components/auth/ImpersonationBanner.tsx:13`
  ```ts
  // ANTES: import { Warning, X } from '@phosphor-icons/react';
  // DESPUES: import { AlertTriangleIcon, CloseIcon } from '@repo/icons';
  ```
  Y reemplazar `<Warning` → `<AlertTriangleIcon`, `<X` → `<CloseIcon` en el JSX
- **Verificación**: `pnpm --filter admin typecheck`

### D.4 - Gap #36: Eliminar EntityForm dead code (visibleIf/editableIf)

- **Archivos a modificar**:
  1. `apps/admin/src/components/entity-form/types/section-config.types.ts:30-31` - eliminar props `visibleIf?` y `editableIf?`
  2. `apps/admin/src/components/entity-form/types/field-config.types.ts:370-371` - eliminar props `visibleIf?` y `editableIf?`
  3. `apps/admin/src/components/entity-form/EntityFormSection.tsx:89-95` - simplificar `isVisible` a solo `hasViewPermission`, eliminar referencia a `config.visibleIf`
  4. `apps/admin/src/components/entity-form/EntityViewSection.tsx:104-111` - idem
  5. `apps/admin/src/components/entity-form/hooks/useEntityForm.ts:68,84` - eliminar TODOs de visibleIf/editableIf
  6. `apps/admin/src/components/entity-view/hooks/useEntityView.ts:87` - eliminar TODO
  7. `apps/admin/src/hooks/useSectionProgress.ts:99-101` - eliminar check de `field.visibleIf`
- **Verificación**: `pnpm --filter admin typecheck`

---

## Batch E: Infrastructure & Validation (~4 horas)

### E.1 - Gap #6: @repo/utils build fix

- **Archivo**: `packages/utils/package.json` ya tiene `"build": "tsc"`
- **Verificar**: Ejecutar `pnpm --filter @repo/utils build` y confirmar que genera `dist/`
- **Si falla**: Verificar que `tsconfig.json` hereda `outDir: "dist"` del base. Si no, agregar explícitamente.
- **Verificación**: `ls packages/utils/dist/index.js && ls packages/utils/dist/index.d.ts`

### E.2 - Gap #28: ActorSchema para reemplazar z.any()

- **Descubrimiento**: `ActorSchema` YA EXISTE en `packages/schemas/src/api/auth.schema.ts:12-22`
- **Archivos a modificar**:
  1. `packages/service-core/src/base/base.crud.admin.ts:43` - `actor: z.any()` → `actor: ActorSchema`
  2. `packages/service-core/src/base/base.crud.admin.ts:72` - `actor: z.any()` → `actor: ActorSchema`, `adminInfo: z.any()` → tipo apropiado
  3. `packages/service-core/src/base/base.crud.write.ts:467` - `actor: z.any()` → `actor: ActorSchema`
  4. `packages/service-core/src/services/post/post.service.ts:699` - `actor: z.any()` → `actor: ActorSchema`
- **Import**: Agregar `import { ActorSchema } from '@repo/schemas'` en cada archivo
- **Verificación**: `pnpm --filter @repo/service-core typecheck && pnpm --filter @repo/service-core test`

### E.3 - Gap #19: CI coverage excepción web

- **Archivo**: `.github/workflows/ci.yml` (alrededor de línea 126)
- **Cambio**: En el loop que verifica coverage, agregar excepción para hospeda-web con threshold 80%
- **Verificación**: Revisar que el script de CI no falla por web coverage

### E.4 - Gap #31: 5 billing schemas sin BaseModel wrapper

- **Crear directorio**: `packages/db/src/models/billing/`
- **Crear 5 archivos** siguiendo patrón de modelos existentes:
  1. `billingAddonPurchase.model.ts`
  2. `billingDunningAttempt.model.ts`
  3. `billingNotificationLog.model.ts`
  4. `billingSettings.model.ts`
  5. `billingSubscriptionEvent.model.ts`
- **Patrón**: Cada modelo extiende `BaseModel<T>`, declara `table` y `entityName`
- **Registrar**: Agregar exports al `packages/db/src/models/index.ts`
- **Verificación**: `pnpm --filter @repo/db typecheck`

### E.5 - Gap #35: HACK comments TanStack Router

- **Investigar**: Probar agregar `"verbatimModuleSyntax": true` en `apps/admin/tsconfig.json`
- **Si resuelve**: Eliminar los 12 HACK comments y las bare references `createFileRoute;`
- **Si no resuelve**: Documentar como limitación conocida de TanStack Router file-based routing con el patrón `export const Route = ExternalConfig`. Cambiar `// HACK:` por `// TanStack Router requirement:` para claridad.
- **Archivos afectados** (12):
  - `_authed/events/organizers/index.tsx`
  - `_authed/events/locations/index.tsx`
  - `_authed/destinations/index.tsx`
  - `_authed/content/accommodation-amenities/index.tsx`
  - `_authed/accommodations/index.tsx`
  - `_authed/settings/tags/index.tsx`
  - `_authed/sponsors/index.tsx`
  - `_authed/posts/index.tsx`
  - `_authed/events/index.tsx`
  - `_authed/content/accommodation-features/index.tsx`
  - `_authed/access/users/index.tsx`
  - `_authed/content/destination-attractions/index.tsx`
- **Verificación**: `pnpm --filter admin typecheck`

---

## Batch F: Production Data Integrity (~3 horas)

### F.1 - Gap #29: Endpoints devuelven data incorrecta

**Sub-tarea 1: removeComment() - implementar o marcar como not implemented**
- **Archivo**: `packages/service-core/src/services/post/post.service.ts:691-707`
- **Acción**: Implementar la lógica de borrado de comentario, o lanzar `NotImplementedError` con mensaje claro en vez de retornar `{ success: false }` silenciosamente
- **Prerequisito**: Verificar si existe un modelo de comentarios en `@repo/db`

**Sub-tarea 2: eventLocation totalEvents hardcoded**
- **Archivo**: `packages/service-core/src/services/eventLocation/eventLocation.service.ts:325`
- **Acción**: Implementar query real para contar eventos asociados a la location, o documentar que el feature de eventos no está implementado aún y retornar null en vez de 0 engañoso

**Sub-tarea 3: destination eventsCount hardcoded**
- **Archivo**: `packages/service-core/src/services/destination/destination.service.ts:351`
- **Acción**: Implementar query real para contar eventos del destino, o retornar null

**Sub-tarea 4: ReviewForm no envía datos**
- **Archivo**: `apps/web/src/components/review/ReviewForm.client.tsx:163-165`
- **Acción**: Verificar si existe endpoint POST para reviews. Si no existe:
  - Crear endpoint `POST /api/v1/protected/reviews` en `apps/api/src/routes/`
  - Crear servicio en service-core si no existe
  - Conectar el form al endpoint
- **Nota**: El agente confirmó que NO existe endpoint POST para crear reviews. Solo existe `GET /api/v1/protected/users/me/reviews`.
- **Complejidad**: Esta sub-tarea es la más grande. Requiere: endpoint + service + schema de input + validación.

---

## Batch G: Test Coverage Heavy (~30+ horas)

Esfuerzo mayor, puede hacerse incremental en múltiples sesiones.

### G.1 - Gap #30: 4 servicios sin tests

- **Servicios**: OwnerPromotionService, SponsorshipService, SponsorshipLevelService, SponsorshipPackageService
- **Patrón**: Seguir tests existentes (createActor, mock model layer, AAA pattern)
- **Crear directorios de test** en `packages/service-core/test/`

### G.2 - Gap #45: packages/config sin tests

- **Archivos a testear**: Funciones de validación de env vars en `packages/config/`
- **Crear**: `packages/config/test/` con tests básicos de validación

### G.3 - Gap #47: 9 DB models sin test file

- **Modelos**: accommodationFaq, accommodationIaData, accommodationReview, ownerPromotion, postSponsor, sponsorshipLevel, sponsorshipPackage, userBookmark, userIdentity
- **Acción**: Escribir tests reales siguiendo patrón existente

### G.4 - Gap #4: 32 DB model tests skipeados

- **Esfuerzo mayor**: 20+ horas
- **Estrategia**: Priorizar por uso en producción. Empezar por modelos activos (accommodation, attraction, event, post, destination), dejar modelos de billing/commerce para después.

### G.5 - Gap #37: API tests mock DB → service layer

- **7 archivos** a refactorizar para mockear service layer en vez de DB
- **Estrategia**: Uno a uno, verificando que los tests siguen pasando

---

## Batch H: Refactoring Admin (~8 horas)

### H.1 - Gap #33: 14 archivos admin > 500 líneas

- **Estrategia**: Extraer de cada archivo:
  - Hooks → `hooks/` directory
  - Dialog components → archivo separado
  - Table column definitions → `columns/` directory
  - Form configurations → `config/` directory
- **Excepción**: `icon-comparison.tsx` (dev-only, aceptar)
- **Priorización**: Empezar por los más grandes (promo-codes 811, billing-http-adapter 803)

### H.2 - Gap #8: @ts-expect-error QZPay types

- **Acción**: Modificar QZPay para agregar type declarations faltantes
- **Decisión**: Se discutirá el approach cuando llegue el momento
- **Nota**: Fix va en el repo de QZPay, no en Hospeda

---

## Resumen de Esfuerzo

| Batch | Descripción | Esfuerzo | Gaps |
|-------|-------------|----------|------|
| A | Quick fixes | ~1 hr | #25, #2, #27, #39, #9, #7, #5 |
| B | Schema fixes | ~45 min | #41, #42, #43, #44 |
| C | Tests schema/service | ~3-5 hrs | #26, #14, #15 |
| D | Code quality | ~1.5 hrs | #10/13/22, #18, #34, #36 |
| E | Infra & validation | ~4 hrs | #6, #28, #19, #31, #35 |
| F | Prod data integrity | ~3 hrs | #29 |
| G | Test coverage heavy | ~30+ hrs | #30, #45, #47, #4, #37 |
| H | Refactoring admin | ~8 hrs | #33, #8 |
| **Total** | | **~50-60 hrs** | **30 gaps** |

## Quality Gates

Antes de marcar cada batch como completado:

1. `pnpm typecheck` - 0 errores nuevos
2. `pnpm lint` - 0 errores nuevos
3. `pnpm test` - 0 failures nuevos
4. Tests específicos del área modificada pasan

## Notas Importantes

- **Gap #8** (QZPay types): Se implementa en el repo de QZPay, no en Hospeda
- **Gap #29 sub-tarea 4** (ReviewForm): Requiere crear endpoint nuevo, es la sub-tarea más compleja
- **Gap #28**: `ActorSchema` ya existe en `@repo/schemas`, solo falta usarlo
- **Batch G**: Puede ejecutarse incremental en múltiples sesiones
- **Commit strategy**: Un commit por batch (o sub-batch si es grande). Conventional commits: `fix(scope): description`

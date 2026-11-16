---
title: Promos de local, modelo y API
linear: HOS-2270
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - billing
---

# Promos de local: modelo y API

Hijo de HOS-2252 (Comer y salir). Primero de la cadena HOS-2270, HOS-2271, HOS-2272. HOS-2273 (promos VIP) cuelga de esta spec.

## 1. Resumen

Hoy las promociones (`owner_promotions`) son solo de alojamiento. Esta spec las extiende a los locales: una promo puede pertenecer a un local, se crea y se edita por rutas propias del local, y usa las claves que ya existen (`create_promotions` y `max_active_promotions`). No hay pantalla todavía (HOS-2271).

## 2. Problema

- La tabla solo conoce `accommodation_id`. No hay forma de colgar una promo de un local.
- El gate de crear, editar y contar está fijo en `VerticalEnum.ACCOMMODATION`.
- Una promo sin alojamiento hoy significa "promo de todos los alojamientos del dueño". Si un local usara esa misma forma, aparecería en los alojamientos del dueño y en los avisos por mail. Es el riesgo central de esta spec.
- El tipo de beneficio (`discountType`) solo habla de noches, porcentaje y monto. Un local necesita "2x1 en tragos".

## 3. Objetivos

- G-1. Una promo puede pertenecer a un local, con integridad referencial.
- G-2. Las promos de alojamiento existentes no cambian de comportamiento ni de datos.
- G-3. Las rutas de local declaran `VerticalEnum.VENUE` y gatean con `create_promotions` y `max_active_promotions` en el vertical `venue`.
- G-4. Los campos que no aplican a un local (`minNights`) no se piden ni se validan.
- G-5. Cada puerta cierra su vertical: una promo de local no se puede crear, editar ni contar por las rutas de alojamiento, y al revés.
- G-6. La baja de plan respeta lo cargado y frena lo nuevo (decisión 6 de HOS-2253).

## 4. Fuera de alcance

- Pantallas del dueño y de la ficha (HOS-2271).
- Franja horaria y badge "Ahora" (HOS-2272).
- Promos exclusivas VIP y la clave `venue_vip_promotions` (HOS-2273).
- Asignar `create_promotions` y `max_active_promotions` a los planes de local: lo hace HOS-2282 (additive grant). Hasta ahí el gate responde 403 a todos los dueños de local, y está bien: es la "Fase 1 oculta".
- Promos de experiencia.
- Cerrar la fuga de promos VIP en la ficha pública de alojamiento (ver 11, OQ-5).

## 5. Estado actual del código

Verificado en `origin/staging` (checkout `hospeda-spec-hos-2252-docs`, último commit `92994b9dc6`).

**Tabla.** `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts`
- `:19-21` `accommodation_id` nullable, FK `ON DELETE SET NULL`.
- `:24-26` `discount_type` (enum), `discount_value` int NOT NULL, `min_nights`.
- `:35` `tourist_audience` (`plus` | `vip`, default `plus`).
- `:44-66` índices; `:69-81` relaciones. No hay columna de vertical ni de local.
- El enum `OwnerPromotionDiscountTypeEnum` (`packages/schemas/src/enums/owner-promotion-discount-type.enum.ts`) tiene `percentage`, `fixed` y `free_night`.

**Cinco lectores que tratan `accommodation_id IS NULL` como "promo de todos los alojamientos del dueño" (D-4 de SPEC-285).** Si un local guardara su promo con `accommodation_id` nulo, los cinco la tomarían como de alojamiento:
1. `packages/db/src/models/owner-promotion/ownerPromotion.model.ts:209-212` (`findActiveForAccommodation`) y `:273-276` (`countActiveForAccommodation`).
2. `packages/service-core/src/services/alert/promo-offer-evaluator.service.ts:294-320` (expande la promo a todos los alojamientos del dueño para el mail diario) y `:359` (`fetchAllActivePromotions`, sin filtro de target).
3. `packages/service-core/src/services/owner-promotion/ownerPromotion.visibility.ts:24-35`: un `accommodation_id` nulo siempre pasa el filtro de visibilidad.
4. `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts:250` y `:286`: la lista pública sin filtro devuelve todas las filas ACTIVE.
5. `packages/db/src/models/listing/listing-purge.model.ts:54`: la purga borra por `accommodation_id`. Un local no tiene fila en `CONTENT_TABLES.venue` (`:62-74`).

**Rutas protegidas** (`apps/api/src/routes/owner-promotion/protected/`):
- `create.ts:42-59`: `enforceUserGate` con `VerticalEnum.ACCOMMODATION`, clave `create_promotions` y límite `max_active_promotions`. El conteo `:47-50` cuenta **todas** las promos activas del dueño (`ownerId`), sin separar por vertical. Con promos de local, un dueño de alojamiento y local gastaría el cupo de uno con el otro.
- `update.ts:53-57` y `patch.ts:53-55`: mismo gate, solo la clave. Pausar una promo también exige `create_promotions`. Activar una promo pausada no revisa el límite.
- En `create.ts` y en `OwnerPromotionService` (`_beforeCreate`, `_canCreate`) no se encontró ninguna verificación de que `accommodationId` del body sea del dueño: solo se pide el permiso `OWNER_PROMOTION_CREATE`. Posible hueco de alojamiento, fuera de alcance; conviene confirmarlo con un test y abrir un issue aparte. En local esto no puede pasar: la ruta cuelga del `{id}` del local (ver 6.3).
- `list.ts`: lista todas las promos del dueño sin filtro de target.

**Servicio.** `OwnerPromotionService` (`ownerPromotion.service.ts`): `_executeSearch :209-251`, `_executeCount :253-290`, `findExclusiveDeals :415-460`, `getDefaultListRelations :82-84` (solo `owner` y `accommodation`).

**Permisos.** `packages/seed/src/required/rolePermissions.seed.ts:1104-1111`: solo el rol `HOST` tiene `OWNER_PROMOTION_CREATE/VIEW_OWN/UPDATE_OWN/SOFT_DELETE_OWN/RESTORE_OWN/UPDATE_VISIBILITY_OWN`. El rol `VENUE_OWNER` (`:1165-1217`) no tiene ninguno. El servicio los exige (`ownerPromotion.permissions.ts`).

**Claves.** `create_promotions` es entitlement de scope `vertical` (`packages/schemas/src/catalog/entitlement-keys.ts:25`) y `max_active_promotions` es límite `vertical`, agregación `SUM`, enforcement `ARCHIVE` (`limit-keys.ts:18`). Hoy solo las tienen los planes de alojamiento en `scripts/production-catalog/catalog.ts` (líneas 106, 170, 275, 351, 462, 541). Los planes de local (`venue-basico/pro/premium`) no las tienen.

**Cron.** `apps/api/src/cron/jobs/archive-expired-promotions.job.ts:125-136` archiva por `valid_until` sin mirar el target: sirve igual para local, no cambia. `billing-promo-ending-notice` (`schedules.manifest.ts:192`) es de promos de cobro, no de `owner_promotions`: no aplica.

**Patrón de rutas de local con gate.** `apps/api/src/routes/venue/protected/putEvents.ts:81-91`: `listingAccess: { vertical: VerticalEnum.VENUE, operation: 'EDIT', listingSection }`. El resolver (`packages/verticals/src/authorization/resolve-listing-access.ts:171-172` y `:212-221`) salta la clave de la sección con `intent: 'read'` (dueño) y `intent: 'delete'`, y la exige con `'write'`. Es exactamente la baja de plan que pide la decisión 6.

## 6. Diseño propuesto

### 6.1 Decisión de modelo (a confirmar por el dueño, OQ-1)

| | A1. `entity_type` + `entity_id` | A2. `venue_id` nullable (recomendada) | C. Tabla `venue_promotions` |
|---|---|---|---|
| Qué hace | Reemplaza `accommodation_id` por un par polimórfico | Suma `venue_id` con FK y un CHECK de exclusión | Tabla nueva, servicio nuevo |
| Integridad | Sin FK, se pierde | FK real a `venues` | FK real |
| Promos de alojamiento existentes | Hay que migrar datos de todas | Intactas (columna nueva nullable) | Intactas |
| Riesgo "nulo = de todos" | Desaparece | Sigue: hay que endurecer los 5 lectores (5) | No existe |
| Pantalla de admin y cron | Reusa | Reusa | Hay que duplicar o extender |
| Lista de beneficios exclusivos (HOS-2273) | Una consulta | Una consulta | Dos tablas, paginar la unión |
| Purga (G-R9) | Hay que sumar fila `entity_type` en `purged-closed-list.json` y en la lista congelada de `purged-closed-list-from-empty.test.ts` (lección HOS-2192) | La fila de `owner_promotions` (`hangsBy: fk`, `purged-closed-list.json:218-224`) ya existe, solo se suma el FK a `CONTENT_TABLES.venue` | Fila nueva `fk` |
| Costo | Alto, toca datos vivos | Medio | Medio-alto (unos 25 archivos duplicados) |

**Recomendación: A2.** Es el único que cumple "las promos de alojamiento no cambian" sin duplicar el servicio, el cron ni el admin. El precio es endurecer cinco lectores, y se cubre con un test por lector (ver 9). A1 se descarta por el costo de migrar datos vivos. C es la alternativa si el dueño prefiere cero riesgo de contaminación a costa de duplicar.

### 6.2 Datos (carril estructural)

Una migración con `pnpm db:generate` (el último número hoy es `0226`; el siguiente libre se toma al implementar):
- `owner_promotions.venue_id uuid NULL` con FK a `venues(id)` `ON DELETE SET NULL` (igual que `accommodation_id`) e índice `ownerPromotions_venueId_idx`.
- CHECK `owner_promotions_single_target_check`: `num_nonnulls(accommodation_id, venue_id) <= 1`. Se declara en el schema Drizzle si el generador lo soporta; si no, va a `packages/db/src/migrations/extras/` (carril de objetos invisibles para Drizzle, idempotente).
- Nuevo valor de enum `special_offer` en `owner_promotion_discount_type_enum` (beneficio libre: 2x1, combo, postre gratis). `discount_value` queda 0. Ver OQ-2. `ALTER TYPE ... ADD VALUE` va solo en su migración.

Semántica que queda escrita en el docblock de la tabla:
- `accommodation_id` con valor: promo de ese alojamiento.
- `venue_id` con valor: promo de ese local. No hay promo "de todos los locales" del dueño (YAGNI).
- Ambos nulos: promo de todos los alojamientos del dueño (D-4, sin cambios).

No hay data-migration de seed: no se cambia dato existente. Fixture de dev opcional para `venue-owner@local.test` en `packages/seed/src/test-users/hostPromotion.ts`: si se agrega, es dato demo y está exento de la regla de dual-write.

### 6.3 Rutas (tier protegido, bajo `routes/venue/protected/`)

Todas con `listingAccess.vertical = VerticalEnum.VENUE`, `idParam: 'id'` (G2) y la sección `promotions` del catálogo (6.5). El `{id}` del local da la propiedad: el dueño del local es el dueño de la promo.

| Método y ruta | Operación | Sección e intent | Límite |
|---|---|---|---|
| `GET /api/v1/protected/venues/{id}/promotions` | `READ_OWN` | `promotions`, `read` | no |
| `POST /api/v1/protected/venues/{id}/promotions` | `EDIT` | `promotions`, `write` | `max_active_promotions`, pedido = activas del dueño en locales + 1 |
| `PUT /api/v1/protected/venues/{id}/promotions/{promotionId}` | `EDIT` | `write` | si pasa a ACTIVE, mismo límite |
| `PATCH` mismo path | `EDIT` | `delete` si el body es solo `{ lifecycleState }` distinto de ACTIVE (pausar), si no `write` | como PUT |
| `DELETE` mismo path (soft delete) | `EDIT` | `delete` | no |

- El intent dinámico se resuelve como en `putMenu.ts:88` y `putEvents.ts:88`.
- El límite usa el hook `listingAccess.limit` (`apps/api/src/types/authorization.ts:65-69`), no `enforceUserGate`.
- La promo se crea con `ownerId = dueño del local`, `venueId = {id}`, `accommodationId = null`. Ni `ownerId` ni `venueId` ni `accommodationId` se leen del body.
- Errores (contrato de `apps/api/docs/error-contract.md`): 401 sin sesión; 403 `ENTITLEMENT_REQUIRED` sin clave o sin cobertura; 403 `LIMIT_REACHED` con `{ limitKey, currentCount, maxAllowed }`; 400 `VALIDATION_ERROR` por forma; 404 si el local o la promo no son del dueño (nunca 403) y si `{promotionId}` no cuelga de `{id}`.
- Permisos: las rutas piden `OWNER_PROMOTION_*_OWN` según el verbo. Hay que dárselos a `VENUE_OWNER` (6.6).

### 6.4 Cerrar las puertas de alojamiento (G-5)

- `create.ts`, `update.ts`, `patch.ts`, `softDelete.ts`, `get.ts` de `owner-promotion/protected/` tratan una fila con `venue_id` como inexistente: 404 `NOT_FOUND`. Una sola puerta por vertical.
- `OwnerPromotionCreateRequestSchema` omite `venueId`. El schema de alta de local es otro (6.7) y no admite `accommodationId`.
- `create.ts:47-50` cuenta solo promos con `venue_id IS NULL`. Es una corrección de comportamiento para dueños con ambos verticales: hoy no existen promos de local, así que no cambia nada observable.
- `list.ts` (`GET /protected/owner-promotions`, la lista de `/mi-cuenta/promociones`) devuelve solo filas con `venue_id IS NULL`.
- Lista pública `GET /public/owner-promotions` y `getById` público: solo `venue_id IS NULL`. Las promos de local se publican por la ruta de HOS-2271.

### 6.5 Sección de catálogo y gate de clave

Sección nueva `promotions` en `LISTING_SECTIONS.venue` (`packages/schemas/src/catalog/listing-sections.ts`, después de `venueEvents`, `:108-116`): `common: true`, `entitlementKey: K.CREATE_PROMOTIONS`, `fields: []`, `readOnlyFields: []`, grupo `content`. Las promos no viajan en el payload del local: tienen su propia ruta pública (HOS-2271), así el proyector público no las esconde cuando la sección queda bloqueada y siguen vigentes tras una baja de plan (6.9). Hay que confirmar que ningún test o guard del catálogo exija campos en cada sección. Sin operación nueva en el pipeline: no toca `OPERATION_STEP6_KEY` ni `check-step5-declared`. No se compara la vertical en ningún lado (G1): el gate sale del catálogo.

Registros exhaustivos (`satisfies Record<ListingSectionId<'venue'>, …>`) que cortan el build hasta declarar la sección. Aquí van con un valor mínimo; el contenido real es de HOS-2271 y de HOS-2262:
- `apps/web/src/lib/venue/venue-detail-sections.ts:35-48` (`promotions: false` hasta que HOS-2271 pinte el bloque).
- `apps/web/src/lib/editor/listing-section-presentation.ts:78-81` (slug `promociones`, `labelKey` `listing.owner.editor.sectionNav.venuePromotions`).
- `apps/web/src/components/billing/plan-comparison-catalog-rows.ts` (bloque venue, junto a `venueEvents` `:121-128`): `promotions: {}` por ahora. La fila de la tabla de planes la define HOS-2262.
- `apps/web/src/lib/venue/section-upsell-plan.ts:7-14` no es exhaustivo (interfaz), pero HOS-2271 suma `promotions` ahí.

### 6.6 Permisos de rol

Dar a `VENUE_OWNER` los seis `OWNER_PROMOTION_*_OWN` que hoy tiene `HOST`. Dual-write (HOS-25): línea en `rolePermissions.seed.ts` y data-migration numerada con `pnpm db:seed:make` (precedente `0176-hos1612-migrate-plan-permission.ts`, `onConflictDoNothing`). Un rol no decide nada (G6): es solo el permiso que gatea la ruta.

### 6.7 Schemas (`@repo/schemas`)

- `OwnerPromotionSchema` suma `venueId` (uuid nullable opcional; hoy no existe un `VenueIdSchema` en `packages/schemas/src/common/id.schema.ts`, se agrega ahí junto a `AccommodationIdSchema`) y un `superRefine` que rechaza ambos targets a la vez (400, no un 23514 de Postgres).
- `VenuePromotionCreateRequestSchema`: `title`, `description`, `discountType` (percentage | fixed | special_offer), `discountValue`, `validFrom`, `validUntil`, `touristAudience` (solo se acepta `plus` acá; `vip` entra por HOS-2273). Sin `minNights`, sin `maxRedemptions` (no hay flujo de canje, ver OQ-3). El de update es `.strict()` y parcial, como el actual (`owner-promotion.schema.ts:123-126`), así que `minNights` en el body da 400.
- Constantes `ACCOMMODATION_PROMOTION_DISCOUNT_TYPES` y `VENUE_PROMOTION_DISCOUNT_TYPES`; el formulario de alojamiento y la validación leen la suya. Así `special_offer` no aparece en el formulario de alojamiento (`PromotionForm.client.tsx` itera los tipos).
- Salidas: schema protegido de promo de local (incluye `lifecycleState`, `validFrom`, `validUntil`, `discountType`, `discountValue`, `touristAudience`).
- Actualizar `scripts/zod-keys-inventory.json` y las claves `zodError.ownerPromotion.*` en `validation.json` (es, en, pt).

### 6.8 Servicio y modelo

- `OwnerPromotionModel`: `countActiveForVenueOwner({ ownerId })`, `findByVenue({ venueId })`; los `findActiveFor*` y `countActiveFor*` de alojamiento suman `isNull(venue_id)` al owner-wide (`:209-212`, `:273-276`).
- `OwnerPromotionService`: `_executeSearch`/`_executeCount` suman `venue_id IS NULL`; `buildAccommodationVisibilityCondition` pasa a `venue_id IS NULL AND accommodation_id IS NULL OR …` (la rama de local con su visibilidad llega en HOS-2273). `getDefaultListRelations` suma `venue`. Sin comparar `vertical` en código compartido (G1): se filtra por la columna.
- `promo-offer-evaluator.service.ts:359`: `fetchAllActivePromotions` excluye `venue_id` no nulo. Sin esto, un local dispararía mails de "oferta en tu alojamiento".
- `listing-purge.model.ts:62-74`: `venue` suma `{ table: 'owner_promotions', fk: 'venue_id' }`. Tests de purga actualizados.
- Revalidación de caché: toda escritura de promo de local revalida la ficha y la lista del local (entidad `venue`, vocabulario de `packages/cache-tags`; el `VenueService` ya expone `_revalidationEntityType`, `venue.service.ts:237`).

### 6.9 Baja de plan (decisión 6)

- Se respeta lo cargado: las promos activas siguen vigentes hasta su `validUntil` o hasta que el dueño las borre, igual que en alojamiento. No se archiva ni se borra nada.
- Se frena lo nuevo: crear, editar y activar exigen la clave y el límite (`write`). Leer, pausar y borrar siempre se pueden (`read` y `delete`).
- El enforcement `ARCHIVE` de `max_active_promotions` es solo un atributo del catálogo: no hay motor de baja que lo aplique hoy y esta spec no lo agrega (OQ-4).
- Aislamiento de scope: el límite y la clave se leen con `vertical: venue` (`resolveLimitStep`/`listingAccess`), y el conteo del dueño es solo de locales. El de alojamiento sigue en `vertical: accommodation` y cuenta solo `venue_id IS NULL`.

## 7. Contratos

- Respuesta de `GET .../promotions`: `{ items, meta: { activeCount, maxActive } }`. `maxActive` sale de `readEffectiveLimit` (`apps/api/src/utils/listing-access/user-gate.ts:85`); `2147483647` es sin tope (`UNLIMITED_LIMIT_VALUE`).
- OpenAPI: tags `['Venue', 'Venue Promotions']`.

## 8. UX

Sin pantalla (HOS-2271).

## 9. Criterios de aceptación

- AC-1. Dado un dueño con `create_promotions` y cupo en venue, cuando hace `POST /protected/venues/{id}/promotions`, entonces se crea una promo con `venue_id = {id}`, `accommodation_id = null` y `owner_id` del local.
- AC-2. Dado un dueño sin `create_promotions` en venue, cuando hace POST, entonces 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'create_promotions'`.
- AC-3. Dado un dueño con 5 promos activas de local y límite 5, cuando crea otra, entonces 403 `LIMIT_REACHED` con `currentCount: 5, maxAllowed: 5`.
- AC-4. Dado un dueño con límite de alojamiento 3 y 3 promos activas de alojamiento, y límite de local 5, cuando crea una promo de local, entonces se crea (los cupos no se cruzan). Y al revés.
- AC-5. Dado un POST con `minNights` o `accommodationId`, entonces 400 `VALIDATION_ERROR`.
- AC-6. Dado un dueño que bajó de plan y ya no tiene `create_promotions` en venue, cuando lista, pausa o borra una promo vigente, entonces funciona; cuando crea, edita o reactiva, entonces 403. La promo vigente sigue visible en la ficha.
- AC-7. Dado un local de otro dueño, cuando se pide cualquier ruta de promociones sobre él, entonces 404, nunca 403.
- AC-8. Dado `PUT /protected/owner-promotions/{id}` o `DELETE` con el id de una promo de local, entonces 404.
- AC-9. Dada una promo de local, entonces no aparece en `GET /public/owner-promotions`, ni en `getById` público, ni en `GET /protected/owner-promotions`.
- AC-10. Dada una promo de local ACTIVE, cuando corre `evaluatePromoOffers`, entonces no genera ninguna coincidencia para alojamientos del dueño.
- AC-11. Dada una promo de local, cuando se consulta `findActiveForAccommodation` de un alojamiento del mismo dueño, entonces no la incluye.
- AC-12. Dado el CHECK, cuando se inserta una fila con `accommodation_id` y `venue_id`, entonces falla en DB y la API responde 400 (no 500) por el `superRefine`.
- AC-13. Dado un local que se purga, entonces sus promos se borran con el contenido (`owner_promotions` por `venue_id`).
- AC-14. Dado un dueño con solo rol `VENUE_OWNER`, cuando crea una promo, entonces no recibe 403 por permiso (recibe el gate de clave si corresponde).
- AC-15. Dado el cron `archive-expired-promotions`, cuando hay una promo de local vencida, entonces se archiva.
- AC-16. Dada toda escritura de promo de local, entonces se encola la revalidación de la ficha y la lista del local.

## 10. Plan de pruebas

- Unit `packages/schemas/test/entities/ownerPromotion/`: `venueId`, superRefine, create/update de local `.strict()`, constantes de tipos de descuento.
- Unit `packages/service-core/test/services/owner-promotion/` y `.../alert/promo-offer-evaluator.service.test.ts`: AC-10 y AC-11 (un test por lector endurecido: modelo, evaluador, visibilidad, búsqueda pública, conteo).
- Integración DB `packages/db/test/integration/`: CHECK (AC-12), purga (AC-13), FK. Hay un guard de que `purged-closed-list-from-empty.test.ts` y `pnpm check:purged-closed-list` (G-R9) siguen verdes.
- Integración API `apps/api/test/routes/venue/protected/` (sigue el estilo de `putEvents` y de `apps/api/test/routes/owner-promotion/protected/create.test.ts`): AC-1 a AC-9, AC-14, AC-16. Fixtures de effective set con `rehydrateEffectiveSet` como en `tourist-audience.test.ts`.
- Cron: `apps/api/test/cron/archive-expired-promotions.test.ts` con una fila de local (AC-15).
- Guard congelado de rutas: `apps/api/test/routes/coverage-step-coverage.guard.test.ts:165-184` lista cada ruta de escritura de local con su operación. Se suman las cuatro nuevas con `{ operation: 'EDIT' }` (la de lectura no entra). Sin esto el test falla.
- Guards a correr antes del PR: `check-vertical-context` (G2), `check-vertical-axis-items` (G1), G3/G18 (no se tocan claves), `check-seed-dual-write`, `check-purged-closed-list`.
- Sin e2e: no hay UI.

## 11. Riesgos y preguntas para el dueño

Riesgos:
- R-1. Endurecer los cinco lectores con `venue_id IS NULL` se puede olvidar en un sexto lector futuro. Mitigación: docblock de la tabla y un test que recorra los `findActive*`.
- R-2. Hasta HOS-2282 ningún dueño de local tiene `create_promotions`: no se puede smokear de punta a punta salvo con un grant manual en una versión de plan de staging.
- R-3. Colisión de archivos con otras hojas de HOS-2252 (catálogo de secciones, `listing-sections.ts`). Coordinar el orden de merge.

Preguntas:
- OQ-1. Modelo de datos. Opciones: (A2) `venue_id` en `owner_promotions`; (A1) polimórfico; (C) tabla `venue_promotions`. **Recomiendo A2** (ver 6.1).
- OQ-2. Tipo de beneficio del local. Opciones: (a) solo porcentaje y monto; (b) sumar `special_offer` de texto libre; (c) todo en texto libre. **Recomiendo (b)**: el ejemplo del issue ("2x1 en tragos") no entra en porcentaje ni monto.
- OQ-3. Cupo de canjes (`maxRedemptions`) en locales. Opciones: (a) no pedirlo, hoy nada lo incrementa; (b) pedirlo como en alojamiento. **Recomiendo (a)** (YAGNI).
- OQ-4. Tras una baja de plan, ¿las promos que exceden el nuevo tope se siguen mostrando hasta que venzan? Opciones: (a) sí, solo se bloquea crear (decisión 6 leída literal); (b) se pausan las que exceden. **Recomiendo (a)**, igual que alojamiento.
- OQ-5. Hallazgo fuera de alcance: la ficha pública de alojamiento (`PromotionBanner`, `GET /public/owner-promotions`) hoy muestra también las promos `vip` (`_executeSearch` no filtra `touristAudience`, `ownerPromotion.service.ts:209-251`). ¿Se abre un issue aparte para cerrarlo? **Recomiendo sí**; en local la spec lo evita desde el inicio.

## 12. Dependencias

- HOS-2282 (habilitar promos en planes) para el smoke real.
- HOS-2271 (pantallas), HOS-2272 (franja), HOS-2273 (VIP) dependen de esta.
- Coordinar con HOS-2259/HOS-2262: no agregan claves para esta spec (usa claves existentes).

## 13. Etiquetas de smoke y Novedades

- `status-needs-smoke-staging`: toca gates de entitlement y límite. El smoke se hace con HOS-2282 ya aplicado, o con un grant manual en staging. Sigue `docs/billing/smoke-checklist.md` (parte staging). No es núcleo de billing, no pide sección de producción.
- Novedades: no aplica (es backend invisible). Etiqueta `whats-new-none`.

## 14. Desglose de tareas

1. T-1 Schemas: `venueId`, superRefine, schemas de local, constantes de tipos, claves zod. Tests.
2. T-2 DB: migración estructural (`venue_id`, índice, CHECK, enum `special_offer`) y docblock de la tabla.
3. T-3 Modelo: métodos de local y endurecer los `findActive*`/`countActive*`.
4. T-4 Servicio: búsqueda, conteo, visibilidad, relación `venue`. Evaluador de alertas. Tests de cada lector.
5. T-5 Purga: `listing-purge.model.ts` + tests + G-R9.
6. T-6 Catálogo de secciones: sección `promotions` y valores mínimos en los tres registros exhaustivos web (detalle, presentación del editor, tabla de planes) para que compile.
7. T-7 Rutas de local (GET/POST/PUT/PATCH/DELETE), intent dinámico, límite, revalidación. Tests.
8. T-8 Cerrar puertas de alojamiento (404 para filas de local, conteo y lista filtrados). Tests.
9. T-9 Permisos de `VENUE_OWNER`: seed + data-migration + test de rolePermissions.
10. T-10 Cron (test) y quality gate: guards G1, G2, dual-write, purga.

## 15. Linear

Canonical tracking: HOS-2270. Épica: HOS-2252. Decisiones: HOS-2253.

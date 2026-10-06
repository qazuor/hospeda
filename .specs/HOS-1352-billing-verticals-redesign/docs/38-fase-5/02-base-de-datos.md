# FASE 5 · Área 2 — Base de datos

- **Área**: base de datos (esquema Drizzle de `packages/db`, carril de extras, los tres carriles de migración, el guard de dual-write del seed, soft delete y `BaseModel`, restricciones).
- **Código de referencia**: `origin/staging` en `35e2d63e819d087cb871392ec923158b91630f30` (leído con `git show` / `git grep` y con un `git archive` de `packages/db`, `packages/seed/src/data-migrations`, `scripts`, `apps/api/src` y `packages/service-core/src` al scratchpad; nunca el working tree).
- **Fecha**: 2026-09-30.
- **Criterio**: `DEC-METH-017` (`reglas-fase-5.md`). Lo que `U1` borra va como `DELETE` citando el lote N-A de `16-fase-7…` §4.6; la excepción de las tres columnas es el lote N.
- **Siglas de rutas**: `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`, `V` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `B` = `.specs/HOS-1354-billing-cobro-y-proveedor`. Las citas de código son `ruta:línea` en `origin/staging`.

## Resumen

Conteo por categoría (contado con `grep -c` sobre las líneas `- **Categoría**:` de este archivo, abajo en *«búsquedas de ausencia»*):

| categoría | piezas |
|---|---|
| `DELETE` | 5 |
| CONFIRMA | 8 |
| CONTRADICE | 11 |
| FALTA | 3 |
| ADAPTAR | 7 |
| **total** | **34** |

**Las ALTA** (cuatro):

1. **F5-BD-012** — Las rutas de borrado de fichas que existen hoy (soft delete del dueño, soft/hard delete y restore del admin, en las tres verticales) contradicen *«`PURGED` conserva la fila»* y *«ninguna transición escribe `deleted_at`»*; el hard delete arrastra por `CASCADE` las reseñas de terceros. El diseño no las nombra ni se las asigna a nadie.
2. **F5-BD-019** — La lista de pendientes de `G8` (`packages/db/src/migrations/**`) cubre el carril de extras, el paso 6 le saca esa entrada sin reemplazar los extras, y `032-commerce-media.constraints.sql` nombra la palabra en el nombre y en el cuerpo: `G8` queda rojo en el commit del paso 6.
3. **F5-BD-020** — El carril estructural es `drizzle-kit migrate` sobre archivos SQL: la migración del paso 3 no puede *«llamar la pieza de `V2`»* ni calcular el seudónimo *«con la misma función que `T1`»*, que son TypeScript.
4. **F5-BD-021** — Las bases de desarrollo, de tests de integración y de e2e nocturno se arman con `drizzle-kit push`, que no ejecuta el SQL de las migraciones: las filas de referencia que el diseño pone en la migración (tabla de claves, espejo de verticales, plazos v1, catálogo) no llegan a ellas.

---

## 1. Lo que `U1` borra (`DELETE`, lote N-A)

### F5-BD-001 — Las 27 tablas de qzpay

- **Categoría**: DELETE
- **Diseño**: `D/16-fase-7-del-paraguas.md` §4.6 punto 1 (líneas 604-611): *«el esquema de las tablas viejas de billing, cuyo borrado genera la migración que las saca de la base en el paso 3»*; `B/docs/21-migracion.md` §4 (líneas 435-443).
- **Código**: el modelo vive en `@qazuor/qzpay-drizzle` y entra al esquema por `packages/db/src/billing/schemas.ts:14` (`export * from '@qazuor/qzpay-drizzle'`), que `packages/db/drizzle.config.ts:12` incluye en `schema`. El snapshot `packages/db/src/migrations/meta/0124_snapshot.json` tiene 174 tablas, `public.billing_plans` entre ellas.
- **Nota de verificación (no es argumento de la clasificación)**: la derivación del diseño se sostiene: al sacar `./src/billing/schemas.ts` de `drizzle.config.ts`, `drizzle-kit generate` emite los `DROP` porque las 27 están en el snapshot. `F-1B-001` sigue vigente: 147 tablas propias (conteo por script, abajo) + 27 = 174.
- **Unidad**: `U1`.

### F5-BD-002 — Las quince tablas de billing propias de hospeda

- **Categoría**: DELETE
- **Diseño**: `D/16-…` §4.6 punto 1; `B/docs/21-migracion.md` §4 (líneas 437-440: *«`billing_*` entero … los grants de destaque, `entity_subscriptions`, `partner_subscriptions`»*).
- **Código**: `packages/db/src/schemas/billing/` define 14 tablas en 12 archivos (`billing_addon_purchases`, `billing_dunning_attempts`, `billing_mp_addon_plans`, `billing_mp_plans`, `billing_notification_log`, `billing_orphan_payments`, `billing_pending_checkouts`, `billing_plan_price_changes`, `billing_plan_price_change_targets`, `billing_plan_price_change_notices`, `billing_settings`, `billing_subscription_events`, `entity_subscriptions`, `featured_listing_addon_grants`), más `partner_subscriptions` en `packages/db/src/schemas/partner/partner_subscription.dbschema.ts`.
- **Nota**: el trigger duplicado de `F-1B-011` (`trg_set_updated_at_commerce_listing_subscriptions` sobre `entity_subscriptions`) muere con la tabla; no hace falta retirarlo aparte.
- **Unidad**: `U1`.

### F5-BD-003 — Columnas del cobro viejo en tablas que sobreviven

- **Categoría**: DELETE
- **Diseño**: `B/docs/21-migracion.md` §4 (líneas 440-443: *«las columnas denormalizadas que el código de hoy lee, como `featured_by_entitlement`… se retiran con el código que las lee»*).
- **Código**: `partners.plan_id` y `partners.subscription_id`, con FK a `billing_plans` y `billing_subscriptions` (`packages/db/src/schemas/partner/partner.dbschema.ts:60`, `:63`; importan de `../../billing/index.ts`, línea 4, así que no compilan sin qzpay); `featured_by_entitlement` en las tres tablas de ficha (`accommodation.dbschema.ts:92`, `gastronomy.dbschema.ts:186`, `experiences.dbschema.ts:304`); `experiences.has_active_subscription` (`experiences.dbschema.ts:238`).
- **Unidad**: `U1`.

### F5-BD-004 — Los 18 extras que escriben sobre tablas de billing

- **Categoría**: DELETE
- **Diseño**: `D/16-…` §4.6 punto 1, *«todo lo que sólo el sistema viejo usa»*.
- **Código**: en `packages/db/src/migrations/extras/`, **13 tocan tablas de qzpay** (`010`, `014`, `015`, `020`, `023`, `024`, `025`, `028`, `031`, `035-canceled-spelling…`, `036`, `037`, `038-courtesy-window…`) y **5 sólo tablas de billing de hospeda** (`004-billing.constraints`, `029`, `030`, `038-hos1012…`, `041`). El 13 de `F-1B-014` sigue vigente.
- **Nota que el lote no dice y el que haga `U1` necesita**: 10 de los 18 no chequean que su tabla exista (`to_regclass` / `information_schema.tables`: 0 apariciones en `015`, `028`, `029`, `030`, `031`, `037`, `038-courtesy…`, `038-hos1012…`, `041`, y `004` sí tiene guardas). Si alguno queda en el repo, `pnpm db:apply-extras` falla en toda base donde la migración de `U1` ya corrió. El criterio de *«lista»* de `U1` (`D/16-…` §4.6, tabla de `U1`) no incluye correr los extras sobre una base migrada; ver `F5-BD-031`.
- **Unidad**: `U1`.

### F5-BD-005 — El archivo de configuración de planes y sus seeders

- **Categoría**: DELETE
- **Diseño**: `B/docs/21-migracion.md` §4 (líneas 468-474: *«`packages/billing/src/config/`, 11 archivos y 3378 líneas»*, *«los seeders de planes»*); `D/nucleo/02-modelo-de-datos.md` §1.4 punto 1.
- **Código**: hoy son **13 archivos y 4367 líneas** (`git ls-tree` + `wc -l` sobre `origin/staging`; la medición del diseño fue en hospeda2, que está atrasado); los seeders son `packages/seed/src/required/billingAddons.seed.ts`, `billingEntitlements.seed.ts`, `billingLimits.seed.ts`, `billingPlans.seed.ts`, `billingPromoCodes.seed.ts`, `commercePlan.seed.ts`, `partnerPlan.seed.ts`, `testDailyPlan.seed.ts`, `trialPlans.seed.ts` y `trialPlans.writer.ts`.
- **Nota**: el número del diseño está viejo; no cambia la clasificación.
- **Unidad**: `U1`.

---

## 2. Las tablas que el diseño da por existentes

### F5-BD-006 — `listing` son las tres tablas de ficha, con dueño único y no anulable

- **Categoría**: CONFIRMA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.5 (líneas 444-457: *«una tabla por vertical… `accommodations`, `gastronomies`, `experiences`… La vertical es la tabla»*); §5 fila 11 (línea 928: *«columna no anulable, no tabla de relación»*).
- **Código**: `accommodation.dbschema.ts:40`, `gastronomy.dbschema.ts:65`, `experiences.dbschema.ts:50`; el dueño es `owner_id … .notNull().references(() => users.id, { onDelete: 'restrict' })` en `accommodation.dbschema.ts:134-136`, `gastronomy.dbschema.ts:135-137` y `experiences.dbschema.ts:262-264`.
- **Argumento**: las tres tablas existen, cada una es de una sola vertical (la vertical es inmutable por construcción) y el dueño es una columna no anulable. Es lo que el diseño supone.
- **Unidad**: `V6`.

### F5-BD-007 — Los nombres `owner_user_id` y `user` del diseño no son los del esquema

- **Categoría**: CONTRADICE
- **Severidad**: BAJA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.5 (línea 441: *«un solo `owner_user_id`»*); §2.2 (líneas 408-421: *«la FK de `trial.user_id` a `user`»*, *«`user.deleted_at`»*).
- **Código**: la columna de dueño de las fichas es `owner_id` (`accommodation.dbschema.ts:134`); la tabla es `users` (`user.dbschema.ts:44-45`). `owner_user_id` existe, pero en `partners` (`partner.dbschema.ts:77`) y en `host_trades`.
- **Argumento**: la semántica coincide y el nombre no. Quien implemente contra el texto puede crear una columna nueva `owner_user_id` en vez de usar `owner_id`, y quedarían dos columnas de dueño. **Qué corregir**: el diseño (usar `owner_id`, o decir que `owner_user_id` es el nombre lógico).
- **Unidad**: `V6`.

### F5-BD-008 — Las columnas que lee la tabla de traducción existen, y sólo en `accommodations`

- **Categoría**: CONFIRMA
- **Diseño**: `V/docs/21-migracion.md` §2.4 (líneas 205-209 y la tabla 233-242: `deleted_at`, `lifecycle_state` en `DRAFT`/`ARCHIVED`/`INACTIVE`/`ACTIVE`, `visibility = PUBLIC`, `billing_unpublished_at`, `owner_suspended`, `plan_restricted`, `moderation_state` con `REJECTED`, `is_featured`; *«`gastronomies` y `experiences` no tienen `billing_unpublished_at`, `owner_suspended` ni `plan_restricted`… `experiences` tiene en cambio `has_active_subscription`»*).
- **Código**: `accommodation.dbschema.ts:110` (`owner_suspended`), `:117` (`plan_restricted`), `:133` (`billing_unpublished_at`), `:142` (`visibility`), `:143` (`lifecycle_state`), `:155` (`deleted_at`), `:158` (`moderation_state`), `:83` (`is_featured`). Los valores: `lifecycle_status_enum` = `DRAFT, ACTIVE, INACTIVE, ARCHIVED`, `moderation_status_enum` = `PENDING, APPROVED, REJECTED`, `visibility_enum` = `PUBLIC, PRIVATE, RESTRICTED` (`packages/db/src/migrations/0000_baseline.sql`, líneas 16, 18 y 45; ninguna migración posterior hace `ALTER TYPE` sobre esos tres). `gastronomy.dbschema.ts` y `experiences.dbschema.ts` no tienen ninguna de las tres columnas; `experiences.dbschema.ts:238` tiene `has_active_subscription`.
- **Argumento**: cada columna y cada valor que la tabla de traducción nombra está en el esquema, y la asimetría que obliga a escribirla sólo para `accommodations` es real.
- **Unidad**: `V6`.

### F5-BD-009 — `partners.owner_user_id` existe, anulable y con índice común

- **Categoría**: CONFIRMA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.7 fila `partner` (línea 595: *«`partners.owner_user_id`, anulable… Hoy el índice sobre la columna es común, no único»*).
- **Código**: `partner.dbschema.ts:77` (`uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' })`, sin `notNull`); `partner.dbschema.ts:229` (`index('partners_ownerUserId_idx')`, no `uniqueIndex`).
- **Argumento**: coincide en las tres cosas. El `UNIQUE … WHERE owner_user_id IS NOT NULL` que el diseño agrega (lote B) exige que producción no tenga dos filas con el mismo dueño; eso no lo pude medir (ver *«lo que no pude cerrar»*).
- **Unidad**: `V7`.

### F5-BD-010 — `conversations` apunta a la ficha con `RESTRICT` y no anulable

- **Categoría**: CONFIRMA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §4.1, fila de conversaciones (línea 744: *«La referencia a la ficha admite una ficha ausente: es anulable… Hoy es `onDelete: restrict` y no anulable»*).
- **Código**: `packages/db/src/schemas/conversation/conversations.dbschema.ts:40-42`.
- **Argumento**: el *«hoy»* del diseño es cierto; el cambio a anulable es trabajo previsto de la unidad que construye `PURGED`.
- **Unidad**: `V6`.

### F5-BD-011 — Lo que cuelga de una ficha: el conjunto de 38 cierra, el reparto 28 + 10 no

- **Categoría**: CONTRADICE
- **Severidad**: BAJA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §4.1 (líneas 733-737 y 753-756: *«29 tablas con FK… y 11 con `entity_type`»*; *«38 del código actual que sobreviven a la limpieza del principio, 28 con FK y 10 con `entity_type`»*); `V/docs/20-testing.md` §2, fila `G-R9` (línea 71, lo mismo).
- **Código**: el recorrido por script (abajo) sobre `packages/db/src/schemas/` da **29 con FK** a `accommodations`/`gastronomies`/`experiences` (29 apariciones de `=> <tabla>.id`, una por tabla, `posts` incluida) y **11 con `entity_type`**, igual que el diseño. Pero las dos tablas del cobro viejo están **las dos** entre las 11 de `entity_type`: `featured_listing_addon_grants` dejó la FK a `accommodations` por `entity_type` + `entity_id` con HOS-1286 (`packages/db/src/schemas/billing/featured_listing_addon_grant.dbschema.ts:20-28` y `:79`). Después de `U1` quedan **29 con FK y 9 con `entity_type`**. El conjunto de 38 coincide tabla por tabla con la columna *«tablas»* de la lista cerrada (diferencia vacía en las dos direcciones).
- **Argumento**: el total que `G-R9` compara está bien; el reparto que el texto y la fila de `G-R9` escriben, no. Un `G-R9` que afirme sus subtotales en el mensaje afirmaría algo falso. **Qué corregir**: el diseño (`V/02` §4.1 y `V/20` §2).
- **Unidad**: `V6` (construye `G-R9`).

### F5-BD-012 — Las rutas de borrado de fichas que existen hoy no están en el diseño

- **Categoría**: ADAPTAR
- **Severidad**: ALTA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §4.1, renglón *«se borra»* (línea 721: *«`PURGED` conserva la fila: el borrado es del contenido, no un `DELETE` de `listing`… nadie lea "hard delete" como borrar la fila»*); fila de favoritos (línea 745: *«Ninguna transición del modelo nuevo escribe esa columna [`deleted_at`]»*); fila de reseñas (línea 742: *«se conservan, sin mostrarse»*).
- **Código**: hoy hay, por vertical, un soft delete de admin (`apps/api/src/routes/accommodation/admin/delete.ts:39`, idem `gastronomy/admin/delete.ts`, `experience/admin/delete.ts`), un hard delete de admin (`accommodation/admin/hardDelete.ts:40`, `gastronomy/admin/hardDelete.ts:40`, `experience/admin/hardDelete.ts:40`) y un restore; y un soft delete **del dueño** en Alojamiento (`apps/api/src/routes/accommodation/protected/softDelete.ts:19-40`). El soft delete escribe `deleted_at` por `BaseModel.softDelete` (`packages/db/src/base/base.model.ts:642-668`) y dispara el trigger que borra los favoritos (`extras/003-delete-entity-bookmarks.trigger.sql:128-132`). El hard delete hace `DELETE` de la fila: de las 29 FK a las fichas, **26 son `CASCADE`**, entre ellas las tres de reseñas (`accommodation_review.dbschema.ts:23`), una `RESTRICT` (`conversations`) y dos sin acción (`owner_promotions`, `posts`) (script, abajo).
- **Argumento**: si estas rutas quedan, el dueño que borra su ficha no pasa por `PB12` sino por `deleted_at`, le borra los favoritos a los turistas (que la lista cerrada conserva) y la ficha queda fuera de `PURGED`; y el admin que usa el hard delete borra en cascada las reseñas de terceros, que el diseño conserva por `DEC-DATA-005`. Nada falla ni avisa. Ningún capítulo las nombra (búsqueda abajo) y ninguna unidad las tiene asignadas. **Qué corregir**: el diseño tiene que decir qué pasa con cada una (la del dueño pasa a ser `PB12`; las de admin, ¿se retiran, o pasan a `PURGED`?).
- **Unidad**: `V6` (dueña de `PB12`) y `V5`/`V8` para las de admin.

### F5-BD-013 — `users.deleted_at` y el trigger de favoritos sobre `users`

- **Categoría**: CONFIRMA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.2 (línea 419: *«la baja escribe `user.deleted_at`… y esa escritura dispara el trigger de favoritos sobre `users` del carril de extras, que borra los favoritos que otros guardaron sobre la cuenta»*); §4.1 fila de favoritos (línea 745: el trigger de `accommodations` actúa cuando `deleted_at` pasa de nulo a no nulo).
- **Código**: `packages/db/src/schemas/user/user.dbschema.ts:178` (`deleted_at`); `extras/003-delete-entity-bookmarks.trigger.sql:31-49` (resuelve `USER` para `users` y `ACCOMMODATION` para `accommodations`), `:57-63` (actúa sólo en la transición nulo → no nulo), `:128-132` y `:146-150` (los triggers `AFTER UPDATE` sobre `accommodations` y `users`).
- **Argumento**: el trigger hace exactamente lo que el diseño dice. `F-1B-011` sigue vigente: las dos funciones de trigger son `set_updated_at` (`extras/002-set-updated-at.trigger.sql:19`) y `delete_entity_bookmarks` (`003`, línea 25); la tercera función del carril, `refresh_search_index` (`001-search-index.matview.sql:119`), no es de trigger.
- **Unidad**: la acción 24 (`NUCLEO/08` §3; fuera de las épicas, HOS-1393).

### F5-BD-014 — `set_updated_at` se engancha solo a las tablas nuevas, al re-aplicar los extras

- **Categoría**: CONFIRMA
- **Diseño**: `D/16-…` §4.2, paso 6 (línea 145: *«[el carril de extras] se re-aplica idempotente con `db:apply-extras` después de las migraciones»*).
- **Código**: `extras/002-set-updated-at.trigger.sql:47-70` recorre `information_schema.columns` y crea el trigger en toda tabla con `updated_at` que no lo tenga; `scripts/server-tools/src/commands/db-migrate.ts:13-14` corre `db:migrate` y después `db:apply-extras`.
- **Argumento**: las tablas nuevas de las dos épicas reciben su trigger en la misma corrida del paso 3, sin tocar el archivo.
- **Unidad**: ninguna (lo usa toda unidad que cree tablas).

---

## 3. Las tres columnas que sobreviven hasta el paso 3

### F5-BD-015 — *«Sólo las usa el cobro viejo»* no es cierto: las leen la lectura pública y los permisos

- **Categoría**: CONTRADICE
- **Severidad**: MEDIA
- **Diseño**: `D/16-…` §4.6 punto 1 (líneas 611-614: *«sólo las usa el cobro viejo, pero la tabla de traducción del corte las lee»*); `V/docs/21-migracion.md` §2.4 (líneas 220-222: *«son columnas de `accommodations` que sólo usa el cobro viejo»*).
- **Código, escritores**: `owner_suspended` lo escribe sólo `apps/api/src/services/subscription-pause.service.ts:79`; `plan_restricted` (en `accommodations`) lo escribe `apps/api/src/services/plan-restriction.service.ts:85`, `:134`, `:193`, `:248`; **`billing_unpublished_at` lo escribe además el servicio de fichas de `service-core`**: lo borra al publicar (`packages/service-core/src/services/accommodation/accommodation.service.ts:2099`) y lo sella al despublicar con `billingUnpublish` (`:2289`), además de `accommodation-winback-republish.service.ts:178`.
- **Código, lectores fuera del cobro viejo**: el modelo de fichas filtra por `owner_suspended` y `plan_restricted` en la lectura pública (`packages/db/src/models/accommodation/accommodation.model.ts:636`, `:641`, `:793`, `:797`, `:981`, `:985`, `:1221-1223`); los permisos (`packages/service-core/src/services/accommodation/accommodation.permissions.ts:66`, `:170`, `:185`); los destinos (`packages/service-core/src/services/destination/destination.service.ts:627-628`, `:1337-1338`); la visibilidad de promociones (`packages/service-core/src/services/owner-promotion/ownerPromotion.visibility.ts:27-28`); la ruta de similares (`apps/api/src/routes/accommodation/public/similar.ts:183-184`); y los esquemas Zod de la entidad (`packages/schemas/src/entities/accommodation/accommodation.schema.ts:223`, `:240`, `:278`).
- **Argumento**: el diseño resolvió bien lo que importa (que las columnas lleguen vivas a la migración del paso 3), pero sobre una premisa falsa. Consecuencia concreta: la migración que las borra en el paso 3 exige sacarlas del esquema Drizzle, y eso rompe la compilación de todos esos lectores, que son código de verticales, no del cobro viejo. `U1` no los borra (no son del cobro viejo) y el diseño no le asigna a nadie retirarlos. Lo ve `typecheck`, así que no pasa en silencio; pero la unidad que escribe la migración de borrado (`V6`) hereda, sin saberlo, reescribir la lectura pública de fichas. **Qué corregir**: el diseño (declarar que `V6` retira esos lectores en el mismo cambio, o que la lectura pública nueva por estado los reemplaza antes).
- **Unidad**: `V6` (y `U1` para los escritores del cobro viejo).

### F5-BD-016 — `billing_unpublished_at` ya no decide nada en la migración

- **Categoría**: CONTRADICE
- **Severidad**: BAJA
- **Diseño**: `V/docs/21-migracion.md` §2.4, tabla (líneas 238-239: `L4` → `DRAFT`, `L5` → `DRAFT` desde C12); la excepción de supervivencia (`D/16-…` §4.6, líneas 611-616; `B/docs/21-migracion.md` §4, líneas 447-452: *«que la tabla de traducción… lee para `L5` y `L7`»*).
- **Código**: `accommodation.dbschema.ts:133`.
- **Argumento**: `billing_unpublished_at` sólo separa `L4` de `L5`, y desde C12 las dos nacen en `DRAFT`. En la migración del paso 3 la columna ya no cambia el estado de ninguna ficha: lo único que separa `L7` de `L8` son `owner_suspended` y `plan_restricted`. El recuento de la población a avisar (`B/21` §1.3) la lee sobre la base vieja antes del corte, no en la migración. La excepción podría ser de dos columnas; mantener tres no rompe nada. **Qué corregir**: el diseño, si el owner quiere achicar la excepción; si no, sólo corregir el *«para `L5`»*.
- **Unidad**: `V6`, `U1`.

### F5-BD-017 — Otras dos marcas del cobro viejo en tablas que sobreviven, sin dueño en el diseño

- **Categoría**: FALTA
- **Severidad**: MEDIA
- **Diseño**: `D/16-…` §4.6 punto 1 nombra sólo tres columnas de `accommodations`; `B/docs/21-migracion.md` §4 habla de *«las columnas que las copian»* sin enumerarlas. Ninguna de las dos nombra `service_suspended` ni `owner_promotions.plan_restricted` (búsqueda abajo).
- **Código**: `users.service_suspended` (`user.dbschema.ts:138`; *«canonical service-suspension flag… Denormalized to `accommodations.owner_suspended`»*, líneas 130-137), escrito sólo por `subscription-pause.service.ts:74` y leído por la guarda de alta de fichas (`accommodation.service.ts:852`). `owner_promotions.plan_restricted` (`packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts:37`), escrito por el remedio de downgrade del cobro viejo y leído por la lectura pública de promociones (`packages/db/src/models/owner-promotion/ownerPromotion.model.ts:110`, `:162`, `:228`, `:293`; `ownerPromotion.service.ts:230`, `:268`; `ownerPromotion.permissions.ts:128`).
- **Argumento**: son marcas del cobro viejo en tablas que el diseño conserva, igual que las tres de `accommodations`, pero ningún texto dice si `U1` las borra o si sobreviven. Si `U1` las deja, quedan congeladas con el valor de producción y siguen filtrando (una promoción con `plan_restricted = true` no se ve nunca más, y un dueño con `service_suspended = true` no puede dar de alta una ficha). Si las borra, se van los lectores de verticales con ellas. **Qué corregir**: el diseño (listarlas con su destino).
- **Unidad**: `U1`, `V6`.

---

## 4. Partner

### F5-BD-018 — `partners.subscription_status` y `partners.tier` deciden hoy la presencia pública

- **Categoría**: ADAPTAR
- **Severidad**: MEDIA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.7 fila `partner` (línea 595: el contenido de la presencia *«vive en la misma tabla de partners de hoy»*); `V/docs/18-partner.md` (líneas 115-124: la página y el carrusel se ven si el partner tiene hoy su clave); `V/descomposicion.md` fila `V7` (línea 60: *«la presencia como entitlement booleano… la página y el carrusel se ven si el partner tiene hoy su clave»*).
- **Código**: `partner.dbschema.ts:55` (`subscription_status`, enum propio de hospeda, no de qzpay) y `:30` (`tier`); la lectura pública filtra por `subscription_status = 'active'` en `packages/db/src/models/partner/partner.model.ts:94`, `:175`, `:255`, `:278`, `:398`.
- **Argumento**: el diseño cambia la regla (la clave decide) pero conserva la tabla, y no dice qué pasa con las dos columnas que hoy son la regla. No son de qzpay, así que el recorte de `U1` por dependencia no las alcanza. Hay que retirarlas o dejarlas sin lectores, con los cinco filtros del modelo. **Qué corregir**: el diseño (nombrarlas en `V7` o en `U1`).
- **Unidad**: `V7`.

---

## 5. Carriles de migración, extras y guards

### F5-BD-019 — La lista de pendientes de `G8` cubre el carril de extras, y el paso 6 no lo reemplaza

- **Categoría**: CONTRADICE
- **Severidad**: ALTA
- **Diseño**: `V/docs/20-testing.md` §2 fila `G8` (línea 56: la lista de pendientes tiene *«la historia de migraciones (`packages/db/src/migrations/**`)»*, y *«el paso 6 del corte le saca las dos historias… y un build destinado a producción después del corte falla si le queda una de las dos»*); `D/16-…` §4.2 paso 6 (línea 145: *«El carril de extras (`packages/db/src/migrations/extras/`) queda afuera del reemplazo»*).
- **Código**: `packages/db/src/migrations/extras/032-commerce-media.constraints.sql` lleva la palabra en el nombre del archivo y en las líneas 2, 21 y 22; `extras/033-content-media.constraints.sql:10` la nombra en un comentario. (`023` y `024` también la nombran, pero salen con `U1`, `F5-BD-004`.)
- **Argumento**: el glob `packages/db/src/migrations/**` incluye `extras/`, así que hasta el corte esos dos archivos pasan `G8` por la lista. El paso 6 saca la entrada de la lista y reemplaza la historia por la foto, pero deja los extras tal cual; en ese mismo commit `G8` vuelve a mirar `extras/` y falla sobre `032` y `033`. Es el commit que tiene que ir junto con la reescritura de las dos tablas de producción, el día del corte. Los extras no tienen ledger (`F-1B-015`), así que renombrarlos o reescribir su comentario en `U1` no cambia nada en ninguna base. **Qué corregir**: el código en `U1` (renombrar `032` y limpiar `033`, que es lo que `U1` punto 2 ya pide para *«el código que la nombra»*) o el diseño (que la entrada de la lista excluya `extras/`).
- **Unidad**: `U1` (limpieza), `V1` (`G8`), `V6` (paso 6).

### F5-BD-020 — La migración estructural no puede llamar código TypeScript

- **Categoría**: CONTRADICE
- **Severidad**: ALTA
- **Diseño**: `D/16-…` §4.2 paso 6 (línea 145: *«`V6`, dueña de la migración estructural; `V2` construye la pieza que carga y que esa migración llama»*); paso 3 (línea 137: la migración estructural escribe el estado de nacimiento, `inactiva_desde`, la prueba de cada dueño `L8`, los plazos v1 y el catálogo de producción); `V/docs/21-migracion.md` §2.4 (líneas 397-401: la prueba del corte lleva *«el seudónimo del correo calculado con la misma función que `T1`»* y *«la campaña previa agendada»*); `D/nucleo/02-modelo-de-datos.md` §1.4 punto 2.
- **Código**: el carril estructural es `drizzle-kit migrate` (`packages/db/package.json`, script `db:migrate`) sobre los `.sql` de `packages/db/src/migrations/` (125 archivos, `0000_baseline` a `0124_amusing_hawkeye`, 125 entradas en `meta/_journal.json`). Producción lo corre con `hops db-migrate` (`scripts/server-tools/src/commands/db-migrate.ts:13`). El carril que corre TypeScript es el de las migraciones de datos del seed (`packages/seed/src/data-migrations/runner.ts`), que va después de los extras y por otro comando. El `CLAUDE.md` raíz (línea 890) reserva el carril estructural para *«tables/columns/indexes/FKs/enums»* y manda los datos al carril 3.
- **Argumento**: una migración SQL puede escribir filas, pero no puede importar la pieza de `V2` ni la función de seudónimo de `T1`. Hay dos salidas y las dos cambian el diseño: (a) escribir en SQL la carga del catálogo y la normalización del correo por proveedor (la tabla de `V/02` §2.2 punto 1) con `sha256`, que es una segunda implementación de la función que `V/02` §2.2 punto 3 dice que no cambia nunca, y que tiene que dar el mismo resultado byte a byte; o (b) correr esas escrituras desde TypeScript, fuera de `drizzle-kit migrate`, que rompe la atomicidad que el paso 3 promete (*«si esa escritura falla a la mitad, falla la migración»*) y el orden respecto de la migración que borra las tres columnas. **Qué corregir**: el diseño (elegir una salida y escribirla); lo decide el owner.
- **Unidad**: `V6`, `V2`, `V4`.

### F5-BD-021 — Las bases de desarrollo y de tests no aplican migraciones: usan `push`

- **Categoría**: CONTRADICE
- **Severidad**: ALTA
- **Diseño**: `D/16-…` §4.2 paso 6 (línea 145: *«desde que se mergea hasta que este paso la reemplaza por la foto, la corre toda base que aplique las migraciones, el ensayo del corte en `staging`, las bases de desarrollo y la de CI… en desarrollo y en CI corre igual»*; y *«[la foto] lleva además… las filas de referencia sin las cuales una base armada desde el repositorio no arranca: la tabla de claves, el espejo del enum de verticales y la versión 1 de los plazos»*); `D/nucleo/02-modelo-de-datos.md` §1.4 (líneas 116 y 131-134: *«la tabla de claves la escribe la migración desde el catálogo, y toda asignación apunta a ella por FK»*; *«la migración estructural del paso 3 carga el de producción en toda base que aplique las migraciones, producción, `staging`, desarrollo y CI»*).
- **Código**: `pnpm db:fresh-dev` arma la base con `pnpm --filter @repo/db db:push` (`package.json` raíz, script `db:fresh-dev`); la base de los tests de integración, con `scripts/setup-test-db.ts:43-44` (`db:push`); la de los e2e de la API, con `apps/api/test/e2e/setup/test-database.ts:118` (`db:push`); el e2e nocturno, con `.github/workflows/e2e-nightly.yml:221` (`db:push`). Sólo `e2e-pr.yml:216`, `e2e-local.self-hosted.yml:187` y `a11y-sweep.yml:99` corren `db:migrate`. La plantilla de las bases por worktree se clona de `hospeda_dev` (`CLAUDE.md` raíz, *«Operar el worktree»*), que sale de `db:fresh-dev`.
- **Argumento**: `drizzle-kit push` sincroniza el esquema desde el TypeScript y no ejecuta el SQL de las migraciones, así que las filas que el diseño pone *dentro* de la migración no llegan a esas bases. La tabla de claves queda vacía y la primera asignación de clave que escriba el seed choca con la FK; lo mismo pasa con la foto del paso 6, que sigue siendo SQL. La frase *«toda base que aplique las migraciones… desarrollo y CI»* describe un repositorio que no es éste, y en la práctica afecta los tests de integración de todas las unidades desde `V1`. **Qué corregir**: el diseño (que el seed o el armado de la base de test carguen las filas de referencia, o que esas bases pasen a `migrate`).
- **Unidad**: `V1` (tabla de claves), `V2`, `V6`, `V9`, `B2`.

### F5-BD-022 — La migración del paso 3 no la corre el despliegue, y el diario no está en la imagen

- **Categoría**: CONTRADICE
- **Severidad**: MEDIA
- **Diseño**: `D/16-…` §4.2 paso 3 (línea 137: *«desplegar —con la migración estructural…»*; *«después de migrar, toda migración del journal de la imagen tiene que figurar en la tabla de migraciones aplicadas de producción»*).
- **Código**: la imagen de la API arranca con `CMD ["node", "dist/index.js"]` (`apps/api/Dockerfile:98`) y no corre migraciones. Las corre `hops db-migrate` en el VPS, desde el checkout de `$HOPS_REPO_ROOT`, con `git pull` opcional, su propio backup y después `db:apply-extras` (`scripts/server-tools/src/commands/db-migrate.ts:8-14`, flags `--pull`/`--no-pull` en las líneas 77-79).
- **Argumento**: el despliegue y la migración son dos actos distintos, con orden a fijar (contenedor viejo apagado → `hops db-migrate` → imagen nueva), y el *journal* que hay que comparar es el del checkout del VPS, que tiene que estar en el mismo commit que la imagen. El diseño no nombra el comando ni exige esa igualdad. **Qué corregir**: el diseño del paso 3.
- **Unidad**: `V6` (herramientas del corte).

### F5-BD-023 — Los plazos vacíos rompen la migración desde que se mergea, no desde el ensayo

- **Categoría**: CONTRADICE
- **Severidad**: MEDIA
- **Diseño**: `D/nucleo/02-modelo-de-datos.md` §1.5 (líneas 178-180: *«los fija el owner antes del ensayo del corte en `staging`, y la migración estructural del corte falla si alguno está vacío»*); `D/16-…` §4.2 paso 6 (línea 145: la corren desde el merge `staging`, desarrollo y CI).
- **Código**: `.github/workflows/e2e-pr.yml:216` corre `pnpm --filter @repo/db db:migrate` en cada PR.
- **Argumento**: si la migración falla con plazos vacíos y corre en el CI de cada PR desde que se mergea, `V6` no puede mergearse hasta que el owner fije los cinco plazos, que es antes de lo que el diseño pide. Es una precondición de `V6` que el diseño no declara. **Qué corregir**: el diseño (adelantar la fecha a *«antes del merge de `V6`»*).
- **Unidad**: `V6`, `V9`, `B2`.

### F5-BD-024 — Los tres carriles y su orden

- **Categoría**: CONFIRMA
- **Diseño**: `D/16-…` §4.2 pasos 3 y 6 (el orden estructural → extras, las migraciones de datos del seed fuera del corte); `V/docs/21-migracion.md` §2.4 (líneas 225-230: la migración que borra las tres columnas, fechada después de la clasificación, en el mismo despliegue).
- **Código**: `CLAUDE.md` raíz, línea 890 (*«Run order on a live env: `db:migrate` → `db:apply-extras` → `db:seed:migrate`»*); `hops db-migrate` corre los dos primeros (`db-migrate.ts:13-14`) y `hops db-seed-migrate` el tercero (`scripts/server-tools/src/commands/db-seed-migrate.ts`). En producción `F-1B-015` midió 125/125 y 105/105; hoy el repo tiene 125 estructurales y **106** migraciones de datos (`ls` con el prefijo `NNNN-`), una más que el inventario.
- **Argumento**: el orden existe y es el que el diseño supone. La trampa de HOS-433 que el `CLAUDE.md` describe (un backfill que corre después del `DROP` de su fuente) no aplica: la clasificación y el borrado de las tres columnas van en el mismo carril, ordenados por el diario de Drizzle.
- **Unidad**: `V6`.

### F5-BD-025 — La foto del paso 6 tiene un precedente, generado desde el TypeScript y no desde la base

- **Categoría**: ADAPTAR
- **Severidad**: BAJA
- **Diseño**: `D/16-…` §4.2 paso 6 (línea 145: *«una sola migración de partida, generada de la base de producción ya cortada… La migración de partida la genera Drizzle»*).
- **Código**: `packages/db/src/migrations/0000_baseline.sql` (commit `47138a8d1a`, 2026-06-01, *«add 0000 baseline migration + journal (SPEC-178 T-002)»*) y el estampado del ledger del seed (`packages/seed/src/data-migrations/baselineStamp.ts`). La guarda de drift (`scripts/check-schema-drift.sh:69`, `:101`) compara el esquema TypeScript con el snapshot de `meta/`.
- **Argumento**: el repositorio ya hizo este reemplazo una vez, así que es factible. Pero una partida sacada de la base (`drizzle-kit pull`) no garantiza un snapshot que coincida con el TypeScript, y la guarda de drift quedaría roja en el mismo commit del paso 6. El precedente la generó desde el esquema TypeScript y verificó contra la base; la comparación de esquemas que el paso 6 ya pide en `staging` es la que cierra la diferencia. **Qué corregir**: el diseño (*«generada por Drizzle desde el esquema del repo y comparada con la base cortada»*).
- **Unidad**: `V6`.

### F5-BD-026 — La rama de billing del guard de dual-write existe y hay que sacarla

- **Categoría**: ADAPTAR
- **Severidad**: BAJA
- **Diseño**: `D/nucleo/02-modelo-de-datos.md` §1.4 (líneas 134-137: *«Sale de `scripts/check-seed-dual-write.sh` la rama que vigila el archivo de configuración de planes, y de la regla de dual-write del `CLAUDE.md` raíz la mención a los planes, límites y entitlements de billing»*); `D/16-…` §4.6, *«qué deja demostrado»*.
- **Código**: `scripts/check-seed-dual-write.sh:269-282` (lista de los seis `packages/billing/src/config/*.config.ts` vigilados) y `:335` (`'packages/billing/src/config'` en el `git diff`); `CLAUDE.md` raíz, línea 891 (*«a billing plan/limit/entitlement»*).
- **Argumento**: las dos cosas que el diseño manda sacar existen donde dice. Un detalle que el diseño no cubre: el guard vigila todo `packages/seed/src/data/**` por defecto y exime sólo una lista (`check-seed-dual-write.sh:200-217`); si los datos de planes de demostración que reemplazan al archivo van ahí, el guard les va a pedir migración de datos a cada cambio, aunque el diseño los declara *«fuera del dual-write»*. Hay que agregarlos a la exención en el mismo cambio.
- **Unidad**: `U1`; la exención, la unidad que escriba el seed de demostración del catálogo (`V2`/`B2`).

### F5-BD-027 — Las migraciones de datos del seed que importan `@repo/billing`: son 11, pero no todas importan el archivo de planes

- **Categoría**: CONTRADICE
- **Severidad**: BAJA
- **Diseño**: `B/docs/21-migracion.md` §4 (líneas 474-480: *«Las 11 migraciones de datos del seed que importan `@repo/billing` dejan de compilar cuando el archivo se borra… cada una deja de importar `@repo/billing` y lleva escritos los valores que leía»*); `D/16-…` §4.6 (línea 646).
- **Código**: importan `@repo/billing` `0004`, `0005`, `0045`, `0061`, `0073`, `0074`, `0075`, `0092`, `0103`, `0105` y `0106` (11). Dos no importan configuración sino funciones de estado: `0092-hos-1084-backfill-accommodation-subscription-cache.ts:83` (`isEntitlementGrantingStatus`) y `0106-hos-1326-abandoned-checkout-mislabelled-cancelled.ts:181` (`PENDING_PROVIDER_STORED_STATUSES`). Y dos auxiliares del runner también importan el paquete: `packages/seed/src/data-migrations/helpers/billingCleanupGuards.ts:24` y `helpers/trialPlanMigration.ts:15`.
- **Argumento**: el número coincide, la descripción no. Congelar *«los valores que leía»* no aplica a dos de las once (hay que copiar una función, no un valor), y las dos auxiliares no están en la cuenta: si `@repo/billing` pierde esos símbolos, también dejan de compilar. Lo ve `typecheck`. **Qué corregir**: el diseño (contar 11 + 2 auxiliares y decir qué se congela en cada una).
- **Unidad**: `U1`.

### F5-BD-028 — El inventario de extras de `F-1B-014`: el 13 sigue, el *«cuatro mueven datos»* no

- **Categoría**: CONTRADICE
- **Severidad**: BAJA
- **Diseño (inventario)**: `D/08-phase-1b-code-discovery.md`, `F-1B-014` (líneas 545-573: *«Cuatro de los 42 `extras` mueven datos, y trece escriben sobre tablas de qzpay»*).
- **Código**: siguen siendo 42 archivos y 13 tocan tablas de qzpay (`F5-BD-004`). Pero contando sentencias `INSERT`/`UPDATE`/`DELETE` fuera de comentarios, **17 archivos** mueven datos al aplicarse (`010`, `013`, `014`, `015`, `019`, `020`, `021`, `023`, `024`, `025`, `026`, `027`, `028`, `030`, `035-canceled…`, `036`, `038-courtesy…`); el `DELETE` de `003` está dentro de la función de trigger y no cuenta.
- **Argumento**: el inventario quedó viejo (o contó sólo los nombres `.data.sql`). No cambia el diseño: los de billing salen con `U1` y los demás se re-aplican idempotentes. **Qué corregir**: el inventario, no el diseño.
- **Unidad**: ninguna.

---

## 6. Soft delete, `BaseModel` y restricciones

### F5-BD-029 — Nada dice si las tablas que nunca se borran llevan `deleted_at`

- **Categoría**: FALTA
- **Severidad**: BAJA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §5 (líneas 931-939: *«Se rechaza con un trigger que rechaza todo `DELETE` sobre `trial`»*); §4.2 regla 2 (la fila de `trial` sobrevive a todo).
- **Código**: `BaseModel.softDelete` estampa `deleted_at` en cualquier tabla que tenga la columna (`packages/db/src/base/base.model.ts:642-668`), y el `CLAUDE.md` raíz dice *«Soft delete by default»*.
- **Argumento**: el trigger rechaza el `DELETE`, no un `UPDATE` que ponga `deleted_at`. Si `trial` nace con los campos de auditoría de siempre, un soft delete la *«borra»* para toda lectura que filtre por `deleted_at` sin que nada lo impida, y la guarda de `T1` (*«el seudónimo no tiene fila»*) deja de verla mientras el `UNIQUE` sigue rechazando la inserción. **Qué falta**: que el diseño diga que `trial` (y las demás tablas de sólo agregar) no llevan `deleted_at`.
- **Unidad**: `V4`.

### F5-BD-030 — La ruta de hard delete de usuarios choca con *«la fila de `user` no se borra»*

- **Categoría**: ADAPTAR
- **Severidad**: MEDIA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.2 (líneas 408-421: FK `trial.user_id` → `user` con `ON DELETE RESTRICT`; *«[la baja] no borra la fila de `user`: la seudonimiza»*).
- **Código**: `apps/api/src/routes/user/admin/hardDelete.ts:18-31` (`DELETE /{id}/hard`, `userService.hardDelete`).
- **Argumento**: con la FK nueva, esa ruta falla con un error de clave foránea sobre toda cuenta con prueba, y sobre las demás borra la fila, que es justo lo que el diseño dice que no pasa. El diseño no la nombra. **Qué corregir**: el diseño (retirarla, o que devuelva un error de negocio y no un 500).
- **Unidad**: `V4` (dueña de la FK); la baja manual es HOS-1393.

### F5-BD-031 — Los criterios de *«lista»* de `U1` no prueban los extras sobre una base migrada

- **Categoría**: ADAPTAR
- **Severidad**: MEDIA
- **Diseño**: `D/16-…` §4.6, tabla de `U1` y *«qué deja demostrado»* (líneas 638-651: typecheck, lint, `G8`, el recorrido de `@qazuor/qzpay`).
- **Código**: `pnpm db:apply-extras` (`packages/db/scripts/apply-postgres-extras.mjs`) aplica todos los `.sql` de `extras/`; 10 de los 18 extras de billing no chequean que su tabla exista (`F5-BD-004`).
- **Argumento**: lo que `U1` borra del esquema genera una migración con `DROP TABLE`; un extra de billing que quede en el repo hace fallar `db:apply-extras` en toda base que aplique esa migración, y ni typecheck ni lint lo ven. Agregar *«`db:migrate` + `db:apply-extras` sobre una base vacía, verdes»* a los criterios de `U1` lo cierra.
- **Unidad**: `U1`.

### F5-BD-032 — `is_featured` de las fichas: curado por el admin, y el diseño lo retira con el cobro viejo

- **Categoría**: ADAPTAR
- **Severidad**: MEDIA
- **Diseño**: `V/docs/21-migracion.md` §2.4 (líneas 258-259: *«`is_featured`: no cruza… `B/21` §4 lo retira»*); `B/docs/21-migracion.md` §4 (líneas 440-443: *«y `is_featured`… se retiran con el código que las lee… el código sale de la rama en la limpieza del principio»*).
- **Código**: `accommodation.dbschema.ts:83`, `gastronomy.dbschema.ts:145`, `experiences.dbschema.ts:272`. El `CLAUDE.md` raíz (*«Featured-listing entitlement»*) la describe como *«admin-curated, separate column»*, que además un dueño con la capacidad puede prender.
- **Argumento**: no es una columna del cobro viejo sino una curada, así que el alcance de `U1` (*«todo lo que sólo el sistema viejo usa»*) no la cubre sin decisión. Si `U1` la retira, se lleva la curación del admin; si no, nadie la retira. **Qué corregir**: el diseño (qué unidad la saca y cuándo).
- **Unidad**: `U1` o `V6`.

### F5-BD-033 — Las formas de restricción que el diseño pide ya tienen precedente en el esquema

- **Categoría**: CONFIRMA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.1 (`UNIQUE(plan_id) WHERE vigente`, `UNIQUE(vertical, rank) WHERE vendible AND vigente`), §2.7 (índice único parcial por correo en minúsculas), §5 (*«toda columna de estado tiene dominio cerrado»*); `B/docs/02-modelo-de-datos.md` §5.
- **Código**: índice único parcial con Drizzle en `packages/db/src/schemas/social/social_credentials.dbschema.ts:85-87` (`uniqueIndex(…).on(…).where(sql…)`); dominios cerrados por `pgEnum` (90 tipos, `F-1B-064`); FK compuestas y `check()` de Drizzle en `billing_addon_purchase.dbschema.ts` y `content-moderation/term.dbschema.ts`; y las restricciones que Drizzle no expresa, en extras (`CLAUDE.md` raíz, línea 890).
- **Argumento**: nada de lo que el modelo de datos pide a la base necesita una herramienta que el repositorio no use ya.
- **Unidad**: todas las que crean tablas.

### F5-BD-034 — Lo nuevo del modelo no existe todavía

- **Categoría**: FALTA
- **Severidad**: BAJA
- **Diseño**: `V/docs/02-modelo-de-datos.md` §2.1-§2.7 y §5; `B/docs/02-modelo-de-datos.md` §2; `D/nucleo/02-modelo-de-datos.md` §1.4, §1.5 y §2.6.
- **Código**: ninguna de estas tablas está entre las 147 de `packages/db/src/schemas/` (lista por script, abajo): `vertical`, `plan`, `plan_version` y sus dos tablas de claves, `addon` y `addon_version` con las suyas, la tabla de claves, las de plazos, `trial`, `canje_de_trial`, `cuota_ventana`, `pedido_de_arreglo`, `postulacion`, `domain_event`, `outbox`, y todo el lado de billing (`billing_option`, `subscription`, `reconciliation_mark`, `provider_link`, `payment`, `receipt`, `permanent_grant`, `addon_instance`, `provider_notification`…). Tampoco las columnas nuevas de las fichas (`inactiva_desde`, `plazos_version`, `borrado_anunciado`, el estado nuevo), la marca de *«pendiente de borrado remoto»* en fotos y calendario, `partners.secreto_de_reclamo`, ni los triggers de `trial` y de la postulación (los dos únicos de trigger del carril son `set_updated_at` y `delete_entity_bookmarks`, `F5-BD-013`).
- **Argumento**: es lo esperado; se registra para que la ausencia esté medida y no supuesta, y porque no hay choque de nombres con tablas existentes.
- **Unidad**: `V1`-`V9`, `B1`-`B13`.

---

## Búsquedas de ausencia

Todas sobre `origin/staging` `35e2d63e81`, con el control positivo al lado.

1. **Tablas del esquema** — script Python sobre el `git archive` de `packages/db/src/schemas` (147 tablas, sin tests), partiendo cada archivo por `pgTable(`. Control: `users`, `accommodations`, `partners` aparecen. Ninguna tabla nueva del diseño aparece (`F5-BD-034`).
2. **FK a las fichas y `entity_type`** — el mismo script, con `references\(\s*\(\)\s*(?::\s*\w+\s*)?=>\s*(accommodations|gastronomies|experiences)\.id` (con `re.S`, cruza saltos de línea) y `['"]entity_type['"]`: 29 y 11. Control cruzado: `rg -c -U "=>\s*(accommodations|gastronomies|experiences)\.id"` da 29; `rg foreignColumns` sobre esas tablas da 0. Comparado contra la columna *«tablas»* de `V/02` §4.1 (líneas 739-750): diferencia vacía en las dos direcciones, salvo las cuatro que el diseño nombra y el código no tiene (`addon_instance`, `pedido_de_arreglo`) o tiene tachadas (`entity_subscriptions`, `featured_listing_addon_grants`).
3. **Columnas nuevas de la ficha** — `rg -i "inactive_since|inactiva|last_activity|plazos|announced_deletion|publication_state|listing_state"` sobre los tres `*.dbschema.ts` de ficha: sin resultados (código de salida 1). Control: `rg -c deleted_at accommodation.dbschema.ts` = 1.
4. **Las rutas de borrado en el diseño** — `grep -rn -i -E "hardDelete|softDelete|/hard|restore\b|DELETE de la fila|DELETE directo|DELETE sobre"` sobre `V/`, `D/nucleo/` y `D/12-…`: ninguna mención de las rutas existentes (sólo aparecen la fila de `G8` y la acción de baja de cuenta, por otras palabras). Control: el mismo `grep` sobre `apps/api/src/routes` encuentra los 9 archivos `delete.ts`/`hardDelete.ts`/`restore.ts` de las tres verticales.
5. **`service_suspended` y `partners.subscription_status` en el diseño** — `grep -rn -E "partners\.(plan_id|subscription_id|subscription_status|tier)|subscription_status|subscriptionStatus|service_suspended"` sobre `D/16-…`, `D/nucleo/`, `V/` y `B/`: cero. Control: el mismo patrón sobre `packages/db/src/schemas` da `partner.dbschema.ts:55` y `user.dbschema.ts:138`.
6. **La palabra en los extras** — `rg -i -c` con el nombre del agrupamiento viejo sobre `extras/`: `023`, `024`, `032` (3) y `033`.
7. **Guardas de existencia en los extras de billing** — `grep -c -i -E "to_regclass|information_schema.tables|IF EXISTS \(SELECT"` por archivo: 0 en diez de los dieciocho.
8. **Sentencias que mueven datos en extras** — `grep -v '^\s*--'` y conteo de `INSERT INTO`, `UPDATE … SET` y `DELETE FROM` por archivo (`F5-BD-028`).
9. **Cómo se arma cada base** — `git grep -n -E "db:push|drizzle-kit push|db:migrate"` sobre `.github/workflows`, `scripts/*`, `apps/api/test/*` y `package.json`.
10. **Conteo de este informe** — `grep -c '^- \*\*Categoría\*\*: DELETE'` (y lo mismo con CONFIRMA, CONTRADICE, FALTA y ADAPTAR) sobre este archivo.

## Lo que no pude cerrar

- **Duplicados de `partners.owner_user_id` en producción.** El `UNIQUE … WHERE owner_user_id IS NOT NULL` del lote B falla al crearse si hay dos partners con el mismo dueño. Hace falta un `select owner_user_id, count(*) … having count(*) > 1` sobre producción (`hops psql`, por ssh al VPS); no consulté producción.
- **Si el migrador de Drizzle saltea migraciones más viejas que la última aplicada** (`F-8V3C2-006`, que el diseño ya trata como verificación). No pude leer `node_modules` (lo bloquea la política del entorno) y no lo di por hecho.
- **`exchange_rates` y `exchange_rate_config`** (`packages/db/src/schemas/exchange-rate/`): el `CLAUDE.md` raíz pone su cron entre los de billing, y ningún capítulo del diseño las nombra. No determiné si son del cobro viejo (entonces `DELETE` por `U1`) o de la plataforma.
- **Los valores `BILLING_SUBSCRIPTION` y `PAYMENT` de `entity_type_enum`** (`0000_baseline.sql`, línea 10): son vocabulario del cobro viejo en un enum que sobrevive. Postgres no borra valores de un enum sin recrear el tipo; no medí si alguna fila los usa ni qué genera `drizzle-kit` al sacarlos.

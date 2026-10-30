---
title: "FASE 5 · 00 · Consolidado de los cinco informes"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
fase: 5
---

# FASE 5 · 00 · Consolidado

- **Qué es**: la deduplicación por causa de los cinco informes de la FASE 5 (`01-permisos-y-roles`, `02-base-de-datos`, `03-api-rutas-y-crons`, `04-web-admin-y-eje-2`, `05-lo-que-borra-u1`) más dos casos que salieron de las mediciones de hoy (`M-1` y `M-2`, de `mp-probes/RESULTS-2026-09-30.md`).
- **Código de referencia**: `origin/staging` en `35e2d63e819d087cb871392ec923158b91630f30`. Toda cita de código de una pieza ALTA la releí yo con `git show origin/staging:<ruta>` (tabla del §2).
- **Fecha**: 2026-09-30.
- **Criterio**: `DEC-METH-017` (`reglas-fase-5.md`). Siglas: `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`, `V/` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `B/` = `.specs/HOS-1354-billing-cobro-y-proveedor`, `16-` = `D/16-fase-7-del-paraguas.md`. En este documento las piezas van sin el prefijo `F5-` (`AUT-003` es `F5-AUT-003`).
- **No decide nada**: el grupo A son preguntas al owner, con opciones y una recomendada.

## 1. Resumen

### 1.1 Piezas

Hay **200 piezas** en los cinco informes, no 184: es la suma de los totales que cada informe declara (52 + 34 + 25 + 46 + 43), y el script del §6 extrae exactamente esas 200 ids, sin repetidas. Con `M-1` y `M-2` son **202** unidades de trabajo.

| agente | CONFIRMA | CONTRADICE | FALTA | ADAPTAR | DELETE | total |
|---|---|---|---|---|---|---|
| 01 · permisos y roles | 7 | 4 | 25 | 13 | 3 | 52 |
| 02 · base de datos | 8 | 11 | 3 | 7 | 5 | 34 |
| 03 · API, rutas y crons | 10 | 4 | 6 | 4 | 1 | 25 |
| 04 · web, admin y Eje 2 | 6 | 8 | 9 | 10 | 13 | 46 |
| 05 · lo que borra `U1` | 4 | 6 | 3 | 9 | 21 | 43 |
| **total** | **35** | **33** | **46** | **43** | **43** | **200** |
| mediciones de hoy (`M-1`, `M-2`) | — | 2 | — | — | — | 2 |

Piezas ALTA: **26** (01: 7, 02: 4, 03: 3, 04: 7, 05: 5).

### 1.2 Racimos

Las 202 quedan en **44 racimos** con causa (`R5-01` a `R5-44`) más dos bolsas del grupo C (confirmaciones y `DELETE`).

| grupo | ALTA | MEDIA | BAJA | racimos | piezas |
|---|---|---|---|---|---|
| A · decide el owner | 13 | 15 | 1 | 29 | 65 |
| B · lo corrige el código en su unidad | 6 | 9 | 0 | 15 | 51 |
| C · confirmaciones, ausencias esperadas y `DELETE` | — | — | — | 2 bolsas | 86 |
| **total** | **19** | **24** | **1** | **44 + 2** | **202** |

### 1.3 Los racimos del grupo A, en el orden en que conviene decidirlos

| lote | racimo | sev. | una línea |
|---|---|---|---|
| 1 · bloquea `U1` | `R5-01` | ALTA | los gates de entitlement son la autorización de 145-147 archivos de las verticales: `U1` no los borra sin tocar la autorización |
| 1 | `R5-02` | ALTA | `billing_notification_log` es la bitácora de todos los correos, y `U1` borra `billing_*` entero |
| 1 | `R5-03` | ALTA | no son 11 las migraciones de datos del seed que dejan de compilar: son unas 50 |
| 1 | `R5-04` | ALTA | `partners` tiene FK a tablas de qzpay y tres crons que archivan una presencia que el diseño no archiva |
| 1 | `R5-05` | MEDIA | falta la lista cerrada de columnas del cobro en tablas que sobreviven |
| 1 | `R5-06` | MEDIA | `is_featured` es la curada por el admin y el diseño la retira con el cobro |
| 1 | `R5-07` | ALTA | `archive-abandoned-drafts` es un segundo `PB5` que además revoca el rol `HOST` |
| 1 | `R5-08` | ALTA | `G8` queda rojo el día del corte por dos extras que nadie iba a tocar |
| 1 | `R5-09` | MEDIA | permisos y tipos del cobro viejo en los enums de la base |
| 2 · `V1`/`B1` e infraestructura común | `R5-10` | ALTA | ninguna unidad construye el outbox |
| 2 | `R5-11` | MEDIA | correlación, huso e id de corrida en logs y crons: sin unidad |
| 2 | `R5-12` | ALTA | las bases de desarrollo y test se arman con `push`: las filas de referencia de la migración no llegan |
| 2 | `R5-13` | ALTA | la migración estructural no puede llamar código TypeScript |
| 2 | `R5-14` | MEDIA | variables de entorno de Mercado Pago: cuáles borra `U1` y cuáles hereda `B1` |
| 3 · `V6` y el corte | `R5-15` | ALTA | el estado nuevo de la ficha y las columnas viejas que hoy deciden «pública» y disparan la revalidación |
| 3 | `R5-16` | ALTA | las tres columnas que sobreviven tienen lectores fuera del cobro y nadie los retira |
| 3 | `R5-17` | ALTA | rutas de borrado y restauración de fichas y cuentas fuera de `PB9`/`PB12` |
| 3 | `R5-18` | ALTA | las fichas de cuentas de staff pierden la exención por rol en el corte |
| 3 | `R5-19` | MEDIA | los plazos vacíos rompen la migración desde el merge, no desde el ensayo |
| 3 | `R5-20` | MEDIA | los crons del sistema nuevo arrancan con el despliegue del paso 3 |
| 3 | `R5-21` | MEDIA | desplegar y migrar son dos actos en este repositorio |
| 3 | `R5-22` | MEDIA | `M-1`: el titular que sólo conoce el proveedor sin pago aprobado no tiene detector |
| 4 · producto (`V4`/`V5`/`V7`) | `R5-23` | MEDIA | la postulación de Partner ya existe (`alliance_leads`) y el diseño no la nombra |
| 4 | `R5-24` | MEDIA | en Partner el paso 3 de la cadena no tiene familia que preguntar |
| 4 | `R5-25` | MEDIA | la impersonación está apagada, no descartada (HOS-354) |
| 4 | `R5-26` | MEDIA | la excepción VIP del contrato de errores contesta 403 |
| 4 | `R5-29` | BAJA | `trial` y las tablas de sólo agregar no dicen si llevan `deleted_at` |
| 5 · `B6` | `R5-27` | MEDIA | `M-2`: las devoluciones de una orden van de a una |
| 6 · textos | `R5-28` | MEDIA | siete razones o números caducos bajo conclusiones correctas |

## 2. Verificación de las citas de las ALTA

Releí con `git show origin/staging:<ruta>` todas las citas de código de las 26 piezas ALTA. **Todas se sostienen**; ninguna baja de severidad. Cuatro detalles, ninguno cambia la conclusión:

| pieza | cita | resultado |
|---|---|---|
| `API-015` | `archive-abandoned-drafts.job.ts:35` como `shouldRevokeHostHat` | la línea 35 es un import; `shouldRevokeHostHat` está en `:71`. La revocación real (`:384-390`) y el umbral (`:45`) se sostienen |
| `BD-021` | `apps/api/test/e2e/setup/test-database.ts:118` como armado por `push` | es el texto de ayuda que se imprime si falta el esquema, no una ejecución. Las otras tres citas sí ejecutan `push`: `package.json:83` (`db:fresh-dev`), `scripts/setup-test-db.ts:44`, `.github/workflows/e2e-nightly.yml:221`; el nocturno no corre `db:migrate` en ningún paso |
| `U1-048` | 53 migraciones de datos | mi recuento independiente da 49 (45 archivos que nombran una tabla del cobro por identificador, más `@repo/billing`, en la unión); el de 05 sale de un grafo de imports. El orden de magnitud (unas 50 contra las 11 del diseño) se sostiene |
| `U1-040` | 145 archivos de fuente fuera del cobro importan los gates | mi recuento con otro patrón da 147 en `apps/api/src` fuera de `routes/billing` y de `middlewares/`. Se sostiene |

Citas releídas, por pieza (`ruta:línea` sobre `origin/staging`):

| pieza | lo releído |
|---|---|
| `AUT-003` | `permission.service.ts:96` (`assignPermissionToRole`), `:160-215` (el único rechazo es un destinatario con `SUPER_ADMIN`, `:191`; escribe en `:210-212`); `actor.ts:383-386` (suma los grants); `rolePermissions.seed.ts:250` (`PERMISSION_ASSIGN` de `SUPER_ADMIN`) |
| `AUT-004`, `AUT-125` | `roles.ts:109`, `:176` (`USER_UPDATE_ROLES` para todo rol); `rolePermissions.seed.ts:164` (bloque `SUPER_ADMIN`, `:14`) y `:624` (bloque `ADMIN`, `:488`); `user-role.schema.ts:20` (`NON_ASSIGNABLE_ROLES` = `SYSTEM`, `GUEST`), `:176-180` (`reason` opcional) |
| `AUT-005` | `apps/api/src/utils/actor.ts:33-38` (`roles: [SUPER_ADMIN]`, `permissions: Object.values(PermissionEnum)`); `newsletter-subscriber.service.ts:705-709` (actor fabricado a mano); `authorization.ts:161-172` (sólo el borde HTTP lo rechaza) |
| `AUT-006` | `manual-payment.ts:24` (`PARTNER_MANAGE` y nada más); `authorization.ts:40-68` (sólo permisos) |
| `AUT-012`, `API-015`, `SUP-018` | `archive-abandoned-drafts.job.ts:4-15` (sobre `updated_at`), `:45` (30 días), `:288` (`ARCHIVED`), `:384-390` (`revokeRole` `HOST`); `registry.ts:14`, `:83`; bloques de `rolePermissions.seed.ts` (`USER` en `:1403`, `HOST` en `:1057`) |
| `AUT-022` | `accommodation.service.ts:260-264` (`BILLING_EXEMPT_ROLES`), `:1941-1952` (el dueño exento no arranca trial) |
| `BD-012`, `SUP-017` | `accommodation/protected/softDelete.ts` (ruta del dueño, `bypassPermission: ACCOMMODATION_DELETE_ANY`), `accommodation/admin/hardDelete.ts` (`ACCOMMODATION_HARD_DELETE`), `admin/restore.ts`; `gastronomy/admin/{delete,hardDelete,restore}.ts` y `experience/admin/{delete,hardDelete,restore}.ts` existen; `accommodation_review.dbschema.ts:23` (`onDelete: 'cascade'`); `base.model.ts:642` (`softDelete`) |
| `BD-019` | `extras/032-commerce-media.constraints.sql` (nombre, `:2`, `:21-22`), `extras/033-content-media.constraints.sql:10`; fila `G8` de `V/docs/20-testing.md:56` |
| `BD-020` | `packages/db/package.json:40` (`drizzle-kit migrate`); `scripts/server-tools/src/commands/db-migrate.ts:8-14` |
| `API-019`, `U1-042` | `billing_notification_log.dbschema.ts:15-21` (FK a `billing_customers`); `notification.service.ts:3`, `:1063` (inserta cada envío); `ai-cost-alert.service.ts:31`, `:70-80` (dedup); `extras/004-billing.constraints.sql:94` (índice único) |
| `API-020` | `notification.service.ts:244` (manda), `:264`, `:289` (registra después); `newsletter-delivery.service.ts:15-27` (el único outbox); `rg -c -i outbox` en las dos `descomposicion.md` → 0 (control: `nucleo/07-outbox-y-notificaciones.md` → 5) |
| `SUP-002` | ningún archivo `publish`/`lifecycle`/`visib`/`state` en `gastronomy/protected` ni `experience/protected` (control: `accommodation/protected` da tres); el `patch` del dueño excluye `lifecycleState` y `visibility` (`experience/protected/patch.ts:12-13`); `commerce/protected/start-subscription.ts:1-10`; `commerce-visibility.ts:7-14` |
| `SUP-005` | `apps/web/src/lib/entitlements-cache.ts:27-36` (un conjunto, un `plan`), `:82` (un endpoint) |
| `SUP-010` | `accommodation.service.ts:969-977` (`_isPubliclyVisible`); `commerce-revalidation.ts:64-69`; `indexnow-visibility.ts:51-58` |
| `SUP-015` | `publish.ts:59` y `unpublish.ts:43` (`bypassPermission: ACCOMMODATION_UPDATE_ANY`); `accommodation.service.ts:1911-1914` (`isAdmin` por ese permiso), `:1961-1964` (elegibilidad del **dueño**), sin ningún chequeo de `isOwner` antes de `startsLocalTrial`; `states-moderation.consolidated.ts:38-44`, `:73-76` |
| `SUP-020` | `accommodation.service.ts:1091`, `:1203`, `:1319`; `commerce-revalidation.ts:109` |
| `U1-030` | `accommodation.model.ts:636`, `:641`; `accommodation.permissions.ts:170`; `destination.service.ts:627-628`; `similar.ts:183-184`; `accommodation.service.ts:2099`, `:2289` (escritor de `billing_unpublished_at` fuera del cobro) |
| `U1-040` | `accommodation/protected/create.ts:66`; `gastronomy/protected/removeMedia.ts:21-23`, `:81-82` |
| `U1-044` | `partner.dbschema.ts:4` (importa `billingPlans`, `billingSubscriptions`), `:60-65` (FK), `:264-268` (relaciones); `partner.model.ts:28`, `:223-226` (`leftJoin(partnerSubscriptions…)`) |
| `U1-048` | `0001-billing-plans-ai-consumer-search-limits.ts:62` (`billingPlans` de `@repo/db`); 11 archivos con `from '@repo/billing'` en una línea (9 numeradas y los 2 auxiliares) más `0004` y `0005` con import partido |
| `BD-021` | ver arriba |

## 3. Grupo A · decide el owner

Cada racimo: piezas, severidad, qué supone el diseño, qué hace el código, quién corrige, y la pregunta en llano con opciones. **Recomendada** marca la que propongo; no está decidida.

### Lote 1 · lo que bloquea `U1`

Va primero porque `U1` es la unidad que abre la rama: hasta que estos nueve estén contestados, su alcance no está cerrado y su criterio *«la rama sigue compilando»* (`16-` §4.6, línea 649) no se puede cumplir.

#### R5-01 · Los gates de entitlement son la autorización de las verticales · ALTA

- **Piezas**: `U1-040` (ALTA), `API-008`, `U1-046`.
- **Diseño**: `U1` borra *«todo lo que sólo el sistema viejo usa»* (`16-` §4.6 punto 1) con *«Ningún código nuevo»* (`16-` §4.6, fila `U1`, línea 677) y *«La rama sigue compilando: typecheck y lint verdes»* (línea 649).
- **Código**: `apps/api/src/routes/accommodation/protected/create.ts:66` (`requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS)`); `apps/api/src/routes/gastronomy/protected/removeMedia.ts:21-23`, `:81-82` (tres gates juntos); 147 archivos de `apps/api/src` fuera del cobro los importan. Siete rutas de alojamiento importan `accommodation-publish-deps.ts`, que importa `@qazuor/qzpay-core` (`API-008`); `publishDeps` es opcional en `AccommodationService`, así que `null` compila (`U1-046`).
- **Quién corrige**: el diseño (el alcance de `U1`). Unidades `U1`, `V5`.
- **Pregunta**: cuando borremos el cobro viejo, las rutas donde Juan edita su alojamiento o su restaurante hoy chequean su plan antes de dejarlo hacer nada. ¿Qué hacen esas rutas en la rama, desde la limpieza hasta que exista la autorización nueva?
  1. **Quedan los gates hasta la autorización nueva.** `U1` no los borra. Costo bajo en `U1`. Riesgo alto: los gates leen tablas de qzpay, así que `U1` no llega a *«ningún `@qazuor/qzpay`»* y su criterio de salida no se cumple.
  2. **`U1` los cambia por un gate provisorio que sólo mira propiedad y permiso.** Costo: 147 archivos y un gate nuevo (código nuevo, contra la fila de `U1`). Riesgo: un gate provisorio que alguien olvida reemplazar.
  3. **`U1` los saca y deja la cadena de permiso y propiedad que esas rutas ya tienen; la autorización nueva agrega el paso de cobertura.** Costo: 147 archivos mecánicos. Riesgo: en la rama un dueño con permiso escribe sin plan; la rama no se despliega hasta el corte, y se cierra con un criterio de salida de `V5` (*«ninguna ruta de escritura de vertical sin el paso de cobertura»*). **Recomendada**: es la única que respeta *«ningún código nuevo»* y *«sin qzpay»* a la vez, y el riesgo vive sólo en la rama.

#### R5-02 · `billing_notification_log` es la bitácora de todos los correos · ALTA

- **Piezas**: `API-019` (ALTA), `U1-042` (ALTA).
- **Diseño**: no se conserva *«`billing_*` entero»* (`B/docs/21-migracion.md:438`); `U1` borra el esquema de las tablas viejas (`16-` §4.6 punto 1).
- **Código**: `packages/db/src/schemas/billing/billing_notification_log.dbschema.ts:15-21` (FK a `billing_customers`); `packages/notifications/src/services/notification.service.ts:3`, `:1063` (inserta cada envío, sea del tipo que sea); `apps/api/src/services/ai-cost-alert.service.ts:31`, `:70-80` (dedup de la alerta de costo de IA); `extras/004-billing.constraints.sql:94` (su índice único). La usan contacto, feedback, alianzas, calendario, IA y más.
- **Quién corrige**: el diseño. Unidades `U1` y la dueña del outbox (`R5-10`).
- **Pregunta**: hoy cada correo que la plataforma le manda a Juan (el de contacto, el aviso de su calendario, cualquiera) queda anotado en una libreta que por nombre parece del cobro. ¿Qué hacemos con esa libreta cuando borramos el cobro viejo?
  1. **Sobrevive con nombre neutro.** `U1` la renombra, le saca la columna y la FK de cliente del cobro, y su índice pasa del extra `004` a uno propio. Costo: una migración de renombre y unos 37 consumidores. Riesgo bajo. **Recomendada**.
  2. **Sobrevive tal cual hasta el outbox.** `U1` sólo suelta la FK. Costo menor. Riesgo: una tabla `billing_*` viva contra `B/21` §4, que el outbox tiene que acordarse de absorber.
  3. **`U1` la borra.** Costo: se pierden el dedup de alertas de IA (alertas duplicadas) y la pantalla de registros del admin hasta que exista el outbox. Riesgo alto.

#### R5-03 · Las migraciones de datos del seed que dejan de compilar son unas 50, no 11 · ALTA

- **Piezas**: `U1-048` (ALTA), `BD-027`.
- **Diseño**: *«Las 11 migraciones de datos del seed que importan `@repo/billing` dejan de compilar… cada una deja de importar `@repo/billing` y lleva escritos los valores que leía»* (`B/docs/21-migracion.md:474-480`; `16-` §4.6, caso 9).
- **Código**: 11 numeradas y 2 auxiliares (`helpers/billingCleanupGuards.ts`, `helpers/trialPlanMigration.ts`) importan `@repo/billing`; dos de las numeradas importan funciones y no valores (`0092`, `0106`; `BD-027`); y unas 45 más importan **tablas** del cobro de `@repo/db` (p. ej. `0001-billing-plans-ai-consumer-search-limits.ts:62`). Congelar valores no les devuelve la tabla.
- **Quién corrige**: el diseño. Unidad `U1`.
- **Pregunta**: hay unas cincuenta recetas viejas, ya aplicadas en producción, que tocan tablas del cobro. Cuando esas tablas desaparecen del código, las recetas dejan de compilar. ¿Qué hacemos con ellas?
  1. **Reescribirlas como SQL crudo** que no importa tablas y no hace nada si la tabla no existe. Costo: unos 50 archivos. Riesgo medio: cada una necesita su guarda de existencia.
  2. **`U1` las saca de la rama**, adelantando para ellas lo que el paso 6 iba a hacer. Costo bajo. Riesgo: no está medido si el runner tolera filas del registro sin archivo ni qué hace `--baseline-stamp` en una base nueva sin ellas. **Recomendada, condicionada a esa medición** (sólo lectura del runner, antes de escribir `U1`).
  3. **Un módulo de tipos con las tablas viejas hasta el paso 6.** Costo bajo. Riesgo alto: contradice *«ningún `@qazuor/qzpay`»*.

#### R5-04 · `partners` y sus crons dependen del cobro viejo · ALTA

- **Piezas**: `U1-044` (ALTA), `BD-018`, `SUP-024`, `API-016`.
- **Diseño**: `B/docs/21-migracion.md:438-440` retira `partner_subscriptions`; *«La página propia de Partner Gold no tiene máquina de estados… El contenido se conserva. No se baja, no se archiva y no se borra nada»* (`V/docs/18-partner.md` §1.6).
- **Código**: `packages/db/src/schemas/partner/partner.dbschema.ts:4` (importa `billingPlans`, `billingSubscriptions`), `:60-65` (FK), `:264-268` (relaciones); `packages/db/src/models/partner/partner.model.ts:223-226` (join a `partner_subscriptions`) y el filtro de lectura pública por `subscription_status` (`:94`, `:175`, `:255`, según 02 y 04); `partner-expiry.job.ts:78-79` y `partner-unpaid-reaper.job.ts:133` archivan (según 03).
- **Quién corrige**: el diseño. Unidades `U1`, `V7`.
- **Pregunta**: Juan es socio Gold. Hoy que su página se vea depende de columnas del cobro viejo, y dos procesos nocturnos la archivan si deja de pagar. Cuando borramos el cobro viejo, ¿qué pasa con esas columnas y esos procesos?
  1. **`U1` borra las columnas de pago de `partners`, sus FK y los tres crons**; la lectura pública queda sin presencia visible hasta `V7`. Costo bajo. Riesgo bajo: hoy Partner tiene cero filas (`V/18` §1.6). **Recomendada**.
  2. **`U1` sólo suelta las FK; columnas y crons quedan hasta `V7`.** Costo menor en `U1`. Riesgo: en la rama siguen vivos procesos que archivan contra el modelo nuevo.
  3. **Sólo nombrar los tres crons en el lote N y dejar las columnas a `V7`.** Costo intermedio. Riesgo: la lectura pública lee una columna que nadie escribe.

#### R5-05 · Falta la lista cerrada de columnas del cobro en tablas que sobreviven · MEDIA

- **Piezas**: `U1-032`, `BD-017`, `SUP-D12` (`DELETE` condicional).
- **Diseño**: `16-` §4.6 punto 1 nombra sólo las tres columnas de `accommodations`; `B/21` §4 dice *«como `featured_by_entitlement` y `is_featured`»*, un ejemplo y no una lista.
- **Código**: `users.service_suspended` (`user.dbschema.ts:138`, leída por el alta de fichas); `owner_promotions.plan_restricted` (`owner_promotion.dbschema.ts:37`, leída por la lectura pública de promociones); `experiences.has_active_subscription` (`experiences.dbschema.ts:238`); las pantallas `billing/{sponsorships,owner-promotions}.tsx` del admin; las tablas de tipo de cambio y los valores `BILLING_SUBSCRIPTION` y `PAYMENT` de `entity_type_enum` (`0000_baseline.sql:10`), que ningún capítulo nombra.
- **Quién corrige**: el diseño. Unidades `U1`, `V6`.
- **Pregunta**: además de las tres marcas que decidiste conservar hasta el corte, quedan otras del cobro viejo en tablas que sobreviven: por ejemplo *«la cuenta de Juan está suspendida»* o *«la promoción de Juan quedó fuera de su plan»*. ¿Cuáles borra la limpieza?
  1. **Lista cerrada**: `U1` borra `service_suspended`, `owner_promotions.plan_restricted` y `has_active_subscription` con sus lectores; el tipo de cambio, los patrocinios y las promociones del dueño quedan (no son cobro); los valores de `entity_type_enum` van con `R5-09`. Costo: editar promociones y el alta de fichas. Riesgo: una promoción hoy oculta por `plan_restricted` vuelve a verse; conviene contarlas antes. **Recomendada**, con el conteo previo.
  2. **Se suman a la excepción de las tres** y se borran en el paso 3. Costo: la migración del corte crece. Riesgo bajo.
  3. **Que `U1` decida al implementar.** Rechazada de hecho por el lote N-A (*«100 % seguros»*); la listo para que quede escrita.

#### R5-06 · `is_featured` es la curada por el admin · MEDIA

- **Piezas**: `BD-032`, `U1-045`.
- **Diseño**: *«`featured_by_entitlement` y `is_featured`… se retiran con el código que las lee… en la limpieza del principio»* (`B/docs/21-migracion.md:440-443`); *«ninguna ficha nace destacada»*.
- **Código**: `is_featured` en `accommodation.dbschema.ts:83`, `gastronomy.dbschema.ts:145`, `experiences.dbschema.ts:272`, curada por el admin (el `CLAUDE.md` raíz: *«admin-curated, separate column»*); el listado ordena por `isFeatured OR featuredByEntitlement` (`accommodation.model.ts:198`, según 05) y la home tiene su sección de destacados.
- **Quién corrige**: el diseño (confirmar o cambiar). Unidades `U1` o `V6`.
- **Pregunta**: hoy el equipo puede marcar a mano la ficha de Juan como destacada, sin que Juan pague nada. El diseño retira esa marca junto con el cobro viejo. ¿La retiramos?
  1. **Sí, `U1` retira las dos columnas en las tres tablas.** El destaque vuelve sólo como complemento pagado. Costo: seis rutas públicas, el orden del listado y la sección de la home. Riesgo: la home queda sin destacados hasta que exista el complemento. **Recomendada**: es lo que el diseño ya dice, ahora con su costo a la vista.
  2. **Sólo sale la del cobro; la curada queda como herramienta editorial.** Costo: una acción administrativa más (*«destacar»*) en el catálogo de `NUCLEO/08` §3. Riesgo: dos caminos al destaque.
  3. **La curada la retira `V6` cuando construya el destaque nuevo.** Costo repartido. Riesgo: la columna vive sin dueño entre `U1` y `V6`.

#### R5-07 · `archive-abandoned-drafts` es un segundo `PB5` que revoca roles · ALTA

- **Piezas**: `AUT-012` (ALTA), `API-015` (ALTA), `SUP-018` (ALTA).
- **Diseño**: `PB5` archiva a los N meses sobre `inactiva_desde` con la versión de plazos de la ficha (`V/docs/03-maquinas-de-estado.md:487`); *«Perder el acceso NUNCA revoca un rol»* (`V/docs/17-autorizacion.md:664`); `U1` borra *«todo el cobro viejo»* (`16-` §4.6). El cron no aparece en ninguna épica, en el núcleo ni en `16-` (`rg -c archive-abandoned` → sin hits; control: `08-phase-1b-code-discovery.md` → 2).
- **Código**: `apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts:45` (30 días), `:4-15` (sobre `updated_at`), `:288` (escribe `ARCHIVED`), `:384-390` (`revokeRole` de `HOST`); registrado en `registry.ts:14`, `:83`.
- **Quién corrige**: el diseño (nombrar quién lo borra). Unidades `U1` o `V6`/`V9`; el guard de `V5`.
- **Pregunta**: hoy, si Juan deja un borrador de alojamiento sin tocar 30 días, un proceso nocturno lo archiva y además le saca el rol de anfitrión. El diseño tiene su propio reloj de retención, en meses, y dice que perder algo nunca saca un rol. ¿Quién apaga el proceso viejo?
  1. **Lo borra `U1`, aunque no sea cobro.** Costo cero en producción: la rama no se despliega hasta el corte, y el reloj nuevo llega con `V6`/`V9`. Riesgo bajo. **Recomendada**.
  2. **Lo borra la unidad que construye `PB5`, en el mismo cambio; `U1` sólo le saca la revocación del rol.** Costo repartido. Riesgo: si esa unidad se atrasa, sigue vivo en la rama.
  3. **Complemento de cualquiera de las dos**: que el guard de `V5` (`V/17` §4.4) mire también la máquina de la ficha, para que ninguna transición toque roles. Costo bajo. Lo sugiere `AUT-012`.

#### R5-08 · `G8` queda rojo el día del corte por dos extras · ALTA

- **Piezas**: `BD-019` (ALTA), `U1-055`.
- **Diseño**: la lista de pendientes de `G8` cubre *«la historia de migraciones (`packages/db/src/migrations/**`)»* y el paso 6 la saca (`V/docs/20-testing.md:56`); *«El carril de extras… queda afuera del reemplazo»* (`16-` §4.2 paso 6, línea 145).
- **Código**: `packages/db/src/migrations/extras/032-commerce-media.constraints.sql` nombra la palabra en el nombre del archivo y en `:2`, `:21-22`; `033-content-media.constraints.sql:10` en un comentario. Ninguno es de cobro: `U1` no los toca.
- **Quién corrige**: el código en `U1`, y una línea del diseño. Unidades `U1`, `V1`.
- **Pregunta**: el guardián que busca la palabra vieja del agrupamiento de restaurantes y experiencias va a encontrar dos archivos de reglas de la base que nadie iba a tocar, justo el día del corte. ¿Los reescribimos en la limpieza, o cambiamos lo que el guardián perdona?
  1. **`U1` reescribe `032` (nombre y comentarios) y `033` (comentario).** Los extras no tienen registro, así que ninguna base cambia. Costo mínimo. Riesgo bajo.
  2. **1 y además la lista de pendientes deja de cubrir `extras/`**, así un extra nuevo con la palabra falla desde el primer día y no el del corte. Costo: una línea en `V/20`. **Recomendada**.
  3. **Sólo excluir `extras/` sin reescribir.** Riesgo: `G8` falla hoy mismo sobre `032` y `033`.

#### R5-09 · Permisos y tipos del cobro viejo en los enums de la base · MEDIA

- **Piezas**: `AUT-023`, `U1-058`.
- **Diseño**: `U1` borra el rol de comercio *«y sus siete permisos… con su migración de datos»* (`V/docs/21-migracion.md:545`); de los permisos y tipos del cobro no dice nada.
- **Código**: `BILLING_MANAGE`, `MANAGE_SUBSCRIPTIONS`, `BILLING_PROMO_CODE_MANAGE`, `BILLING_RECONCILIATION_MANAGE` (`permission.enum.ts:876-881`, `:944-948`), espejados en el `pgEnum` (`enums.dbschema.ts:171`) y en filas de `role_permission`; 14 enums del cobro en `packages/schemas/src/enums/` con sus `pgEnum` (p. ej. `billing_interval_enum`, `enums.dbschema.ts:297`).
- **Quién corrige**: el diseño. Unidades `U1`, `V5`.
- **Pregunta**: en la base quedan etiquetas del cobro viejo: permisos como *«gestionar el cobro»*, que hoy tiene el equipo, y tipos como *«intervalo de facturación»*. Si quedan, alguien podría seguir dándole a Juan un permiso que ya no significa nada. ¿Se borran en la limpieza?
  1. **Todo en `U1`**: se recrean los tipos sin esos valores y una migración de datos saca las filas de roles y overrides. Costo: recrear en Postgres un enum de unos 790 valores. Riesgo medio.
  2. **Los tipos que sólo usan tablas del cobro se borran con sus tablas en la misma migración de `U1`; los valores de permisos y de `entity_type_enum` quedan sin lectores y la resolución los rechaza** (con la lista de `R5-33`). Costo bajo. Riesgo: vocabulario muerto en la base. **Recomendada**.
  3. **Nada en `U1`.** Riesgo: `AUT-003` (un override puede dar cualquiera).

### Lote 2 · `V1`, `B1` y la infraestructura común

Va segundo porque todas las unidades que escriben filas, mandan correos o corren jobs se apoyan en esto.

#### R5-10 · Ninguna unidad construye el outbox · ALTA

- **Piezas**: `API-020` (ALTA), `API-021`.
- **Diseño**: `NUCLEO/07` §1.1-§2 (encolar en la transacción de dominio, `processing` con dueño y vencimiento, escalado, clave de deduplicación) y §4 (supresión); `16-` lo da por nuevo (*«antes de que exista el outbox nuevo»*, línea 293); lo consumen `V6`, `V9`, `B4`, `B12` (`V/descomposicion.md:507`, `:606`; `B/descomposicion.md:138`, `:699`). `outbox` aparece 0 veces en las dos `descomposicion.md`.
- **Código**: `notification.service.ts:244` manda y `:264`, `:289` registran después, fuera de toda transacción; el único outbox del repositorio es el del newsletter (`newsletter-delivery.service.ts:15-27`, BullMQ); el rebote duro sólo se registra para el newsletter.
- **Quién corrige**: el diseño. Sin unidad hoy.
- **Pregunta**: cuando la ficha de Juan se borra, el diseño dice que su aviso queda *«encolado»* en la misma operación, para que nunca se pierda ni salga dos veces. Hoy nadie tiene asignado construir esa cola. ¿Quién la construye?
  1. **Una unidad nueva del paraguas**, después de `U1` y antes de cualquier unidad que encole, sobre el precedente del newsletter; incluye la supresión y absorbe la bitácora de `R5-02`. Costo: una unidad más en el plan. Riesgo bajo. **Recomendada**.
  2. **`V1` la construye como infraestructura común.** Costo: `V1` crece y bloquea más. Riesgo medio.
  3. **`B1` la construye.** Riesgo: la mitad de verticales pasa a depender del package del cobro para mandar un correo, contra `D/12-contrato-de-cobertura.md` §7.1.

#### R5-11 · Correlación, huso e id de corrida en logs y crons: sin unidad · MEDIA

- **Piezas**: `API-023`, `API-009`, `API-006`.
- **Diseño**: correlación acuñada en el borde que viaja al evento y a la fila de outbox, y la de cada corrida de job (`NUCLEO/08` §2.1-§2.3, §5); toda ventana en días en el huso del mercado, *«y eso incluye a los jobs»* (`NUCLEO/07` §3); el reloj inyectado (`D/12-…` §7.1 punto 5).
- **Código**: `apps/api/src/lib/request-context.ts:36-51` (sólo `requestId`); `correlationId` → 0 hits; el contexto del cron trae `startedAt: new Date()` (`cron/bootstrap.ts:50`) y `node-cron` programa sin huso (`bootstrap.ts:128`); no hay interfaz de reloj.
- **Quién corrige**: el diseño (dueño). Unidades `B1` (reloj) y la del outbox.
- **Pregunta**: cuando un proceso nocturno toca la ficha de Juan, el diseño pide poder seguir ese hilo de punta a punta, con la hora del reloj de pruebas y el horario de Argentina. ¿Quién agrega eso a la infraestructura de logs y de procesos nocturnos?
  1. **La unidad del outbox (`R5-10`)**, porque la correlación viaja a su fila; `B1` sigue dando el reloj. Costo: la unidad crece un poco. **Recomendada**.
  2. **`B1`, junto con el reloj.** Riesgo: `B1` es de la mitad del cobro y esto lo usan las dos.
  3. **Cada unidad que escriba un job.** Riesgo: veinte implementaciones de lo mismo.

#### R5-12 · Las bases de desarrollo y de test se arman con `push` · ALTA

- **Piezas**: `BD-021` (ALTA).
- **Diseño**: la migración *«la corre toda base que aplique las migraciones… las bases de desarrollo y la de CI»* y la foto lleva *«las filas de referencia sin las cuales una base armada desde el repositorio no arranca»* (`16-` §4.2 paso 6, línea 145); *«la tabla de claves la escribe la migración desde el catálogo»* (`D/nucleo/02-modelo-de-datos.md` §1.4).
- **Código**: `package.json:83` (`db:fresh-dev` usa `db:push`), `scripts/setup-test-db.ts:44`, `.github/workflows/e2e-nightly.yml:221`; sólo `e2e-pr.yml:216` corre `db:migrate`.
- **Quién corrige**: el diseño y el armado de bases. Unidad `V1` (tabla de claves), y todas las que siguen.
- **Pregunta**: el diseño pone datos de referencia (la lista de claves, las verticales, la primera versión de los plazos) adentro de la migración. Pero las bases de desarrollo y de pruebas se arman con otro comando que no corre migraciones, así que esos datos nunca llegan y los tests de Juan fallan sin motivo aparente. ¿Cómo llegan?
  1. **Esas bases pasan a `db:migrate`**, como ya hace `e2e-pr`. Costo: armar la base tarda más. Riesgo bajo; una sola fuente. **Recomendada**.
  2. **El seed `required` carga las mismas filas.** Costo bajo. Riesgo: dos escritores de lo mismo que tienen que coincidir.
  3. **2 con un guard que compare seed y migración.** Costo medio; el guard sólo existe porque hay dos fuentes.

#### R5-13 · La migración estructural no puede llamar código TypeScript · ALTA

- **Piezas**: `BD-020` (ALTA).
- **Diseño**: *«`V6`, dueña de la migración estructural; `V2` construye la pieza que carga y que esa migración llama»* (`16-` §4.2 paso 6, línea 145); la prueba del corte lleva *«el seudónimo del correo calculado con la misma función que `T1`»* (`V/docs/21-migracion.md:397-401`); *«si esa escritura falla a la mitad, falla la migración»* (paso 3).
- **Código**: `packages/db/package.json:40` (`drizzle-kit migrate` sobre `.sql`); `db-migrate.ts:8-14`. El único carril que corre TypeScript es el de datos del seed, después y por otro comando.
- **Quién corrige**: el diseño. Unidades `V6`, `V2`, `V4`.
- **Pregunta**: el día del corte, una sola operación de la base tiene que cargar el catálogo nuevo y calcular el seudónimo del correo con que Juan usó su prueba, con la misma fórmula que usa la aplicación. Esa operación es SQL y la fórmula está en TypeScript. ¿Cómo lo resolvemos?
  1. **Todo en SQL**, con un test que compare byte a byte contra la función TypeScript. Costo: dos implementaciones de una función que no puede cambiar nunca. Riesgo medio (la normalización por proveedor).
  2. **El script del corte escribe esas filas en su propia transacción.** Costo bajo. Riesgo: se pierde *«si falla a la mitad, falla la migración»* y el orden respecto de la migración que borra las tres columnas.
  3. **Híbrido**: el SQL del catálogo lo genera un script TypeScript al escribir la migración (se commitea el SQL generado y un guard lo regenera y compara), y los seudónimos los precalcula el script del corte en una tabla de paso que la migración lee. Costo medio. Riesgo bajo: una sola implementación de cada cosa y la migración sigue atómica. **Recomendada**.

#### R5-14 · Variables de entorno de Mercado Pago: cuáles borra `U1` · MEDIA

- **Piezas**: `U1-053`.
- **Diseño**: `16-` §4.6 no nombra variables de entorno (búsqueda A1 de 05).
- **Código**: siete de Mercado Pago en `packages/config/src/env-registry.hospeda.ts:445-539` y cuatro de rate limit del cobro en `env-registry.api-config.ts:974-1020`; las diez que sólo usa el viejo ya son `DELETE` (`U1-021`).
- **Quién corrige**: el diseño. Unidades `U1`, `B1`.
- **Pregunta**: hay once variables de configuración de Mercado Pago que usa el cobro viejo y seguramente también el nuevo. ¿La limpieza las borra o quedan para el nuevo?
  1. **Quedan las de Mercado Pago para `B1`, salvo `STATEMENT_DESCRIPTOR`** (sin sujeto en preapprovals); `U1` borra las cuatro de rate limit y las diez de `U1-021`. Costo bajo. **Recomendada**.
  2. **`U1` borra todas; `B1` registra las suyas.** Costo: dos rondas en Coolify.
  3. **Quedan todas hasta `B1`.** Riesgo: variables sin lector en la rama.

### Lote 3 · `V6` y el corte

Depende del lote 1 (qué columnas y rutas quedan) y del 2 (cómo llega la migración). `R5-16` depende de `R5-15`.

#### R5-15 · El estado nuevo de la ficha frente a las columnas viejas · ALTA

- **Piezas**: `SUP-010` (ALTA), `SUP-020` (ALTA), `SUP-014`.
- **Diseño**: `listing` guarda *«estado del cap. 03 §9»* (`V/docs/02-modelo-de-datos.md` §2.5); la tabla de transiciones de `V/docs/03-maquinas-de-estado.md` §9 no pide revalidar en ninguna fila; `lifecycle_state` y `visibility` sólo aparecen en la tabla de traducción del corte (`V/21` §2.4); `moderation_state` sólo para decir que no se traduce.
- **Código**: *«pública»* es `lifecycleState = ACTIVE` y `visibility = PUBLIC` (`accommodation.service.ts:969-977`, `commerce-revalidation.ts:64-69`, `indexnow-visibility.ts:51-58`), 150 usos en 104 archivos; los disparadores de revalidación miran ese par (`accommodation.service.ts:1091`, `:1203`, `:1319`; `commerce-revalidation.ts:109`).
- **Quién corrige**: el diseño (`V/02` §2.5 y `V/03` §9). Unidad `V6`.
- **Pregunta**: hoy *«la ficha de Juan se ve en el sitio»* se decide con dos columnas viejas, y cuando cambian se refresca la página. El diseño agrega un estado nuevo y no dice qué pasa con las dos viejas ni quién refresca la página cuando cambia el nuevo. ¿Cuál manda?
  1. **El estado nuevo reemplaza a las dos (y a `moderation_state`)**: `V6` migra los lectores y los disparadores de refresco, y cada fila de §9 dice si revalida; las viejas se borran en el paso 3. Costo alto (unos 104 archivos). Riesgo bajo después. **Recomendada**.
  2. **Conviven**: cada transición escribe también las dos viejas. Costo bajo. Riesgo: dos verdades que pueden separarse.
  3. **Las viejas pasan a columnas generadas** a partir del estado nuevo. Costo medio. Riesgo: todo escritor de hoy de esas columnas falla.

#### R5-16 · Las tres columnas que sobreviven tienen lectores fuera del cobro · ALTA

- **Piezas**: `U1-030` (ALTA), `BD-015`, `SUP-011`, `BD-016`.
- **Diseño**: *«sólo las usa el cobro viejo»* (`16-` §4.6 punto 1; `V/docs/21-migracion.md:220-222`), y la tabla de traducción las lee *«para `L5` y `L7`»*.
- **Código**: lectores fuera del cobro en `accommodation.model.ts:636`, `:641`, `accommodation.permissions.ts:170`, `destination.service.ts:627-628`, `similar.ts:183-184`; y `service-core` escribe `billing_unpublished_at` al publicar y despublicar (`accommodation.service.ts:2099`, `:2289`). `billing_unpublished_at` ya no separa ningún destino desde C12 (`BD-016`).
- **Quién corrige**: el diseño. Unidad `V6` (y `U1` para los escritores del cobro).
- **Pregunta**: decidiste conservar tres marcas viejas hasta el corte. Pero no sólo las usa el cobro: también las usa la parte que decide si la ficha de Juan aparece en búsquedas y en su destino. Cuando se borren en el corte, esa parte deja de compilar. ¿Quién la cambia y cuándo?
  1. **`V6` retira esos lectores en el mismo cambio que la migración que borra las columnas**, reemplazados por el estado nuevo (`R5-15`, opción 1). Costo: `V6` crece. Riesgo bajo; lo ve `typecheck`. **Recomendada**, con la corrección del texto (*«sólo las usa el cobro viejo»* y *«para `L5`»*).
  2. **Una tarea previa al ensayo del corte** reemplaza esos filtros y la migración va después. Costo igual, repartido. Riesgo: una ventana con dos criterios.
  3. **Además achicar la excepción a dos columnas**, porque `billing_unpublished_at` ya no decide nada. Complementaria; mantener tres no rompe nada.

#### R5-17 · Rutas de borrado y restauración fuera de `PB9`/`PB12` · ALTA

- **Piezas**: `BD-012` (ALTA), `SUP-017` (ALTA), `BD-030`, `SUP-030`, `AUT-122`.
- **Diseño**: *«`PURGED` conserva la fila: el borrado es del contenido, no un `DELETE` de `listing`»* (`V/docs/02-modelo-de-datos.md:721`); *«ningún borrado de ficha sale de otra fila que `PB9` o `PB12`, que es lo que hace correr `A6`»* (`NUCLEO/08` línea 245); la baja *«no borra la fila de `user`: la seudonimiza»* (`V/02` §2.2).
- **Código**: el dueño borra por `accommodation/protected/softDelete.ts` (escribe `deleted_at` y el trigger le borra los favoritos a los turistas); el admin tiene `delete`, `hardDelete` y `restore` en las tres verticales; el `hardDelete` arrastra por `CASCADE` las reseñas de terceros (`accommodation_review.dbschema.ts:23`); `user/admin/hardDelete.ts` borra cuentas.
- **Quién corrige**: el diseño (nombrarlas) y el código. Unidades `V6`, `V5`, `V8`, `V4`.
- **Pregunta**: hoy Juan puede borrar su ficha con un botón que no pasa por el borrado del diseño, y el equipo puede borrarla del todo, llevándose las reseñas que dejaron otros turistas, o restaurarla. Con las cuentas pasa lo mismo. ¿Qué hacemos con esas puertas?
  1. **Se retiran todas**: el borrado del dueño pasa a ser el del diseño, el del equipo pasa a la acción 23 (a pedido y con motivo), y el borrado físico de fichas y cuentas desaparece. Costo: unas diez rutas y la UI del admin. Riesgo bajo. **Recomendada**.
  2. **Se retiran las de fichas; el borrado físico de cuentas queda para cuentas sin rastro** (spam) y contesta un error de negocio si hay prueba. Costo menor. Riesgo: una puerta más que mantener.
  3. **Quedan y se declaran.** Riesgo alto: un addon de ficha que sigue cobrando sin `A6`, y reseñas ajenas perdidas.

#### R5-18 · Las fichas de cuentas de staff pierden la exención en el corte · ALTA

- **Piezas**: `AUT-022` (ALTA), `SUP-016`.
- **Diseño**: *«Y ningún rol es una fuente»* (`V/docs/17-autorizacion.md` §4.3, líneas 693-695); el corte clasifica por columnas y estado, sin mirar el rol (`V/21` §2, `L1`-`L8`).
- **Código**: `accommodation.service.ts:260-264` (`BILLING_EXEMPT_ROLES`) y `:1941-1952`: una ficha de `ADMIN`, `CLIENT_MANAGER` o `SUPER_ADMIN` publica sin plan ni trial.
- **Quién corrige**: el diseño (el corte) y el código de `PB1`. Unidades `V6`, `B9`.
- **Pregunta**: las fichas que publicó alguien del equipo hoy se ven sin plan porque su dueño es del equipo. El diseño dice que un rol nunca da acceso, así que el día del corte esas fichas se bajarían. ¿Las cubrimos?
  1. **Un grant permanente en el corte** para esas cuentas (o para la cuenta de la plataforma), con motivo. Costo bajo. Riesgo bajo.
  2. **Aceptar que se bajen.** Costo cero. Riesgo: fichas de la plataforma que desaparecen el día del corte.
  3. **Contar primero** (una consulta de sólo lectura a producción) y elegir 1 o 2 con el número. **Recomendada**.

#### R5-19 · Los plazos vacíos rompen la migración desde el merge · MEDIA

- **Piezas**: `BD-023`.
- **Diseño**: los plazos *«los fija el owner antes del ensayo del corte en `staging`, y la migración estructural del corte falla si alguno está vacío»* (`D/nucleo/02-modelo-de-datos.md:178-180`).
- **Código**: `.github/workflows/e2e-pr.yml:216` corre `db:migrate` en cada PR.
- **Quién corrige**: el diseño. Unidades `V6`, `V9`, `B2`.
- **Pregunta**: los cinco plazos (por ejemplo, cuántos meses espera el borrador de Juan antes de archivarse) los fijás antes del ensayo. Pero la migración que los necesita corre en cada revisión automática desde que se mergea. ¿Adelantamos la fecha?
  1. **Fijarlos antes del merge de `V6`.** Costo: decidir antes. Riesgo bajo. **Recomendada**.
  2. **La migración falla sólo en `staging` y producción; en desarrollo y CI usa valores de prueba.** Riesgo: dos comportamientos de la misma migración.

#### R5-20 · Los crons del sistema nuevo arrancan con el despliegue del paso 3 · MEDIA

- **Piezas**: `API-010`.
- **Diseño**: *«Hasta acá [paso 5] el sistema nuevo no crea nada en el proveedor»* y la rama de aborto cubre los pasos 3, 3b, 4 y 4b (`16-` §4.2, filas 3 y 5); *«sin interruptores»* (`16-` §4.4).
- **Código**: el programador arranca apenas levanta el servidor (`apps/api/src/index.ts:392-393`); el único interruptor es `HOSPEDA_CRON_ADAPTER`, de proceso entero (`cron/bootstrap.ts:81`).
- **Quién corrige**: el diseño (FASE 7 del paraguas).
- **Pregunta**: entre el despliegue y el momento en que confirmamos el corte, los procesos automáticos nuevos (mandar correos, evaluar fichas) arrancan solos. Si abortamos, el correo a Juan ya salió. ¿Los dejamos arrancar o los prendemos a mano?
  1. **Se despliega con `HOSPEDA_CRON_ADAPTER` apagado y se prende en el paso 5.** Usa lo que existe. Costo bajo. Riesgo: los crons del resto de la plataforma también paran unas horas. **Recomendada**.
  2. **Arrancan con el despliegue y la rama de aborto enumera lo que hacen.** Riesgo: un correo no se deshace.
  3. **Un interruptor por job.** Costo medio, y choca con *«sin interruptores»*.

#### R5-21 · Desplegar y migrar son dos actos · MEDIA

- **Piezas**: `BD-022`.
- **Diseño**: *«desplegar —con la migración estructural…»* y *«toda migración del journal de la imagen tiene que figurar en la tabla de migraciones aplicadas de producción»* (`16-` §4.2 paso 3, línea 137).
- **Código**: la imagen arranca con `node dist/index.js` y no migra (`apps/api/Dockerfile:98`, según 02); migra `hops db-migrate` desde el checkout del VPS, con `git pull` opcional (`db-migrate.ts:8-14`).
- **Quién corrige**: el diseño del paso 3. FASE 7 del paraguas.
- **Pregunta**: el diseño dice *«desplegar con la migración»*. En este repositorio son dos actos separados, y el que migra lee su propia copia del código en el servidor. ¿Lo escribimos así?
  1. **Escribir el orden (viejo apagado, `hops db-migrate --pull` sobre el mismo commit que la imagen, imagen nueva) y exigir la igualdad de commit.** Costo: texto. **Recomendada**.
  2. **Que el contenedor migre al arrancar.** Costo: cambia el despliegue de toda la plataforma. Riesgo medio.

#### R5-22 · `M-1`: el titular que sólo conoce el proveedor, sin pago aprobado, no tiene detector · MEDIA

- **Piezas**: `M-1`.
- **Diseño**: la pasada del proveedor suma titulares *«con su `payer_email` si alguna lectura lo trae»* (`16-` §4.2, línea 330); *«si ninguna lectura trae su pagador… esa población no tiene detector»* (`16-` §4.3, línea 536); `B/docs/21-migracion.md:89` y `:536`; `DEC-MIG-005`, 📌 del 2026-09-30 (`D/01-decision-log.md:6308`).
- **Medido** (`mp-probes/RESULTS-2026-09-30.md`, `EX-59`, corrida de producción del owner): ninguna lectura de suscripciones trae el correo; `GET /v1/payments/{id}` sí, **sólo de un pago aprobado** (los dos rechazados traen `payer.email: null`); sin cobro no hay pagador. `?payer_email=` en el buscador **verifica** un correo candidato, no lo descubre. El diseño dice *«si alguna lectura lo trae»*, que ya no es una incógnita: lo trae una, con condición.
- **Quién corrige**: el diseño (`16-` §4.2 y §4.3, `B/21` §1.3, `DEC-MIG-005`). Herramienta del corte.
- **Pregunta**: si Juan autorizó un débito en Mercado Pago que nuestra base no conoce y todavía no le cobraron nada (o sólo le rechazaron), no hay forma de saber su correo para avisarle antes del corte. ¿Qué hacemos con esa persona?
  1. **Declararlo sin detector, ya acotado**: el detector cubre a quien tiene al menos un pago aprobado (la cadena `authorized_payments` → pago → correo), y el resto queda declarado. El 2026-09-24 era una sola persona, el owner. Costo: texto. **Recomendada**.
  2. **Sumar la vía secundaria**: recorrer los correos de nuestra base contra el buscador de Mercado Pago por correo, para los que sí son usuarios. Costo: una pasada más del script. Riesgo: el buscador de producción con ese filtro no está medido.
  3. **2, midiendo antes el filtro en producción** (sólo lectura). Costo: una medición. Tiene sentido si la población crece antes del corte.

### Lote 4 · producto (`V4`, `V5`, `V7`)

No bloquean el arranque; conviene cerrarlos antes de escribir `V5` y `V7`.

#### R5-23 · La postulación de Partner ya existe y el diseño no la nombra · MEDIA

- **Piezas**: `SUP-006`, `SUP-026`, `AUT-018`, `AUT-105`.
- **Diseño**: `postulacion` es una entidad nueva de tres estados con unicidad por correo y trigger de espera (`V/docs/02-modelo-de-datos.md` §2.7); el reclamo con secreto de un solo uso en `partner.secreto_de_reclamo` (`V/18` §2.4); `PP1` es una excepción de la cadena, con Turnstile y una sola abierta por correo (`V/17` §1.2 precisión 9).
- **Código**: `alliance_leads` (`alliance_lead.dbschema.ts:32` `kind` que mezcla cuatro tipos, `:52` cuatro estados, `:175` `provisioned_partner_id`); aprobación en `approve-and-provision-partner.ts:100`; reclamo con token en `alliance/protected/claim.ts`; alta pública por `createPublicRoute` sin Turnstile (`create-lead.ts:75`). El diseño la menciona sólo por `alliance_leads.partner_type` en la limpieza (búsqueda B-3 de 04).
- **Quién corrige**: el diseño. Unidades `V7`, `V5`, `V8`.
- **Pregunta**: Juan quiere postularse como socio. Ya existe un formulario y una lista de postulaciones, que además mezcla otros tipos (patrocinadores, editores, proveedores). El diseño describe una postulación nueva sin mencionar la que existe. ¿Adaptamos la existente o hacemos otra?
  1. **Adoptar `alliance_leads`**: el diseño mapea *«en revisión»* y los otros tipos, y se agregan Turnstile y la unicidad por correo. Costo medio. Riesgo: la entidad de Partner arrastra tipos ajenos.
  2. **`V7` crea la postulación de Partner y `alliance_leads` queda para los otros tipos.** Costo: dos formularios parecidos. Riesgo bajo: hoy hay cero partners. **Recomendada**.
  3. **`V7` reemplaza y borra `alliance_leads`.** Costo: rehacer también los otros tipos, que no son de este programa.

#### R5-24 · En Partner el paso 3 no tiene familia que preguntar · MEDIA

- **Piezas**: `AUT-025`.
- **Diseño**: el paso 3 pregunta *«¿pertenece a la familia de operaciones?»* y *«el rol dice a qué familia… pertenece la persona»* (`V/17` §1.2, línea 73; §4.2, línea 679); ningún capítulo da rol o familia al dueño de un Partner.
- **Código**: *«An approved partner is an ordinary account»* (`partners/protected/mine-stats.ts:11`); `mine.ts:89`, `:111` sin `requiredPermissions`: la propiedad es el control.
- **Quién corrige**: el diseño. Unidades `V5`, `V7`.
- **Pregunta**: cuando Juan, ya socio, entra a ver sus estadísticas, la cadena pregunta primero a qué familia de operaciones pertenece por su rol. Ser socio no es un rol. ¿Creamos uno o decimos que para socios esa pregunta no aplica?
  1. **Declarar el paso vacuo en Partner**; lo cubre la propiedad del paso 4, como hoy. Costo: una línea. **Recomendada**.
  2. **Rol y familia de socio.** Costo: rol, permisos, migración de datos, asignarlo al aprobar. Riesgo: quitarlo al perder la presencia choca con *«perder el acceso nunca revoca un rol»*.

#### R5-25 · La impersonación está apagada, no descartada · MEDIA

- **Piezas**: `AUT-017`.
- **Diseño**: *«No existe la impersonación.»*; *«"Entrar como" se va a agregar en una versión posterior, y no es esto»* (`V/17` §3.2 regla 4, líneas 449-455).
- **Código**: el rol del plugin `admin` de Better Auth incluye `impersonate` y `set-role` (`apps/api/src/lib/auth.ts:76-89`, `:590-600`); el botón espera a HOS-354 (`apps/admin/src/features/users/components/ImpersonateButton.tsx:17-22`); el permiso `USER_IMPERSONATE` existe (`permission.enum.ts:310`).
- **Quién corrige**: el código y el backlog, por decisión del owner. Unidad `V5`.
- **Pregunta**: el diseño dice que nadie del equipo puede *«entrar como»* Juan. El código tiene esa función apagada, esperando que otra tarea abierta la vuelva a prender. ¿Cuál vale?
  1. **Vale el diseño**: salen `impersonate` y `set-role` del plugin, el botón y el permiso; HOS-354 se cierra o se reescribe como el *«entrar como»* posterior. Costo bajo. **Recomendada**.
  2. **Queda apagada hasta la versión posterior**, y sólo sale `set-role`, que es un segundo camino para asignar roles. Costo mínimo. Riesgo: código dormido que contradice el diseño.

#### R5-26 · La excepción VIP del contrato de errores contesta 403 · MEDIA

- **Piezas**: `AUT-009`.
- **Diseño**: una ficha ajena existe sólo si está en un estado público, lista cerrada (`V/17` §1.2 precisión 7, líneas 193-199); el corte manda a `DRAFT` toda ficha activa no pública (`V/21` §2, `L6`).
- **Código**: `apps/api/docs/error-contract.md:235-254`: *«refuses a foreign RESTRICTED listing with 403»*, fijado por un test, con *«Changing it is an owner decision»*.
- **Quién corrige**: el código y el contrato. Unidades `V5`, `V6`.
- **Pregunta**: hoy si alguien busca una ficha privada de Juan que no es suya, el sistema le contesta *«necesitás acceso especial»*, y con eso confirma que existe. El diseño dice que tiene que parecer inexistente, y después del corte no quedan fichas así. ¿Cambiamos la respuesta?
  1. **Sí, en `V5`**: la sección VIP y su test pasan a 404. Costo bajo. **Recomendada**.
  2. **Queda como rama muerta con una nota.** Riesgo: contrato y diseño dicen lo contrario.

#### R5-29 · `trial` y las tablas de sólo agregar no dicen si llevan `deleted_at` · BAJA

- **Piezas**: `BD-029`.
- **Diseño**: un trigger rechaza todo `DELETE` sobre `trial` (`V/docs/02-modelo-de-datos.md` §5, líneas 931-939).
- **Código**: `BaseModel.softDelete` estampa `deleted_at` en toda tabla que la tenga (`packages/db/src/base/base.model.ts:642`).
- **Quién corrige**: el diseño. Unidad `V4`.
- **Pregunta**: la tabla que recuerda que Juan ya usó su prueba gratis no se puede borrar. Pero *«borrar suave»* es marcar una fecha, y eso el candado no lo ve. ¿Decimos que esa tabla no lleva esa fecha?
  1. **Sí: `trial` y las tablas de sólo agregar nacen sin `deleted_at`.** Costo: una línea. **Recomendada**.
  2. **El trigger rechaza también el `UPDATE` de `deleted_at`.** Costo: un trigger más.

### Lote 5 · `B6`

#### R5-27 · `M-2`: las devoluciones de una misma orden van de a una · MEDIA

- **Piezas**: `M-2`.
- **Diseño**: `RF2` dice que si la llamada de devolución de una orden *«exige y respeta la clave, qué devuelve su reenvío y si la relectura de la orden nombra el id de la devolución no está medido»*; `RF3` agrega que si la relectura no nombra el id, la fila *«toma la devolución de la orden de su mismo monto»*, y que con dos del mismo monto decide una persona (`B/docs/03-maquinas-de-estado.md` §6.1). Ninguna de las dos pide serializar.
- **Medido** (`RESULTS-2026-09-30.md`, `EX-58`, sandbox): la clave es obligatoria (`400` sin ella); mismo cuerpo y misma clave devuelven la misma devolución, byte a byte; otro monto con la misma clave da `409`; **el POST devuelve todas las devoluciones de la orden**, así que la nueva sale por resta contra las ya registradas; la relectura trae id y monto de cada una; ninguna trae nuestra clave ni una referencia nuestra. Consecuencia: el id siempre viene, la rama *«de su mismo monto»* ya no hace falta, y dos devoluciones simultáneas sobre la misma orden vuelven ambigua la resta.
- **Quién corrige**: el diseño (`RF2`, `RF3`). Unidad `B6`. Además la nota de `RF2` sobre `RF-6` (*«contesta `200` con el cuerpo vacío y sin el id»*) es del pago; en la orden el reenvío devuelve la misma devolución con su id.
- **Pregunta**: cuando le devolvemos plata a Juan por una compra de única vez, Mercado Pago contesta con la lista de todas las devoluciones de esa compra, no sólo la nueva; la nueva se reconoce comparando con las que ya teníamos anotadas. Si dos devoluciones de la misma compra salen al mismo tiempo, no se sabe cuál es cuál. ¿Las hacemos de a una?
  1. **Serializar por orden, id por resta, y sacar de `RF3` la rama del mismo monto** para órdenes; un `409` es error de programación (clave mal derivada), no *«ya estaba hecha»*. Costo bajo. **Recomendada**.
  2. **Serializar y conservar la rama del mismo monto como respaldo.** Riesgo: un camino que no se ejercita nunca.

### Lote 6 · textos

#### R5-28 · Razones o números caducos bajo conclusiones correctas · MEDIA

- **Piezas**: `BD-007`, `BD-011`, `BD-025`, `BD-028`, `SUP-013`, `API-011` (MEDIA), `AUT-016`.
- **Qué pasa**: en las siete la conclusión del diseño se sostiene y la razón o el número no. Ninguna cambia una unidad; dos confunden a quien implemente literal.

| pieza | el texto dice | el código dice (`origin/staging`) | corrección propuesta |
|---|---|---|---|
| `BD-007` | `owner_user_id` en las fichas, tabla `user` (`V/02` §2.5, §2.2) | `owner_id` (`accommodation.dbschema.ts:134`), tabla `users` | usar los nombres reales |
| `BD-011` | 38 = 28 con FK + 10 con `entity_type` (`V/02` §4.1, `V/20` fila `G-R9`) | 29 con FK + 9 con `entity_type` tras `U1` | corregir el reparto |
| `BD-025` | la foto del paso 6 *«generada de la base de producción»* | el precedente (`0000_baseline.sql`) salió del esquema TypeScript; la guarda de drift compara contra el TypeScript | *«generada por Drizzle desde el esquema del repo y comparada con la base cortada»* |
| `BD-028` | cuatro extras mueven datos (`F-1B-014`) | 17 | corregir el inventario |
| `SUP-013` | `moderation_state` nunca gobernó la visibilidad (`V/21` §2.4) | cierto en Alojamiento; falso en Gastronomía y Experiencia (`commerce-visibility.ts:261`, `:285`) | acotar a Alojamiento |
| `API-011` | sin el 4c la ficha se ve hasta la detección de 48 h (`16-` §4.2, 4c) | el cron purga por tipo, no por ficha, y los listados cada 6 h o menos (`page-revalidation.job.ts:101`, `:195`; `revalidation.service.ts:395-396`) | la página de la ficha y del destino no las purga nunca el cron; el 4c hace más falta, no menos |
| `AUT-016` | *«inhabilitado por abuso»* no tenía columna (`V/17` §1.1) | `banned`, `ban_reason`, `ban_expires` existen y el plugin rechaza la sesión (`user.dbschema.ts:76-81`, `auth.ts:556-562`) | corregir la razón, o decidir que las columnas salen en `U1` |

- **Pregunta**: hay siete frases del diseño cuya conclusión sigue en pie pero cuya razón o número está mal medido. ¿Las corregimos todas de una vez?
  1. **Las siete, como dice la tabla.** Costo: texto. **Recomendada**.
  2. **Sólo las que un implementador lee literal** (`BD-007`, `BD-011`, `BD-025`, `API-011`). Riesgo: razones caducas que el próximo repaso vuelve a encontrar.

## 4. Grupo B · lo corrige el código dentro de su unidad

El diseño está bien y el código no lo cumple: sólo hay que anotarlo en la unidad para que no pase inadvertido. La cita de diseño y de código completa está en la pieza del informe de origen.

| racimo | sev. | piezas | qué anotar | unidad |
|---|---|---|---|---|
| `R5-30` | ALTA | `SUP-002`, `U1-047` | Gastronomía y Experiencia no tienen publicar ni despublicar propio: publicar es pagar (`commerce/protected/start-subscription.ts`) y la visibilidad la pone un reconciliador del cobro (`commerce-visibility.ts:7-14`), que `U1` borra. `V6` construye `PB1`/`PB6` para las dos, no las hereda de Alojamiento. `U1` desengancha la lectura de `entity_subscriptions` (cero filas) | `V6`, `V8`, `U1` |
| `R5-31` | ALTA | `SUP-005` | el lector de la web tiene un conjunto y un plan por usuario, sin vertical (`apps/web/src/lib/entitlements-cache.ts:27-36`); pasa a `usuario + vertical` y lo global como global (`B/19` §3) | `V3`, `V8`, `B13` |
| `R5-32` | ALTA | `SUP-015`, `AUT-027`, `AUT-115`, `SUP-029` | un admin con `ACCOMMODATION_UPDATE_ANY` publica la ficha ajena y le arranca el trial al dueño (`publish.ts:59`; `accommodation.service.ts:1911-1914`, `:1961`), contra `NUCLEO/08` §3 (*«un acto de un actor distinto del dueño nunca es "el dueño publica"»*); el formulario admin expone `lifecycleStatus`/`isPublished`. Publicar sólo lo hace el dueño; la edición ajena (acción 15) sin estado y con aviso | `V5`, `V6`, `V8` |
| `R5-33` | ALTA | `AUT-003`, `AUT-004`, `AUT-125`, `SUP-031` | ningún rechazo impide dar por override o por `role_permission` un permiso *«que viene sólo con el rol»*; asignar `SUPER_ADMIN` lo hace `ADMIN` con `USER_UPDATE_ROLES`, también sobre sí mismo, con motivo opcional. Lista cerrada rechazada en los dos servicios, permiso propio para la acción 26 y motivo obligatorio | `V5` |
| `R5-34` | ALTA | `AUT-005` | el actor de sistema lleva `SUPER_ADMIN` y todos los permisos (`utils/actor.ts:33-38`), y hay uno fabricado a mano en el newsletter; sólo el borde HTTP lo frena. No hereda el rol, o la resolución lo rechaza en toda acción de `NUCLEO/08` §3 | `V5` |
| `R5-35` | ALTA | `AUT-006` | la regla *«actor distinto del sujeto»* no existe en ninguna ruta ni servicio | `V5` |
| `R5-36` | MEDIA | `AUT-101` a `AUT-104`, `AUT-106` a `AUT-114`, `AUT-116` a `AUT-121`, `AUT-124` (20) | las acciones administrativas no tienen permiso propio: usan uno general del cobro viejo (que se va con `U1`) o de Partner. Cada unidad declara el suyo; las marcadas *(der.)* en 01 tienen la unidad derivada y hay que confirmarla al escribir la unidad | `V5` y la unidad de cada acción |
| `R5-37` | MEDIA | `AUT-015`, `AUT-123` | la baja de cuenta de hoy no borra credenciales ni pide motivo | `V8` |
| `R5-38` | MEDIA | `AUT-010`, `AUT-011` | el paso 2 (correo sin verificar) no se chequea y el contrato de errores no tiene fila ni código para él; `V5` elige status y `error.code` dentro del contrato | `V5` |
| `R5-39` | MEDIA | `AUT-013` | el guard `G6` no existe; su inventario inicial está en `AUT-013` | `V5` |
| `R5-40` | MEDIA | `BD-031`, `U1-054` | los 18 extras de billing salen con `U1` (10 no chequean que su tabla exista), y el criterio de salida de `U1` suma *«`db:migrate` + `db:apply-extras` sobre una base vacía, verdes»* | `U1` |
| `R5-41` | MEDIA | `U1-041`, `U1-043`, `U1-049`, `U1-050`, `U1-051`, `BD-026` | lo mecánico de `U1` que el diseño no lista: 16 ensambladores (`types.ts`, `create-app.ts`, `routes/index.ts`, `client.ts`…), el tipo `Money` que usan las notificaciones (y `@repo/billing` en siete `package.json`, no cinco), los 18 usuarios de prueba, 51 archivos de UI, 169 tests, y la exención del guard de dual-write para los planes de demostración | `U1` (la exención, `V2`/`B2`) |
| `R5-42` | MEDIA | `API-002` | la ruta del receptor se monta sólo si billing está configurado (`routes/index.ts:778-784`): un error de configuración da 404 y no el 500 que el proveedor reintenta; el diseño dice *«no hay rato en que la ruta no exista»* | la unidad del receptor (`B/descomposicion.md:129`) |
| `R5-43` | MEDIA | `SUP-004`, `SUP-009`, `SUP-019` | Mi Cuenta, la pricing y el botón de publicar no conocen los estados ni los avisos nuevos (*«sin planes disponibles»*, *«mandar a publicar»*) | `V8`, `B13` |
| `R5-44` | MEDIA | `SUP-023` | la página de Partner revocado contesta 410; pasa a 404 en la API y en la web, y `revokedAt` sirve de bit de moderación mientras `V/18` §1.6 no nombre la columna | `V7` |

## 5. Grupo C · confirmaciones, ausencias esperadas y `DELETE`

### 5.1 Confirmaciones y KEEP (44 piezas)

- **Autorización**: el camino para declarar un permiso (`AUT-001`), `SUPER_ADMIN` con todos por el rol (`AUT-002`), el guest con UUID real (`AUT-007`), lo ajeno contesta 404 (`AUT-008`), la cuenta dada de baja sin sesión (`AUT-014`), Turnstile montado (`AUT-019`), rol y acceso ya separados en datos (`AUT-026`).
- **Base de datos**: `listing` son las tres tablas con dueño no anulable (`BD-006`), las columnas de la tabla de traducción (`BD-008`), `partners.owner_user_id` (`BD-009`), `conversations` con `RESTRICT` (`BD-010`), el trigger de favoritos (`BD-013`), `set_updated_at` automático (`BD-014`), el orden de los tres carriles (`BD-024`), restricciones con precedente (`BD-033`), lo nuevo que no existe todavía (`BD-034`).
- **API**: la ruta y la marca del canal (`API-001`), lo que hereda la ruta (`API-003`), el Worker del borde que falta, con dos precedentes en `infra/cloudflare/` (`API-004`), las etiquetas y la escritura de nacimiento del 4c (`API-012`, `API-013`), el job de alertas (`API-017`), el reconciliador diario que falta (`API-018`). **KEEP** según la plantilla del PDR: factories de rutas y `ResponseFactory` (`API-007`; `createOpenApiRoute` del `CLAUDE.md` raíz no existe), revalidación y `@repo/cache-tags` (`API-014`), huso del mercado en `@repo/utils` (`API-022`), `@repo/logger` (`API-024`); **ADAPT** la raíz de composición (`API-005`).
- **Superficies**: publicar arranca el trial en Alojamiento (`SUP-001`), editores por vertical (`SUP-003`), el 404 indistinguible (`SUP-012`), las citas del 4c (`SUP-021`), la asimetría de columnas (`SUP-022`), el índice común de `partners` (`SUP-025`), la UI pregunta al backend (`SUP-035`); y ausencias esperadas con unidad: pedido de arreglo (`SUP-027`), editores de catálogo (`SUP-028`), panel de cobro (`SUP-032`), alertas y conversaciones sobre `PURGED` (`SUP-033`), los 54 avisos en tres idiomas (`SUP-034`).
- **`U1`**: el camino del receptor sobrevive (`U1-031`), la rama del guard de dual-write y su cableado (`U1-052`), unos 1018 archivos con la palabra a reescribir (`U1-056`), los cinco `package.json` de qzpay (`U1-057`).

### 5.2 `DELETE` por el lote N (42 piezas)

Sin otro argumento, por `16-` §4.6 punto 1 y `B/21` §4: `AUT-020`, `AUT-021`, `AUT-024`; `BD-001` a `BD-005`; `API-025`; `SUP-007`, `SUP-008`, `SUP-D01` a `SUP-D10`; `U1-001` a `U1-021`. La pieza 43, `SUP-D12`, es condicional y va en `R5-05`. Se solapan entre informes sin contradecirse: las tablas (`BD-001`, `BD-002` y `U1-009`), los extras (`BD-004` y `U1-010`), los crons (`API-025`, que cuenta 17, y `U1-003`, que cuenta 20 porque suma `partner-payment-review` y separa dos archivos de `notification-schedule`), la exención por rol (`AUT-020`, `AUT-021` dentro de `U1-004` y del servicio de fichas). `U1` debería partir de la lista por archivo de 05 (`DEL.txt`) y no de las carpetas.

## 6. Cómo se contó

Scripts en el scratchpad de la sesión (`f5c/`), fuera del repositorio.

```text
# 1. Extraer las 200 piezas (id, categoría, severidad, agente) de los cinco informes
python3 extract.py > pieces.tsv          # 01: títulos "### F5-AUT-NNN · CAT · SEV" y filas de tabla;
                                         # 02/03: líneas "- **Categoría**:" / "- **categoría**:";
                                         # 04/05: columna de categoría de las tablas (SUP-D11 no se cuenta, como en 04)
wc -l pieces.tsv                          # 200, sin ids repetidas
cut -f4 pieces.tsv | sort | uniq -c       # 52 / 34 / 25 / 46 / 43
awk -F'\t' '{print $4,$2}' pieces.tsv | sort | uniq -c   # la tabla del §1.1

# 2. Asignar cada pieza (más M-1 y M-2) a un racimo y contar
python3 count.py                          # missing [] dup [] assigned 202 total 202
                                          # A: 13 ALTA, 15 MEDIA, 1 BAJA; B: 6 ALTA, 9 MEDIA; C: 44 + 42
                                          # piezas por grupo: A 65, B 51, C 86
```

La severidad de un racimo es la máxima de sus piezas (`DELETE` y las CONFIRMA de 02 no traen severidad y cuentan como ninguna). Las búsquedas de verificación del §2 son `git show origin/staging:<ruta> | sed -n '<rango>p'` y, para los recuentos, `git grep -l -E '<patrón>' origin/staging -- <ruta>` con control positivo.

## 7. Lo que no pude cerrar

- **Tres conteos de producción** que deciden la urgencia de un racimo y ningún agente corrió: fichas publicadas de cuentas de staff (`R5-18`), promociones con `plan_restricted = true` (`R5-05`), y duplicados de `partners.owner_user_id` (lo necesita la unicidad de `V/02` §2.7). Más el de cuentas con sesión y correo sin verificar (`R5-38`).
- **Si el runner de migraciones de datos tolera filas del registro sin archivo** (`R5-03`, opción 2): no lo leí.
- **El tipo de cambio** (`exchange-rate-fetch` y sus tablas): 02, 03 y 05 lo dejaron abierto; lo puse como pregunta dentro de `R5-05`, sin clasificar.
- **La diferencia 53 contra 49** en `R5-03`: mi recuento por identificador y el grafo de 05 miden conjuntos distintos; no cambia la conclusión.
- **La cuenta de 184 piezas del encargo**: el script da 200 con los totales que declaran los cinco informes; no encontré qué conjunto da 184.

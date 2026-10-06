---
title: "FASES 6 y 7 · 20 · El pase de la FASE 6: KEEP/ADAPT/REWRITE sobre autorización, base y tres guards"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 6
---

# FASES 6 y 7 · 20 · El pase de la FASE 6

- **Qué es**: el pase que eligió el owner en la pregunta **G** (`10-decisiones-del-owner.md`, fila G):
  la plantilla del PDR aplicada a lo que los informes `F5/01` y `F5/02` conservan, y el destino de
  los tres guards que no están en ninguna lista.
- **Criterio**: `DEC-METH-017` punto 3 (la plantilla `KEEP`/`ADAPT`/`REWRITE` sólo sobre lo que el
  diseño conserva de fuera del cobro viejo), con el Eje 2 del punto 4 (lo propio de una vertical,
  en su módulo, no se penaliza por no ser genérico) y el punto 5 (argumento escrito siempre). La
  plantilla es la de la FASE 5 del PDR (`D/00-PDR.md:2466-2504`): **KEEP** sólo si es correcto,
  genérico, bien testeado, usable por las verticales que corresponde y representa el modelo nuevo;
  **ADAPT** sólo si el cambio es pequeño, claro y seguro; **REWRITE** por defecto cuando adaptar es
  costoso, hay deuda, dudas, mezcla de legacy o no hay plena confianza. Desempate de la FASE 6
  (`D/00-PDR.md:2506-2524`): *«ante duda razonable… preferir reescribir»*.
- **Siglas**: `D` = `.specs/HOS-1352-billing-verticals-redesign/docs`, `F5/` = `D/38-fase-5/`,
  `V/` = `.specs/HOS-1353-verticales-capacidades-y-autorizacion`, `L5` = `F5/10-decisiones-del-owner.md`
  (las decisiones del owner en la FASE 5, citadas por lote y letra).
- **Código**: `origin/staging` en `72a6817eb3`, leído con `git show` / `git grep`, nunca el working
  tree. Las líneas de los informes 01 y 02 eran de `35e2d63e81`; donde las volví a medir lo digo.
- **No edita nada más**: ni el diseño, ni el log, ni los informes. Lo que cambia una unidad va en
  «Vuelve al owner».

---

## 1. El conteo

Contado con script sobre los dos informes (el título de sección en 01, la línea
`- **Categoría**:` en 02):

```bash
rg -c '^### F5-AUT-[0-9]+ · (CONFIRMA|ADAPTAR)' F5/01-permisos-y-roles.md   # 14
# 02: se parte el archivo por '### F5-BD-' y se lee la línea '- **Categoría**:' de cada sección
python3 -c "import re;t=open('F5/02-base-de-datos.md').read();print(sum(re.search(r'Categoría\*\*: (CONFIRMA|ADAPTAR)\b',s) is not None for s in re.split(r'\n(?=### F5-BD-)',t)))"  # 15
```

**29, como dice la propuesta**: 14 de autorización (`AUT-001`, 002, 003, 004, 005, 007, 008, 010,
014, 015, 018, 019, 026, 027) y 15 de base (`BD-006`, 008, 009, 010, 012, 013, 014, 018, 024, 025,
026, 030, 031, 032, 033).

**Seis más que el conteo no ve**: la tabla de las 25 acciones de 01 (§3) tiene seis filas
`ADAPTAR` (`AUT-105`, 113, 115, 122, 123, 125) que el patrón de títulos no cuenta. Cinco son la
misma pieza que una del conteo vista desde una acción; las veo en el §4 para que no queden sin
veredicto.

**Cuatro de las 29 ya no las conserva el diseño**: después de los informes, el owner decidió
retirarlas en los lotes de la FASE 5 (`BD-012` y `BD-030` en el lote 3 C, `BD-032` en el lote 1 F;
y `AUT-018` dejó de ser la base de `PP1` en el lote 4 A). No se les aplica la plantilla: se
registran con la decisión que las saca.

| veredicto | piezas |
|---|---|
| **KEEP** | 13 (7 de autorización, 6 de base) |
| **ADAPT** | 11 (5 de autorización, 6 de base) |
| **REWRITE** | 1 |
| ya no se conserva (decisión del owner en la FASE 5) | 4 |
| **total** | **29** |

---

## 2. Autorización (`F5/01`)

### 2.1 Remendar o reescribir el núcleo

La propuesta lo planteó como la pregunta de la FASE 6: el núcleo se conserva con tres `ADAPTAR`
ALTA. Lo medí pieza por pieza, porque «el núcleo» son cinco piezas con historias distintas:

| pieza del núcleo | qué paso de la cadena de `V/17` §1.2 hace hoy | tests en `origin/staging` | lectura |
|---|---|---|---|
| la resolución del actor (`apps/api/src/middlewares/actor.ts:355-390`) | arma el conjunto efectivo: atajo de `SUPER_ADMIN`, y si no, unión de roles más overrides menos denegaciones | `apps/api/test/middlewares/actor.resolution.test.ts` (18 casos), `actor.test.ts` | es el modelo de `V/17` §4.2 al pie de la letra; le falta una resta |
| la puerta HTTP (`apps/api/src/middlewares/authorization.ts`) | pasos 1 (401 al guest) y 3 (permiso, `passesPermissionGate`) | `authorization.test.ts` (34), `utils/error-contract.guard.test.ts` | correcta; le faltan el paso 2 y la regla 5, que son piezas nuevas que se insertan |
| la propiedad (`apps/api/src/middlewares/ownership.ts:263`) | paso 4, con 404 idéntico al de «no existe» | `ownership.test.ts` (19), `ownership.contract.test.ts`, `ownership-fetcher-coverage.guard.test.ts` | correcta; el salto por `_ANY` es la parte a cambiar |
| la escritura de permisos y roles (`permission.service.ts:96`, `:160`; `user-role.service.ts:185`, `:264`) | alimenta el conjunto | diez archivos en `packages/service-core/test/services/permission/`, `user-role.service.test.ts`, `user-role.transaction-errors.test.ts`, `routes/user/admin/roles.test.ts` (16) | correcta en lo que hace; le faltan dos rechazos |
| el actor de sistema (`apps/api/src/utils/actor.ts:33-38`) | ninguno: es un actor fabricado que se salta la cadena entera | **ninguno**: ningún test nombra `createSystemActor` salvo dos de servicios del cobro viejo, y la barrera de `authorization.ts:161` no la ejerce ningún test (`git grep` de `system_actor_rejected`, `_isSystemActor` en `authorization.test.ts`: 0) | es lo contrario del modelo |

**El chequeo de permisos es una sola función.** En `service-core` todo permiso se mira con
`hasPermission` (`packages/service-core/src/utils/permission.ts:89`: `actor.permissions.includes(p)`),
272 llamadas en 51 archivos. Así que lo que decide si un actor puede algo es **sólo** el conjunto
que la resolución le arma; la forma de las verificaciones no hay que tocarla. Eso separa el costo
en dos:

- **Remendar la cadena cuesta poco y no deja «una mitad vieja»**: la cadena de hoy ya es la del
  diseño en los pasos 1, 3 y 4 (los informes lo confirman en `AUT-007`, 008, 026), con tests y
  guards propios. Los tres `ADAPTAR` ALTA de la cadena (`AUT-003`, `AUT-004`) son rechazos que
  faltan en dos servicios y un permiso que falta en una ruta. Reescribirla daría lo mismo con más
  riesgo: 26 rutas usan `bypassPermission`, y todas las rutas protegidas pasan por
  `authorization.ts`.
- **El actor de sistema no se puede remendar sin dejar la mitad vieja**, por tres razones medidas:
  1. **Falla abierto por construcción**: `permissions: Object.values(PermissionEnum)`. Un remiendo
     del tipo *«todos menos la lista de las 25 acciones»* conserva esa dirección: todo permiso que
     se agregue después le llega al sistema salvo que alguien se acuerde de sumarlo a la lista.
  2. **No hay un actor de sistema, hay unos treinta**: la fábrica, con 4 llamadas (dos las borra
     `U1`: `usage-tracking.service.ts` por la lista explícita y `services/billing/trial-local-expiry.service.ts`
     por carpeta; `accommodation-winback-republish.service.ts` no lo verifiqué); **9 literales en el
     newsletter** con `roles: ['SUPER_ADMIN'] as never` y todos los permisos, **sin** la marca
     `_isSystemActor` (`newsletter-subscriber.service.ts:707`, `:929`, `:1329`, `:1490`, `:1646`,
     `:1753`; `newsletter-campaign.service.ts:1217`; `newsletter-delivery.service.ts:313`;
     `newsletter-tracking.service.ts:120`); **17 literales de conversaciones** con rol `ADMIN`,
     diez permisos `CONVERSATION_*` y la marca (en rutas de `apps/api/src/routes/conversations/**`,
     dos crons y `conversation.service.ts:406`); y uno en `refresh-external-reputation.job.ts:52`.
     Contado con `git grep` de `id: '00000000-0000` y de `SYSTEM_ACTOR` fuera de tests: 31 literales.
     Un remiendo en la fábrica no alcanza a los nueve del newsletter, que son los que tienen todos
     los permisos.
  3. **Lleva el rol `SUPER_ADMIN`**, así que todo predicado por rol (los cinco `roles.includes(`
     que `AUT-013` inventaría) lo trata como el dueño de la plataforma. El enum ya tiene el rol que
     corresponde, `RoleEnum.SYSTEM` (`packages/schemas/src/enums/role.enum.ts:60`), no asignable
     (`NON_ASSIGNABLE_ROLES`).

  El diseño pide lo contrario en las dos cosas: *«Un actor de sistema no puede ejecutar ninguna de
  las veinticinco acciones»* y los jobs *«llevan su propio identificador de actor»* (`V/17` §3.3,
  citado en `AUT-005`). No hay nada del actor de hoy que lo represente: **REWRITE**, acotado a la
  fábrica y sus literales. Es la pregunta **H**.

### 2.2 Tabla

| pieza | ubicación en `origin/staging` | veredicto | argumento contra la plantilla | unidad |
|---|---|---|---|---|
| `AUT-001` · declarar un permiso nuevo | `packages/schemas/src/enums/permission.enum.ts`; `PermissionPgEnum` en `packages/db/src/schemas/enums.dbschema.ts`; `r_role_permission.dbschema.ts`; `packages/seed/src/required/rolePermissions.seed.ts`; carril de datos | **KEEP** | Correcto (camino ejercitado por diez migraciones de datos de permisos); genérico (no nombra vertical ni acción); testeado (`permission-naming-convention.guard.test.ts` congela el vocabulario); representa el modelo (*«permiso propio, una por una»*). Su costo (cuatro lugares por permiso) no es incorrección. El lote 1 I de `L5` recrea el enum en `U1` sin los valores del cobro: cambia el contenido, no el mecanismo | cada unidad que construye una acción; el patrón, `V5` |
| `AUT-002` · `SUPER_ADMIN` trae todos los permisos | `apps/api/src/middlewares/actor.ts:355-359` | **KEEP** | Es la mitad *«viene con el rol»* de la regla 1 tal cual; testeado en `actor.resolution.test.ts`; genérico. La otra mitad (*«no se da suelto»*) es `AUT-003`, y se resuelve sin tocar este atajo | `V5` |
| `AUT-003` · un permiso «sólo `SUPER_ADMIN`» se puede dar suelto | `permission.service.ts:160-215` (el único rechazo es un destinatario con `SUPER_ADMIN`, `:190`) y `:96`; suma de grants en `actor.ts:381-388` | **ADAPT** | La unión menos denegaciones es el modelo; lo que falta es una lista cerrada rechazada en `assignPermissionToUser` y `assignPermissionToRole`. **Condición para que sea seguro**: la lista también **se resta en la resolución** (`actor.ts`, rama no-`SUPER_ADMIN`, donde ya se restan las denegaciones en `:388`), porque `role_permission` es editable en vivo y producción puede ya tener una fila así (`F5/01`, *«lo que no pude cerrar»*); rechazar sólo al escribir deja pasar lo que ya está escrito. Con la resta, son dos rechazos y una resta en tres archivos con suites propias: pequeño, claro y seguro | `V5` |
| `AUT-004` · asignar o quitar `SUPER_ADMIN` | `apps/api/src/routes/user/admin/roles.ts:109`, `:176` (`USER_UPDATE_ROLES`); `packages/schemas/src/entities/user/user-role.schema.ts:175-180` (motivo `.optional()`); `user-role.service.ts:185`, `:264`; registro `user_role_audit` en la misma transacción | **ADAPT** | El registro append-only con actor, sujeto y motivo ya es el que pide la fila 26 (KEEP de esa parte). Falta: permiso propio de la acción 26 (de la lista de `AUT-003`) cuando el rol es `SUPER_ADMIN`, motivo obligatorio en ese caso y el rechazo de `actor = sujeto`. Tres cambios en una ruta y un servicio con 16 + 2 suites. El segundo camino, `set-role` del plugin de Better Auth, ya sale por el lote 4 C y el lote de la aplicación L de `L5` | `V5` |
| `AUT-005` · el actor de sistema | `apps/api/src/utils/actor.ts:33-38`; 31 literales (§2.1) | **REWRITE** | Falla las cinco condiciones que importan: no representa el modelo (lleva el rol y todos los permisos que el diseño le niega), no está testeado (ninguna prueba lo nombra ni ejerce la barrera HTTP), y no es una pieza sino una fábrica y treinta copias. Remendarlo conserva la dirección que falla abierto (§2.1). Lo que se reescribe es chico (una fábrica con rol `SYSTEM`, identificador por job y permisos explícitos) y la migración de los literales es mecánica. **Vuelve al owner: H** | `V5` |
| `AUT-007` · el guest es un actor con UUID real | `apps/api/src/utils/actor.ts:45-48` (`isGuestActor`); `authorization.ts` rama `protected` | **KEEP** | Correcto y fijado por el contrato de errores y su guard (`error-contract.guard.test.ts`, `protected-routes-resolve-session-actor.test.ts`); genérico. El detalle de `alliance-lead.service.ts` que identifica por conjunto de roles queda fuera del programa (lote 4 A: `alliance_leads` es para los otros tipos) | `V5` |
| `AUT-008` · lo ajeno contesta 404 | `ownership.ts` rama no-dueño (404 byte a byte igual); `apps/api/docs/error-contract.md` | **KEEP** | Correcto, genérico y con tres suites (`ownership.test.ts`, `ownership.contract.test.ts`, `error-contract.guard.test.ts`). La excepción VIP que lo contradecía es `AUT-009` y el lote 4 D ya la manda a 404 en `V5`: eso cambia una rama de `checkCanView`, no este mecanismo | `V5` |
| `AUT-010` · el contrato no tiene escalón para el paso 2 | `apps/api/docs/error-contract.md` (orden y tabla); `apps/api/src/utils/http-error-codes.ts` | **ADAPT** | El contrato es correcto y está vigilado; le falta una fila y un código. Es un cambio de documento y de una tabla de constantes, más el caso que el guard del contrato tiene que conocer: pequeño y claro | `V5` |
| `AUT-014` · una cuenta dada de baja no crea sesión ni la conserva | `apps/api/src/lib/auth.ts` (hook `session.create.before`); `apps/api/src/middlewares/auth.ts` (re-chequeo de `deleted_at`); `user.service.ts` (`_afterSoftDelete`) | **KEEP** | Correcto en las tres capas, genérico, testeado (`auth.deleted-user.test.ts`) y es lo que el diseño cita como hecho (H-163) | `V8` |
| `AUT-015` · la baja de hoy no borra credenciales | `apps/api/src/routes/user/admin/delete.ts` → `userService.softDelete` | **ADAPT** | Lo que se conserva (el `deleted_at` y la revocación de sesiones) es `AUT-014`, KEEP. Lo que falta de la acción 24 son piezas aditivas: el borrado de filas de `accounts` en la misma transacción, el motivo, el permiso propio y las precondiciones (`puedeCobrarle`, fichas, presencia), que son piezas nuevas de otras áreas y se componen, no reemplazan. La ruta es una cáscara de dos líneas: adaptarla es chico | `V8` |
| `AUT-018` · la ruta pública de postulación | `apps/api/src/routes/alliance/public/create-lead.ts` | ya no se conserva | El lote 4 A de `L5` decidió que `PP1` escribe en una tabla nueva, `postulacion`, que construye `V7`, y que `alliance_leads` y esta ruta quedan para los otros tipos, **fuera del programa**. De esta pieza, `PP1` reusa las utilidades (el honeypot, el límite por IP y el Turnstile de `AUT-019`), no la ruta | `V7` |
| `AUT-019` · Turnstile montado y probado | `apps/api/src/utils/turnstile.ts` (`getTurnstileSecret`, `verifyCfTurnstileToken`); usado en `routes/feedback/public/submit.ts` | **KEEP** | Correcto (fail-closed), genérico, testeado (`test/routes/feedback/turnstile-verify.test.ts`, `FeedbackForm.turnstile-gate.test.tsx`), con su variable registrada. Enchufarlo a `PP1` es uso, no cambio | `V7` |
| `AUT-026` · rol y acceso son ejes separados en los datos | `user_role` (varios por cuenta); unión de roles en `actor.ts:355-390` | **KEEP** | El dato ya separa los dos ejes; los que los juntaban (la exención por rol del cobro y la revocación de `HOST` del cron de borradores) se van con `U1` (`AUT-020`, `AUT-021`, y el lote 1 G de `L5`). Testeado con la resolución | `V5` |
| `AUT-027` · el bypass de propiedad por permiso `_ANY` | `ownership.ts:263`; 26 rutas con `bypassPermission`; 61 menciones de permisos `_ANY` en `service-core` | **ADAPT** | El mecanismo (un permiso parametrizado salta el paso 4) es genérico y correcto para las entidades que no son de las 25 acciones (posts, eventos, reseñas) y se queda como está. Cambia sólo en las rutas de ficha que implementan las acciones 15 y 23: el permiso pasa a ser el de la acción y el middleware deja el **sujeto** (el dueño de la fila) en el contexto, para que el paso de cobertura que `V5` agrega (lote 1 A de `L5`) evalúe al dueño y no al admin; la edición ajena no toca el estado (racimo `R5-32`). Es un cambio de valor en pocas rutas y un dato más en el contexto, con tres suites de propiedad detrás | `V5`, `V8` |

---

## 3. Base de datos (`F5/02`)

Ninguna pieza de base nombra una vertical fuera de lo que su tabla es, así que el Eje 2 no entra
en juego salvo en `BD-008` (la asimetría de `accommodations` es real y el diseño la respeta).

| pieza | ubicación en `origin/staging` | veredicto | argumento contra la plantilla | unidad |
|---|---|---|---|---|
| `BD-006` · las tres tablas de ficha, dueño único no anulable | `packages/db/src/schemas/accommodation/accommodation.dbschema.ts`, `gastronomy.dbschema.ts`, `experiences.dbschema.ts` (`owner_id … notNull … onDelete: 'restrict'`) | **KEEP** | Correcto y es el modelo (*«la vertical es la tabla»*); lo que el diseño cambia de la ficha (el estado nuevo, lote 3 A) son columnas, no la tabla ni el dueño. Lo vigila la guarda de drift contra el snapshot. El nombre `owner_user_id` del diseño es `BD-007`, texto | `V6` |
| `BD-008` · las columnas que lee la tabla de traducción | `accommodation.dbschema.ts` (`owner_suspended`, `plan_restricted`, `billing_unpublished_at`, `visibility`, `lifecycle_state`, `moderation_state`, `deleted_at`) | **KEEP** (transitorio) | Se conservan sólo como **entrada** de la migración del paso 3, que las lee una vez y las borra (lote 3 A y B de `L5`); para eso son correctas y están medidas valor por valor. No se les pide *«representa el modelo»* porque el modelo las reemplaza en el mismo despliegue | `V6` |
| `BD-009` · `partners.owner_user_id` anulable, índice común | `packages/db/src/schemas/partner/partner.dbschema.ts` (`owner_user_id`, `partners_ownerUserId_idx`) | **ADAPT** | La columna es la del modelo; le falta el `UNIQUE … WHERE owner_user_id IS NOT NULL`. El riesgo que `F5/02` no pudo medir (duplicados en producción) no existe: hoy hay cero partners (`V/docs/18-partner.md` §2.1). Una restricción sobre una tabla vacía: pequeño y seguro | `V7` |
| `BD-010` · `conversations` apunta a la ficha con `RESTRICT` | `packages/db/src/schemas/conversation/conversations.dbschema.ts` | **ADAPT** | El diseño ya lo dice (*«Hoy es `onDelete: restrict` y no anulable»*) y lo cambia la unidad de `PURGED`. Una columna a anulable: pequeño | `V6` |
| `BD-012` · rutas de borrado de fichas fuera del diseño | `apps/api/src/routes/{accommodation,gastronomy,experience}/admin/{delete,hardDelete,restore}.ts`; `accommodation/protected/softDelete.ts` | ya no se conserva | El lote 3 C de `L5` (racimo `R5-17`, opción 1) retira todas: el borrado del dueño pasa a `PB12`, el del equipo a la acción 23 y desaparece el borrado físico | `V6`, `V5`, `V8` |
| `BD-013` · `users.deleted_at` y el trigger de favoritos | `packages/db/src/migrations/extras/003-delete-entity-bookmarks.trigger.sql` | **ADAPT** | Correcto y genérico, pero **sin test**: `git grep` de `delete_entity_bookmarks` en tests sólo encuentra los `global-setup` que lo aplican, y ningún test de favoritos (`user-bookmark.integration.test.ts`, `real-user-scenarios.test.ts`) escribe `deleted_at`. La adaptación es una prueba, no código: la acción 24 tiene que afirmar que los favoritos sobre la cuenta se borran, y esa prueba ya es de la unidad que la construye. Nota: la mitad de `accommodations` queda sin disparador en el modelo nuevo (*«ninguna transición escribe `deleted_at`»*); no hace daño y no se toca | `V8` |
| `BD-014` · `set_updated_at` se engancha solo a las tablas nuevas | `extras/002-set-updated-at.trigger.sql` (recorre `information_schema.columns`) | **ADAPT** | Correcto y genérico; **sin test** propio (misma búsqueda). La adaptación es una prueba: que una tabla recién creada reciba su trigger después de `db:apply-extras`. Entra en un criterio que ya existe (las bases de test pasan a `db:migrate` por el lote 2 C, y `U1` suma *«`db:migrate` + `db:apply-extras` sobre una base vacía, verdes»*), así que no cambia el alcance de nadie; va con la primera tabla nueva | `V1` |
| `BD-018` · `partners.subscription_status` y `partners.tier` | `partner.dbschema.ts` (`tier`, `subscription_status`); cinco filtros en `packages/db/src/models/partner/partner.model.ts` | **ADAPT** | `subscription_status` sale con `U1` (lote 1 D y lote de la aplicación H de `L5`). **`tier` no está en ninguna lista**: sigue `notNull`, indexada y leída por `routes/partners/public/get-by-slug.ts` y las tres `mine*` (medido hoy). En el modelo, Gold o Silver es el plan y lo que se ve lo decide la clave; una columna `tier` que sobrevive es una segunda verdad. La adaptación (sacarla con sus lectores) es chica, pero cambia el alcance de una unidad: **vuelve al owner: J** | `V7` |
| `BD-024` · los tres carriles y su orden | `scripts/server-tools/src/commands/db-migrate.ts`, `db-seed-migrate.ts`; runner de `packages/seed/src/data-migrations/` | **KEEP** | El orden existe, es el que el diseño supone y está ejercitado en producción (125/125 y 105/105, `F-1B-015`). Las dos grietas que `F5/02` encontró alrededor (`BD-020`, `BD-021`) ya las resolvió el owner en el lote 2 C y D de `L5` sin tocar el orden | `V6` |
| `BD-025` · la foto del paso 6 tiene precedente | `packages/db/src/migrations/0000_baseline.sql`; `scripts/check-schema-drift.sh` | **KEEP** | El mecanismo (Drizzle genera desde el esquema del repositorio, la guarda de drift compara) es correcto y testeado (`scripts/__tests__/check-schema-drift.test.ts`). Lo que estaba mal era el texto del diseño, ya corregido en `DEC-ARCH-012` (*«la genera Drizzle desde el esquema del repositorio»*, `F5/18-aplicacion-log-y-matriz.md:68`) | `V6` |
| `BD-026` · la rama de billing del guard de dual-write | `scripts/check-seed-dual-write.sh:269-282`, `:335` | **ADAPT** | El guard es correcto y testeado (`scripts/__tests__/check-seed-dual-write.test.ts`); se le saca una lista de seis archivos y se le suma una exención. Pequeño y claro, y ya asignado (racimo `R5-41`) | `U1`; la exención, `V2`/`B2` |
| `BD-030` · la ruta de borrado físico de usuarios | `apps/api/src/routes/user/admin/hardDelete.ts` | ya no se conserva | El lote 3 C de `L5` (`R5-17`, opción 1) retira también el borrado físico de cuentas | `V8`, `V4` |
| `BD-031` · el aplicador de extras y el criterio de `U1` | `packages/db/scripts/apply-postgres-extras.mjs` | **KEEP** | El script es correcto, genérico e idempotente, y lo corren los `global-setup` de integración de `packages/db` y `apps/api`. Lo que había que cambiar no era el script sino el criterio de `U1`, y ya se sumó (`R5-40`) | `U1` |
| `BD-032` · `is_featured` de las fichas | `accommodation.dbschema.ts`, `gastronomy.dbschema.ts`, `experiences.dbschema.ts` | ya no se conserva | El lote 1 F de `L5` la retira en `U1` en las tres tablas | `U1` |
| `BD-033` · las formas de restricción ya tienen precedente | `social_credentials.dbschema.ts` (índice único parcial); `pgEnum`; `check()` de Drizzle; carril de extras | **KEEP** | Son herramientas, no lógica: correctas, genéricas y usadas en el repositorio. Nada del modelo pide otra | todas las que crean tablas |

---

## 4. Las seis filas de acciones que el conteo no ve

| fila | es la pieza | veredicto |
|---|---|---|
| `AUT-125` · acción 26 | `AUT-004` | **ADAPT**, con `AUT-004` |
| `AUT-115` · acción 15 | `AUT-027` | **ADAPT**, con `AUT-027` |
| `AUT-123` · acción 24 | `AUT-015` | **ADAPT**, con `AUT-015` |
| `AUT-122` · acción 23 | la ruta admin de borrado de ficha (`BD-012`) | ya no se conserva: la retira el lote 3 C, y la acción 23 es nueva |
| `AUT-105` · acción 5 | la aprobación sobre `alliance_leads` (`AUT-018`) | ya no se conserva: `postulacion` es nueva (lote 4 A) |
| `AUT-113` · acción 13 | tres permisos de moderación, uno de ellos (`COMMERCE_MODERATION_CHANGE`) entre los siete `commerce.*` que borra `U1` | **ADAPT**: un permiso con dos niveles para ficha y presencia; declararlo es `AUT-001` |

No cambian el conteo: ninguna agrega un `REWRITE`.

---

## 5. Los tres guards sin destino

### 5.1 Lo que decide el destino, antes que la opinión de nadie

**`G8`, que construye `U1`, los pone en rojo a los tres.** `G8` falla si aparece, sin distinguir
mayúsculas, el nombre del agrupamiento viejo de Gastronomía y Experiencia en **cualquier** archivo
versionado del repositorio, código y comentarios incluidos, con una sola exención (el PDR)
(`V/docs/20-testing.md`, fila `G8`); y `U1` tiene como criterio que `G8` *«nace verde sobre todo el
repo»* (`V/descomposicion.md`, fila de `U1`). Los dos guards de `productDomain` tienen la palabra en
el patrón, en la cabecera y en el mensaje; el del ternario, en la cabecera
(*«commerce vertical»*, `commerceVerticalToProductDomain`) y en el mensaje. **`U1` no puede
terminar sin tocar los tres**, así que dejarlos *«como documentación histórica»* (una de las salidas
que el inventario de la FASE 9 le dejó a la FASE 6) no existe.

### 5.2 El conflicto del ternario, resuelto

Las dos lecturas tienen razón a medias, y la razón del inventario es la que está mal:

- **El inventario** (`D/15-fase-9/04-inventario-de-guards.md:50` y `:137-141`) lo da `MUERE`
  porque *«ancla explícitamente en `ProductDomainEnum` y en `commerce-limits.config.ts`»*. **Leído el
  script, no ancla en ninguno de los dos**: su patrón es `===\s*['"]gastronomy['"][\s\S]{0,200}?\?`
  sobre todo `.ts`/`.tsx` de `apps/api/src`. El enum y el archivo de configuración aparecen sólo en
  la cabecera y en el texto del remedio. El sujeto que vigila (un despacho binario sobre el
  literal de una vertical) **no depende del modelo viejo**: el modelo nuevo tiene cinco verticales y
  una `vertical === 'gastronomy' ? A : B` le contesta `B` a Alojamiento igual que hoy. Es una razón
  caduca bajo una conclusión que tampoco era correcta.
- **La FASE 9** (`D/15-fase-9/01-R6-resuelto.md:844-849`) lo cita como *«la defensa estática que ya
  existe»*. Es cierto hoy y sigue siéndolo después de `U1`, con un defecto: el remedio que imprime
  apunta a `commerceVerticalToProductDomain` / `parseCommerceVertical` de `@repo/billing`, que `U1`
  borra con `packages/billing/src/config/`.
- **Lo que lo reemplaza está en el diseño**: `G1`, de `V1`, falla si *«una pieza nombra una vertical
  sin implementar uno de los ocho ítems del Eje 2»* (`V/docs/20-testing.md`, fila `G1`;
  `D/nucleo/01-…` §4.4). Un ternario binario fuera del módulo de su vertical nombra una vertical sin
  ser un ítem del Eje 2, así que `G1` lo caza y más. Entre `U1` y `G1` no hay otra defensa, y es
  justo la ventana en la que `B1` arranca en paralelo con `V1`.

**Resolución**: se conserva hasta que `G1` exista, con el texto reescrito en `U1`, y lo retira `V1`
cuando `G1` pruebe que caza su caso.

### 5.3 Tabla

| guard | en `origin/staging` | destino | argumento | unidad |
|---|---|---|---|---|
| `check-product-domain-vocabulary.sh` | `scripts/`; `package.json` (`check:product-domain-vocabulary` y dentro de `check:guards`); `ci.yml:289-290` | **lo borra `U1`**, con su script de `package.json`, su entrada en `check:guards` y su paso en `ci.yml` | Su sujeto (`productDomain` contra el literal viejo) desaparece con `U1`; salteando directorios inexistentes, saldría 0 sobre nada. `G8` es estrictamente más amplio (la palabra en todo el repositorio, no sólo junto a `productDomain`), y además el script mismo lo pone en rojo. No tiene test propio que borrar | `U1` |
| `check-product-domain-raw-sql.sh` | ídem (`check:product-domain-raw-sql`; `ci.yml:291-292`) | **lo borra `U1`**, igual | Mismo argumento, con `product_domain` en SQL crudo y seeds. `G8` también lo subsume: mira todo archivo versionado, que es más de lo que este mira | `U1` |
| `check-no-binary-vertical-ternary.sh` | ídem (`check:no-binary-vertical-ternary`; `ci.yml:331`) | **se conserva hasta `G1`**: `U1` reescribe su cabecera y su mensaje (sin la palabra vieja, y con el remedio *«un `switch` exhaustivo con `default` que falla»* en lugar de los helpers borrados), sin tocar patrón ni alcance; **`V1` lo retira** en el mismo PR en que `G1` entra, con el caso de `HOS-1079` (`x === 'gastronomy' ? A : B` en código compartido) entre los que hacen fallar a `G1` | Sujeto vivo en el modelo nuevo (§5.2); única defensa entre `U1` y `G1`; retirarlo antes deja la ventana abierta y conservarlo después duplica a `G1`. **Cambia el alcance de `U1` y de `V1`: vuelve al owner, I** | `U1`, `V1` |

---

## 6. Vuelve al owner

Tres preguntas, en lote. Continúan las letras de `10-decisiones-del-owner.md` (A a G). Filtradas
contra `DEC-MIG-007` (*«las premisas del corte»*): ninguna toca el corte.

### H · El actor de sistema: reescribirlo o remendarlo (`AUT-005` «actor de sistema omnipotente»)

**El problema**: el actor que usan los jobs es un `SUPER_ADMIN` con todos los permisos, y no es uno
solo: hay una fábrica y unos treinta copiados a mano, nueve de ellos con todos los permisos y sin la
marca que la barrera HTTP mira. El diseño dice que un job no puede ejecutar ninguna de las 25
acciones administrativas; hoy puede todas, y ningún test lo prueba.

1. **Reescribir la fábrica** en `V5`: rol `SYSTEM` (ya existe y no se puede asignar), un
   identificador por job, los permisos que cada job usa escritos uno por uno, y la fábrica rechaza
   al construirse cualquiera de los permisos de las 25 acciones; un guard nuevo falla si aparece un
   actor con `_isSystemActor` o con `Object.values(PermissionEnum)` fuera de la fábrica; los
   literales de hoy pasan a la fábrica; y la cadena, además, rechaza `_isSystemActor` en las 25
   acciones (dos capas). Costo: unos treinta sitios, casi todos mecánicos, más averiguar qué
   permisos usa cada job del newsletter; `V5` crece. Riesgo: un job que usaba un permiso sin
   saberlo deja de poder, y falla **cerrado** con un error de permiso que el test o el log
   muestran. **(Recomendada)**: es lo único que cumple *«no puede ninguna»* por construcción y no
   por lista; y el costo es de migración mecánica, no de diseño.
2. **Remendar**: la fábrica da todos los permisos **menos** una lista con los de las 25 acciones, y
   los nueve del newsletter pasan a la fábrica; el rol `SUPER_ADMIN` queda. Costo: unos diez sitios.
   Riesgo: falla **abierto** por defecto (todo permiso nuevo le llega al sistema salvo que alguien lo
   sume a la lista) y todo predicado por rol lo sigue tratando como dueño de la plataforma.
3. **Sólo la cadena**: la resolución rechaza `_isSystemActor` en las 25 acciones y el actor queda
   como está. Costo: mínimo. Riesgo: los nueve del newsletter no llevan la marca y pasan; la
   defensa depende de que cada actor futuro se acuerde de ponérsela.

**Con Juan**: Juan, un anfitrión, está al día. Un cron que relee suscripciones tiene un error y
llama al servicio de cancelar (acción 8) sobre la de Juan. Con la 1 el servicio le contesta *«sin
permiso»* al cron y Juan no se entera; con la 2 lo frena sólo si la lista estaba completa; con la
3, sólo si ese cron usaba un actor con la marca.

### I · Los tres guards sin destino (`check-product-domain-*` «guards del dominio viejo» y `check-no-binary-vertical-ternary` «guard del ternario»)

**El problema**: ninguna lista les da destino, y `G8`, que `U1` tiene que dejar verde en todo el
repositorio, los pone en rojo a los tres porque nombran la palabra vieja. Dos vigilan un vocabulario
que `U1` borra; el tercero vigila un error (el despacho binario por vertical) que el modelo nuevo
puede volver a escribir, y es la única defensa contra él hasta que `V1` construya `G1`.

1. **`U1` borra los dos del dominio viejo** con su cableado en `package.json` y `ci.yml`, y
   **reescribe el texto del ternario** sin la palabra ni los helpers que borra, sin tocar su
   patrón; **`V1` lo retira** en el mismo PR en que entra `G1`, con el caso de `HOS-1079` entre los
   que hacen fallar a `G1`. Costo: dos borrados y un texto en `U1`; un caso de prueba y un borrado
   en `V1`. Riesgo: bajo, sin ventana. **(Recomendada)**: `U1` no puede terminar sin tocarlos, y
   así el ternario cubre exactamente el tramo en que nada más lo cubre.
2. **`U1` borra los tres.** Costo: el menor. Riesgo: entre `U1` y `G1` no hay defensa, y en ese
   tramo `B1` y las primeras unidades de cobro escriben código que elige por vertical.
3. **El ternario se conserva para siempre, junto a `G1`.** Costo: dos guards superpuestos que
   mantener. Riesgo: que diverjan y uno quede verde sobre algo que el otro ya no mira.

**Con Juan**: en una unidad de cobro alguien escribe `vertical === 'gastronomy' ? planGastro :
planExperiencia` para elegir el plan de una suscripción. Juan es de Alojamiento. Con la 1 o la 3 el
PR queda rojo antes de entrar; con la 2, si `G1` todavía no existe, Juan termina con un plan de
Experiencia y nadie lo ve hasta que le cobren.

### J · La columna `tier` de Partner (`BD-018` «tier de Partner huérfano»)

**El problema**: `U1` borra las seis columnas de pago de `partners`, pero `tier` (Gold o Silver) no
está en ninguna lista: sigue obligatoria, indexada y leída por la página pública y las tres rutas
del socio. En el modelo nuevo, Gold o Silver es el plan y lo que se ve lo decide la clave; si la
columna queda, hay dos verdades.

1. **`V7` la borra con su migración**, junto con `starts_at` y `ends_at` (como ya decidió el lote O
   de `L5`), y sus lectores pasan a la clave. Costo: una columna, su índice y unos nueve lectores.
   Riesgo: bajo; hoy hay cero partners. **(Recomendada)**: es la misma unidad, la misma migración y
   el mismo motivo que la decisión O.
2. **Queda como dato descriptivo, sin decidir nada**, y `V7` sólo le saca los lectores que deciden
   visibilidad. Costo: menor. Riesgo: dos verdades que el panel muestra; un día la columna dice
   Gold y la clave, Silver.
3. **`U1` la borra.** Costo: el mismo que la 1, antes. Riesgo: `U1` crece con algo que no es del
   cobro viejo (la columna es de la plataforma), que es lo que el criterio de `U1` evita.

**Con Juan**: Juan, anfitrión, además es socio Gold y un día baja a Silver. Con la 1 su página
propia se apaga porque la clave de Gold ya no está; con la 2, el panel sigue diciendo *«Gold»* al
lado de una página que ya no existe.

---

## Key Learnings

1. **«El núcleo de autorización» eran cinco piezas, y sólo una es lo contrario del modelo**: la
   resolución, la puerta HTTP, la propiedad y la escritura de permisos hacen los pasos 1, 3 y 4 de
   la cadena del diseño con suites propias, y se remiendan con dos rechazos y una resta; el actor de
   sistema no tiene test y falla abierto por construcción. Remendar todo o reescribir todo eran las
   dos respuestas equivocadas.
2. **El chequeo de permisos es una sola función** (`hasPermission`, `includes` sobre el conjunto;
   272 llamadas en 51 archivos): todo el poder de un actor está en el conjunto que se le arma, así
   que reescribir el actor de sistema no toca ninguna verificación.
3. **«El actor de sistema» son 31 literales**, no una fábrica: 9 del newsletter con todos los
   permisos y sin la marca `_isSystemActor`, que es lo único que la barrera HTTP mira; un remiendo
   en `createSystemActor` no los alcanza.
4. **Un rechazo al escribir no alcanza cuando la tabla es editable en vivo**: la lista de permisos
   «sólo `SUPER_ADMIN`» tiene que restarse también en la resolución, porque producción puede ya
   tener la fila que el rechazo nuevo impediría escribir.
5. **El inventario de guards de la FASE 9 dio `MUERE` al ternario con una razón falsa**: dice que
   ancla en `ProductDomainEnum`, y el script ancla en el literal `'gastronomy'` sobre
   `apps/api/src`; el enum sólo está en su cabecera. Leer el patrón, no la cabecera, resolvió el
   conflicto con la FASE 9.
6. **`G8` decide el destino de los tres guards antes que cualquier criterio**: nombran la palabra
   vieja en cabecera o mensaje, y `U1` tiene que dejar `G8` verde en todo el repositorio. *«Dejarlo
   como documentación histórica»* no era una salida posible.
7. **Cuatro de las 29 piezas ya no se conservan**: el owner las retiró en los lotes de la FASE 5
   después de que los informes se escribieran; aplicarles la plantilla habría sido clasificar
   código que ya tiene fecha de borrado.
8. **Dos mecanismos de base que el diseño da por buenos no tienen test**: el trigger de favoritos y
   `set_updated_at`; ningún test ejerce su efecto, sólo los `global-setup` los aplican. Por la
   plantilla eso los saca de `KEEP` aunque hagan exactamente lo que el diseño dice.

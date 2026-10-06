# FASE 5 · 01 · Autorización, permisos y roles

- **Área**: autorización, permisos y roles (agente 1 de la FASE 5 de HOS-1352).
- **Código de referencia**: `origin/staging` en `35e2d63e81`, leído con `git show` / `git grep` desde el worktree del programa.
- **Fecha**: 2026-09-30.
- **Criterio**: `DEC-METH-017` (reglas de la FASE 5). Abreviaturas: `V/17` = `HOS-1353/docs/17-autorizacion.md`, `V/18` = `HOS-1353/docs/18-partner.md`, `N/08` = `nucleo/08-auditoria-y-observabilidad.md`, `N/04` = `nucleo/04-invariantes.md`, `16-` = `16-fase-7-del-paraguas.md`. Toda ruta de código es relativa a la raíz del repo en `origin/staging`.

## Resumen

Conteo hecho con script sobre este archivo (ver el pie de la sección *«Cómo se contó»*):

| categoría | piezas |
|---|---|
| CONFIRMA | 7 |
| CONTRADICE | 4 |
| FALTA | 25 |
| ADAPTAR | 13 |
| DELETE | 3 |
| **total** | **52** |

Las 25 acciones administrativas vivas son 25 de esas 52 piezas (§3): 19 FALTA y 6 ADAPTAR; las otras 27 son las secciones F5-AUT-001 a F5-AUT-027. Ninguna tiene hoy un permiso que sea *«de esa acción concreta»*; el mecanismo para declararlos existe (F5-AUT-001), el mecanismo para que un permiso venga *sólo* con el rol `SUPER_ADMIN` no (F5-AUT-003).

**Las ALTA** (7):

- **F5-AUT-003** · ADAPTAR · un override por usuario y la edición de `role_permission` pueden dar **cualquier** permiso a una cuenta que no es `SUPER_ADMIN`: el «permiso que viene sólo con el rol» no tiene dónde apoyarse.
- **F5-AUT-004** · ADAPTAR · asignar `SUPER_ADMIN` (acción 26) lo puede hacer un `ADMIN`, también sobre sí mismo, con motivo opcional.
- **F5-AUT-005** · ADAPTAR · el actor de sistema del código lleva el rol `SUPER_ADMIN` y **todos** los permisos, así que cualquier permiso nuevo de las 25 acciones lo tiene por construcción.
- **F5-AUT-012** · CONTRADICE · el cron de borradores abandonados **revoca el rol `HOST`** al archivar la última ficha del dueño, y con eso el dueño de una ficha `ARCHIVED` pierde el permiso de familia para verla, exportarla y reactivarla.
- **F5-AUT-006** · FALTA · la regla 5 (`actor ≠ sujeto` en toda acción administrativa) no existe en ningún lugar del código.
- **F5-AUT-125** · ADAPTAR · la acción 26 en la tabla de las 25: su base es la ruta de roles de F5-AUT-004.
- **F5-AUT-022** · FALTA · las fichas de cuentas de staff publican hoy por rol (exentas de billing); el diseño retira la exención y no dice qué fuente las cubre en el corte.

---

## 1. El mecanismo de permisos y roles

### F5-AUT-001 · CONFIRMA · BAJA · Declarar un permiso nuevo tiene camino completo

- **Diseño**: cada una de las 25 acciones lleva *«permiso propio, una por una»* (`V/17` §3.2 regla 1, línea 373; `N/08` §3, línea 175: *«Cada acción lleva tres cosas: permiso propio, registro de auditoría, y confirmación explícita»*); y *«renombrar un permiso es mover filas de `role_permission`»* (`V/21` §4, línea 545).
- **Código**: `PermissionEnum` es la fuente (`packages/schemas/src/enums/permission.enum.ts`, 793 valores contados con `rg -c "^\s+[A-Z0-9_]+ = '"`); su espejo es un enum de Postgres (`packages/db/src/schemas/enums.dbschema.ts:171`, `PermissionPgEnum = pgEnum('permission_enum', enumToTuple(PermissionEnum))`); la asignación a roles es `role_permission` (`packages/db/src/schemas/user/r_role_permission.dbschema.ts:7-15`), con su línea base en `packages/seed/src/required/rolePermissions.seed.ts:13` (`ROLE_PERMISSIONS`) y el carril de datos para entornos vivos con precedentes (`packages/seed/src/data-migrations/0072-hos-765-billing-reconciliation-permission.ts`, `0089-hos-981-qr-code-permissions.ts`, y ocho más con `perm` en el nombre).
- **Argumento**: cada permiso nuevo es un valor de enum + una migración estructural del `pgEnum` + la línea base del seed + una migración de datos (regla de dual-write del `CLAUDE.md` raíz). El camino existe y está ejercitado; el costo es que son cuatro lugares por permiso, y un valor nuevo toca guards congelados del paquete de schemas (`packages/schemas/test/enums/permission-naming-convention.guard.test.ts`).
- **Unidad**: cada unidad que construye una acción (tabla del §3); el patrón, `V5`.

### F5-AUT-002 · CONFIRMA · BAJA · `SUPER_ADMIN` trae todos los permisos por el rol

- **Diseño**: *«"De `SUPER_ADMIN`" es un permiso que viene sólo con el rol… lo trae el rol `SUPER_ADMIN`»* (`V/17` §3.2 regla 1, líneas 399-405; `N/08` §3, líneas 234-240).
- **Código**: `apps/api/src/middlewares/actor.ts:355-359`: si la cuenta tiene el rol `SUPER_ADMIN`, `permissions: Object.values(PermissionEnum)`, sin leer `role_permission` ni overrides.
- **Argumento**: todo permiso nuevo que se agregue al enum le llega solo al `SUPER_ADMIN`, sin fila de seed. Es exactamente la mitad *«viene con el rol»* de la regla. La otra mitad (*«y no se da suelto»*) es F5-AUT-003.
- **Unidad**: `V5`.

### F5-AUT-003 · ADAPTAR · ALTA · Nada impide dar suelto un permiso «sólo `SUPER_ADMIN`»

- **Diseño**: *«**Ese permiso no se da suelto**: lo trae el rol `SUPER_ADMIN` y ningún override por usuario lo puede dar, así que un `CLIENT_MANAGER` no llega a fijar precios por un override»* (`V/17` §3.2 regla 1, líneas 402-404); la prueba de `V5`: *«un override que le da a un `CLIENT_MANAGER` el permiso de fijar el precio de un ciclo, o el de cualquiera de las siete filas "sólo `SUPER_ADMIN`", se rechaza»* (`V/descomposicion.md:505`).
- **Código**: dos puertas abiertas.
  - `packages/service-core/src/services/permission/permission.service.ts:160-215` (`assignPermissionToUser`): acepta **cualquier** `PermissionEnum` con efecto `grant`; el único rechazo es que el **destinatario** tenga `SUPER_ADMIN` (`:190`), y escribe la fila en `:211`. `apps/api/src/middlewares/actor.ts:381-388` suma esos grants al conjunto efectivo.
  - `permission.service.ts:96` (`assignPermissionToRole`): edita `role_permission` en vivo, así que un permiso «sólo `SUPER_ADMIN`» agregado al rol `ADMIN` llega a todos los `ADMIN` sin pasar por la acción 26.
  - Las dos exigen `PERMISSION_ASSIGN`, que en la línea base sólo tiene `SUPER_ADMIN` (`rolePermissions.seed.ts:250`); pero `role_permission` es editable en vivo, así que esa línea base no es una garantía.
- **Argumento**: el diseño supone un conjunto de permisos que el override y la edición de roles **no pueden** otorgar. Hoy no existe esa lista ni ese rechazo (búsqueda de ausencia 2). Sin ella, el *«sólo cambia de manos con rastro»* de la acción 26 se esquiva con un override, que no es una fila de `N/08` §3.
- **Qué cambia**: el código. Una lista cerrada de permisos *«que vienen sólo con el rol»*, rechazada en `assignPermissionToUser` y en `assignPermissionToRole`, con un guard que falle si un valor de la lista aparece en la línea base de otro rol.
- **Unidad**: `V5`.

### F5-AUT-004 · ADAPTAR · ALTA · Asignar o quitar `SUPER_ADMIN` (acción 26) ya existe, con otro permiso y sin la regla 5

- **Diseño**: *«asignar o quitar el rol `SUPER_ADMIN` a una cuenta ✚, **sólo `SUPER_ADMIN`**, **con motivo**… Sobre la propia cuenta la rechaza el paso 3»* (`N/08` §3, fila 26, línea 205); *«nadie se da el rol a sí mismo ni se lo quita: lo hace otra cuenta que ya lo tiene»* (`V/17` §3.2 regla 5, líneas 487-490).
- **Código**:
  - `apps/api/src/routes/user/admin/roles.ts:102-130` (grant) y `:169-198` (revoke) exigen `PermissionEnum.USER_UPDATE_ROLES` (`:109`, `:176`), el mismo para **todo** rol.
  - `USER_UPDATE_ROLES` lo tienen `SUPER_ADMIN` y **`ADMIN`** (`rolePermissions.seed.ts:164` y `:624`).
  - El cuerpo acepta `SUPER_ADMIN`: `AssignableRoleEnumSchema` sólo excluye `SYSTEM` y `GUEST` (`packages/schemas/src/entities/user/user-role.schema.ts:20`, `:174-181`), y el motivo es `.optional()` (`:176-180`).
  - `grantRole` / `revokeRole` no reciben al actor como tal ni comparan actor y sujeto (`packages/service-core/src/services/user-role/user-role.service.ts:185-235`; búsqueda de ausencia 3).
  - Lo que sí está: el registro append-only `user_role_audit` con actor, sujeto, acción y motivo, escrito **en la misma transacción** que la mutación (`packages/db/src/schemas/user/user_role_audit.dbschema.ts:25-44`; `user-role.service.ts:217-224`).
- **Argumento**: hoy un `ADMIN` se puede dar `SUPER_ADMIN` a sí mismo, sin motivo, y con eso fijar precios. El registro que pide la fila ya existe y sirve; lo que hay que cambiar es el permiso (uno propio, que venga sólo con el rol), el motivo (obligatorio), y el rechazo de `actor = sujeto`.
- **Qué cambia**: el código. **Unidad**: `V5`.

### F5-AUT-005 · ADAPTAR · ALTA · El actor de sistema es un `SUPER_ADMIN` con todos los permisos

- **Diseño**: *«**Un actor de sistema no puede ejecutar ninguna de las veinticinco acciones del capítulo 08 §3**»* (`V/17` §3.3, línea 501); los jobs *«llevan su propio identificador de actor»* (`V/17` §3.3, línea 499).
- **Código**: `apps/api/src/utils/actor.ts:33-38` (`createSystemActor`): `roles: [RoleEnum.SUPER_ADMIN]`, `permissions: Object.values(PermissionEnum)`, `_isSystemActor: true`. Hay además actores de sistema fabricados a mano sin la marca: `packages/service-core/src/services/newsletter/newsletter-subscriber.service.ts:705-709` (`roles: ['SUPER_ADMIN'] as never`, id `…0001` distinto del de `createSystemActor`). La única barrera es HTTP: `apps/api/src/middlewares/authorization.ts:161-172` rechaza `_isSystemActor` en una ruta. Un cron que llama a un servicio no pasa por ahí.
- **Argumento**: con este actor, cualquier permiso nuevo de las 25 acciones lo tiene el sistema, y la prohibición del §3.3 queda en manos de que ningún job llame al servicio. El diseño pide que el sistema **no** tenga esos permisos; el código le da todos por la misma vía que al `SUPER_ADMIN`.
- **Qué cambia**: el código. El actor de sistema no hereda el rol `SUPER_ADMIN`, o la resolución rechaza `_isSystemActor` en toda acción de `N/08` §3; y los actores fabricados a mano pasan a la fábrica.
- **Unidad**: `V5` (la resolución); las unidades de billing que construyen acciones la heredan.

### F5-AUT-006 · FALTA · ALTA · La regla 5 (`actor ≠ sujeto`) no existe

- **Diseño**: *«**Una acción administrativa nunca tiene `actor = sujeto`: el paso 3 la rechaza** (*«sin permiso»*)»* (`V/17` §3.2 regla 5, línea 456; `N/08` §3, línea 259); prueba de `V5`: *«un `ADMIN` que es además Partner con pago manual no puede registrarse su propia cuota»* (`V/descomposicion.md:602`).
- **Código**: ninguna ruta admin ni servicio compara actor y sujeto (búsqueda de ausencia 3, sobre las rutas de roles, y ausencia de un chequeo genérico en `apps/api/src/middlewares/authorization.ts`, que sólo mira permisos: `:40-68`). La ruta de pago manual de Partner (`apps/api/src/routes/partners/admin/manual-payment.ts:24`) exige `PARTNER_MANAGE` y nada más.
- **Argumento**: es pieza nueva de la resolución; sin ella `D11` se cumple a la letra sin proteger nada, que es lo que la regla vino a cerrar.
- **Unidad**: `V5`.

### F5-AUT-007 · CONFIRMA · BAJA · El guest es un actor con UUID real, y el paso 1 le contesta 401

- **Diseño**: *«el `Guest` del §6 es **un actor del modelo, no la falta de uno**»* (`V/17` §3.3, línea 498); paso 1, *«¿hay un actor autenticado?»* (`V/17` §1.2, línea 71).
- **Código**: `apps/api/src/utils/actor.ts:45-48` (`isGuestActor`: id `00000000-0000-4000-8000-000000000000` o rol `GUEST`); `apps/api/src/middlewares/authorization.ts:186-199` (protegido + guest → 401 con auditoría `ACCESS_DENIED`); `apps/api/docs/error-contract.md:57-66` (R2, y la trampa del UUID real).
- **Argumento**: el modelo coincide. Un detalle: el alta de postulación identifica al anónimo por el conjunto de roles y no por `isGuestActor` (`packages/service-core/src/services/alliance-lead/alliance-lead.service.ts:438-443`), equivalente hoy.
- **Unidad**: `V5`.

---

## 2. El orden, el contrato de errores y el estado de la persona

### F5-AUT-008 · CONFIRMA · BAJA · Lo ajeno contesta 404, byte a byte igual que lo inexistente

- **Diseño**: *«El paso 4 responde "no existe" a las tres cosas»* y *«En el contrato de errores de la API es **404 y no 403**»* (`V/17` §1.2 precisiones 1 y 6, líneas 86-89 y 166-170).
- **Código**: `apps/api/docs/error-contract.md:39-40` (fila *«belongs to somebody else → 404»*), `:120-126` y `:195-212` (las escrituras, `maskForeignRowRefusal`); `apps/api/src/middlewares/ownership.ts:279-290` (404 idéntico al de no encontrado).
- **Argumento**: el diseño cita este contrato y el código lo cumple. La precisión 1 del diseño dice que al **dueño** una ficha `ARCHIVED` le contesta por su estado, no «no existe»; el contrato lo tiene como la excepción 3 (`error-contract.md:222-228`: *«A refusal aimed at the row's OWNER… stays 403»*). Coinciden.
- **Unidad**: `V5`.

### F5-AUT-009 · CONTRADICE · MEDIA · La excepción VIP: una ficha ajena `RESTRICTED` contesta 403

- **Diseño**: *«Cuando el sujeto no es el dueño, el recurso existe sólo si está en un estado público, y la lista es cerrada: una ficha en **`PUBLISHED`**…»* (`V/17` §1.2 precisión 7, líneas 193-199); y el corte manda a `DRAFT` toda ficha activa con `visibility` distinta de `PUBLIC` (`V/21` §2, fila `L6`, línea 240).
- **Código**: `apps/api/docs/error-contract.md:235-254`: *«`checkCanView` … refuses a foreign RESTRICTED listing with 403 'VIP access required', … a standing, deliberate exception to the 404 rule»*, fijada por un test (*«keeps the VIP 403»*) y con la instrucción *«Changing it is an owner decision: edit this section first»*.
- **Argumento**: con la lista cerrada de la precisión 7, una ficha ajena no pública no existe; el código confirma su existencia a propósito. Tras el corte ninguna ficha queda `RESTRICTED` y publicada (`L6`), así que la rama queda muerta; pero el documento del contrato y su test siguen diciendo lo contrario del diseño.
- **Qué corregir**: el código y el contrato (la sección VIP y su test), por decisión del owner como pide el propio documento. **Unidad**: `V5` (y `V6`, que es dueña del estado de la ficha).

### F5-AUT-010 · ADAPTAR · MEDIA · El contrato de errores no tiene escalón ni código para el paso 2

- **Diseño**: el paso 2 (*«estado de la persona»*, correo sin verificar) va **antes** del permiso (`V/17` §1.2, línea 72, y precisión 2, líneas 117-121); su respuesta es *«correo sin verificar»*.
- **Código**: `apps/api/docs/error-contract.md:12-17`: el orden es autenticación (401) → permiso (403) → forma (400) → existencia (404) → reglas de negocio; la tabla (`:34-45`) no tiene fila para una cuenta autenticada con el correo sin verificar, y `apps/api/src/utils/http-error-codes.ts` es la tabla única de códigos que la resolución tendría que usar (`error-contract.md:52-55`).
- **Argumento**: el diseño agrega un escalón entre el 1 y el 2 del contrato y no le da status ni `error.code`. El contrato no lo contradice (no dice nada), pero tampoco lo tiene: hay que escribirlo, y es el lugar donde el orden *«es el contrato»*.
- **Qué cambia**: el contrato y su tabla de códigos. **Unidad**: `V5`.

### F5-AUT-011 · FALTA · MEDIA · El paso 2 (correo sin verificar) no se chequea en ninguna parte

- **Diseño**: el paso 2 rechaza todo lo que no esté en la lista cerrada de la precisión 2 (`V/17` §1.2, líneas 123-132).
- **Código**: el dato está: el actor lleva `emailVerified` (`apps/api/src/middlewares/actor.ts:331-332`, `:362`, `:399`). Sólo lo lee el newsletter (`packages/service-core/src/services/newsletter/newsletter-subscriber.service.ts:610`); `authorization.ts` no lo mira (búsqueda de ausencia 4). La población es chica pero no vacía: con contraseña no hay sesión sin verificar (`apps/api/src/lib/auth.ts:313`, `requireEmailVerification: true`), pero sí por los proveedores externos con vinculación de cuentas (`auth.ts:520-523`) y por las cuentas que crea un admin (`apps/api/src/routes/user/admin/create.ts:68`, `emailVerified: userData.emailVerified ?? false`).
- **Argumento**: pieza nueva de la resolución, con la lista cerrada de excepciones del diseño. No medí cuántas cuentas con sesión viva tienen hoy el correo sin verificar (*«lo que no pude cerrar»*).
- **Unidad**: `V5`.

---

## 2 bis. Rol y acceso

### F5-AUT-012 · CONTRADICE · ALTA · Archivar la última ficha revoca el rol `HOST`

- **Diseño**: *«**Perder el acceso NUNCA revoca un rol.**»* (`V/17` §4.1, línea 664); una ficha `ARCHIVED` *«acepta de su dueño verla, exportarla y reactivarla»* (`V/17` §1.2 precisión 1, líneas 90-93), y lo demuestra `V5` (`V/descomposicion.md:602`); el guard de §4.4 mira sólo *«la máquina de suscripción [y] la de trial»* (`V/17` §4.4, línea 706).
- **Código**: `apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts:301-305` y `:384-390`: al archivar la última ficha no archivada de un dueño, `revokeRole({ role: RoleEnum.HOST, reason: LAST_ACCOMMODATION_ARCHIVED })`. El rol que le queda, `USER`, no tiene ningún permiso de gestión de fichas (`rolePermissions.seed.ts:1403-1450`: sólo reseñas y `BILLING_VIEW_OWN`), y `HOST` es el que los trae (31 líneas `ACCOMMODATION` en `:1057-1206`).
- **Argumento**: el dueño cuya única ficha se archivó pierde en el paso 3 lo que el diseño le promete en el paso 4 y en la versión de piso (`PB8`, exportar, `PB12`). Es la reconstrucción a ojo que el §4.2 razón 3 prohíbe. Y el guard del §4.4 no lo vería: no es una transición de suscripción ni de trial.
- **Qué corregir**: el código (el job, o el que lo reemplace con el reloj de inactividad, no revoca roles) **y** el diseño, si el owner quiere que el guard del §4.4 cubra también la máquina de la ficha. **Unidades**: `V5` (guard), `V6`/`V9` (máquina de la ficha y retención).

### F5-AUT-013 · FALTA · MEDIA · `G6`: el guard de «ninguna autorización decide sólo por rol» no existe

- **Diseño**: `G6` en dos mitades (`V/20` §2, línea 55; `N/04` §2.3, invariantes 12 y 13).
- **Código**: no hay guard de ese nombre ni de ese predicado (búsqueda de ausencia 5). Lo que el guard va a encontrar al nacer, en `apps/api/src` y `packages/service-core/src` (5 archivos con `roles.includes(RoleEnum.`): `apps/api/src/lib/auth.ts:126-138` (etiqueta de analítica, no autoriza), `apps/api/src/middlewares/entitlement.ts:538` (cobro viejo), `apps/api/src/routes/user/protected/entitlements.ts:179`, `apps/api/src/utils/actor.ts:47` (`isGuestActor`) y `packages/service-core/src/services/hostTrade/host-trade-usage.service.ts:72` (`roles.includes(RoleEnum.HOST)`), más los predicados por conjunto de F5-AUT-020 y F5-AUT-021.
- **Argumento**: el guard es nuevo; el inventario de arriba es lo que tendrá que admitir por nombre (`isGuestActor`, la resolución de permisos por rol de `actor.ts`) o reescribir.
- **Unidad**: `V5`.

---

## 2 ter. Sesión, correo y Partner sin cuenta

### F5-AUT-014 · CONFIRMA · BAJA · Una cuenta dada de baja no crea sesión ni la conserva

- **Diseño**: *«**Una cuenta dada de baja no es un actor autenticado**: la acción 24 escribe `user.deleted_at`… y ninguna sesión nace sobre ella»* (`V/17` §1.2 paso 1, línea 71; `N/08` §3 fila 24, línea 203, que cita `apps/api/src/lib/auth.ts`, H-163).
- **Código**: `apps/api/src/lib/auth.ts:684-707` (el hook `session.create.before` rechaza con `ACCOUNT_DELETED` para todo tipo de credencial); `apps/api/src/middlewares/auth.ts:136` (re-chequeo de `deleted_at` en cada request); `packages/service-core/src/services/user/user.service.ts:954-975` (`_afterSoftDelete` borra las sesiones).
- **Argumento**: lo que el diseño leyó en hospeda2 está igual en `origin/staging`.
- **Unidad**: `V8` (acción 24).

### F5-AUT-015 · ADAPTAR · MEDIA · La baja de hoy no borra las credenciales

- **Diseño**: la acción 24 *«**borra las credenciales vinculadas de la cuenta**, la contraseña y las vinculaciones con proveedores externos (las filas de `account`)»* (`N/08` §3 fila 24, línea 203).
- **Código**: `apps/api/src/routes/user/admin/delete.ts:25` y `:34` (`USER_DELETE` → `userService.softDelete`): escribe `deleted_at` y revoca sesiones (F5-AUT-014), y ningún código de `apps/api/src` ni `packages/service-core/src` borra filas de `accounts` (búsqueda de ausencia 6). `USER_DELETE` lo tienen `SUPER_ADMIN`, `ADMIN` y `CLIENT_MANAGER` (`rolePermissions.seed.ts:167`, `:627`, `:886`), y el motivo no se pide.
- **Argumento**: la ruta es la base de la acción 24, y le faltan el borrado de credenciales, el motivo, las precondiciones (`puedeCobrarle`, fichas, presencia) y la seudonimización (esas dos últimas son de otra área).
- **Unidad**: `V8`.

### F5-AUT-016 · CONTRADICE · BAJA · «Inhabilitado por abuso» sí tiene columna

- **Diseño**: *«"Inhabilitado por abuso" sale de la lista: no tenía columna, transición ni acción que lo escribiera»* (`V/17` §1.1, líneas 50-53).
- **Código**: `packages/db/src/schemas/user/user.dbschema.ts:76-81` (`banned`, `ban_reason`, `ban_expires`, del plugin `admin` de Better Auth); el plugin rechaza la sesión de un baneado (`apps/api/src/lib/auth.ts:556-562`), y el panel muestra las tres columnas (`apps/admin/src/features/users/config/users.config.ts:164-175`). Lo único que escribe `banned: true` es el seed del usuario de sistema (`packages/seed/src/required/systemUser.seed.ts:104`); los endpoints del plugin contestan 403 a todos desde HOS-296 (`auth.ts:547-553`).
- **Argumento**: la conclusión del diseño se sostiene (ninguna acción de producto lo escribe) y la razón escrita no: hay columna y hay un control en el paso 1 que la lee. Es la razón caduca bajo una conclusión correcta.
- **Qué corregir**: el texto del diseño (o decidir que las columnas y el control salen). **Unidad**: ninguna la construye; la toca `U1` si se decide borrarla.

### F5-AUT-017 · CONTRADICE · MEDIA · La impersonación está deshabilitada, no descartada: HOS-354 la quiere de vuelta

- **Diseño**: *«**No existe la impersonación.**»* y *«"Entrar como" se va a agregar en una versión posterior, y no es esto»* (`V/17` §3.2 regla 4, líneas 449-455).
- **Código**: el rol del plugin `admin` de Better Auth para `SUPER_ADMIN` y `ADMIN` incluye `'set-role'`, `'ban'` e `'impersonate'` (`apps/api/src/lib/auth.ts:76-89`, `:590-600`); hoy falla cerrado porque el plugin no resuelve el rol (`auth.ts:547-555`). El botón existe y está apagado a la espera de **HOS-354**, *«the issue that restores impersonation»* (`apps/admin/src/features/users/components/ImpersonateButton.tsx:17-22`). El permiso existe: `USER_IMPERSONATE` (`permission.enum.ts:310`), de `SUPER_ADMIN` (`rolePermissions.seed.ts:162`).
- **Argumento**: el código conserva la impersonación entera y una issue abierta para reactivarla; el diseño la prohíbe. Además `'set-role'` en el plugin es un segundo camino para asignar roles fuera de la acción 26 si el plugin vuelve a resolver roles.
- **Qué corregir**: el código (sacar `impersonate` y `set-role` del rol del plugin, retirar el botón y el permiso) y el backlog (HOS-354 se cierra o se reescribe como el *«entrar como»* con actor el admin). Lo decide el owner. **Unidad**: `V5`.

### F5-AUT-018 · ADAPTAR · MEDIA · Postular un Partner: la ruta pública existe, sin Turnstile y sin el paso 2 para quien tiene sesión

- **Diseño**: `PP1` es la segunda excepción del guest, *«una excepción de la cadena, declarada acá, no una ruta exenta»*; *«una cuenta con sesión y el correo sin verificar no postula como guest: … la pantalla le pide verificar el correo antes de postular»*; *«un captcha (Turnstile, que el sitio ya usa) y una sola postulación abierta por correo»* (`V/17` §1.2 precisión 9, líneas 240-255; `V/18` §2.4, líneas 258-261).
- **Código**: `apps/api/src/routes/alliance/public/create-lead.ts:75` (`createPublicRoute`, es decir, ruta exenta), con honeypot y límite de 5 por minuto por IP (`:9-14`) y **sin Turnstile** (búsqueda de ausencia 1); con sesión, el servicio vincula la postulación a la cuenta sin mirar `emailVerified` (`packages/service-core/src/services/alliance-lead/alliance-lead.service.ts:438-443`); el correo tiene sólo un índice, no una unicidad de *«abierta por correo»* (`packages/db/src/schemas/alliance/alliance_lead.dbschema.ts:217`).
- **Argumento**: lo que hay es la base de `PP1`, pero como ruta exenta y sin dos de las tres defensas. La unicidad vive en la entidad nueva `postulacion` (`V/02` §2.7), que es del área de Partner.
- **Unidad**: `V5` (la excepción en la cadena y el paso 2) y `V7` (el formulario con el captcha).

### F5-AUT-019 · CONFIRMA · BAJA · Turnstile está montado y probado en el sitio

- **Diseño**: *«Turnstile, que el sitio ya usa»* (`V/17` §1.2 precisión 9, línea 253).
- **Código**: `apps/api/src/utils/turnstile.ts:33` y `:49` (`getTurnstileSecret`, `verifyCfTurnstileToken`), usado en `apps/api/src/routes/feedback/public/submit.ts:28` y `:223-232` (fail-closed); la variable está registrada (`packages/config/src/env-registry.hospeda.ts`).
- **Argumento**: la pieza de verificación existe y se reusa; lo que falta es enchufarla a `PP1` (F5-AUT-018).
- **Unidad**: `V7`.

---

## 2 quater. Los roles que hoy deciden sobre el cobro

### F5-AUT-020 · DELETE · — · La exención del cobro viejo por rol de staff, en los middlewares de entitlements

- **Lote N** (`16-` §4.6, punto 1: *«todo lo que sólo el sistema viejo usa»*). El diseño lo nombra además: *«El cargador del código de hoy, que le da a `SUPER_ADMIN`, `ADMIN`, `EDITOR` y `CLIENT_MANAGER` el conjunto entero con limits en `-1`… **se retira**»* (`V/17` §4.3, líneas 695-699).
- **Código**: `apps/api/src/utils/staff-roles.ts:39-71` (`STAFF_BILLING_BYPASS_ROLES`, `isStaffBypassRole`), usado sólo por los middlewares del cobro viejo: `apps/api/src/middlewares/entitlement.ts:1092-1108` (y `buildStaffUnlimitedResult`, `:552`), `apps/api/src/middlewares/owner-entitlement.ts:358` y `:785`, `apps/api/src/middlewares/commerce-entitlement.ts:599`, `apps/api/src/middlewares/require-live-subscription.ts:84`.

### F5-AUT-021 · DELETE · — · La exención de billing al publicar, por rol del dueño

- **Lote N** (`16-` §4.6, punto 1): es la rama del *gate* de publicación del cobro viejo (`publishDeps`); y `V/17` §4.3 (*«ningún rol es una fuente»*, líneas 693-699).
- **Código**: `packages/service-core/src/services/accommodation/accommodation.service.ts:262-266` (`BILLING_EXEMPT_ROLES = {ADMIN, CLIENT_MANAGER, SUPER_ADMIN}`), `:276` (`holdsBillingExemptRole`) y sus tres usos (`:1669-1670`, `:1818`, `:1946`).
- **Nota**: el servicio sobrevive y la rama se borra; su consecuencia sobre las fichas de staff es F5-AUT-022.

### F5-AUT-022 · FALTA · ALTA · Las fichas de cuentas de staff pierden la exención y el diseño no dice qué fuente las cubre

- **Diseño**: *«**Y ningún rol es una fuente.** El conjunto efectivo sale **sólo** de las fuentes que devuelve `cobertura()`»* (`V/17` §4.3, líneas 693-695); el corte clasifica las fichas por columnas y estado (`V/21` §2, filas `L1`–`L8`), sin mirar el rol del dueño (`rg -n -i 'staff|exento|exempt|CLIENT_MANAGER' V/docs/21-migracion.md` da cero hits sobre el tema).
- **Código**: hoy una ficha cuyo dueño tiene `ADMIN`, `CLIENT_MANAGER` o `SUPER_ADMIN` publica sin plan ni trial (F5-AUT-021, `accommodation.service.ts:1940-1951`: *«A billing-exempt owner … never starts a trial»*).
- **Argumento**: desde el corte esas fichas resuelven contra la versión de piso, que no otorga publicar: si existen fichas publicadas de cuentas de staff, el reconciliador las baja. Hace falta una decisión (grant a la cuenta de la plataforma en el corte, o aceptar la bajada) y un conteo que no hice (*«lo que no pude cerrar»*).
- **Unidad**: `V6` (clasificación del corte) y `B9` (si la respuesta es un grant).

### F5-AUT-023 · FALTA · MEDIA · Qué permisos del cobro viejo borra `U1`, y con qué migración

- **Diseño**: `U1` borra *«todo lo que sólo el sistema viejo usa»* (`16-` §4.6, punto 1) y, del agrupamiento viejo, *«el rol, sus permisos»* (`16-` §4.6, punto 2; `V/21` §4, línea 545: *«sus siete permisos… con su migración de datos»*). De los permisos del cobro viejo no dice nada.
- **Código**: las rutas admin del cobro viejo se autorizan con permisos gruesos que desaparecen con ellas: `BILLING_MANAGE` (p. ej. `apps/api/src/routes/billing/admin/subscription-comp.ts:149`, `subscription-courtesy.ts:96`, `plans.ts:175`, `plan-price-increase.ts:97`), `MANAGE_SUBSCRIPTIONS` (`apps/api/src/routes/billing/trial.ts:194`), `BILLING_PROMO_CODE_MANAGE` (`apps/api/src/routes/billing/promo-codes.ts:110`, `admin/subscription-trial-extension.ts:126`), `BILLING_RECONCILIATION_MANAGE` (`admin/payment-reconciliation.ts:128`); sus valores viven en `permission.enum.ts:876-881` y `:944-948`, en el `pgEnum` y en filas de `role_permission`.
- **Argumento**: si `U1` borra las rutas y deja los valores, quedan permisos muertos asignables por override (F5-AUT-003); si los borra, es una migración estructural del enum más una de datos, y el diseño no la lista entre lo que `U1` entrega.
- **Unidad**: `U1`.

### F5-AUT-024 · DELETE · — · El rol de dueño de comercio y sus siete permisos

- **Lote N** (`16-` §4.6, punto 2) y `V/21` §4, línea 543: *«el rol de dueño de comercio, sus siete permisos»*.
- **Código**: `packages/schemas/src/enums/role.enum.ts:39` (`COMMERCE_OWNER`); los siete valores `commerce.*` de `permission.enum.ts:1004`, `:1007-1011` y `:1022` (contados con `rg -c "= 'commerce\."`: 7, que confirma el número del diseño).

### F5-AUT-025 · FALTA · MEDIA · La familia de permisos de Partner

- **Diseño**: el paso 3 pregunta *«¿pertenece a la familia de operaciones?»* y *«el rol dice a qué familia de operaciones pertenece la persona»* (`V/17` §1.2, línea 73; §4.2, línea 679); ningún capítulo dice qué rol o permiso tiene el dueño de un Partner (`rg -n -i 'rol.*partner|partner.*rol' V/docs/18-partner.md V/docs/02-modelo-de-datos.md`: cero hits).
- **Código**: las rutas del dueño de Partner no declaran permiso: *«An approved partner is an ordinary account»* (`apps/api/src/routes/partners/protected/mine-stats.ts:11`; `mine.ts:89` y `:111`, `createProtectedRoute` sin `requiredPermissions`), y la propiedad de la fila es el control.
- **Argumento**: el paso 3 no tiene qué preguntar en Partner. O el diseño declara que en Partner el paso 3 es vacuo (la propiedad lo cubre en el 4), o se crea una familia y un rol. Pide decisión.
- **Unidad**: `V5` y `V7`.

### F5-AUT-026 · CONFIRMA · BAJA · Rol y acceso ya son ejes separados en los datos

- **Diseño**: *«el rol dice a qué familia… el estado de acceso dice si hoy puede ejecutarlas. Son dos ejes independientes»* (`V/17` §4.2, líneas 679-681).
- **Código**: los roles viven en `user_role` (varios por cuenta, HOS-296: `apps/api/src/middlewares/actor.ts:288-316`) y los permisos efectivos son unión de roles más overrides menos denegaciones (`actor.ts:366-388`); ningún estado de suscripción vive en la tabla de roles (`packages/db/src/schemas/user/r_user_role.dbschema.ts`).
- **Argumento**: el modelo de datos ya separa los dos ejes; lo que los junta hoy son los predicados por rol de F5-AUT-020/021 (que se borran) y la revocación de F5-AUT-012.
- **Unidad**: `V5`.

### F5-AUT-027 · ADAPTAR · MEDIA · El bypass de propiedad por permiso genérico `_ANY`

- **Diseño**: *«`actor ≠ sujeto` exige un permiso de esa acción concreta, no una condición general de "es administrador"»*; y la acción 15 evalúa los pasos 5 a 7 **sobre el sujeto** (`V/17` §3.2 reglas 1 y 3, líneas 372-373 y 428-434).
- **Código**: `apps/api/src/middlewares/ownership.ts:262-268`: con `bypassPermission` (p. ej. `ACCOMMODATION_UPDATE_ANY`, `permission.enum.ts:147`, de `SUPER_ADMIN` y `ADMIN`: `rolePermissions.seed.ts:18`, `:491`) la ruta salta la propiedad y sigue, sin que nada evalúe cupo sobre el dueño.
- **Argumento**: el `_ANY` es la forma genérica que la regla 1 descarta, y el salto no lleva el cupo al sujeto. Es la base técnica de las acciones 15 y 23, a adaptar.
- **Unidad**: `V5` y `V8`.

---

## 3. Las 25 acciones administrativas vivas

Fuente de diseño de toda la tabla: `N/08` §3, filas 180-205 (la numeración es la de `V/17` §3.2 regla 1; la 16 salió y su número no se reusa). Para cada una: el permiso más cercano que hay hoy, dónde, y qué falta. *«Unidad»* sale de `V/descomposicion.md` y `B/descomposicion.md` §2; donde la asigné por el tema de la unidad lo marco con *(der.)*.

| id | cat. | sev. | acción (`N/08` §3) | lo que hay en el código | argumento | unidad |
|---|---|---|---|---|---|---|
| F5-AUT-101 | FALTA | MEDIA | 1 · otorgar o revocar una cortesía temporal (fila `:180`) | `apps/api/src/routes/billing/admin/subscription-courtesy.ts:96`, `BILLING_MANAGE` (cobro viejo, lote N) | no hay permiso propio; el de hoy es general y sale con la ruta | `B9` *(der.)* |
| F5-AUT-102 | FALTA | MEDIA | 2 · otorgar, anclar o revocar un grant permanente (`:181`) | `apps/api/src/routes/billing/admin/subscription-comp.ts:149`, `BILLING_MANAGE` (lote N) | ídem; `N/04` inv. 30 exige que sea sólo `SUPER_ADMIN` y hoy también es sólo `SUPER_ADMIN` por la línea base (`rolePermissions.seed.ts:336`), pero por un permiso general | `B9` *(der.)* |
| F5-AUT-103 | FALTA | MEDIA | 3 · registrar un pago manual (`:182`) | `apps/api/src/routes/partners/admin/manual-payment.ts:24`, `PARTNER_MANAGE` | permiso de gestión de Partner, no de la acción; sin regla 5 (F5-AUT-006) | `B5` *(der.)* |
| F5-AUT-104 | FALTA | MEDIA | 4 · confirmar que no se pagó (`:183`) | `apps/api/src/routes/partners/admin/review-payment.ts:57`, `PARTNER_MANAGE` | ídem | `B7` *(der.)* |
| F5-AUT-105 | ADAPTAR | MEDIA | 5 · aprobar, rechazar o anular la espera de una postulación (`:184`) | `apps/api/src/routes/alliance/admin/approve-and-provision-partner.ts:100` y `mark-handled.ts:87`, `ALLIANCE_LEAD_MANAGE` (`permission.enum.ts:1083`; `SUPER_ADMIN` y `ADMIN`) | es un permiso de esa acción; falta *«anular la espera»* y cambia la entidad (`postulacion`) | `V7` |
| F5-AUT-106 | FALTA | MEDIA | 6 · configurar el plan y el método de pago de un Partner (`:185`) | `apps/api/src/routes/partners/admin/send-link.ts:196`, `PARTNER_MANAGE` | permiso general de Partner | `V7` *(der.)* |
| F5-AUT-107 | FALTA | MEDIA | 7 · levantar la marca `requiere_conciliación` (`:186`) | `apps/api/src/routes/billing/admin/payment-reconciliation.ts:128`, `BILLING_RECONCILIATION_MANAGE` (lote N) | la marca con motivo es nueva; el permiso de hoy es de otra cola | `B11` |
| F5-AUT-108 | FALTA | MEDIA | 8 · cancelar una suscripción (`:187`) | las rutas admin de `@qazuor/qzpay-hono` montadas en `apps/api/src/routes/billing/admin/index.ts:189-192`, con `MANAGE_SUBSCRIPTIONS` para escribir una suscripción (`apps/api/src/middlewares/billing-admin-auth.middleware.ts:67`) y los efectos en `qzpay-admin-hooks.ts:8-18` (lote N) | permiso general del cobro viejo, sale con la ruta; hay que declarar uno propio | `B8` |
| F5-AUT-109 | FALTA | MEDIA | 9 · pausar o reanudar (`:188`) | ídem (`billing-admin-auth.middleware.ts:67`, `MANAGE_SUBSCRIPTIONS`, lote N) | ídem | `B8` |
| F5-AUT-110 | FALTA | MEDIA | 10 · cambiar de plan a un cliente (`:189`) | ídem | ídem | `B8` |
| F5-AUT-111 | FALTA | MEDIA | 11 · extender un trial (`:190`) | `apps/api/src/routes/billing/admin/subscription-trial-extension.ts:126`, `BILLING_PROMO_CODE_MANAGE` (lote N) | el permiso de hoy es de códigos promocionales | `V4` |
| F5-AUT-112 | FALTA | MEDIA | 12 · reembolsar (`:192`) | el reembolso de las rutas admin de qzpay exige `BILLING_MANAGE` como movimiento de plata (`billing-admin-auth.middleware.ts:82`, lote N); `REFUND_APPROVE` y `PAYMENT_REFUND` existen en el enum (`permission.enum.ts:757`, `:692`) y ningún código de `apps/api/src` los lee | permiso propio a declarar (o reusar uno de los del enum: decisión) | `B6` |
| F5-AUT-113 | ADAPTAR | MEDIA | 13 · moderar una ficha o la presencia de un Partner (`:191`) | ficha: `ACCOMMODATION_MODERATION_CHANGE` (`permission.enum.ts:191`; `SUPER_ADMIN`, `ADMIN`); comercio: `COMMERCE_MODERATION_CHANGE` (`:1022`, lote N); presencia: `apps/api/src/routes/partners/admin/revoke.ts:57`, `PARTNER_MANAGE` | el diseño pide **un** permiso para ficha y presencia (`N/08` §3, línea 216) y dos niveles; hoy son tres permisos distintos | `V6`, `V7` |
| F5-AUT-114 | FALTA | MEDIA | 14 · asentar un cobro o devolución fuera del flujo (`:193`) | nada | nueva | `B5` *(der.)* |
| F5-AUT-115 | ADAPTAR | MEDIA | 15 · editar el contenido de una ficha ajena (`:194`) | `ACCOMMODATION_UPDATE_ANY` como `bypassPermission` (F5-AUT-027) | permiso genérico y sin cupo sobre el sujeto | `V8` |
| F5-AUT-116 | FALTA | MEDIA | 17 · migrar a los clientes de un plan retirado (`:196`) | nada (el aumento de precio viejo, `plan-price-increase.ts:97`, `BILLING_MANAGE`, lote N) | nueva; «sólo `SUPER_ADMIN`» depende de F5-AUT-003 | `B12` |
| F5-AUT-117 | FALTA | MEDIA | 18 · publicar una versión de plan (`:197`) | `apps/api/src/routes/billing/admin/plans.ts:175`, `BILLING_MANAGE` (lote N) | nueva; ídem F5-AUT-003 | `V2` |
| F5-AUT-118 | FALTA | MEDIA | 19 · fijar el precio de un ciclo (`:198`) | nada fuera del cobro viejo | nueva; ídem | `B2` |
| F5-AUT-119 | FALTA | MEDIA | 20 · publicar una versión de complemento (`:199`) | `apps/api/src/routes/billing/admin/addons.ts:166`, `BILLING_MANAGE` (lote N) | nueva; escribe en las dos épicas | `V2` + `B10` |
| F5-AUT-120 | FALTA | MEDIA | 21 · crear o cerrar un código promocional (`:200`) | `apps/api/src/routes/billing/promo-codes.ts:110`, `BILLING_PROMO_CODE_MANAGE` (lote N) | nueva; ídem | `B9` *(der.)* |
| F5-AUT-121 | FALTA | MEDIA | 22 · cambiar un plazo (`:201`) | `BILLING_SETTINGS_WRITE` (`permission.enum.ts:945`; `SUPER_ADMIN` y `ADMIN`, `rolePermissions.seed.ts:376`, `:769`) sobre la configuración vieja | nueva, y hoy la tiene también `ADMIN` | `V2` / `B2` *(der.)* |
| F5-AUT-122 | ADAPTAR | MEDIA | 23 · borrar una ficha ajena a pedido de su dueño (`:202`) | `ACCOMMODATION_DELETE_ANY` (`permission.enum.ts:149`; `SUPER_ADMIN`, `ADMIN`) | genérico, sin motivo ni `PB12` | `V8` |
| F5-AUT-123 | ADAPTAR | MEDIA | 24 · dar de baja una cuenta a pedido de su dueño (`:203`) | `USER_DELETE` (`apps/api/src/routes/user/admin/delete.ts:25`) | ver F5-AUT-014/015 | `V8` |
| F5-AUT-124 | FALTA | MEDIA | 25 · vaciar la presencia de un Partner (`:204`) | `apps/api/src/routes/partners/admin/delete.ts:23`, `PARTNER_MANAGE` (borra la fila, no vacía el contenido) | nueva | `V8` |
| F5-AUT-125 | ADAPTAR | ALTA | 26 · asignar o quitar `SUPER_ADMIN` (`:205`) | `USER_UPDATE_ROLES` (ver F5-AUT-004) | ver F5-AUT-004 | `V5` |

---

## Cómo se contó

```bash
rg -o '^### F5-AUT-[0-9]+ · [A-Z]+' 01-permisos-y-roles.md | awk '{print $NF}' | sort | uniq -c
rg -o '^\| F5-AUT-[0-9]+ \| [A-Z]+' 01-permisos-y-roles.md | awk '{print $NF}' | sort | uniq -c
```

Suma de las dos salidas: la tabla del Resumen. Las severidades ALTA se contaron igual (`rg -c '· ALTA ·'` sobre los títulos y `| ALTA |` sobre la tabla).

## Búsquedas de ausencia

Todas sobre `origin/staging` (`35e2d63e81`), con el patrón probado contra un caso positivo.

1. **Turnstile en la postulación**: `git grep -n -i turnstile origin/staging -- apps/api/src/routes/alliance packages/service-core/src/services/alliance-lead` → 0. Positivo: el mismo patrón sobre `apps/api/src/routes/feedback` da `submit.ts:28` y `:223`.
2. **Lista de permisos que el override no puede dar**: `git grep -n -i -E "non_?overridable|superAdminOnly|SUPER_ADMIN_ONLY|ROLE_ONLY_PERMISSIONS|nonAssignablePermission" origin/staging -- packages apps ':!*.md'` → sólo `superAdminOnlySection` de dashboards del panel (sin relación). Positivo del mecanismo análogo para roles: `NON_ASSIGNABLE_ROLES` en `packages/schemas/src/entities/user/user-role.schema.ts` (3 hits).
3. **Comparación actor/sujeto en la asignación de roles**: `git grep -n -E "actor\.id ===|=== actor\.id|grantedBy ===|=== userId|self" origin/staging -- apps/api/src/routes/user/admin/roles.ts packages/service-core/src/services/user-role/` → un solo hit, en un comentario JSDoc (`user-role.service.ts:258`), ninguno en código. Positivo: `grantedBy` aparece 3 veces en `roles.ts`.
4. **`emailVerified` en la autorización**: `git grep -n emailVerified origin/staging -- apps/api/src/middlewares/authorization.ts` → 0. Positivo: el mismo patrón en `apps/api/src/middlewares/actor.ts` da `:362` y `:399`.
5. **Guard `G6`**: `git grep -n -i -l -E "decid.*only by role|sólo por rol|roles\.includes.*guard" origin/staging -- '**/*.test.ts'` → 0; y la lista de guards con `role|permission|auth` en el nombre (`git ls-tree -r --name-only origin/staging | rg -i 'guard\.test\.ts$' | rg -i 'role|permission|auth|guest|actor'`) no trae ninguno sobre decisiones por rol.
6. **Borrado de credenciales**: `git grep -n -i "delete(accounts)\|accounts)\.where" origin/staging -- packages/service-core/src apps/api/src ':!*test*'` → 0. Positivo: `from(accounts)` da `apps/api/src/routes/auth/change-password.ts:44` y dos más.
7. **Escritores de `banned`**: `git grep -n -E "banned: true|set\(\{ ?banned|banUser|ban-user" origin/staging -- apps packages ':!*.md'` → sólo el seed del usuario de sistema (`systemUser.seed.ts:104`), un `.omit` de schema y tests. Positivo: `banned` aparece 2 veces en `user.dbschema.ts`.

## Lo que no pude cerrar

- **Cuántas cuentas con sesión viva tienen hoy el correo sin verificar** (F5-AUT-011): pide una consulta a producción que no corrí.
- **Cuántas fichas publicadas son de cuentas con rol de staff** (F5-AUT-022): ídem; es lo que dice si la decisión es urgente o nominal.
- **A qué unidad va cada acción del catálogo** donde lo marqué *(der.)*: lo derivé del tema de la unidad, no de una asignación escrita.
- **Si `role_permission` en producción coincide con la línea base del seed** (F5-AUT-003): la tabla es editable en vivo desde el panel (HOS-120), así que quién tiene `PERMISSION_ASSIGN` y `USER_UPDATE_ROLES` hoy puede no ser lo que dice `rolePermissions.seed.ts`.
- **Los permisos de inspección del §48** (`V/17` §3.2 regla 1, líneas 407-416): el diseño los deja para cuando se enumere la superficie del admin; no los clasifiqué uno por uno. Hoy existen `USER_READ_ALL`, `PARTNER_VIEW_ALL`, `ALLIANCE_LEAD_VIEW_ALL` y el `BILLING_READ_ALL` del cobro viejo.

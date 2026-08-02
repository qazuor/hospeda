---
title: Editor: cargar notas y eventos desde la web, sin acceso al panel de admin
linear: HOS-374
statusSource: linear
created: 2026-08-02
type: feature
areas:
  - web
  - api
  - auth
---

# Editor: cargar notas y eventos desde la web, sin acceso al panel de admin

## 1. Summary

Hoy, un editor aprobado recibe el rol `EDITOR` y entra al **panel de administración
completo** para cargar posts (notas) y eventos. Esta spec mueve esa carga a
`/mi-cuenta` en la web pública, de forma que un editor sólo pueda ver y editar lo
que él creó, nunca entre al panel de admin, y que lo que publica nazca en revisión
salvo que un admin lo haya marcado como "editor de confianza".

## 2. Problem

El rol `EDITOR`, tal como está seedeado hoy
(`packages/seed/src/required/rolePermissions.seed.ts:807-919`), no es un rol
acotado a contenido: incluye `PermissionEnum.ACCESS_PANEL_ADMIN` y
`ACCESS_API_ADMIN` (líneas 885-886) — el único gate real de entrada al shell de
`apps/admin` (`apps/admin/src/lib/authed-guard.ts`, función `decideAuthedGuard`,
líneas 143-164: chequea una única permission binaria,
`permissions.includes(PermissionEnum.ACCESS_PANEL_ADMIN)`) — más `TAG_*`,
`MEDIA_UPLOAD`/`MEDIA_DELETE`, `NEWSLETTER_CAMPAIGN_VIEW`/`WRITE`, y permisos de
perfil de usuario. Es decir: darle el rol `EDITOR` a un colaborador externo hoy lo
deja parado en el mismo panel que usa el staff.

Esto ya causó un incidente real con otro rol: **HOS-152** —
*"HOST/COMMERCE_OWNER can access the admin panel after publishing first
accommodation"*. El riesgo no es hipotético, y crece con cada feature nueva que se
agregue al admin sin acordarse de excluir a `EDITOR` de ella.

`apps/web/src/config/discovery-doors.ts:224-234` ya documenta este mismo problema
en su comentario, para la opción `editor` de la puerta `partner`:

```ts
// The only aliado with a real entry form today (HOS-134 §2) —
// an admin manually promotes the applicant to RoleEnum.EDITOR,
// who then holds POST_CREATE and manages content in the admin
// panel, not under /mi-cuenta (`managesInAdminPanel`).
acquiredPermission: PermissionEnum.POST_CREATE,
managesInAdminPanel: true
```

Ese flag `managesInAdminPanel: true` es exactamente lo que esta spec revierte.

## 3. Goals

- **G-1** — Un usuario con rol `EDITOR` crea y edita posts y eventos desde
  `/mi-cuenta`, sin necesitar entrar a `apps/admin`.
- **G-2** — Un editor sólo ve y edita lo que él creó (`authorId === actor.id`),
  garantizado a nivel de query server-side, no sólo ocultado en la UI.
- **G-3** — Lo que un editor crea nace no-público y en revisión
  (`moderationState: PENDING`), salvo que tenga el flag de "editor de confianza".
- **G-4** — Un admin puede marcar a un editor como "de confianza": lo que ese
  editor cree a partir de ahí se publica directo.
- **G-5** — El rol `EDITOR` deja de otorgar `ACCESS_PANEL_ADMIN`/`ACCESS_API_ADMIN`
  (o se reemplaza por un rol/permiso distinto para la carga desde la web), y se
  audita qué pasa con los editores que hoy ya tienen acceso al admin.
- **G-6** — Reusar el molde de editor por secciones de `apps/web` (`RichTextEditor`,
  navegación de secciones, patrón de guardado) en vez de construir uno nuevo desde
  cero.

## 4. Non-goals

- **NG-1** — La página pública de autor unificada (`/autores/<slug>/`,
  notas + eventos) → **HOS-375**, spec separada.
- **NG-2** — El flujo de postulación/aprobación de un editor nuevo (lead → cuenta →
  rol `EDITOR`) → **HOS-278**, del cual esta spec es "el camino de `editor`" una vez
  que el rol ya está asignado. Esta spec no rediseña cómo alguien se convierte en
  `EDITOR`.
- **NG-3** — El premio/beneficio que recibe un editor (comp turista VIP o descuento
  sobre su plan pago) → ya definido en HOS-278 §6.6, no se repite acá.
- **NG-4** — Moderar/aprobar contenido desde la web. La aprobación sigue siendo una
  acción de admin, dentro de `apps/admin` (el flujo de revisión de contenido no se
  mueve, sólo la carga).
- **NG-5** — Cambiar cómo funciona `moderationState`/`visibility` para contenido
  creado por staff/admin (fuera del alcance de esta spec: sólo se toca el camino de
  creación por `EDITOR`).

## 5. Current baseline

### 5.1 Las rutas `protected` para posts y eventos ya existen — pero la web no las usa

Ambas entidades ya están montadas en las tres capas
(`apps/api/src/routes/index.ts:461-462`,
`/api/v1/protected/events`, `/api/v1/protected/posts`):

| Ruta | Tier | Path | Permission |
|---|---|---|---|
| `post/protected/create.ts` | protected | `POST /protected/posts` | `POST_CREATE` |
| `post/protected/update.ts` / `patch.ts` | protected | `PUT`/`PATCH /protected/posts/:id` | `POST_UPDATE` (chequeo plano; el ownership vive un nivel más abajo, ver 5.3) |
| `post/protected/softDelete.ts` | protected | `DELETE /protected/posts/:id` | `POST_DELETE` |
| `event/protected/create.ts` | protected | `POST /protected/events` | `EVENT_CREATE` |
| `event/protected/update.ts` / `patch.ts` | protected | `PUT`/`PATCH /protected/events/:id` | ownership (`createdById === actor.id`) OR `bypassPermission: EVENT_UPDATE` |
| `event/protected/softDelete.ts` | protected | `DELETE /protected/events/:id` | ownership OR `bypassPermission: EVENT_DELETE` |

**No existen** rutas `protected` de listado "lo mío" (`GET .../mine`) ni de
`getById` para posts ni eventos — `apps/api/src/routes/post/protected/index.ts` y
`event/protected/index.ts` sólo wirean create/update/patch/softDelete (+
like/unlike en eventos). Hay que construirlas.

`apps/web` no consume ninguna de estas rutas hoy: no existe `postsApi`/`eventsApi`
de escritura en `apps/web/src/lib/api/endpoints-protected.ts`; los consumidores
actuales (`publicaciones/`, `eventos/`) sólo leen del tier público. Esta spec sería
el primer consumidor web de las rutas `protected` de creación.

### 5.2 `moderationState: PENDING` hoy NO bloquea nada — el gate real es `visibility`

Verificado directamente en código: tanto `httpToDomainPostCreate`
(`packages/schemas/src/entities/post/post.http.schema.ts`, función que arma el
`PostCreateInput`) como `httpToDomainEventCreate`
(`packages/schemas/src/entities/event/event.http.schema.ts`) **hardcodean**, sin
tomarlo del body, en cada creación:

```ts
lifecycleState: LifecycleStatusEnum.ACTIVE,
visibility: VisibilityEnum.PUBLIC,
moderationState: ModerationStatusEnum.PENDING,
```

Y los métodos de lectura pública de `PostService`/`EventService`
(`packages/service-core/src/services/post/post.service.ts` líneas ~923-1127,
`event/event.service.ts` líneas ~930-1243) filtran **sólo por `visibility`**
(`where.visibility = 'PUBLIC'` si no se especifica otra cosa) — ninguno de los dos
servicios lee ni filtra por `moderationState` en ningún método, ni en
`_beforeCreate`, ni en list/get.

**Consecuencia concreta y crítica para esta spec**: con el código actual, cualquier
contenido creado vía `protected/create` queda **inmediatamente público**
(`visibility: PUBLIC` hardcodeado) sin importar que `moderationState` nazca en
`PENDING`. El texto del issue de Linear ("Lo que crea un editor nace en `PENDING`;
un admin lo aprueba antes de que se publique") describe el comportamiento
**deseado**, no el actual — `moderationState` es hoy un campo decorativo para la
visibilidad pública. Esto no es un detalle: si se abre `protected/posts`/`events`
a `EDITOR` sin tocar esto, cualquier nota o evento que cargue un editor se publica
al instante, sin revisión, contradiciendo el propósito central del issue.

Cerrar este gap es **trabajo obligatorio de esta spec**, no un efecto colateral de
otra: la ruta de creación usada por el nuevo flujo de `EDITOR` tiene que dejar de
hardcodear `visibility: PUBLIC` quien la usa es un `EDITOR` sin flag de confianza,
y algo tiene que promover `visibility` a `PUBLIC` cuando `moderationState` pasa a
`APPROVED` (hoy tampoco existe ese enlace — ver 5.5).

### 5.3 `authorId` es un campo del body, no forzado al actor

En ambos schemas HTTP de creación, `authorId` es un `z.string().uuid()`
**requerido, tomado del body**:
`PostCreateHttpSchema.authorId` (`post.http.schema.ts`) y
`EventCreateHttpSchema.authorId` (`event.http.schema.ts`), y ambos handlers
(`post/protected/create.ts`, `event/protected/create.ts`) lo pasan derecho a
`httpToDomainPostCreate(body)`/`httpToDomainEventCreate(body)` sin overridearlo con
`actor.id`. Hoy este riesgo está contenido porque sólo staff con `POST_CREATE`/
`EVENT_CREATE` puede pegarle a estas rutas; en cuanto se exponen a editores
externos vía self-service, un `authorId` arbitrario en el body deja de ser un
detalle interno y pasa a ser suplantación de autoría real. La ruta que use esta
spec (nueva o reformada) tiene que forzar `authorId = actor.id` en el servidor e
ignorar cualquier valor del body.

### 5.4 El scoping "sólo lo mío" NO existe hoy para `EDITOR`

El modelo de permisos de `EDITOR` es hoy de **equipo editorial compartido**, no de
propiedad individual:

- **Eventos**: `checkCanUpdateEvent`
  (`packages/service-core/src/services/event/event.permissions.ts`) chequea
  únicamente `actor.permissions.includes(EVENT_UPDATE)` — **no compara
  `createdById`/`authorId` contra el actor en absoluto**.
- **Posts**: `checkCanUpdatePost`
  (`packages/service-core/src/services/post/post.permissions.ts`) sí compara
  `actor.id === post.authorId`, pero como **alternativa** a la permission amplia
  `POST_UPDATE` — cualquiera de las dos alcanza.
- `EDITOR` tiene, además de `POST_UPDATE`/`EVENT_UPDATE`, `POST_VIEW_ALL`/
  `EVENT_VIEW_ALL` y `*_VIEW_PRIVATE` — documentado explícitamente en
  `packages/seed/test/role-permission-audit.test.ts` como *"the editorial role
  sees all editorial content (posts + events, incl. private) by design"*.

**Hoy, cualquier `EDITOR` puede editar el post/evento de cualquier otro editor.**
Esto choca directo con el requisito del issue ("El editor sólo ve y edita lo que
él creó"). No es sólo UI a construir: hace falta una restricción de scoping nueva
para la superficie de `/mi-cuenta` (ver §6.3) — sin tocar el modelo de permisos
existente para el resto del sistema (fuera de alcance, NG-5).

### 5.5 No existe endpoint de moderación, ni enforcement server-side sobre quién puede aprobar

No hay ruta admin dedicada `moderate`/`approve` para posts ni eventos —
`moderationState` es simplemente un campo más de
`PostUpdateInputSchema`/`EventUpdateInputSchema`, editado vía el `PUT`/`PATCH`
genérico. `PermissionEnum.POST_MODERATION_CHANGE`/`EVENT_MODERATION_CHANGE`
existen y están seedeados sólo en `ADMIN`/`SUPER_ADMIN`/`CLIENT_MANAGER`
(`EDITOR` no los tiene), pero **no se chequean en ningún lado server-side** — sólo
gatean el widget inline de la tabla del admin
(`apps/admin/src/features/posts/config/posts.columns.ts:260`,
`.../events/config/events.columns.ts:275`). Es decir: hoy, cualquier actor con el
`POST_UPDATE`/`EVENT_UPDATE` plano (que `EDITOR` ya tiene) podría, en teoría,
mandar `moderationState: APPROVED` por el `PATCH` genérico sin tener
`POST_MODERATION_CHANGE`. Esto no importa hoy porque `moderationState` no gatea
nada (5.2), pero en cuanto esta spec le dé efecto real, hace falta un chequeo
server-side real: la ruta que use `EDITOR` para editar lo suyo no debe permitir
que el propio actor cambie `moderationState`/`visibility` a un estado de
publicación, salvo que tenga el flag de confianza (§6.4).

### 5.6 Asignación del rol `EDITOR` — 100% manual, sin scope propio

Desde HOS-296, `users.role` (columna escalar) no existe más — los roles viven en
`user_role` (tabla puente). La única vía de asignación hoy es
`POST`/`DELETE /api/v1/admin/users/{id}/roles`
(`apps/api/src/routes/user/admin/roles.ts`), gateada por
`PermissionEnum.USER_UPDATE_ROLES` (sólo `ADMIN`/`SUPER_ADMIN`), vía la pestaña de
Roles del admin (`apps/admin/src/features/users/components/roles/UserRolesCard.tsx`).
No hay ningún flujo automático que otorgue `EDITOR` —
`RoleGrantReason` (`packages/schemas/src/entities/user/user-role.schema.ts:236`)
enumera `signup`, `signup_as_host`, `accommodation_created`,
`accommodation_activated`, `commerce_lead_approved`, `seed`: ninguno de tipo
editor. Esta spec no cambia esa asignación (NG-2): sigue siendo manual, vía admin.

### 5.7 No existe precedente de un flag "de confianza" por usuario

La tabla `users` (`packages/db/src/schemas/user/user.dbschema.ts`) tiene varios
booleanos togglables por admin/sistema: `profileCompleted`, `setPasswordPrompted`,
`serviceSuspended` (línea 138, SPEC-143 — el más parecido: un boolean simple en
`users`, leído por lógica de servicio para gatear un comportamiento downstream),
`mustChangePassword`, `banned` (Better Auth). **No existe `isVerified` en `users`**
— ese campo vive sólo en `accommodations` (`is_verified`, HOS-341, verificación de
ficha, no de usuario) y no es un precedente aplicable acá. No hay ningún flag hoy
de tipo "lo que este actor crea se auto-aprueba" en ningún dominio del código —
grep de `autoApprove`/`skipModeration`/`bypassModeration`/`isTrusted` no encontró
nada relevante (sólo `isTrustedSource` de rate-limiting de IPs, sin relación). El
flag de "editor de confianza" es mecanismo nuevo de punta a punta.

### 5.8 El molde de referencia de editor por secciones (`host/editor/`)

**Reusable tal cual** (sin acoplamiento a alojamiento):

- `apps/web/src/components/host/editor/RichTextEditor.client.tsx` — TipTap v3
  (StarterKit + Markdown), persiste como string Markdown. Props:
  `{ value, onChange, placeholder?, disabled?, hasError?, errorMessage? }`. Cero
  imports específicos de alojamiento.
- `apps/web/src/components/host/editor/EditorSectionNav.client.tsx` — nav
  scrollspy sticky. Props: `{ locale, sections: { id, label }[] }`, no conoce el
  contenido de cada sección.
- `apps/web/src/components/host/editor/ActionBar.client.tsx` — barra
  Guardar/Cancelar. Props: `{ locale, isSaving, onCancel }`.
- `apps/web/src/lib/forms/use-zod-form.ts` (`useZodForm`) — hook de validación Zod
  genérico (`fieldErrors`, `formError`, `validate`, `handleApiError`).

**NO reusable** (acoplado a alojamiento o a facturación del anfitrión):

- `AmenitiesSection`, `CapacitySection`, `PricingSection`, `LocationPicker(.Map)`,
  `ContactInfoSection`, `SocialNetworksSection`, `CountryCodeCombobox`,
  `Calendar*` (6 archivos, sync iCal), `OccupancyEventEditDialog` — campos
  específicos de alojamiento, sin equivalente en posts/eventos.
- `FeaturedToggleSection`, `PlanEntitlementGate`, `AiTextImprovePanel` — gateados
  por entitlements de billing del anfitrión (`product_domain='accommodation'`).
  `EDITOR` no tiene plan de billing propio para este flujo: esta capa entera no
  aplica y no debe copiarse.
- **`PhotoSection.client.tsx`** — construido sobre la tabla relacional
  `accommodation_media` (SPEC-204, `accommodationMediaApi` en
  `endpoints-protected.ts:3308`, un endpoint por foto). Posts/eventos usan
  `BaseMediaFields` (`packages/schemas/src/common/media.schema.ts`) — un objeto
  JSONB embebido (`featuredImage` + galería opcional), no una tabla por fila. La
  imagen de portada de posts/eventos necesita un componente mucho más simple: subir
  → setear un campo del PATCH, no la danza multi-endpoint de `PhotoSection`.
- `BasicInfoSection.client.tsx` — específico de alojamiento en sus campos, pero es
  la **plantilla de forma correcta** a imitar para una sección "título + contenido"
  de posts/eventos (usa `RichTextEditor` internamente), sacando la parte de
  `PlanEntitlementGate`.

**Patrón del orquestador** (`AccommodationEditor.client.tsx`): no hay un config de
secciones — son bloques JSX a mano, con un array `navSections` armado en paralelo
a mano para alimentar `EditorSectionNav`. Estado: un `formData` + un `baseline`
resincronizado tras cada guardado exitoso, para armar un PATCH **diff-only**
(`buildPatchPayload`). Sin autosave ni borrador en `localStorage`: `<form
onSubmit>` con un único botón "Guardar" (`ActionBar`). El editor de posts/eventos
debería copiar este mismo patrón (secciones a mano, sin sistema de config), con
muchas menos secciones: título, contenido (`RichTextEditor`), imagen de portada,
categoría/tags.

### 5.9 Upload de media — soporta `post`/`event` en el tipo, pero el ownership check está roto para ambos

`apps/api/src/routes/media/protected/upload-entity.ts`: `resolveEntityService()`
(líneas ~56-82) ya rutea `entityType: 'post'` → `PostService` y
`entityType: 'event'` → `EventService` — no hace falta agregarlos a ningún
allowlist. **Pero el chequeo de ownership (líneas ~247-255) lee
`entity.ownerId`**, campo que **no existe** en `post`/`event` (tienen `authorId`,
no `ownerId`:
`packages/schemas/src/entities/post/post.schema.ts:97`,
`.../event/event.schema.ts:92`). Con el código actual, subir media a un
`entityType: 'post'|'event'` siempre devuelve 403, porque
`entity.ownerId` es siempre `undefined`. Además, un fix ingenuo
(`entity.authorId === actor.id`) sería incorrecto para `EVENT`, porque bloquearía
a un editor autorizado a editar el evento de un colega (5.4) de subirle una
imagen — el chequeo tiene que ser consciente del tipo de entidad y espejar la
misma lógica de `checkCanUpdatePost`/`checkCanUpdateEvent` para ese entityType (y,
si esta spec restringe el scoping de `EDITOR` a "sólo lo mío" en la superficie
nueva — 5.4/§6.3 —, el upload debería respetar esa misma restricción ahí, no la
más amplia que rige hoy en el admin).

Del lado web, `apps/web/src/lib/media/upload-entity.ts::uploadEntityImage`
hardcodea `formData.append('entityType', 'accommodation')` y su parámetro se llama
literalmente `accommodationId` — no es genérico hoy; hace falta un parámetro
`entityType` + `entityId` genérico, o un helper hermano.

### 5.10 `discovery-doors.ts` ya modela el estado a revertir

`apps/web/src/config/discovery-doors.ts:224-234`, opción `editor` de la puerta
`partner`: `acquiredPermission: PermissionEnum.POST_CREATE`,
`managesInAdminPanel: true`. El comentario en código documenta explícitamente el
estado actual que esta spec cambia (ver §2). No hay `manageHref` seteado para esta
opción hoy — hay que agregarlo apuntando a la nueva superficie en `/mi-cuenta` y
sacar `managesInAdminPanel`.

### 5.11 No existe gate de rol/permission del lado cliente en `apps/web`

`apps/web/src` no tiene `useMyRole`/`useHasPermission`/`useHasRole`. El único hook
parecido es `useMyEntitlements` (`apps/web/src/hooks/useMyEntitlements.ts`), que es
puramente de billing (`product_domain='accommodation'`, según contexto ya
verificado en specs previas de este repo — no aplica acá, `EDITOR` no tiene plan).
Mostrar/ocultar la nueva sección de editor en `/mi-cuenta` necesita mecanismo
nuevo — lo más natural es resolverlo server-side en Astro vía `Astro.locals.user`
(el actor/sesión ya disponible en SSR), no un hook cliente que pegue a un
endpoint de permisos.

## 6. Proposed design

### 6.1 El `EDITOR` deja de entrar al admin

`packages/seed/src/required/rolePermissions.seed.ts` deja de otorgarle a
`RoleEnum.EDITOR` `PermissionEnum.ACCESS_PANEL_ADMIN` y `ACCESS_API_ADMIN`.
Conserva `POST_CREATE`/`POST_UPDATE`/`EVENT_CREATE`/`EVENT_UPDATE`/
`MEDIA_UPLOAD`/`MEDIA_DELETE` (necesarios para el flujo `protected`/web) y
mantiene o recorta el resto (`TAG_*`, `NEWSLETTER_*`, `USER_*`) según lo que la
nueva superficie realmente necesite — a decidir en implementación, no inventado
acá (ver §11 OQ-1: qué subconjunto exacto del permission set actual de `EDITOR`
sigue haciendo falta una vez que no entra al admin).

Como `decideAuthedGuard` (`apps/admin/src/lib/authed-guard.ts`) gatea el shell
completo con la única permission `ACCESS_PANEL_ADMIN`, sacarla de `EDITOR` alcanza
para cerrar el acceso al panel sin tocar el guard en sí.

### 6.2 Rutas `protected` — cerrar los gaps de 5.2/5.3 antes de exponerlas

Antes de que `EDITOR` pueda pegarle a `protected/posts`/`protected/events`:

1. **`authorId` (post) y `authorId` (event) se fuerzan a `actor.id` en el
   handler**, ignorando el valor del body (5.3). Aplica a ambas rutas de creación,
   no sólo a la que use el nuevo flujo — es una corrección de seguridad
   independiente del alcance de `EDITOR`.
2. **La creación deja de hardcodear `visibility: PUBLIC` incondicionalmente.** El
   valor depende de si el actor tiene el flag de confianza (§6.4): confiado →
   `PUBLIC` + `moderationState: APPROVED`; no confiado → `PRIVATE` (o
   `RESTRICTED` — a definir, §11 OQ-2) + `moderationState: PENDING`.
3. **El PATCH usado por `EDITOR` sobre lo suyo no permite que el propio actor
   cambie `moderationState`/`visibility` hacia un estado publicado**, salvo que
   tenga el flag de confianza — cerrando el gap de 5.5 para esta superficie
   específica.
4. **Nuevas rutas `GET /protected/posts/mine` y `GET /protected/events/mine`**
   (siguiendo el patrón ya usado por commerce, HOS-278 §5.5: *"cada vertical
   expone su propio `GET /{vertical}/mine`, owner-scoped en el service"`), que
   filtran por`authorId === actor.id` **de forma dura**, sin honrar
   `POST_VIEW_ALL`/`EVENT_VIEW_ALL` — la superficie nueva de `/mi-cuenta` no
   hereda el modelo de "equipo editorial ve todo" (5.4), que queda intacto para
   quien siga usándolo desde el admin (staff con permisos más altos).
5. **Nueva ruta `GET /protected/posts/:id` y `GET /protected/events/:id`**
   (no existen hoy, 5.1), con el mismo enforcement de ownership que `mine` — 404
   si el post/evento no es del actor (mismo patrón que
   `fetchOwnerListingDetail` de commerce, HOS-278 §6.4: *"the protected getById
   endpoint enforces ownership server-side: non-owners... receive NOT_FOUND"*).

Este mismo criterio de scoping (paso 4/5: sólo lo mío, sin `VIEW_ALL`) se aplica
también al chequeo de `upload-entity.ts` cuando `entityType` es `post`/`event` y
el actor es `EDITOR` (5.9).

### 6.3 Página(s) nuevas en `/mi-cuenta`

Siguiendo el precedente de `mi-cuenta/comercio/[vertical]/[id]/editar.astro`
(auth-guard por `Astro.locals.user` + gate de rol, scoping server-side, nunca por
id pasado del cliente): una sección nueva bajo `/mi-cuenta/` con listado ("mis
notas", "mis eventos") y edición por sección (reusando `RichTextEditor`,
`EditorSectionNav`, `ActionBar`, `useZodForm` — 5.8), gateada server-side por
`Astro.locals.user` teniendo el rol `EDITOR` (mecanismo de lectura de rol en SSR a
definir en implementación — no existe hoy un helper para esto, 5.11).

`apps/web/src/config/discovery-doors.ts:224-234` — la opción `editor` pasa a
tener `manageHref` apuntando a esta superficie y pierde `managesInAdminPanel`.

El nombre/path exacto de la sección (¿`/mi-cuenta/colaborar/`? ¿reusa
`/mi-cuenta/aliados`?) no está fijado por ningún código ni por la decisión del
owner — queda en §11 OQ-3 en vez de inventarse acá.

### 6.4 El flag de "editor de confianza"

El propio issue lo deja abierto ("A definir dónde vive ese flag"); no hay
precedente exacto en código (5.7), sólo el más cercano estructuralmente
(`users.serviceSuspended`: boolean simple en `users`, togglable por admin, leído
por lógica de servicio). Esta spec no fija el nombre/tabla exacta — eso es §11
OQ-4 — pero sí fija el contrato funcional que debe cumplir, verificable
independientemente de dónde viva:

- Es por-usuario, no por-post/por-evento.
- Sólo un admin (permission ya existente a determinar — probablemente
  `USER_UPDATE_ROLES` o un permiso nuevo, ver OQ-1) puede togglearlo.
- Cuando está activo, el flujo de creación de §6.2 punto 2 hace
  `visibility: PUBLIC` + `moderationState: APPROVED` directo, en vez de
  `PRIVATE`/`PENDING`.
- No es retroactivo: activar el flag no cambia el estado de contenido ya creado
  antes de activarlo.

### 6.5 Auditoría de editores existentes (G-5)

Antes de sacarle `ACCESS_PANEL_ADMIN` al rol `EDITOR`, hace falta un relevamiento
operativo (no resoluble por lectura de código, es dato vivo de cada ambiente): qué
usuarios tienen hoy el rol `EDITOR`, y si alguno lo usa además para acceder a otras
secciones del admin más allá de posts/eventos (dado que el permission set actual
de `EDITOR` incluye tag management, newsletter draft, etc. — 5.6). A quien lo
necesite genuinamente, asignarle el rol/permission que corresponda por separado
antes del cambio, para no cortarle acceso real a un colaborador de staff.

## 7. Data model / contracts

### Migraciones

| tabla | cambio | notas |
|---|---|---|
| `users` (o tabla nueva) | flag de "editor de confianza" | forma y ubicación exacta: OQ-4. Boolean simple, default `false`, siguiendo el precedente de `serviceSuspended`. |

No hace falta agregar `authorId` a `posts`/`events` — ya existe en ambas, con
índice (`events_authorId_idx`, y el equivalente en `posts`).

### Endpoints nuevos

| método | ruta | notas |
|---|---|---|
| `GET` | `/api/v1/protected/posts/mine` | owner-scoped por `authorId`, sin honrar `POST_VIEW_ALL` |
| `GET` | `/api/v1/protected/posts/:id` | no existe hoy en `protected`; 404 si no es del actor |
| `GET` | `/api/v1/protected/events/mine` | owner-scoped por `authorId`, sin honrar `EVENT_VIEW_ALL` |
| `GET` | `/api/v1/protected/events/:id` | no existe hoy en `protected`; 404 si no es del actor |
| — | toggle de "editor de confianza" | ruta exacta a definir junto con OQ-4 (probablemente admin-tier, sobre el propio recurso `user`) |

### Endpoints existentes que se modifican (no nuevos, pero con cambio de contrato)

| ruta | cambio |
|---|---|
| `POST /protected/posts`, `POST /protected/events` | `authorId` forzado a `actor.id` server-side (ignora el body); `visibility`/`moderationState` dejan de ser siempre `PUBLIC`/`PENDING` fijos — dependen del flag de confianza |
| `PUT`/`PATCH /protected/posts/:id`, `.../events/:id` | (para el camino usado por `EDITOR`) rechaza que el propio actor cambie `moderationState`/`visibility` hacia publicado sin el flag de confianza |
| `POST /protected/media/upload-entity` | fix del chequeo de ownership para `entityType` `'post'` y `'event'` (lee `authorId`, no `ownerId`; rama de ownership consciente del tipo) |

## 8. UX / UI behavior

- **Sección nueva en `/mi-cuenta`** (nombre exacto: OQ-3), visible sólo para
  usuarios con rol `EDITOR` — gate resuelto server-side (SSR), no oculto sólo por
  CSS/JS cliente.
- **Listado "mis notas" / "mis eventos"**: título, estado
  (`PENDING`/`APPROVED`/`REJECTED`), fecha, con acceso a editar. Nunca contenido de
  otro autor.
- **Editor por secciones**: título, contenido (`RichTextEditor`), imagen de
  portada (subida simple, sin el patrón multi-endpoint de `PhotoSection`),
  categoría/tags — pocas secciones, siguiendo el patrón hand-coded de
  `AccommodationEditor.client.tsx` (5.8), sin autosave, guardado explícito con
  PATCH diff-only.
- **Estado visible tras guardar**: si el editor no es de confianza, la UI deja
  claro que el contenido quedó en revisión, no publicado — evitar la trampa ya
  señalada en otra spec de este repo (HOS-278 §8): la copy nunca debe decir que
  algo ya está publicado si no lo está.
- **Editor de confianza**: mismo editor, mismo flujo — la única diferencia
  observable es que el contenido queda visible/`APPROVED` inmediatamente después
  de guardar, sin paso de revisión intermedio.
- Toda copy nueva va por i18n en es/en/pt.

## 9. Acceptance criteria

- **AC-1** — Un usuario con sólo el rol `EDITOR` no puede acceder a ninguna ruta
  de `apps/admin` (redirige por el mismo mecanismo que hoy usa `decideAuthedGuard`
  para actores sin `ACCESS_PANEL_ADMIN`).
- **AC-2** — Un editor puede crear un post/evento desde `/mi-cuenta` sin pasar por
  `apps/admin`.
- **AC-3** — El post/evento creado por un editor sin flag de confianza nace con
  `moderationState: PENDING` y **no es visible en el sitio público** (no sólo
  `moderationState`, también `visibility` no-público — cierre del gap de 5.2).
- **AC-4** — Un editor no puede leer ni editar un post/evento cuyo `authorId` no
  sea el suyo, a través de las rutas nuevas `mine`/`:id` — 404, no 403 (mismo
  criterio que commerce en HOS-278).
- **AC-5** — Un editor no puede, por sí mismo, cambiar el `moderationState` o la
  `visibility` de su propio contenido hacia un estado publicado — eso requiere ya
  sea una acción de admin, ya sea tener el flag de confianza.
- **AC-6** — Un `POST /protected/posts` o `POST /protected/events` con un
  `authorId` distinto al del actor autenticado en el body es ignorado: el
  `authorId` real queda siendo el del actor, no el del body.
- **AC-7** — Un post/evento creado por un editor **con** el flag de confianza
  activo nace con `moderationState: APPROVED` y `visibility: PUBLIC`, sin paso de
  revisión.
- **AC-8** — Activar el flag de confianza en un editor no cambia retroactivamente
  el estado de contenido que ya había creado antes de la activación.
- **AC-9** — Subir una imagen de portada a un post/evento propio vía
  `upload-entity` funciona para un `EDITOR` (cierre del bug de 5.9, que hoy siempre
  devuelve 403 para `entityType: post|event`).
- **AC-10** — La opción `editor` de `discovery-doors.ts` deja de tener
  `managesInAdminPanel: true` y su CTA de gestión lleva a la nueva superficie en
  `/mi-cuenta`, no al admin.

## 10. Risks

- **R-1 — Cerrar el gap de `visibility: PUBLIC` hardcodeado (5.2) es un cambio de
  comportamiento en una ruta ya existente**, usada hoy por quien tenga
  `POST_CREATE`/`EVENT_CREATE` (staff con acceso amplio). Verificar que nadie
  dependa hoy de que el create público siempre publique de inmediato antes de
  introducir la rama condicional.
- **R-2 — El fix de `authorId` forzado a `actor.id` (5.3/6.2) rompe cualquier
  llamador actual que dependiera de setear un `authorId` distinto** (por ejemplo,
  contenido cargado por un admin a nombre de otro autor). Auditar usos reales
  antes de aplicar.
- **R-3 — El scoping "sólo lo mío" de las rutas nuevas (`mine`/`:id`, §6.2) es
  más estricto que el modelo de permisos vigente de `EDITOR`** (que hoy permite
  ver/editar todo el contenido editorial, 5.4). Esto es deliberado para la
  superficie nueva, pero deja dos modelos de acceso coexistiendo sobre las mismas
  tablas (amplio desde el admin para quien conserve permisos ahí, acotado desde
  `/mi-cuenta`) — documentar la diferencia con claridad para que no se lea como
  inconsistencia.
- **R-4 — Sacarle `ACCESS_PANEL_ADMIN` a `EDITOR` sin auditar quién lo tiene hoy
  (§6.5) puede cortarle acceso real a alguien de staff** que use ese rol también
  para otra cosa dentro del admin. Bloqueante antes de aplicar el cambio de seed.
- **R-5 — El flag de confianza es mecanismo nuevo sin precedente** (5.7): no hay
  código existente que copiar/verificar contra, mayor superficie de bugs nuevos
  que en el resto de la spec, que en su mayoría cierra gaps ya presentes.

## 11. Open questions

> **Decisiones del owner — 2026-08-02**
>
> **`authorId` se fuerza a `actor.id` server-side y deja de aceptarse en el body.**
> No es "ignorar el campo si viene": sale del schema de creación. Un editor no puede
> firmar como otro, ni por error ni a propósito.
>
> **El acceso al panel de admin queda en `SUPER_ADMIN` y `ADMIN`, nada más.** Se le
> quita `ACCESS_PANEL_ADMIN` / `ACCESS_API_ADMIN` a `EDITOR` **y también a
> `CLIENT_MANAGER`** — este último hoy no lo usa nadie (el propio seed dice *"the
> role is currently unused"*), así que sacarlo ahora no rompe nada y evita dejar un
> permiso vivo en un rol sin dueño. Si se activa más adelante y necesita el panel, se
> le devuelve entonces, con el contexto de para qué.
>
> **Se quita en la MISMA entrega que habilita la carga desde `/mi-cuenta`**, no antes.
> Si se adelanta, un editor activo se queda sin ninguna herramienta hasta que esta
> spec esté implementada. Es criterio de aceptación, no una nota al pie.
>
> **Ojo con la regla de dual-write del repo**: cambiar el seed sólo arregla bases
> nuevas. Sacar estos permisos en staging y prod necesita además una data-migration
> numerada, como la que hizo HOS-152
> (`0010-remove-panel-admin-from-host-commerce-owner.ts`) para el caso equivalente.

- **OQ-1** — Subconjunto exacto de permisos que conserva `EDITOR` una vez que
  pierde `ACCESS_PANEL_ADMIN`/`ACCESS_API_ADMIN`: ¿se queda con `TAG_*`,
  `NEWSLETTER_*`, `USER_*` (hoy los tiene, pero sin acceso al admin no está claro
  para qué le sirven), o se recortan también? ¿Quién tiene el permiso para
  togglear el flag de confianza — uno existente (`USER_UPDATE_ROLES`) o uno
  nuevo?
- **OQ-2** — `visibility` no-pública para contenido en revisión: ¿`PRIVATE` o
  `RESTRICTED`? El enum tiene ambos (`VisibilityEnum`), pero ningún código hoy usa
  ninguno de los dos específicamente para "en revisión, pendiente de aprobación
  editorial" — hay que elegir con criterio de qué implica cada uno en el resto del
  sistema (ej. si `RESTRICTED` ya tiene otro significado en la UI pública).
- **OQ-3** — Path/nombre exacto de la sección nueva en `/mi-cuenta` (¿unificada
  para notas + eventos, o separada? ¿reusa el namespace de `/mi-cuenta/aliados`, o
  uno propio tipo `/mi-cuenta/colaborar`?). Se solapa parcialmente con HOS-375
  (página pública de autor) — coordinar para no duplicar naming.
- **OQ-4** — Dónde vive el flag de confianza exactamente: columna en `users`
  (siguiendo el precedente de `serviceSuspended`) vs. tabla separada. El propio
  issue de Linear lo deja como pregunta explícita ("A definir dónde vive ese
  flag").
- **OQ-5** — Cuándo se dispara la auditoría de editores existentes (§6.5): ¿antes
  de mergear el cambio de seed, como gate manual? ¿Quién la ejecuta y contra qué
  ambiente (staging/prod)?
- **OQ-6** — ¿La transición admin `PENDING → APPROVED` (vía el widget de columna
  existente, `posts.columns.ts:260`/`events.columns.ts:275`) debe empezar a
  promover `visibility` a `PUBLIC` automáticamente como parte de esta spec, o eso
  quedaría roto/pendiente si sólo se toca el camino de creación de `EDITOR`? Sin
  esto, un admin que apruebe manualmente el contenido de un editor no confiable
  seguiría sin publicarlo, porque nada más en el sistema mueve `visibility`.

## 12. Implementation notes

- El fix de `authorId` (6.2 punto 1) y el fix del ownership check de
  `upload-entity.ts` (5.9) son correcciones de seguridad independientes del resto
  de la spec — se pueden (y probablemente deban) shipear como su propio work unit,
  antes de exponer nada nuevo a `EDITOR`.
- `AllianceLeadService`/el flujo de asignación de rol (HOS-278) no se toca acá —
  esta spec asume que el usuario ya tiene el rol `EDITOR` asignado por el camino
  manual existente (5.6).
- Reusar explícitamente `RichTextEditor.client.tsx`, `EditorSectionNav.client.tsx`,
  `ActionBar.client.tsx` y `useZodForm` tal cual están, sin forkearlos — son
  genéricos por diseño y ya lo demuestran en el editor de alojamiento.
- No portar `PhotoSection.client.tsx` — construir un componente de imagen de
  portada nuevo y mucho más simple, acorde a `BaseMediaFields` (JSONB embebido),
  no a la tabla relacional `accommodation_media`.
- El scoping "sólo lo mío" de las rutas nuevas debe implementarse a nivel de
  query del service (filtro real por `authorId`), no como un chequeo posterior en
  la ruta — mismo criterio que ya está documentado como gotcha de este repo
  ("un filtro que el search schema no declara se descarta en silencio").
- Las rutas `protected` nuevas no deben cachearse (son actor-dependientes) — mismo
  criterio ya aplicado a las rutas `protected` de alianzas en HOS-278.

## 13. Linear

Canonical tracking:
HOS-374

Relacionados: HOS-278 (modelo de aprobación de aliados, del que este es el camino
de `editor`), HOS-152 (precedente del incidente de acceso indebido al admin),
HOS-375 (página de autor unificada, se solapa en naming con OQ-3).

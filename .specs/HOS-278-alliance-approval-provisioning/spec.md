---
title: Qué obtiene un aliado cuando se aprueba su postulación
linear: HOS-278
statusSource: linear
created: 2026-08-01
type: feature
areas:
  - db
  - api
  - web
  - admin
---

# Qué obtiene un aliado cuando se aprueba su postulación

## 1. Summary

Hoy aprobar un `alliance_lead` sólo cambia una columna de estado. El solicitante
no se entera, no obtiene nada, y no tiene dónde ver ni administrar lo que le
aprobaron. Esta spec define qué recibe concretamente cada tipo de aliado al ser
aprobado, y construye la pieza de datos que hoy hace imposible cualquiera de esas
respuestas: el vínculo entre la postulación y la cuenta del usuario.

## 2. Problem

Un usuario se postuló como partner, un admin lo aprobó desde el panel, y en la
web no ve absolutamente nada. No se entera de la aprobación y no tiene dónde
administrar nada. Es un callejón sin salida después de una acción que, del lado
del negocio, fue un sí.

Esto **no es un bug**: es la consecuencia directa de una decisión deliberada de
HOS-277 (NG-1), documentada en tres lugares del código —
`apps/api/src/routes/alliance/admin/mark-handled.ts:4-8`,
`packages/service-core/src/services/alliance-lead/alliance-lead.service.ts:238-240`
y `apps/web/src/config/discovery-doors.ts:189-193`. `markHandled` sólo escribe
`status`, `adminNote` y `updatedById`
(`alliance-lead.service.ts:247-287`): no crea entidad, no asigna rol, no notifica.
El alta posterior es 100% manual y fuera del sistema.

Lo que esta spec cambia no es "arreglar un olvido" sino **decidir el producto que
no se había decidido**: qué significa "aprobado" para cada tipo de aliado.

## 3. Goals

- **G-1** — Establecer el vínculo `alliance_leads` → cuenta del usuario, que hoy
  no existe y que bloquea a proveedor y a partner por igual.
- **G-2** — Notificar al solicitante cuando su postulación se aprueba o rechaza.
- **G-3** — Proveedor: que vea su ficha del directorio y edite sus campos
  operativos desde `/mi-cuenta`.
- **G-4** — Partner: que la aprobación habilite la contratación de un plan, y que
  al contratar el partner quede publicado.
- **G-5** — Que `/mi-cuenta/aliados` deje de ser sólo un hub de descubrimiento y
  refleje el estado real de las postulaciones del usuario.

## 4. Non-goals

- **NG-1** — **Sponsor queda fuera.** Decisión del owner (2026-08-01): "aún le
  falta refactor del lado backend". Coincide con el bloqueo por HOS-107 (F-1) que
  este issue ya anotaba. No diseñar ni implementar el camino de sponsor acá.
- **NG-2** — **Editor queda fuera.** Ya tiene camino: el admin promueve al rol
  `EDITOR` y la gestión ocurre en el panel de admin, no en `/mi-cuenta`. Es el
  único de los cuatro que hoy resuelve "acquired" correctamente, vía
  `acquiredPermission: PermissionEnum.POST_CREATE`
  (`apps/web/src/config/discovery-doors.ts:224-236`).
- **NG-3** — **No se crea una ficha de directorio de partners.** HOS-294 decidió
  eliminar `/es/partners/`; la superficie pública de un partner es el carrusel del
  home (logo + nombre + texto corto). Ver §6.3.
- **NG-4** — No se construyen las pantallas de métricas que las landings prometen
  ("reportes de alcance e impacto"). Ver §10 R-4.
- **NG-5** — No se cambia el hecho de que la aprobación siga siendo una decisión
  humana. Nada se auto-aprueba.

## 5. Current baseline

### 5.1 La postulación no sabe quién la hizo

`alliance_leads` (`packages/db/src/schemas/alliance/alliance_lead.dbschema.ts:20-65`)
guarda `contactName`, `email` y `phone` sueltos. **No tiene ninguna columna que
apunte al usuario solicitante.** Los `createdById`/`updatedById`/`deletedById`
existen pero son auditoría de admin.

Y no es un olvido: `AllianceLeadService.createLead`
(`alliance-lead.service.ts:20-27,159-177`) **descarta el actor a propósito**,
incluso cuando quien postula tiene sesión activa — el objeto validado contra
`AllianceLeadCreateInputSchema` no incluye `actor`.

Consecuencia: no hay forma de responder "¿cuáles son mis postulaciones?" para
ningún usuario, ni siquiera uno que estaba logueado al postularse.

### 5.2 Las entidades destino tampoco tienen dueño

| tabla | dueño | superficie pública | modelo |
|---|---|---|---|
| `partner` | **no** (sólo auditoría) | `/partners/` — a eliminar por HOS-294 | pago: `planId`, `subscriptionId`, `tier`, `analytics` |
| `host_trade` | **no** | `/mi-cuenta/directorio-proveedores/` — sólo hosts con permiso | gratis, curado por admin |
| `sponsorship` | **sí** — `sponsorUserId` | contenido patrocinado | pago |

Sponsor es el único con el vínculo ya resuelto, y es justamente el que queda
fuera de alcance.

### 5.3 No existe capa protected para alianzas

`apps/api/src/routes/alliance/index.ts:1-7` sólo exporta `adminAllianceRoutes` y
`publicAllianceRoutes`, con el comentario explícito *"No protected tier — lead
submission is public and lead handling is admin-only"*. No hay
`apps/api/src/routes/alliance/protected/`.

### 5.4 `/mi-cuenta/aliados` no consulta nada

`apps/web/src/pages/[lang]/mi-cuenta/aliados/index.astro:1-53` es un hub estático:
busca la puerta `partner` en `ACCOUNT_DISCOVERY_DOORS`
(`apps/web/src/config/discovery-doors.ts:114-239`) y renderiza `DiscoveryDoorHub`.
**No hace ningún fetch de leads.** El estado "acquired"/"unacquired" se resuelve
únicamente por los roles de la sesión.

Y hay un techo estructural: `sponsor`, `partner` y `serviceProvider` **no declaran
`acquiredPermission`**, con el motivo escrito en el código (`discovery-doors.ts:189-193,
203-207, 218-222`): *"lead-only flow (HOS-277 NG-1) — the admin evaluates and
provisions manually, so this option never resolves to 'acquired'"*. Es decir:
**aunque el endpoint existiera, esta página nunca podría mostrar "aprobado"** sin
tocar también esta configuración.

### 5.5 La asimetría de proveedor

El proveedor entra **gratis** — la landing lo promete: *"Sin costo de inclusión —
el equipo da de alta manualmente tras evaluar tu solicitud"* — y entrega un
`benefit` (columna `NOT NULL`) a los anfitriones.

Pero **no puede ver su propia ficha**. El directorio exige
`PermissionEnum.HOST_TRADE_VIEW` (`apps/api/src/routes/host-trade/protected/list.ts:33`),
que es un beneficio **pago** de anfitrión: el bloque de acceso denegado de la web
ofrece *"Ver planes de suscripción"*
(`apps/web/src/pages/[lang]/mi-cuenta/directorio-proveedores/index.astro:145`). Y
el listado viene además acotado a los destinos donde el host tiene alojamientos.

Da algo, y no puede verificar qué recibe. Tampoco puede corregir un teléfono
desactualizado — y `contact` es el dato más volátil de toda la ficha.

### 5.6 El precedente completo: commerce

Commerce ya resolvió este recorrido entero y es el molde:

1. `POST /api/v1/admin/commerce/leads/:id/approve-and-provision`
   (`apps/api/src/routes/commerce/admin/approve-and-provision.ts:83-134`) crea un
   usuario `COMMERCE_OWNER`, **manda las credenciales por email**, y **vincula el
   lead al usuario provisionado** (`provisionedUserId`).
2. `GET /api/v1/protected/commerce/leads/mine`
   (`apps/api/src/routes/commerce/protected/my-lead.ts:109-122`) matchea por
   `provisionedUserId`, es auth-only y degrada a `{ lead: null }` — nunca 404.
3. El panel vive en `apps/web/src/pages/[lang]/mi-cuenta/comercio/`, documentado
   en `apps/web/docs/commerce-owner-self-service.md`.
4. La puerta de discovery declara `acquiredPermission: PermissionEnum.COMMERCE_EDIT_OWN`
   y `manageHref: 'mi-cuenta/comercio'` (`discovery-doors.ts:148-150,161-162`).

Alliance implementó a medias sólo el paso 1 (cambia `status`, nada más) y omitió
2, 3 y el vínculo de datos que hace posible el 4.

## 6. Proposed design

Tres bloques. El primero es prerequisito de los otros dos, que son independientes
entre sí.

### 6.1 Bloque A — el vínculo postulación ↔ cuenta

Es la pieza que **partner y proveedor necesitan por igual**, y por eso se
construye una sola vez.

- Nueva columna `alliance_leads.applicant_user_id` (nullable, FK a `users.id`).
- `createLead` deja de descartar el actor: si hay sesión, la persiste. **La
  postulación anónima sigue siendo el caso primario** y el campo queda `NULL`.
- Nuevo tier protected: `GET /api/v1/protected/alliance/leads/mine`, siguiendo el
  patrón de `commerce/protected/my-lead.ts` — auth-only, sin permiso extra,
  degradando a lista vacía en vez de 404.

**No hace falta retrocompatibilidad.** El owner confirmó (2026-08-01) que no
existe ninguna aprobación real: las que hay en la base son pruebas suyas. La
columna arranca vacía y sólo se puebla hacia adelante. Sin backfill, sin matcheo
por email, y por lo tanto sin el riesgo de exposición que eso implicaba.

### 6.2 Bloque B — proveedor

Modelo commerce-owner-self-service, adaptado: acá **no se crea una cuenta nueva**,
se vincula la que ya existe.

- `host_trade` recibe un dueño (columna nueva, ver §7).
- Al aprobar un lead `service_provider`, el admin provisiona la ficha y queda
  vinculada al solicitante.
- El proveedor edita desde `/mi-cuenta` **sólo los campos operativos**:
  `contact`, `scheduleText`, `is24h`, `benefit`.
- Quedan **read-only y server-stripped**: `name`, `slug`, `category`,
  `destinationId`, `isActive`. La identidad y la visibilidad las mantiene el
  admin, igual que en commerce.

Esto cierra la asimetría de §5.5 sin regalar el directorio: el proveedor accede a
**su propia ficha**, no al listado que es beneficio pago de anfitrión.

### 6.3 Bloque C — partner

Decisión del owner (2026-08-01): **aprobar → contratar → publicar.**

- La aprobación **no publica**: habilita al usuario a contratar un plan de partner
  desde `/mi-cuenta`. La fila `partner` existe pero no es visible.
- Al confirmarse el pago, el partner queda publicado.
- **La superficie pública es el carrusel del home** — logo, nombre y texto corto.
  No hay ficha de directorio ni página de detalle: HOS-294 elimina `/es/partners/`.

Consecuencia de alcance que conviene tener presente: si lo público es logo +
nombre + texto corto, lo que el partner administra son **esos tres campos** más el
estado de su suscripción. El resto de la tabla (`type`, `tier`, `description`
larga, `analytics`) no tiene hoy dónde mostrarse.

Las columnas `planId`, `subscriptionId` y la tabla `partner_subscription`
(con `productDomain`) ya existen sin uso: son exactamente el andamiaje de este
flujo.

### 6.4 Notificación

Al aprobar o rechazar, se notifica al solicitante por email. Es lo que la copy ya
promete ("te vamos a contactar") y hoy depende de que el admin se acuerde de
escribir a mano. Reusa el puerto de notificación del flujo de commerce.

Aplica también a `sponsor` y `editor` aunque su provisioning quede fuera de
alcance: notificar no depende de provisionar.

### 6.5 `/mi-cuenta/aliados`

Pasa a consultar `/protected/alliance/leads/mine` y mostrar el estado real de cada
postulación, además del hub de descubrimiento que ya tiene.

Requiere tocar `ACCOUNT_DISCOVERY_DOORS`: hoy las puertas de `partner` y
`serviceProvider` **no pueden** resolver a "acquired" (§5.4). El estado de la
postulación no se deriva de un permiso, así que necesita su propio camino.

## 7. Data model / contracts

### Migraciones

| tabla | cambio | notas |
|---|---|---|
| `alliance_leads` | `+ applicant_user_id` (uuid, null, FK `users.id`) | Bloque A. Nullable: la postulación anónima es el caso primario. |
| `host_trade` | `+ owner_user_id` (uuid, null, FK `users.id`) | Bloque B. Nullable: las fichas existentes no tienen dueño. |

`partner` no necesita columna de dueño nueva **si** el vínculo se resuelve vía la
suscripción; a confirmar al implementar (§11 OQ-3).

### Endpoints nuevos

| método | ruta | tier | notas |
|---|---|---|---|
| `GET` | `/api/v1/protected/alliance/leads/mine` | protected | auth-only, degrada a `[]`, nunca 404 |
| `GET` | `/api/v1/protected/host-trades/mine` | protected | la ficha propia del proveedor |
| `PATCH` | `/api/v1/protected/host-trades/mine` | protected | sólo campos operativos; el resto server-stripped |

El endpoint de partner para contratar debe reusar el camino de checkout existente,
no uno nuevo.

### Contrato de escritura del proveedor

El schema de update del proveedor **acepta exclusivamente** `contact`,
`scheduleText`, `is24h`, `benefit`. Cualquier otro campo se descarta en el
servidor, no sólo en la UI — mismo criterio que commerce owner.

## 8. UX / UI behavior

- **`/mi-cuenta/aliados`** — lista las postulaciones del usuario con su estado
  (`pending` / `reviewing` / `approved` / `rejected`), su fecha, y para las
  aprobadas un acceso a lo que corresponda por tipo.
- **Proveedor aprobado** — accede a su ficha. Los campos de identidad se muestran
  pero deshabilitados, con una explicación de por qué (los mantiene el equipo).
- **Partner aprobado sin contratar** — ve que fue aprobado y el CTA para contratar.
  La copy **no** debe decir que ya está publicado.
- **Partner contratado** — ve su estado de suscripción y administra los campos que
  el carrusel muestra.
- **Rechazado** — se muestra el estado. No se expone el `adminNote` salvo decisión
  explícita (§11 OQ-4).

Toda la copy nueva va por i18n en es/en/pt, **traducida, no copiada**.

## 9. Acceptance criteria

- **AC-1** — Un usuario logueado que se postula queda vinculado: el lead guarda su
  `applicant_user_id`.
- **AC-2** — Un visitante anónimo puede seguir postulándose exactamente igual que
  hoy; el lead se crea con `applicant_user_id` en `NULL`.
- **AC-3** — `GET /protected/alliance/leads/mine` devuelve sólo las postulaciones
  del usuario autenticado. Un usuario nunca ve las de otro.
- **AC-4** — Ese endpoint devuelve lista vacía (no 404, no 403) para un usuario sin
  postulaciones.
- **AC-5** — Al aprobar o rechazar un lead, el solicitante recibe un email.
- **AC-6** — Un proveedor aprobado ve su ficha en `/mi-cuenta` **sin** tener
  `HOST_TRADE_VIEW` ni suscripción de anfitrión.
- **AC-7** — Un proveedor puede editar `contact`, `scheduleText`, `is24h` y
  `benefit`, y los cambios se reflejan en el directorio.
- **AC-8** — Un proveedor **no** puede modificar `name`, `slug`, `category`,
  `destinationId` ni `isActive`: un PATCH con esos campos los descarta en el
  servidor y devuelve éxito sin haberlos aplicado.
- **AC-9** — Un proveedor no puede leer ni editar la ficha de otro proveedor.
- **AC-10** — Un partner aprobado pero sin contratar **no** aparece en el carrusel
  del home.
- **AC-11** — Al confirmarse el pago, el partner aparece en el carrusel.
- **AC-12** — `/mi-cuenta/aliados` muestra el estado real de cada postulación del
  usuario, no sólo las puertas de descubrimiento.
- **AC-13** — Ninguna copy afirma que el aliado obtuvo algo que el código no le dio
  (ver §10 R-4).

## 10. Risks

- **R-1 — El email del lead no está verificado.** Ya no aplica al backfill (no hay
  datos que migrar), pero sigue vigente como regla permanente: **nunca resolver
  "mis postulaciones" matcheando por email**. Cualquiera puede escribir el de otra
  persona en un formulario público. El vínculo es siempre por `applicant_user_id`.
- **R-2 — Alcance de partner sujeto a HOS-294.** Todo el bloque C asume que la
  superficie pública es el carrusel. Si HOS-294 se revisara, cambia qué administra
  el partner y probablemente qué se le cobra.
- **R-3 — Aprobar deja de ser reversible sin costo.** Hoy aprobar sólo cambia una
  columna. Cuando además provisione, notifique y habilite un cobro, un error de
  aprobación tiene consecuencias visibles para el usuario. Definir el camino de
  reversa.
- **R-4 — Copy que promete lo que no existe.** Las landings ya prometen cosas sin
  implementación: sponsor ofrece *"reportes de alcance e impacto de cada campaña"*
  (la columna `analytics` existe, la pantalla no) y partner ofrece *"visibilidad
  conjunta"* y *"condiciones a medida"*, que son acuerdos comerciales, no features.
  No agregar promesas nuevas en las pantallas de cuenta.
- **R-5 — Alcance real de proveedor.** Es una ficha con cuatro campos editables. No
  construir un panel del tamaño del de commerce para eso.

## 11. Open questions

- ~~OQ-1~~ **CERRADA** (2026-08-01, owner): no hay aprobaciones reales — las
  existentes son pruebas del propio owner. No se necesita retrocompatibilidad ni
  backfill. La columna arranca vacía y funciona sólo hacia adelante.
- **OQ-2** — ¿El provisioning es automático en `markHandled` o un botón explícito
  "Aprobar y provisionar" por tipo? Commerce usa botón explícito. Que sean pasos
  separados permite aprobar sin provisionar todavía.
- **OQ-3** — ¿Cómo se vincula el partner a su usuario: columna nueva en `partner`,
  o se deriva de la suscripción vía `partner_subscription`?
- **OQ-4** — ¿El solicitante ve el `adminNote` cuando lo rechazan? Hoy es un campo
  interno; exponerlo cambia cómo lo escribe el admin.
- **OQ-5** — Un proveedor que además es anfitrión con plan: ¿ve su ficha por las
  dos vías? Hay que confirmar que no se pisan.

## 12. Implementation notes

- `AllianceLeadService` extiende `BaseService`, **no** `BaseCrudService`: no hay
  hooks `_before*`/`_after*`. Los métodos nuevos se escriben a mano siguiendo
  `runWithLoggingAndValidation`. Es deliberado — el create es público y
  list/mark-handled son acciones de workflow, no CRUD.
- Un filtro que el schema de búsqueda no declara **se descarta en silencio** y
  abre la query a todo. Al filtrar por `applicant_user_id`, verificar que el
  schema exacto que usa el método lo declare.
- Las rutas protected nuevas no deben cachearse: son actor-dependientes por
  definición.
- `host_trade` **no tiene soft delete de dueño**: revisar qué pasa con la ficha si
  el usuario vinculado se da de baja.

## 13. Linear

Canonical tracking:
HOS-278

Relacionados: HOS-294 (elimina `/es/partners/`, define la superficie de partner),
HOS-107 (consolidación de sponsors — bloquea el camino de sponsor), HOS-279
(campos custom de `message` a columnas estructuradas), HOS-277 (la spec original
de captación, ya Done).

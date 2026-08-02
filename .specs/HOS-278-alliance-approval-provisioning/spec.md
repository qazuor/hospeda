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
  - billing
---

# Qué obtiene un aliado cuando se aprueba su postulación

## 1. Summary

Hoy aprobar un `alliance_lead` sólo cambia una columna de estado. El solicitante no
se entera, no obtiene nada, y no tiene dónde ver ni administrar lo que le aprobaron.

Esta spec define el recorrido completo de los cuatro tipos de aliado —partner,
proveedor, editor y sponsor— y construye las dos piezas que hoy hacen imposible
cualquiera de ellos: el vínculo entre la postulación y la cuenta del usuario, y el
alta de datos posterior a la aprobación.

Las definiciones de producto que siguen son decisiones del owner tomadas en la
sesión del 2026-08-01/02.

## 2. Problem

Un usuario se postuló como partner, un admin lo aprobó desde el panel, y en la web
no ve absolutamente nada.

Esto **no es un bug**: es la consecuencia de una decisión deliberada de HOS-277
(NG-1), documentada en tres lugares del código —
`apps/api/src/routes/alliance/admin/mark-handled.ts:4-8`,
`packages/service-core/src/services/alliance-lead/alliance-lead.service.ts:238-240`
y `apps/web/src/config/discovery-doors.ts:189-193`. `markHandled` sólo escribe
`status`, `adminNote` y `updatedById`: no crea entidad, no asigna rol, no notifica.

Lo que faltaba no era código sino **la definición de qué significa "aprobado"** para
cada tipo. Eso es lo que esta spec fija.

## 3. Goals

- **G-1** — Vincular la postulación a la cuenta del solicitante, con consentimiento
  del titular del email.
- **G-2** — Partir el formulario en dos: lead corto público, alta completa después
  de aprobar.
- **G-3** — Notificar al solicitante cuando su postulación se aprueba o rechaza.
- **G-4** — Proveedor: que vea y edite su ficha del directorio.
- **G-5** — Partner: que la aprobación lleve a cargar datos, revisión, pago y
  publicación, en ese orden.
- **G-6** — Que `/mi-cuenta/aliados` muestre el estado real de las postulaciones.

## 4. Non-goals

- **NG-1** — **Sponsor queda fuera de esta spec.** Bloqueado por HOS-107
  (consolidación sobre el modelo genérico `Sponsorship`) y postergado por el owner:
  *"aún le falta refactor del lado backend"*. Su definición funcional está en §6.5
  para que no se pierda, pero no se implementa acá.
- **NG-2** — **Retrocompatibilidad.** No existe ninguna aprobación real: las que hay
  en la base son pruebas del owner. El vínculo arranca vacío y sólo se puebla hacia
  adelante. Sin backfill, sin matcheo por email.
- **NG-3** — El registro de uso del beneficio del proveedor y las valoraciones
  mutuas → **HOS-376**, deliberadamente separado.
- **NG-4** — El editor cargando desde la web → **HOS-374**.
- **NG-5** — La página de autor unificada → **HOS-375**.
- **NG-6** — La bitácora de menciones del partner → **HOS-377**.
- **NG-7** — La ficha pública del partner → **HOS-294**.
- **NG-8** — No se auto-aprueba nada. Toda aprobación sigue siendo humana.

## 5. Current baseline

### 5.1 La postulación no sabe quién la hizo

`alliance_leads` (`packages/db/src/schemas/alliance/alliance_lead.dbschema.ts:20-65`)
guarda `contactName`, `email` y `phone` sueltos. **No tiene columna que apunte al
usuario solicitante** — los `createdById`/`updatedById` son auditoría de admin.

No es un olvido: `AllianceLeadService.createLead`
(`alliance-lead.service.ts:20-27,159-177`) **descarta el actor a propósito**, incluso
cuando quien postula tiene sesión activa.

### 5.2 Las entidades destino tampoco tienen dueño

| tabla | dueño | superficie | modelo |
|---|---|---|---|
| `partner` | **no** | carrusel del home; ficha propia sólo gold (HOS-294) | pago |
| `host_trade` | **no** | `/mi-cuenta/directorio-proveedores/` | gratis |
| `sponsorship` | **sí** — `sponsorUserId` | contenido puntual | pago único |

### 5.3 No existe capa protected para alianzas

`apps/api/src/routes/alliance/index.ts:1-7` sólo exporta admin y public, con el
comentario *"No protected tier"*.

### 5.4 `/mi-cuenta/aliados` no consulta nada

Es un hub estático sobre `ACCOUNT_DISCOVERY_DOORS`. Y tiene un techo: `partner` y
`serviceProvider` **no declaran `acquiredPermission`**
(`discovery-doors.ts:189-193, 218-222`), así que **aunque el endpoint existiera, esa
página nunca podría mostrar "aprobado"**. Esa config también hay que tocarla.

### 5.5 Lo que ya existe y se reusa

- **Canje sin cobro**: `SubscriptionStatusEnum.COMP`
  (`apps/api/src/services/subscription-comp-create.service.ts`) inserta la
  suscripción sin preapproval de MercadoPago, la excluye del dunning, y
  `loadEntitlements` la trata como activa.
- **Pago único**: el camino de addons (`apps/api/src/routes/billing/addons.ts`), ya
  usado por `visibility-boost`.
- **Revisión editorial — la columna existe, el gate NO.** `posts` y `events` tienen
  `moderationState` (`PENDING` / `APPROVED` / `REJECTED`), pero **hoy no bloquea
  nada**: los schemas HTTP de creación hardcodean `visibility: PUBLIC`
  (`event.http.schema.ts:316` y su par en post), y ningún servicio filtra lecturas
  públicas por `moderationState`. Un contenido creado en `PENDING` es público al
  instante. Cerrar ese gate es trabajo obligatorio de HOS-374, no algo que ya esté.
- **Autoría de eventos**: `events.authorId` existe, con índice propio.
- **El molde completo**: commerce (`approve-and-provision` → crea usuario, manda
  credenciales, vincula `provisionedUserId` → `GET /protected/commerce/leads/mine` →
  panel en `/mi-cuenta/comercio`).

## 6. Proposed design

### 6.1 El formulario se parte en dos

**Lead (público, anónimo o no):** sólo lo necesario para evaluar — contacto, nombre
de la empresa, categoría, sitio web y qué propone.

**Alta (después de aprobar, ya con cuenta):** logo, redes, dirección, teléfono,
summary, descripción, y lo específico de cada tipo.

Motivo: pedir un logo y dos textos largos antes de evaluar sube el abandono justo en
el paso de captación, y convierte cada rechazo en trabajo tirado del solicitante.

### 6.2 El vínculo con la cuenta

| situación | qué pasa |
|---|---|
| **Autenticado** | Se usa su cuenta. **No se le pide el email**: ya lo sabemos. El lead queda vinculado en el acto. |
| **Anónimo, email sin cuenta** | Se crea cuenta nueva con ese email al aprobar. |
| **Anónimo, email con cuenta** | **Se manda un email de confirmación al titular** — *"alguien postuló X con tu email, confirmá si sos vos"*. El vínculo se establece recién con ese clic. |

Dos reglas que no se negocian:

1. **El formulario nunca revela si un email ya tiene cuenta.** Responder eso en un
   form público sin autenticar permite enumerar usuarios.
2. **Nunca se vincula un lead anónimo a una cuenta existente sin confirmación del
   titular.** El email del lead no está verificado: sin ese paso, cualquiera podría
   colgar una postulación —y los beneficios que traiga— de la cuenta de otra persona.

### 6.3 Partner — aprobar, cargar, revisar, cobrar, publicar

El orden importa y es una decisión explícita del owner: **se revisa antes de
cobrar.**

1. Postula (lead corto).
2. Se evalúa y aprueba.
3. Se entera y carga sus datos completos.
4. **Un admin revisa logo y textos.**
5. Con el contenido aprobado, se le habilita el pago.
6. Paga.
7. **Publica al instante.**

Así nadie paga por días en los que no se lo ve. Si el ciclo arrancara con el cobro,
una revisión que demora una semana es una semana de nada facturada.

**Qué recibe:** carrusel del home siempre; ficha propia `/partners/<slug>/` **sólo
gold**; y las acciones manuales de difusión, donde gold entra antes y más seguido.

**Planes:** `silver` y `gold`, en ciclos mensual, trimestral, semestral y anual. Se
soporta canje vía `COMP`. Si deja de pagar, la visibilidad baja a cero.

### 6.4 Proveedor — gratis, aporta un beneficio

1. Postula (lead corto).
2. Se evalúa y aprueba; el alta puebla su ficha del directorio.
3. Se entera.
4. Entra a `/mi-cuenta` y ve su ficha, con lo operativo editable.

**Edita:** `contact`, horarios (`scheduleText` / `is24h`) y el beneficio.
**Read-only, server-stripped:** `name`, `slug`, `category`, `destinationId`,
`isActive` — identidad y visibilidad las mantiene el admin.

**El beneficio se carga estructurado + libre:** un tipo cerrado (porcentaje, monto
fijo, 2x1, condición especial) con su valor, más un texto para la letra chica. Eso
permite mostrarlo como badge, filtrar el directorio y medirlo después. Con texto
libre puro nada de eso es posible.

**No vence**, pero **cada edición vuelve a pasar por revisión de admin**: si el
beneficio es la contraprestación por estar listado, no puede degradarse en silencio.

**La landing dice de frente que el directorio es un beneficio pago de la suscripción
de anfitrión**, y lo usa como argumento: su beneficio llega a gente con propiedades
activas que pagó para acceder. Es calidad de audiencia, no letra chica.

### 6.5 Sponsor — definido, no implementado acá

Se deja escrito para que no se pierda (ver NG-1):

- **Pago único, no suscripción** → camino de addons.
- **Contenido existente primero**, por catálogo self-service. El contenido nuevo es
  necesariamente negociado y queda para después.
- Puede ofrecer cupón — `couponCode` y `couponDiscountPercent` ya existen. Ojo: si
  lo hace, el sponsor pasa a **aportar** y se parece más al proveedor de lo que
  parece.

### 6.6 Editor — el premio depende de quién sea

El camino de carga es HOS-374 y la superficie de reconocimiento es HOS-375. Acá se
fija sólo el premio:

| quién es el editor | qué recibe |
|---|---|
| Sólo turista | Comp de turista VIP |
| Ya anfitrión, comercio o partner | Descuento o meses bonificados sobre la suscripción que **ya paga** |

**Esto es obligatorio y no es un detalle.** `TOURIST_VIP_ENTITLEMENTS`
(`packages/billing/src/config/plans.config.ts:48-55`) es heredado por **todo** plan
de owner y complex (SPEC-216): *"an owner is also a full tourist, so owner plans
grant the tourist-VIP features in addition to their owner-specific ones"*. Darle un
comp de turista VIP a un anfitrión **no le agrega absolutamente nada** — y el gancho
cruzado de la landing apunta justamente a él.

### 6.7 Notificación

Al aprobar o rechazar, se le escribe al solicitante. Es lo que la copy ya promete y
hoy depende de que el admin se acuerde de hacerlo a mano. Aplica a los cuatro tipos,
incluso a los que no se provisionan en esta spec.

### 6.8 `/mi-cuenta/aliados`

Pasa a consultar las postulaciones del usuario y mostrar su estado real, además del
hub de descubrimiento. Requiere tocar `ACCOUNT_DISCOVERY_DOORS` (§5.4).

## 7. Data model / contracts

### Migraciones

| tabla | cambio | notas |
|---|---|---|
| `alliance_leads` | `+ applicant_user_id` (uuid, null, FK `users.id`) | Nullable: el lead anónimo es el caso primario. |
| `alliance_leads` | `+ claim_token` / `claim_expires_at` | Para la confirmación del titular (§6.2). Forma exacta a definir. |
| `host_trade` | `+ owner_user_id` (uuid, null, FK `users.id`) | Nullable: las fichas existentes no tienen dueño. |
| `host_trade` | beneficio estructurado: `benefit_type`, `benefit_value` | El `benefit` de texto actual pasa a ser la letra chica. |

`partner`: a confirmar si necesita columna de dueño propia o se deriva de la
suscripción vía `partner_subscription` (§11 OQ-2).

### Endpoints nuevos

| método | ruta | notas |
|---|---|---|
| `GET` | `/api/v1/protected/alliance/leads/mine` | auth-only, degrada a `[]`, nunca 404 |
| `POST` | `/api/v1/protected/alliance/leads/:id/claim` | confirma la titularidad del email |
| `GET` | `/api/v1/protected/host-trades/mine` | la ficha propia del proveedor |
| `PATCH` | `/api/v1/protected/host-trades/mine` | sólo campos operativos; el resto server-stripped |

## 8. UX / UI behavior

- **`/mi-cuenta/aliados`** — postulaciones con su estado y fecha; para las aprobadas,
  acceso a lo que corresponda por tipo.
- **Partner aprobado sin cargar datos** — CTA para completar su información. La copy
  **no** debe decir que ya está publicado.
- **Partner con datos en revisión** — se ve que está en revisión, sin opción de pago
  todavía.
- **Partner con contenido aprobado** — CTA de pago.
- **Proveedor aprobado** — su ficha; los campos de identidad visibles pero
  deshabilitados, con la explicación de por qué.
- **Rechazado** — se muestra el estado. El `adminNote` no se expone salvo decisión
  explícita (§11 OQ-3).

Toda copy nueva va por i18n en es/en/pt, traducida.

## 9. Acceptance criteria

- **AC-1** — Un usuario autenticado que postula queda vinculado en el acto, y el
  formulario no le pide el email.
- **AC-2** — Un visitante anónimo puede postularse igual que hoy.
- **AC-3** — El formulario **nunca** revela si un email ya tiene cuenta, ni en la
  respuesta ni en el tiempo de respuesta.
- **AC-4** — Un lead anónimo cuyo email pertenece a una cuenta existente **no queda
  vinculado** hasta que el titular confirma desde el email.
- **AC-5** — `GET /protected/alliance/leads/mine` devuelve sólo las postulaciones del
  usuario autenticado, y `[]` (no 404, no 403) si no tiene.
- **AC-6** — Al aprobar o rechazar, el solicitante recibe un email.
- **AC-7** — Un proveedor aprobado ve su ficha **sin** tener `HOST_TRADE_VIEW` ni
  suscripción de anfitrión.
- **AC-8** — Un proveedor edita contacto, horarios y beneficio; los cambios en el
  beneficio quedan pendientes de revisión antes de verse en el directorio.
- **AC-9** — Un PATCH de proveedor con `name`, `slug`, `category`, `destinationId` o
  `isActive` los descarta en el servidor.
- **AC-10** — Un proveedor no puede leer ni editar la ficha de otro.
- **AC-11** — A un partner **no se le habilita el pago** hasta que su contenido está
  aprobado.
- **AC-12** — Un partner que pagó aparece publicado sin espera adicional.
- **AC-13** — Un editor que ya tiene plan de anfitrión **no** recibe un comp de
  turista VIP.
- **AC-14** — `/mi-cuenta/aliados` muestra el estado real de cada postulación.

## 10. Risks

- **R-1 — El email del lead no está verificado.** Regla permanente: **nunca**
  resolver "mis postulaciones" matcheando por email. El vínculo es siempre por
  `applicant_user_id`.
- **R-2 — Comps de turista sobre usuarios anfitrión.** **HOS-238** fue exactamente
  *"un comp (o cualquier sub tourist-category) de un usuario HOST resuelve
  entitlements de owner-basico en vez del plan real"*. Está cerrado, pero §6.6 crea
  ese escenario a propósito: verificar que la corrección lo cubra antes de convertirlo
  en flujo habitual.
- **R-3 — Datos cargados que nunca se pagan.** Con la revisión antes del cobro, un
  partner puede cargar todo y no pagar nunca. Definir cuánto viven esos datos.
- **R-4 — Aprobar deja de ser reversible sin costo.** Hoy sólo cambia una columna.
  Cuando además notifique, provisione y habilite un cobro, un error tiene
  consecuencias visibles. Definir el camino de reversa.
- **R-5 — Copy que promete lo que no existe.** Sponsor ya ofrece *"reportes de alcance
  e impacto"* que no existen; partner ofrece *"visibilidad conjunta"* y *"condiciones
  a medida"*, que son acuerdos comerciales. No agregar promesas nuevas.

## 11. Open questions

- **OQ-1** — ¿El provisioning es automático al aprobar, o un botón explícito
  "Aprobar y provisionar" por tipo? Commerce usa botón explícito, lo que permite
  aprobar sin provisionar todavía.
- **OQ-2** — ¿Cómo se vincula el partner a su usuario: columna en `partner` o vía
  `partner_subscription`?
- **OQ-3** — ¿El solicitante ve el `adminNote` al ser rechazado? Exponerlo cambia
  cómo lo escribe el admin.
- **OQ-4** — Un proveedor que además es anfitrión con plan: ¿ve su ficha por las dos
  vías sin que se pisen?
- **OQ-5** — Forma exacta del token de confirmación de titularidad: vencimiento,
  reenvío, y qué pasa si nunca se confirma.

## 12. Implementation notes

- `AllianceLeadService` extiende `BaseService`, **no** `BaseCrudService`: no hay
  hooks `_before*`/`_after*`. Los métodos nuevos se escriben a mano siguiendo
  `runWithLoggingAndValidation`.
- Un filtro que el schema de búsqueda no declara **se descarta en silencio** y abre
  la query a todo. Al filtrar por `applicant_user_id`, verificar que el schema del
  método lo declare.
- Las rutas protected nuevas no deben cachearse: son actor-dependientes.
- `host_trade` no contempla qué pasa con la ficha si el usuario vinculado se da de
  baja.

## 13. Linear

Canonical tracking:
HOS-278

Derivados de esta definición: HOS-294 (ficha pública de partner), HOS-374 (editor en
la web), HOS-375 (página de autor), HOS-376 (uso y valoraciones de proveedor),
HOS-377 (bitácora de menciones).
Bloqueos y contexto: HOS-107 (sponsor), HOS-238 (comp sobre host), HOS-277 (la spec
original de captación, Done), HOS-296 (colisión de email y rol único).

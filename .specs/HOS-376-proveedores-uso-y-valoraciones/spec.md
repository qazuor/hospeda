---
title: Proveedores — registro de uso del beneficio y valoraciones
linear: HOS-376
statusSource: linear
created: 2026-08-08
type: feature
areas:
  - db
  - api
  - web
  - admin
  - content
---

# Proveedores — registro de uso del beneficio y valoraciones

## 1. Summary

Construir el registro de **uso del beneficio** entre un anfitrión y un proveedor del
directorio (`host_trades`), y sobre ese registro habilitar **valoraciones públicas**
del anfitrión hacia el proveedor, con **derecho a réplica** y moderación.

El mecanismo central es *una parte declara, la otra confirma*. Ese patrón **no existe
en el repo** — se diseña acá desde cero.

## 2. Problem

El proveedor entra gratis al directorio y aporta un beneficio a anfitriones. La promesa
de la landing es "cartera de clientes curados y abundante", pero hoy **no hay ninguna
medición**: nadie sabe cuántas veces se usó un beneficio ni qué opinan del proveedor.
Sin ese dato no se puede sostener la promesa ni, eventualmente, justificar cobrarle.

Y sin valoraciones visibles, elegir proveedor en el directorio es a ciegas.

El obstáculo original era que **nadie tenía incentivo para registrar un uso**. La
solución mueve el trabajo pesado a quien sí lo tiene (el proveedor, que quiere sus
números) y usa la confirmación de la contraparte como control anti-inflado.

## 3. Goals

- **G-1** — Que exista un registro verificable de "este anfitrión usó el beneficio de
  este proveedor", confirmado por las dos partes.
- **G-2** — Que el proveedor vea sus números en `/mi-cuenta`, incluidos los pendientes,
  para que sepa que su carga no cayó en el vacío.
- **G-3** — Que el anfitrión pueda valorar públicamente a un proveedor **sólo si tiene
  un uso confirmado con él**, y que el proveedor pueda responder públicamente.
- **G-4** — Que la reputación mostrada en el directorio (promedio, valoraciones, usos,
  anfitriones distintos) sea difícil de falsear y, cuando alguien lo intente, que se vea.
- **G-5** — Que un admin pueda moderar valoraciones y réplicas desde una pantalla real,
  no sólo por API.

### Métricas de éxito

- ≥ 60% de los pedidos de confirmación se resuelven (confirmados o rechazados) antes de
  los 30 días.
- ≥ 30% de los usos confirmados derivan en una valoración.
- 0 valoraciones publicadas sin uso confirmado previo (invariante, verificado por test).

## 4. Non-goals

- **NG-1** — El proveedor **no** valora al anfitrión. Unidireccional. Una valoración del
  proveedor sobre su cliente no le sirve a nadie para decidir y crearía un registro
  reputacional sobre alguien que paga para acceder al directorio.
- **NG-2** — **No** hay auto-confirmación por plazo. El silencio no convalida; el pedido
  vence a los 30 días y no cuenta.
- **NG-3** — **No** se construye infraestructura de notificaciones in-app genérica. La
  sección de pendientes es una ruta con una query, no un centro de notificaciones.
- **NG-4** — **No** se agrega i18n a `packages/notifications`. Los templates nuevos van
  en español hardcodeado, como los ~40 existentes.
- **NG-5** — **No** se agrega verificación de plan/suscripción al acceso al directorio, y
  **no es un olvido**: el owner definió el 2026-08-08 que el directorio es **gancho de
  captación**, no perk de plan pago. El acceso libre para cualquier anfitrión es deliberado.
  Lo único que está mal ahí es el **copy** (ver §5, hallazgo 3) — no el gate. Nadie debería
  "arreglar" esto agregando un `requireEntitlement`.
- **NG-6** — **No** se soporta el caso "el anfitrión no existe en el sistema". El
  beneficio sólo se conoce dentro del directorio, que exige rol `HOST`.
- **NG-7** — **No** se hace multi-destino para proveedores (`host_trades.destinationId`
  es uno solo).

## 5. Current baseline

Relevamiento del 2026-08-07/08. Todo lo de acá está verificado contra el código, no
asumido.

### El proveedor es `host_trades`, no `partners`

- `packages/db/src/schemas/host-trade/host_trade.dbschema.ts` — tabla `host_trades`
  (SPEC-241, extendida por HOS-278). `slug` UNIQUE NOT NULL, `destinationId` uuid **NOT
  NULL** (un solo destino, `onDelete: restrict`), `benefit`/`benefitType`/`benefitValue`,
  el trío `pendingBenefit*` + `benefitReviewState`, y `revokedAt`/`revokedById`/
  `revokeReason` (baja sin borrar fila).
- **`ownerUserId` es nullable** (FK `users`, `onDelete: set null`): hay filas
  admin-curadas pre-HOS-278 sin dueño, y aplicantes aprobados cuyo email nunca confirmó
  cuenta.
- **El proveedor aprobado NO recibe rol ni permiso** (AC-7 de HOS-278). Sigue siendo
  `USER`; toda su autorización es **ownership de fila** vía
  `/api/v1/protected/host-trades/mine`.
- `partners` es otra cosa: auspiciantes con plan pago (`subscriptionStatus`, `tier`,
  `planId`). No interviene acá.

### Permisos existentes

`packages/service-core/src/services/hostTrade/host-trade.permissions.ts` +
`packages/schemas/src/enums/permission.enum.ts:943-950`: `HOST_TRADE_VIEW`,
`_VIEW_ALL`, `_CREATE`, `_UPDATE`, `_DELETE`, `_RESTORE`, `_HARD_DELETE`. En el seed
(`packages/seed/src/required/rolePermissions.seed.ts`): `SUPER_ADMIN` y `ADMIN` los
tienen todos; **`HOST` sólo tiene `HOST_TRADE_VIEW`**; ningún otro rol tiene ninguno.

### Cómo se identifica un anfitrión

Rol `RoleEnum.HOST`, otorgado **automáticamente e idempotentemente al crear una
accommodation** (`packages/service-core/src/services/accommodation/accommodation.service.ts:1413-1430`,
`RoleGrantReason.ACCOMMODATION_CREATED`).

**Hallazgo 3 — el acceso al directorio es gratis, y así tiene que ser**. En el código no
hay ningún gate de billing, verificado en las cuatro piezas de la cadena:

1. `apps/api/src/routes/host-trade/protected/list.ts:33` — el único gate es
   `[PermissionEnum.HOST_TRADE_VIEW]`; no hay `requireEntitlement`.
2. `host-trade.service.ts:438-485` — `listForHost` chequea el permiso, busca las
   accommodations del actor por `ownerId` y devuelve los proveedores de esos destinos.
   Cero verificación de suscripción.
3. `packages/seed/src/required/rolePermissions.seed.ts:1087` — el rol `HOST` tiene
   `HOST_TRADE_VIEW`.
4. `accommodation.service.ts:1424-1430` — el rol `HOST` se otorga *"unconditionally and
   idempotently"* al crear el **borrador** de onboarding (`LifecycleStatusEnum.DRAFT`),
   sin mirar ningún plan.

**Decisión del owner (2026-08-08): el directorio es GANCHO DE CAPTACIÓN.** El acceso libre
es intencional, así que el código está correcto y NO hay que agregarle un gate (NG-5).

Lo que sí está mal son dos textos, y conviene no confundirlos con el comportamiento:

- La frase de la issue *"anfitriones que **pagan** por acceder al directorio"* describe un
  modelo que no existe. La monetización apunta al **proveedor**, no al anfitrión — que es
  exactamente lo que esta spec habilita al medir el uso.
- `apps/web/src/pages/[lang]/mi-cuenta/directorio-proveedores/index.astro:144` promete
  *"necesitás un plan de anfitrión activo"*. Ese mensaje sale sólo en el 403, y el 403 sólo
  le llega a quien no es `HOST`: un anfitrión sin plan nunca lo ve, porque nunca se le niega
  el acceso. Es copy que promete un requisito inexistente. Corregirlo es trabajo aparte.

**Hallazgo 4 — no existe búsqueda de usuarios para actores no-admin**.
`GET /protected/users/:id` está escopeado a uno mismo (`UserService._canView` exige
`actor.id === entity.id` salvo `USER_READ_ALL`); la única búsqueda con filtro de texto
es `GET /admin/users`. Hay que construir el mecanismo de identificación (§6.2).

### Reviews: 4 tablas espejadas, ninguna con réplica

| Tabla | Rating | Default moderación |
|---|---|---|
| `accommodation_reviews` | jsonb NOT NULL, 6 dims | **`APPROVED`** (reviewer "semi-verificado" por conversación previa) |
| `destination_reviews` | jsonb NOT NULL, 18 dims | `PENDING` |
| `gastronomy_reviews` | jsonb **nullable** + `overallRating` escalar | `PENDING` |
| `experience_reviews` | jsonb NOT NULL + `overallRating` escalar | `PENDING` |

Las 4 comparten: UNIQUE `(userId, entityId)`, FK cascade al padre, soft-delete,
`moderatedById`/`moderatedAt`/`moderationReason`, índice de `moderationState`.

- **No existe réplica del dueño en NINGÚN dominio del repo.** Los campos
  `hasOwnerResponse`/`responseAfter` de `accommodationReview.http.schema.ts` son
  **scaffold muerto** — ningún route ni service lo importa.
- **No existe gate de "uso verificado"**, porque **no hay tabla de reservas en todo el
  codebase**. `accommodation_reviews` lo aproxima exigiendo conversación previa con el
  host, resuelto 100% client-side en `ReviewSidebarCard.client.tsx`.
- **No hay UI de admin para moderar** reviews de accommodation/destination — sólo el
  endpoint. El sub-tab del admin es read-only y su propio código dice "Mock
  visualization". **Commerce sí la tiene**:
  `apps/admin/src/features/commerce/hooks/createCommerceEntityHooks.ts`
  (`useModerateReviewMutation`, `usePendingReviewsQuery`) — es el molde a clonar.
- El default de moderación lo resuelve
  `resolveInitialModerationState({ entityType, verificationLevel, moderationScore })` en
  `packages/service-core/src/services/moderation/review-moderation.helpers.ts`, con
  `moderateText()` de `@repo/content-moderation` forzando `PENDING` con score ≥ 0.5.
- **El recálculo de agregados del padre NO es trigger de Postgres**: es SQL de agregación
  ejecutado desde TS en los hooks `_after*` del service
  (`recalculateAndUpdateAccommodationStats`).
- **Ningún usuario puede editar su propia review hoy**: `ACCOMMODATION_REVIEW_MODERATE`
  gatea create/update/delete/restore y sólo lo tienen `ADMIN`/`SUPER_ADMIN`.

### Notificaciones

- **Sólo email.** El proveedor real es **Brevo** (`BrevoEmailTransport` en
  `packages/notifications/src/transports/email/resend-transport.ts:39`;
  `ResendEmailTransport` es alias `@deprecated`). Env vars reales:
  `HOSPEDA_EMAIL_API_KEY`, `HOSPEDA_EMAIL_FROM_EMAIL`, `HOSPEDA_EMAIL_FROM_NAME` — el
  README documenta `HOSPEDA_RESEND_*`, que están **obsoletas**.
- Templates React Email `.tsx`, **español hardcodeado sin i18n**, registrados en un
  `switch` a mano en `NotificationService.selectTemplate()`.
- Envío vía `apps/api/src/utils/notification-helper.ts` — `sendNotification()` /
  `trySendNotification()`, **fire-and-forget, tragan errores, nunca rechazan**. Retry en
  sorted-set de Redis (3 intentos, backoff exponencial), **no-op silencioso** si falta
  `HOSPEDA_REDIS_URL`.
- **No hay centro de notificaciones in-app.** Lo único parecido es
  `apps/web/src/components/shared/whats-new/WhatsNewCountPill.client.tsx` (pill con
  conteo de no vistos en la nav de `/mi-cuenta`) — **ese es el molde del contador**.
- `billing_notification_log` es un log de entrega escopeado a `billing_customers`, **no
  sirve de inbox**.
- Las preferencias de notificación están **desconectadas**: `PreferenceService` está
  cableado a mocks en `apps/api` (`notification-helper.ts:33-42`), y el toggle de
  `/mi-cuenta/preferencias` escribe `users.settings.notifications`, que el path de envío
  nunca lee.

### Patrón de link accionable de un solo uso (existe, HOS-278)

`alliance_leads.claim_token` guarda un **digest SHA-256**, no el token; `claim_expires_at`
lo vence a 7 días; la comparación es `timingSafeEqual`; el endpoint
`POST /protected/alliance/leads/{id}/claim` devuelve **404 genérico siempre** (anti-oracle)
y está rate-limitado a 10/min. **No se usa en esta spec** (ver §11, OQ-2), pero queda
como referencia del estándar del repo.

### QR

**No hay librería de QR en el repo** — `grep -c -i qrcode pnpm-lock.yaml` → `0`.

## 6. Proposed design

### 6.1 Máquina de estados del uso

```
                    declara (proveedor o anfitrión)
                                 │
                                 ▼
                            [ PENDING ] ──── 30 días sin respuesta ──▶ [ EXPIRED ]
                              │      │                                  (no cuenta,
                confirma ─────┘      └───── rechaza                      no notifica)
                    │                          │
                    ▼                          ▼
              [ CONFIRMED ]              [ REJECTED ]
              cuenta en stats            no cuenta · bloquea al declarante
              habilita valorar           sobre ese par · suma al umbral
                                         de suspensión · reversible
```

- **Quién confirma** lo determina `declaredBy`: si declaró el proveedor, confirma el
  anfitrión; si declaró el anfitrión, confirma el proveedor. Un solo par de endpoints,
  resueltos por el servicio según el actor.
- **Sólo `CONFIRMED` cuenta** en `confirmedUsesCount` / `distinctHostsCount` y habilita
  valorar.
- **Recordatorio único al día 10**. Vence al día 30.
- **Un solo `PENDING` por par** (`hostTradeId`, `hostUserId`) — índice único parcial.
  Impide apilar pedidos sobre la misma persona.

### 6.2 Los tres caminos para declarar

**(a) QR del proveedor — camino principal.** Cada ficha tiene un QR estático que codifica
`{SITE_URL}/mi-cuenta/directorio-proveedores/{slug}/registrar-uso`. No expira, no es
secreto, no necesita tokens: el `slug` ya es UNIQUE. Va en calco, remito, tarjeta o la
pantalla del proveedor, y **lo escanea el anfitrión con la cámara nativa** — sin escáner
propio, sin permisos de cámara, sin nada en el bundle del cliente. **La identidad del
anfitrión es su propia sesión**, así que el problema de identificación desaparece. Es la
rama `declaredBy = HOST`.

**(b) Selector escopeado — usos repetidos.** El proveedor elige de la lista de anfitriones
que **ya tienen al menos un uso confirmado con él**. Cero exposición de datos. Cubre el
caso más frecuente de la vida real: el mismo cliente cada temporada.

**(c) Fallback por email — primer uso sin escaneo.** El proveedor escribe el email. Si no
resuelve a un anfitrión, el error es **explícito** (`HOST_NOT_FOUND`), no opaco: el typo es
el error más frecuente y esconderlo hace que el proveedor espere 30 días por un pendiente
que nunca va a confirmarse. El proveedor es un actor curado (`host_trades` se crea por
admin o se provisiona desde un `alliance_lead` aprobado), así que la superficie de
enumeración es chica; se acota con rate limit por proveedor.

**Descartado y por qué:**

- *Selector abierto de anfitriones del destino*: le entrega a cada proveedor el padrón
  completo del destino con nombres — es la cartera de clientes que la landing promete
  como activo. Leak mayor que el oráculo de email (el oráculo exige ya conocer la
  dirección; el selector **entrega el conjunto**).
- *QR al revés* (el anfitrión muestra, el proveedor escanea) y *código corto dictado*:
  ponen la fricción en el peor momento posible.
- *Claim por token para emails desconocidos*: convertiría la infra de mail en canal hacia
  direcciones arbitrarias, y una confirmación desde una cuenta nueva sin accommodations
  no sería un uso de beneficio de todos modos (choca con el gate de rol).

### 6.3 Valoración

- **Precondición dura**: al menos un uso `CONFIRMED` entre ese anfitrión y ese proveedor.
  No hay FK al uso — el uso es precondición, no ancla.
- **Unique `(hostUserId, hostTradeId)`** — un cliente, una voz. Editable.
- **Gate de elegibilidad** (los cuatro se verifican server-side):
  1. El actor tiene `HOST_TRADE_REVIEW_CREATE` (rol `HOST`, `ADMIN`, `SUPER_ADMIN`).
  2. Existe un uso `CONFIRMED` para el par.
  3. `hostTrades.ownerUserId !== actor.id` — **auto-valoración prohibida**.
  4. El proveedor no está `revokedAt` ni soft-deleted.
- **Doble rol permitido**: quien es anfitrión *y* proveedor puede valorar a **otros**
  proveedores.
- **Forma**: `overallRating` 1-5 obligatorio + desglose **opcional** de 3 dimensiones
  (calidad del trabajo, puntualidad, trato) + booleano **obligatorio** `respectedBenefit`
  - texto libre opcional. **Sin título.**
- El booleano no es una dimensión de estrellas a propósito: el proveedor está en el
  directorio *por* el beneficio, y uno excelente que no honra el descuento es el modo de
  falla que este sistema tiene que exponer.

### 6.4 Moderación asimétrica

| | Estado inicial | Fundamento |
|---|---|---|
| **Valoración** | `APPROVED` | `accommodation_reviews` justifica su `APPROVED` en un reviewer "semi-verificado" por conversación previa. Acá hay algo **más fuerte**: un uso confirmado por la contraparte. |
| **Réplica** | `PENDING` | La escribe alguien con interés comercial herido que **estuvo en el domicilio del anfitrión**. "La señora de Alberdi 300 me hizo ir tres veces" es un vector de **doxxing** que la valoración no tiene. Y el volumen de réplicas es una fracción del de valoraciones, así que revisarlas no traba el embudo. |

En ambas sigue corriendo `moderateText()`, que fuerza `PENDING` con score ≥ 0.5 sin
importar el default.

**Réplica**: una sola por valoración (no hilo), la escribe el `ownerUserId` del proveedor,
editable. Si el anfitrión **edita** su valoración, esta vuelve a pasar por `moderateText()`
y la réplica **se conserva marcada** (`reviewEditedAfterReply = true`) con el cartel "la
valoración fue editada después de esta respuesta". Borrarle las palabras al proveedor
porque el otro cambió el texto sería peor; con la marca puede reescribirla.

**Decisión operativa que definió esto**: con revisión previa en la valoración, la pantalla
de admin sería **bloqueante** (sin ella no se publicaría nada). Con publicación optimista
es herramienta de backlog y el sistema funciona el día uno. La pantalla igual entra en
alcance (G-5), pero no en el camino crítico.

### 6.5 Anti-colusión

- **Transparencia**: la tarjeta pública muestra la **composición** — "34 usos · 21
  anfitriones distintos". "40 usos · 2 anfitriones" se delata solo.
- **Rechazo explícito** (distinto del silencio): bloquea a ese proveedor para declarar
  sobre ese anfitrión, y **N rechazos en una ventana** le suspenden la declaración y lo
  marcan para admin. Reversible por el propio anfitrión y no sancionatorio hasta el
  umbral.
- Constantes iniciales: `HOST_TRADE_REJECTION_SUSPEND_THRESHOLD = 3`,
  `HOST_TRADE_REJECTION_WINDOW_DAYS = 90`.
- **Descartado el cooldown por par** (límite duro invisible): castiga un caso legítimo —
  el plomero que atiende 8 unidades del mismo complejo en una semana hizo 8 trabajos y el
  sistema le contaría uno.

**Hallazgo que hay que tener presente**: el incentivo del proveedor **corta para los dos
lados**. Si el anfitrión declara, el proveedor va a confirmar **sin mirar**, porque le
suma. La rama `declaredBy = HOST` está débilmente verificada. Lo que la salva es el gate
de rol: un transeúnte que escanea la calco pegada en una camioneta no es anfitrión, y su
uso confirmado no habilita nada.

### 6.6 Notificaciones y visibilidad

Tres capas, porque toda la cadena se corta en el mismo eslabón — que el anfitrión se
entere:

1. **Email** (categoría `TRANSACTIONAL`, no `REMINDER`: es una acción concreta que otro le
   pidió; hoy da igual porque las preferencias están mockeadas, pero cuando se conecten un
   `REMINDER` sería silenciable y esto no debe serlo).
2. **Sección de pendientes** en `/mi-cuenta/usos-de-beneficio`.
3. **Contador en la navegación** de `/mi-cuenta`, clonando `WhatsNewCountPill.client.tsx`.
   **Se apaga al RESOLVER, no al ver** — si se apagara al mirar, el pendiente desaparece
   de la vista sin haberse resuelto.

## 7. Data model / contracts

### 7.1 Tablas nuevas

#### `host_trade_benefit_usages`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK `defaultRandom()` | |
| `hostTradeId` | uuid NOT NULL FK `host_trades.id` `onDelete: cascade` | |
| `hostUserId` | uuid NOT NULL FK `users.id` `onDelete: cascade` | el anfitrión |
| `declaredBy` | `host_trade_usage_declared_by_enum` NOT NULL | `PROVIDER` \| `HOST` |
| `declaredById` | uuid NOT NULL FK `users.id` | quién apretó el botón |
| `creationChannel` | `host_trade_usage_channel_enum` NOT NULL | `QR` \| `LINKED_SELECTOR` \| `EMAIL_LOOKUP` |
| `status` | `host_trade_usage_status_enum` NOT NULL default `PENDING` | `PENDING`\|`CONFIRMED`\|`REJECTED`\|`EXPIRED` |
| `servicedAt` | date NOT NULL | cuándo ocurrió el servicio (lo declara quien carga) |
| `note` | text nullable | máx 300, texto del declarante |
| `expiresAt` | timestamptz NOT NULL | `declaredAt + 30d` |
| `reminderSentAt` | timestamptz nullable | idempotencia del cron de recordatorio |
| `confirmedAt` / `confirmedById` | timestamptz / uuid FK users, nullables | |
| `rejectedAt` / `rejectedById` | timestamptz / uuid FK users, nullables | |
| `rejectionNote` | text nullable | máx 300 |
| `createdAt`/`updatedAt`/`createdById`/`updatedById`/`deletedAt`/`deletedById` | audit + soft-delete `BaseModel` | |

Índices: `hostTradeId`, `hostUserId`, `status`, `(hostTradeId, status)`,
`(hostUserId, status)`, `expiresAt` (para el cron), `(hostTradeId, hostUserId)`.

**Índice único parcial** — `uniqueIndex(...).on(hostTradeId, hostUserId).where(sql\`status = 'PENDING' AND deleted_at IS NULL\`)`.
Drizzle lo expresa; va en el carril estructural, no en extras.

#### `host_trade_reviews`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `hostTradeId` | uuid NOT NULL FK `host_trades.id` `onDelete: cascade` | |
| `hostUserId` | uuid NOT NULL FK `users.id` | |
| `overallRating` | integer NOT NULL | 1-5, CHECK en extras |
| `rating` | jsonb **nullable** | `{ workQuality?, punctuality?, treatment? }`, cada una 1-5 |
| `averageRating` | `numeric(3,2)` nullable | derivado del desglose cuando existe |
| `respectedBenefit` | boolean NOT NULL | |
| `content` | text nullable | min 10 si viene, máx 2000 |
| `lifecycleState` | `ACTIVE`\|`ARCHIVED` default `ACTIVE` | paridad con las 4 tablas existentes |
| `moderationState` | `ModerationStatusEnum` default **`APPROVED`** | |
| `moderatedById` / `moderatedAt` / `moderationReason` | | |
| `editedAt` | timestamptz nullable | marca la edición del anfitrión |
| audit + soft-delete | | |

**UNIQUE `(hostUserId, hostTradeId)`**. Índices: `hostTradeId`, `hostUserId`,
`moderationState`, `(hostTradeId, moderationState)`.

#### `host_trade_review_replies`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `reviewId` | uuid NOT NULL **UNIQUE** FK `host_trade_reviews.id` `onDelete: cascade` | una sola réplica |
| `authorUserId` | uuid NOT NULL FK `users.id` | el `ownerUserId` del proveedor al escribir |
| `content` | text NOT NULL | min 10, máx 1000 |
| `moderationState` | `ModerationStatusEnum` default **`PENDING`** | |
| `moderatedById` / `moderatedAt` / `moderationReason` | | |
| `reviewEditedAfterReply` | boolean NOT NULL default false | |
| audit + soft-delete | | |

### 7.2 Columnas nuevas en `host_trades`

| Columna | Tipo | Notas |
|---|---|---|
| `confirmedUsesCount` | integer NOT NULL default 0 | denormalizado |
| `distinctHostsCount` | integer NOT NULL default 0 | denormalizado, anti-colusión |
| `reviewsCount` | integer NOT NULL default 0 | sólo `APPROVED` |
| `averageRating` | `numeric(3,2)` NOT NULL default 0 | sólo `APPROVED` |
| `benefitRespectedCount` | integer NOT NULL default 0 | para el ratio |
| `declarationSuspendedAt` | timestamptz nullable | por umbral de rechazos |
| `declarationSuspendedById` | uuid nullable FK users | null = automático |
| `declarationSuspendReason` | text nullable | |

Los cinco agregados se recalculan **desde TS en los hooks `_after*` del service**,
siguiendo `recalculateAndUpdateAccommodationStats`. **No** se introducen triggers de
Postgres — el repo no los usa para esto.

### 7.3 Enums nuevos

`packages/schemas/src/enums/`:
`host-trade-usage-status.{enum,schema}.ts`,
`host-trade-usage-declared-by.{enum,schema}.ts`,
`host-trade-usage-channel.{enum,schema}.ts`.
Se reusa `ModerationStatusEnum`.

### 7.4 Permisos nuevos

`packages/schemas/src/enums/permission.enum.ts`:

| Permiso | Valor | Roles en seed |
|---|---|---|
| `HOST_TRADE_REVIEW_CREATE` | `hostTrade.review.create` | `HOST`, `ADMIN`, `SUPER_ADMIN` |
| `HOST_TRADE_REVIEW_VIEW_ALL` | `hostTrade.review.viewAll` | `ADMIN`, `SUPER_ADMIN` |
| `HOST_TRADE_REVIEW_MODERATE` | `hostTrade.review.moderate` | `ADMIN`, `SUPER_ADMIN` |
| `HOST_TRADE_USAGE_VIEW_ALL` | `hostTrade.usage.viewAll` | `ADMIN`, `SUPER_ADMIN` |
| `HOST_TRADE_USAGE_MANAGE` | `hostTrade.usage.manage` | `ADMIN`, `SUPER_ADMIN` |

Las acciones del proveedor sobre lo suyo (declarar, confirmar, replicar) **no llevan
permiso** — van por ownership de fila, igual que `/host-trades/mine` (AC-7 de HOS-278).

> **Regla de dual-write del seed (OBLIGATORIA)**: estos role-permissions son seed DATA que
> ya vive en entornos activos. El mismo PR debe (1) editar el baseline
> `packages/seed/src/required/rolePermissions.seed.ts` **y** (2) agregar una data-migration
> numerada vía `pnpm db:seed:make`. Editar sólo el baseline es un bug silencioso: las DBs
> frescas quedan bien y staging/prod nunca reciben el cambio. El guard
> `scripts/check-seed-dual-write.sh` es fail-closed y va a bloquear el PR.

### 7.5 API

Todas bajo `apps/api/src/routes/host-trade/`. Sin tier público — el directorio es un perk
de anfitrión (`index.ts:5`: *"No public tier"*).

#### Anfitrión (protected)

| Método | Path | Auth | Notas |
|---|---|---|---|
| `POST` | `/protected/host-trades/{slug}/usages` | `HOST_TRADE_VIEW` | camino QR, `declaredBy=HOST`, `creationChannel=QR` |
| `GET` | `/protected/host-trades/usages/pending` | auth | pendientes del anfitrión, paginado |
| `GET` | `/protected/host-trades/usages/pending-count` | auth | contador de la nav |
| `GET` | `/protected/host-trades/{id}/my-review` | auth | `{ review: null }` si no tiene |
| `POST` | `/protected/host-trades/{id}/reviews` | `HOST_TRADE_REVIEW_CREATE` | gate de §6.3 |
| `PATCH` | `/protected/host-trades/reviews/{id}` | auth + ownership | re-moderación + marca réplica |

#### Proveedor (protected, ownership de fila)

| Método | Path | Notas |
|---|---|---|
| `POST` | `/protected/host-trades/mine/usages` | body acepta `hostUserId` (selector) **o** `hostEmail` (fallback) |
| `GET` | `/protected/host-trades/mine/usages` | filtro por `status`, paginado |
| `GET` | `/protected/host-trades/mine/linked-hosts` | selector escopeado a pares con uso confirmado |
| `GET` | `/protected/host-trades/mine/qr` | SVG del QR |
| `GET` | `/protected/host-trades/mine/reviews` | sus valoraciones + réplicas |
| `POST` | `/protected/host-trades/reviews/{id}/reply` | crea réplica (`PENDING`) |
| `PATCH` | `/protected/host-trades/replies/{id}` | edita réplica (vuelve a `PENDING`) |

#### Compartidos (resueltos por actor)

| Método | Path | Notas |
|---|---|---|
| `POST` | `/protected/host-trades/usages/{id}/confirm` | confirma **la contraparte**, según `declaredBy` |
| `POST` | `/protected/host-trades/usages/{id}/reject` | idem, body `{ note? }` |
| `POST` | `/protected/host-trades/usages/{id}/reject/undo` | sólo el que rechazó, revierte a `PENDING` |
| `GET` | `/protected/host-trades/{id}/reviews` | valoraciones `APPROVED` + réplicas `APPROVED` |

#### Admin

| Método | Path | Permiso |
|---|---|---|
| `GET` | `/admin/host-trades/reviews` | `HOST_TRADE_REVIEW_VIEW_ALL` |
| `POST` | `/admin/host-trades/reviews/{id}/moderate` | `HOST_TRADE_REVIEW_MODERATE` |
| `GET` | `/admin/host-trades/replies` | `HOST_TRADE_REVIEW_VIEW_ALL` |
| `POST` | `/admin/host-trades/replies/{id}/moderate` | `HOST_TRADE_REVIEW_MODERATE` |
| `GET` | `/admin/host-trades/usages` | `HOST_TRADE_USAGE_VIEW_ALL` |
| `POST` | `/admin/host-trades/{id}/declaration-suspension` | `HOST_TRADE_USAGE_MANAGE` (aplicar/levantar) |
| `GET` | `/admin/moderation/host-trade-reviews/pending-count` | `HOST_TRADE_REVIEW_MODERATE` |

#### Códigos de error propios

| Código | HTTP | Cuándo |
|---|---|---|
| `HOST_NOT_FOUND` | 404 | el email del fallback no resuelve a un anfitrión |
| `USAGE_PENDING_EXISTS` | 409 | ya hay un `PENDING` para ese par |
| `DECLARATION_BLOCKED` | 403 | hay un rechazo vigente para ese par |
| `DECLARATION_SUSPENDED` | 403 | el proveedor superó el umbral de rechazos |
| `NO_CONFIRMED_USAGE` | 403 | intenta valorar sin uso confirmado |
| `SELF_REVIEW_FORBIDDEN` | 403 | `ownerUserId === actor.id` |
| `REVIEW_ALREADY_EXISTS` | 409 | ya valoró a ese proveedor |
| `PROVIDER_REVOKED` | 422 | el proveedor está `revokedAt` |

Confirmar/rechazar/editar sobre algo que no es del actor devuelve **404, no 403** — no ser
oráculo de existencia, siguiendo el criterio de `alliance/protected/claim.ts:17-19`.

### 7.6 Crons

`apps/api/src/cron/jobs/`:

- `host-trade-usage-expiry.job.ts` — diario. `PENDING` con `expiresAt <= now()` → `EXPIRED`.
  No notifica (el silencio no acusa).
- `host-trade-usage-reminder.job.ts` — diario. `PENDING` con `createdAt <= now()-10d` y
  `reminderSentAt IS NULL` → manda recordatorio y sella `reminderSentAt`.
- `host-trade-stats-reconcile.job.ts` — semanal. Backstop de la denormalización, con el
  molde de `featured-by-entitlement-reconcile.job.ts`.

### 7.7 Templates de mail

`packages/notifications/src/templates/host-trade/` (6 nuevos, español hardcodeado,
cada uno con su entrada en el `switch` de `selectTemplate()`, su `NotificationType`, su
categoría en `config/notification-categories.ts` y su asunto en `utils/subject-builder.ts`):

1. `usage-confirmation-request` — a quien debe confirmar, con CTA a la sección.
2. `usage-confirmation-reminder` — día 10.
3. `usage-confirmed` — al declarante.
4. `usage-rejected` — al declarante.
5. `review-received` — al proveedor.
6. `reply-moderated` — al proveedor, aprobada o rechazada con motivo.

### 7.8 Dependencia nueva

| Paquete | Versión | Propósito |
|---|---|---|
| `qrcode` | a fijar al implementar, verificando el registry | Generar el SVG del QR **server-side**, una vez por ficha |

Aprobada por el owner (2026-08-08). Es dependencia server-side: **cero impacto en el
bundle de `apps/web`**, lo cual importa por el trabajo de peso en curso de HOS-369.

## 8. UX / UI behavior

### Anfitrión

- **`/mi-cuenta/directorio-proveedores/{slug}/registrar-uso`** — destino del QR. Sin
  sesión, redirige a login y vuelve. Muestra el proveedor, pide fecha del servicio y nota
  opcional, y confirma con un botón. Si el proveedor está revocado o soft-deleted,
  pantalla de error explícita.
- **`/mi-cuenta/usos-de-beneficio`** — pendientes arriba con Confirmar / Rechazar
  (rechazar pide confirmación en un `<dialog>` y aclara que es reversible), historial
  abajo. Desde un uso confirmado, CTA a valorar.
- **Contador en la nav de `/mi-cuenta`** — pill con el número de pendientes, clonando
  `WhatsNewCountPill.client.tsx`. **Se apaga al resolver, no al ver.**
- **Formulario de valoración** — `<dialog>` nativo, estrellas 1-5 para el `overallRating`,
  el desglose de 3 dimensiones colapsado por defecto, booleano de beneficio como sí/no
  explícito (sin default preseleccionado), texto opcional. Si ya valoró, el mismo
  formulario abre en modo edición.

### Proveedor (`/mi-cuenta/proveedor`)

Se extiende la ficha existente con tres pestañas nuevas: **Usos** (declarar + pendientes
marcados como tales + historial), **Valoraciones** (con acción de responder), **Mi QR**
(preview + descarga del SVG + instrucción de uso).

El estado suspendido se muestra explícito, con el motivo y qué hacer.

### Directorio (`TradeCard`)

Bajo el beneficio: `★ 4,6 (12 valoraciones) · 34 usos · 21 anfitriones`. **El promedio
sólo se muestra a partir de 3 valoraciones**; debajo de eso va "N valoraciones" sin
estrella — si no, uno con un único 5 le gana en la vidriera a uno con 40 y 4,6. Detalle
del proveedor con la lista de valoraciones y sus réplicas aprobadas.

### Admin

Ruta nueva bajo `apps/admin/src/routes/_authed/host-trades/`: cola de réplicas
`PENDING` (la que importa, porque bloquea publicación), valoraciones con filtro de
`moderationState`, listado de usos con filtros, y las suspensiones de declaración con
acción de levantar. Hooks con el molde de `createCommerceEntityHooks.ts`.

### Estados de carga y error

Skeletons en las tres listas. Errores de API con mensaje traducido (`@repo/i18n`,
namespace nuevo). Las acciones destructivas o irreversibles (rechazar, moderar) piden
confirmación.

### Accesibilidad

Las estrellas son un `radiogroup` operable por teclado con label textual por valor, no
sólo iconos. El `<dialog>` respeta el trap de foco y `Escape`. El pill del contador
expone `aria-label` con el número en texto. Contraste AA en los estados de badge
(pendiente / confirmado / rechazado / vencido).

## 9. Acceptance criteria

### Registro de uso

- **AC-1** — **Dado** un proveedor activo y un anfitrión logueado, **cuando** el anfitrión
  escanea el QR y completa el formulario, **entonces** se crea un uso `PENDING` con
  `declaredBy=HOST`, `creationChannel=QR`, `expiresAt = now + 30d`, y el proveedor recibe
  el mail de pedido de confirmación.
- **AC-2** — **Dado** un proveedor con un anfitrión ya vinculado, **cuando** declara desde
  el selector, **entonces** se crea un uso `PENDING` con `declaredBy=PROVIDER`,
  `creationChannel=LINKED_SELECTOR`, y el anfitrión recibe el mail.
- **AC-3** — **Dado** un proveedor que declara por email, **cuando** el email no
  corresponde a ningún anfitrión, **entonces** responde `404 HOST_NOT_FOUND` con mensaje
  explícito y **no** se crea ningún uso ni se envía ningún mail.
- **AC-4** — **Dado** un uso `PENDING` para un par, **cuando** la misma parte declara otro
  uso para ese mismo par, **entonces** responde `409 USAGE_PENDING_EXISTS`.
- **AC-5** — **Dado** un uso `PENDING`, **cuando** la contraparte lo confirma, **entonces**
  pasa a `CONFIRMED`, se sella `confirmedAt`/`confirmedById`, se recalculan
  `confirmedUsesCount` y `distinctHostsCount` del proveedor, y el declarante recibe mail.
- **AC-6** — **Dado** un uso `PENDING` declarado por el proveedor, **cuando** intenta
  confirmarlo **él mismo**, **entonces** responde `404` (no `403`).
- **AC-7** — **Dado** un uso `PENDING` con más de 30 días, **cuando** corre el cron de
  expiración, **entonces** pasa a `EXPIRED`, **no** suma a ninguna estadística y **no** se
  envía ningún mail.
- **AC-8** — **Dado** un uso `PENDING` de 10 días sin recordatorio, **cuando** corre el
  cron de recordatorio, **entonces** se envía el mail y se sella `reminderSentAt`; **y**
  al correr de nuevo al día siguiente **no** se reenvía.

### Rechazo y anti-colusión

- **AC-9** — **Dado** un uso `PENDING`, **cuando** la contraparte lo rechaza, **entonces**
  pasa a `REJECTED`, no cuenta, y una nueva declaración del mismo proveedor sobre ese
  anfitrión responde `403 DECLARATION_BLOCKED`.
- **AC-10** — **Dado** un rechazo, **cuando** quien lo hizo lo revierte, **entonces** el
  uso vuelve a `PENDING`, se limpia el bloqueo del par y deja de contar para el umbral.
- **AC-11** — **Dado** un proveedor con 3 rechazos en 90 días, **cuando** intenta declarar
  otro uso, **entonces** responde `403 DECLARATION_SUSPENDED`, se sella
  `declarationSuspendedAt` y aparece en la pantalla de admin.
- **AC-12** — **Dado** un proveedor suspendido, **cuando** un admin levanta la suspensión,
  **entonces** puede volver a declarar y queda registrado quién la levantó.

### Valoración

- **AC-13** — **Dado** un anfitrión con un uso `CONFIRMED`, **cuando** valora, **entonces**
  la valoración se crea con `moderationState = APPROVED` y aparece en el directorio.
- **AC-14** — **Dado** un anfitrión **sin** uso confirmado con ese proveedor, **cuando**
  intenta valorar, **entonces** responde `403 NO_CONFIRMED_USAGE`.
- **AC-15** — **Dado** un usuario que **sólo** es proveedor (sin accommodations), **cuando**
  intenta valorar a otro proveedor, **entonces** responde `403` por falta de
  `HOST_TRADE_REVIEW_CREATE`.
- **AC-16** — **Dado** un usuario que es anfitrión **y** proveedor, **cuando** valora a un
  proveedor **distinto** del suyo, **entonces** la valoración se crea normalmente.
- **AC-17** — **Dado** el dueño de una ficha, **cuando** intenta valorar **su propia**
  ficha, **entonces** responde `403 SELF_REVIEW_FORBIDDEN`, incluso teniendo un uso
  confirmado y el rol `HOST`.
- **AC-18** — **Dado** un anfitrión que ya valoró a un proveedor, **cuando** intenta crear
  otra, **entonces** responde `409 REVIEW_ALREADY_EXISTS`.
- **AC-19** — **Dado** un texto con score de moderación ≥ 0.5, **cuando** se envía la
  valoración, **entonces** nace `PENDING` a pesar del default `APPROVED`.
- **AC-20** — **Dado** una valoración sin desglose, **cuando** se guarda, **entonces**
  `rating` es `null`, `averageRating` es `null`, y el promedio del proveedor se calcula
  sólo con `overallRating`.

### Réplica y edición

- **AC-21** — **Dado** el dueño de la ficha, **cuando** responde una valoración,
  **entonces** la réplica se crea `PENDING` y **no** es visible en el directorio hasta que
  un admin la apruebe.
- **AC-22** — **Dado** una valoración ya respondida, **cuando** el anfitrión la edita,
  **entonces** la valoración vuelve a pasar por `moderateText()`, se sella `editedAt`, la
  réplica **se conserva** con `reviewEditedAfterReply = true`, y el directorio muestra el
  cartel correspondiente.
- **AC-23** — **Dado** una réplica aprobada, **cuando** el proveedor la edita, **entonces**
  vuelve a `PENDING` y desaparece del directorio hasta ser reaprobada.
- **AC-24** — **Dado** una réplica moderada (aprobada o rechazada), **cuando** el admin
  resuelve, **entonces** el proveedor recibe mail con el resultado y, si fue rechazo, el
  motivo.

### Estadísticas y visibilidad

- **AC-25** — **Dado** un proveedor con 2 valoraciones, **cuando** se renderiza su tarjeta,
  **entonces** muestra "2 valoraciones" **sin** estrella ni promedio; con 3 o más, muestra
  el promedio.
- **AC-26** — **Dado** un proveedor con 34 usos confirmados de 21 anfitriones distintos,
  **cuando** se renderiza su tarjeta, **entonces** muestra ambos números.
- **AC-27** — **Dado** una valoración que pasa de `APPROVED` a `REJECTED` por moderación,
  **cuando** se guarda la decisión, **entonces** los agregados del proveedor se recalculan
  excluyéndola.
- **AC-28** — **Dado** un proveedor con `revokedAt`, **cuando** alguien intenta declarar un
  uso o valorarlo, **entonces** responde `422 PROVIDER_REVOKED`.
- **AC-29** — **Dado** un desajuste entre los contadores denormalizados y la realidad,
  **cuando** corre el cron de reconciliación, **entonces** los corrige y lo registra.

## 10. Risks

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| **R-1** — Colusión inflando el conteo público de usos | M | A | El owner eligió publicarlo (§11 OQ-6). Se mitiga con `distinctHostsCount` visible, rechazo con consecuencia y umbral de suspensión. **No queda cerrado del todo**: un par decidido puede sostener el número. |
| **R-2** — El proveedor confirma sin mirar los usos declarados por anfitriones | A | M | El gate de rol para valorar acota el daño: sólo un anfitrión real puede después valorar. El conteo sí puede inflarse por esta vía. |
| **R-3** — Réplicas atascadas en `PENDING` sin nadie moderando | M | M | La pantalla de admin entra en alcance (G-5) y el proveedor recibe mail al resolverse. Conviene un alerta si la cola supera N días. |
| **R-4** — Baja conversión: el anfitrión nunca confirma | A | A | Las tres capas de §6.6 existen justamente por esto. Es el riesgo principal del feature y la métrica a mirar primero. |
| **R-5** — Spam vía el fallback por email | B | M | Rate limit por proveedor + el rechazo con consecuencia le pone precio + `creationChannel` deja auditar por canal. |
| **R-6** — Denormalización desincronizada | M | B | Recálculo en hooks `_after*` + cron semanal de reconciliación (AC-29). |
| **R-7** — Edición de valoración deja la réplica sin sentido | M | B | `reviewEditedAfterReply` + cartel + el proveedor puede reescribir. |
| **R-8** — El dual-write del seed se hace a medias y los permisos nunca llegan a prod | M | A | El guard `check-seed-dual-write.sh` es fail-closed. Verificar que corre en el PR. |
| **R-9** — La dependencia `qrcode` se filtra al bundle del web | B | M | Uso exclusivamente server-side en `apps/api`. Verificar con el análisis de bundle antes de mergear (HOS-369 viene peleando el peso). |
| **R-10** — Los mails no salen en local y el flujo parece roto | M | B | `sendNotification` es fire-and-forget y traga errores; el retry es no-op sin `HOSPEDA_REDIS_URL`. Documentarlo en el checklist de smoke local. |

## 11. Open questions

**Ninguna abierta.** Las 9 se cerraron con el owner el 2026-08-07/08. Se dejan
registradas como decisiones porque el fundamento importa para no reabrirlas:

- **OQ-1 — ¿La valoración requiere uso confirmado previo?** **Sí, gate estricto, y el uso
  lo puede iniciar cualquiera de las dos partes** (`declaredBy`). Si sólo declarara el
  proveedor, él decidiría qué interacciones son valorables: declararía los trabajos que
  salieron bien y el directorio tendería a puras 5 estrellas. La bidireccionalidad del
  *uso* conserva la verificación sin el sesgo.
- **OQ-2 — ¿Cómo identifica el proveedor al anfitrión?** **QR + selector escopeado +
  fallback por email con error explícito** (§6.2), con las alternativas descartadas y su
  fundamento.
- **OQ-3 — ¿Una valoración por uso o por par?** **Por par, editable.** Una por uso
  reabriría el inflado de a dos y ponderaría más al cliente frecuente.
- **OQ-4 — ¿Forma del rating?** **Escalar obligatorio + desglose opcional de 3 dims +
  booleano de beneficio, sin título.** Es el patrón más nuevo del repo
  (`gastronomy_reviews`/`experience_reviews`), no una invención.
- **OQ-5 — ¿Moderación?** **Asimétrica**: valoración `APPROVED`, réplica `PENDING` (§6.4).
- **OQ-6 — ¿Qué es público?** **Todo, incluido el conteo de usos.** Decisión del owner.
  *Se había recomendado mantener el conteo privado* para no darle payoff a la colusión;
  el owner eligió publicarlo, lo que elevó el peso de OQ-7.
- **OQ-7 — ¿Anti-colusión?** **Transparencia (`distinctHostsCount`) + rechazo explícito
  con consecuencia** (§6.5). Se descartó el cooldown por par por castigar el caso legítimo
  del complejo con varias unidades.
- **OQ-8 — ¿Cómo llega el pedido?** **Email + sección + contador en la nav** (§6.6).
- **OQ-9 — ¿Alcance?** **Todo en un entregable.** Decisión del owner. *Se había
  recomendado cortar un primer entregable con el registro de uso solo* (sin valoraciones),
  para no exponer reputación de personas reales hasta tener usos confirmados encima. Si el
  diff se vuelve irrevisable, el skill `chained-pr` permite partirlo sin tocar el alcance.

**Único punto a verificar al implementar** (no bloquea): el tipo exacto de
`gastronomy_reviews.overallRating` (`numeric` vs `integer`). Esta spec especifica
`integer` porque el input son estrellas enteras; si gastronomy usa `numeric`, decidir si
se prioriza consistencia o precisión del tipo.

## 12. Implementation notes

### Carriles de migración

Los tres, en este orden (`db:migrate` → `db:apply-extras` → `db:seed:migrate`):

1. **Estructural** (`packages/db/src/migrations/`, vía `pnpm db:generate`): las 3 tablas,
   las 8 columnas de `host_trades`, los 3 enums, todos los índices — incluido el único
   parcial de `PENDING`, que Drizzle sí expresa.
2. **Extras** (`packages/db/src/migrations/extras/`, idempotentes): los CHECK que Drizzle
   no expresa — `overallRating BETWEEN 1 AND 5`; las dimensiones del jsonb dentro de 1-5;
   y los cross-column (`status='REJECTED'` ⇒ `rejectedAt IS NOT NULL`, `status='CONFIRMED'`
   ⇒ `confirmedAt IS NOT NULL`).
3. **Seed data-migration** (`packages/seed/src/data-migrations/`, vía `pnpm db:seed:make`):
   los 5 role-permissions nuevos. **Obligatorio junto con el baseline** (§7.4).

Correr `pnpm db:generate` antes del PR o el drift guard bloquea CI.

### Orden de capas

DB → schemas (Zod) → service-core → API → web/admin. `@repo/schemas` es la fuente única de
tipos; nada de tipos locales espejando la API.

### Convenciones que hay que respetar

- Servicios extendiendo `BaseCrudService`, devolviendo `Result<T>`, con
  `runWithLoggingAndValidation()`.
- Permisos vía `PermissionEnum` **siempre** — nunca chequear roles directamente.
- `safeIlike()` de `@repo/db`, nunca `ilike()` crudo (CI lo rechaza).
- Web: CSS Modules colocados, **sin Tailwind**. Admin: Tailwind, **sin CSS Modules**.
- i18n para todo texto de usuario en `apps/web`/`apps/admin` (los **mails** son la
  excepción: español hardcodeado, NG-4).
- Máximo 500 líneas por archivo, named exports, RO-RO, `import type`.

### Testing strategy

**No tests = not done.** Lógica pura primero (TDD), integración junto a la implementación.

**Unit (`packages/service-core`)** — la máquina de estados completa (todas las
transiciones válidas y todas las inválidas); resolución de quién confirma según
`declaredBy`; los cuatro gates de elegibilidad de §6.3 **cada uno por separado**;
recálculo de los cinco agregados (incluido `distinctHostsCount` con usos repetidos del
mismo anfitrión); umbral y ventana de suspensión; efecto de la edición sobre la réplica.

**Integración (`apps/api`)** — cada endpoint con éxito / 401 / 403 / 404 / validación.
Con foco en: confirmar un uso ajeno devuelve **404 y no 403**; el fallback por email
respeta el rate limit; `PATCH` de valoración ajena devuelve 404.

**Regresión explícita (cada uno su test dedicado)** — AC-6, AC-15, AC-16, AC-17, AC-19,
AC-22, AC-28. Son los que más fácil se rompen en un refactor y los que menos se notan.

**Guards estáticos** — un test que verifique que ningún campo administrado
(`moderationState`, `confirmedAt`, los contadores, `declarationSuspendedAt`) es
user-settable desde los schemas de create/update, con el molde de
`HOST_TRADE_OWNER_FORBIDDEN_FIELDS` (`host-trade.owner.schema.ts:79-94`), que ya tiene su
test guard.

**Cobertura** — mínimo 90%. `.only()` y `.skip()` hardcodeado están prohibidos.

**Datos de prueba** — los usuarios seed de SPEC-143 (`<slug>@local.test` /
`Password123!`) cubren host/tourist/proveedor. Hace falta agregar un usuario **anfitrión +
proveedor a la vez** para AC-16/AC-17, que hoy no existe en la matriz.

### Smoke

Se aplican `status-needs-smoke-local` (gates de rol, ownership, auto-valoración — con los
usuarios seed) y `status-needs-smoke-staging` (mails reales por Brevo y timing de los tres
crons). **No marcar el issue `Done` con esas etiquetas puestas** — sacarlas es un paso
humano.

### Fases sugeridas

1. **Setup** — enums, permisos + dual-write del seed, dependencia `qrcode`, migración
   estructural, extras.
2. **Core** — modelos, servicio de usos con su máquina de estados, servicio de
   valoraciones/réplicas, recálculo de agregados.
3. **Integración** — endpoints (anfitrión → proveedor → compartidos → admin), templates de
   mail y su cableado, los tres crons.
4. **UI** — página del QR, sección de pendientes, contador de nav, formulario y edición de
   valoración, pestañas del proveedor, tarjeta del directorio, pantalla de admin.
5. **Testing y pulido** — regresiones dedicadas, guards, i18n, accesibilidad.

## 13. Linear

Canonical tracking:
[HOS-376](https://linear.app/hospeda-beta/issue/HOS-376/proveedores-registrar-el-uso-del-beneficio-y-las-valoraciones-entre)

Relacionado: [HOS-278](https://linear.app/hospeda-beta/issue/HOS-278) (modelo de aliados,
provisioning del proveedor) · HOS-277 (leads de captación, Done).

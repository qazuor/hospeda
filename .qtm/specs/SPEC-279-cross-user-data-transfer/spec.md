---
spec-id: SPEC-279
title: Cross-user data transfer (entity ownership migration A → B)
type: feature
complexity: high
status: draft-exploration
created: 2026-06-22T00:00:00Z
base: staging
tags: [admin, data-migration, ownership, billing, entitlements, security, high-risk]
---

# SPEC-279 — Cross-user data transfer (entity ownership migration A → B)

> ## ⛔ DO NOT DEVELOP YET — DISEÑO EN DISCUSIÓN
>
> Esta es una de las features **más riesgosas** de la plataforma: reasigna la
> propiedad de entidades reales (alojamientos, billing, conversaciones privadas)
> entre cuentas, de forma destructiva. Un error acá puede dejar a un usuario
> pagando un plan que no usa, exponer mensajes privados de huéspedes a un dueño
> nuevo, o corromper el motor de entitlements.
>
> **Estado: `draft-exploration`.** El blueprint de la sección 4 está acordado con
> el owner, pero las secciones **8 (Riesgos)** y **9 (Preguntas abiertas)** tienen
> que cerrarse en profundidad ANTES de generar tasks, crear worktree o escribir
> una sola línea de código. No promover a `draft`/`approved` hasta resolver todo
> lo de la sección 9.

## 1. Overview

### Goal

Construir una primitiva administrativa única que permita **transferir entidades
de un usuario A a un usuario B** (cambio de propiedad), de forma selectiva,
transaccional, auditada y reversible en el acto, sin contaminar el motor de
entitlements ni la data personal del usuario origen.

### Origin

Pedido del owner: "debemos tener una forma de migrar data de un user a otro
(alojamientos, etc.)". Discovery realizado en sesión 2026-06-22 con inventario
completo del dominio (~39 tablas cuelgan de un usuario) y tres tandas de
decisiones de producto (ver sección 4).

### Por qué es una sola primitiva

El owner eligió **alcance selectivo por entidad** + **admin-only**. Eso colapsa
los cuatro casos de uso en una sola máquina: cambia solo *qué* se selecciona y
*qué le pasa al usuario origen* al final.

| Caso de uso | Cómo se modela con la primitiva |
|---|---|
| Venta de propiedad | Seleccionar 1+ entidades; A queda activo intacto. |
| Cambio de dueño total | Seleccionar todo; A se desactiva. |
| Merge de cuentas duplicadas | Seleccionar todo; A → soft-delete. |
| Corrección de carga admin | Seleccionar lo mal cargado; A queda activo. |

## 2. Contexto del dominio (inventario)

Un usuario "posee" data a través de muchas columnas (`owner_id`, `author_id`,
`user_id`, `sponsor_user_id`, `created_by`, etc.) repartidas en ~39 tablas. Se
clasifican en tres grupos:

1. **Transferible (objeto de esta feature)** — entidades de negocio y su
   contenido pegado, contenido editorial, promociones/sponsorships. Ver §4.2.
2. **Personal (NUNCA se mueve)** — favoritos (`user_bookmarks`),
   colecciones, tags personales, conversaciones de IA (`ai_conversations`),
   `ai_usage`, push tokens, sesiones, cuentas OAuth. Son preferencias privadas
   de A; en una venta no tiene sentido moverlas.
3. **Auditoría histórica (`createdById`/`updatedById`/`deletedById`)** — presente
   en casi todas las tablas. Es traza histórica; NO se reescribe al migrar
   (decisión §4, salvo que en §9 se decida lo contrario por compliance).

### Vínculo de billing (crítico)

```
users.id  ←→  billing_customers.external_id (varchar, sin FK en DB)
                     ↓
            billing_subscriptions.customer_id → billing_customers.id
```

No hay FK a nivel DB; el vínculo es a nivel app vía `getByExternalId(userId)`.
`billing_subscriptions.plan_id` es **varchar** que guarda el UUID del plan.

## 3. Caso de uso / actores

- **Ejecutor:** solo admin/staff (nuevo `PermissionEnum`, ver §9).
- **Usuario A (origen):** cede entidades.
- **Usuario B (destino):** las recibe; debe estar preparado de antemano (§4.4).
- **Huéspedes / autores de reviews:** terceros cuya data viaja pegada a las
  entidades (riesgo de privacidad, ver §8).

## 4. Blueprint acordado (decisiones del owner)

### 4.1 Alcance

Transferencia **selectiva por entidad**, operada **solo por admin/staff**.

### 4.2 Catálogo transferible

| Categoría | Incluye | Cascada automática (viaja con la entidad madre) |
|---|---|---|
| Entidades de negocio | `accommodations`, `experiences`, `gastronomies` | reviews, FAQs, fotos, IA data, vistas, conversaciones huésped↔host **de esa entidad** |
| Contenido editorial | `posts`, `events` | cambian de `author_id` a B |
| Promociones | `owner_promotions`, `sponsorships` | viajan junto con los alojamientos a los que aplican |

**Explícitamente FUERA:** newsletter, leads de commerce, y todo el grupo
**personal** del §2.2.

### 4.3 Billing — recalcular entitlements

Se mueve la **entidad**, NO la suscripción. Tras mover:

1. Revalidar entitlements de **A** y de **B**.
2. Si B queda over-limit → aplicar la política **grandfather/restrict existente
   (SPEC-167)**. No se reinventa billing.

### 4.4 Precondiciones del destinatario B

B **debe estar listo antes**: rol host + billing customer correctos. Si no lo
está, la migración **aborta y avisa**; el admin prepara a B primero. (Decisión
deliberada de control sobre comodidad: nada de auto-promoción silenciosa.)

### 4.5 Destino del usuario A

Lo **decide el admin al ejecutar**, por caso: desactivar / soft-delete / dejar
activo intacto.

### 4.6 Política de conflictos (unique constraints) — híbrida

| Conflicto | Acción |
|---|---|
| Slug global colisiona (`accommodations`, `posts`, etc.) | **ABORTAR** — decisión humana |
| `billing_customers` ya existe en B con subscription | **ABORTAR** — merge de customer requiere decisión humana |
| Tag/favorito/colección duplicado | **AUTO-SKIP**, registrado en audit log |

### 4.7 Red de seguridad

- **Dry-run obligatorio:** preview exacto de qué se va a mover y qué conflictos
  hay, ANTES de confirmar.
- **Transaccional:** todo-o-nada.
- **Audit trail** completo: qué, quién, cuándo, resultado, conflictos resueltos.
- **Undo inmediato post-ejecución:** apenas termina, queda disponible un
  "revertir" por si el admin ve que algo quedó mal. **No es** una ventana de
  días con snapshots: es un rollback en el momento, válido mientras nada más
  haya cambiado el estado.

### 4.8 Notificaciones

Email a **A y a B** al ejecutar (A: "se transfirieron estas entidades"; B:
"recibiste estas entidades").

### 4.9 Invalidación de cache

Al cambiar ownership, las páginas públicas de las entidades cambian → disparar
revalidación de Cloudflare para las URLs afectadas.

## 5. Scope

### In scope
- Servicio de transferencia en `@repo/service-core` (fuera de `BaseCrudService`,
  como los servicios de billing).
- Endpoints admin (`/api/v1/admin/*`): dry-run + execute + undo.
- UI admin (panel) para seleccionar A, B, entidades, destino de A, y revisar el
  dry-run antes de confirmar.
- Audit log dedicado.
- Notificaciones a A y B.
- Revalidación de cache de las entidades movidas.

### Out of scope (por ahora)
- Self-service del host (fase 2 potencial).
- Merge total automático como modo separado (se cubre con "seleccionar todo").
- Transferencia de la suscripción/MercadoPago en sí (solo se recalculan
  entitlements).
- Multi-currency u otras aristas de billing.

## 6. Entidades / capas afectadas (preliminar)

- `packages/db` — posible tabla `user_data_transfers` (audit + payload para undo).
- `packages/schemas` — schemas Zod de request/preview/result.
- `packages/service-core` — `UserDataTransferService` (dry-run, execute, undo,
  conflict detection, entitlement revalidation hook).
- `apps/api` — rutas admin.
- `apps/admin` — pantalla del flujo.
- `packages/notifications` — templates A/B.
- `packages/billing` — hook de revalidación de entitlements (reuso SPEC-167).

## 7. Acceptance criteria (alto nivel, a refinar)

- AC-1: Un admin puede previsualizar (dry-run) una transferencia A→B mostrando
  exactamente qué entidades + cascada se moverán y qué conflictos existen, sin
  mutar nada.
- AC-2: La ejecución es transaccional: ante cualquier conflicto crítico (slug,
  billing customer) aborta sin tocar datos.
- AC-3: Tras ejecutar, entitlements de A y B quedan revalidados; B over-limit
  aplica grandfather/restrict.
- AC-4: La data personal de A nunca se transfiere.
- AC-5: Existe undo inmediato que revierte la transferencia mientras el estado no
  haya cambiado.
- AC-6: Audit log registra la operación completa; A y B reciben email.
- AC-7: Si B no cumple precondiciones (rol/customer), la operación aborta y lo
  informa claramente.

## 8. Riesgos (PENDIENTE de cerrar antes de dev)

1. **Privacidad de terceros:** las conversaciones huésped↔host viajan pegadas a
   la entidad. Eso expone mensajes privados de huéspedes a un dueño NUEVO.
   ¿Legal/ético? ¿Consentimiento? ¿Se anonimiza, se corta el histórico, o se
   mueve completo? **Decisión legal pendiente.**
2. **Suscripción huérfana de A:** si A se desactiva pero tiene una preapproval de
   MercadoPago activa, hay que cancelarla o sigue cobrando. El blueprint dice
   "no se mueve la suscripción" — pero desactivar A sin cancelar su sub es un
   bug de cobro.
3. **Transacción gigante:** "seleccionar todo" de un host grande puede ser una
   transacción enorme (alojamientos + reviews + vistas + conversaciones). ¿Sync
   transaccional o job con checkpoints? Tensión consistencia vs tamaño.
4. **Undo vs estado cambiante:** el undo solo es válido "mientras nada más
   cambió". Hay que definir cómo se detecta que el estado cambió (B editó, llegó
   una review nueva) y qué hace el undo si ya no es seguro.
5. **Entity_views / analytics:** mover vistas históricas distorsiona los KPIs de
   B (SPEC-207). ¿Se mueven, se dejan, se recalculan?
6. **Concurrencia:** A o B editando durante la migración. Hace falta locking o
   detección de versión.
7. **Auditoría histórica:** dejar `createdById` de A puede ser deseable (traza) o
   un leak de identidad. Confirmar contra compliance.

## 9. Preguntas abiertas (DEBEN resolverse antes de generar tasks)

- [ ] **Q1 (privacidad):** ¿qué hacemos con las conversaciones huésped↔host y sus
  mensajes al transferir un alojamiento? (mover completo / cortar histórico /
  anonimizar). Requiere decisión legal.
- [ ] **Q2 (billing huérfano):** al desactivar/soft-deletear A, ¿se cancela
  automáticamente su suscripción MercadoPago? ¿Quién decide?
- [ ] **Q3 (ejecución):** ¿transacción sync única o job en background con
  checkpoints? Definir umbral de volumen.
- [ ] **Q4 (semántica del undo):** ¿cómo se determina que el estado "no cambió" y
  qué pasa si cambió? ¿El undo es un botón con expiración de minutos?
- [ ] **Q5 (analytics/vistas):** ¿`entity_views` viaja con la entidad o se queda?
- [ ] **Q6 (permiso):** nombre y alcance del nuevo `PermissionEnum`
  (`USER_DATA_TRANSFER`?). ¿Solo super-admin o staff con permiso?
- [ ] **Q7 (auditoría histórica):** ¿se reescribe `createdById`/`updatedById` o se
  preserva la traza original?
- [ ] **Q8 (reviews):** confirmar que la autoría de la review (huésped) NO cambia,
  solo la entidad reseñada cambia de dueño.
- [ ] **Q9 (alcance del undo en billing):** el undo, ¿también revierte el recálculo
  de entitlements y la política grandfather aplicada?
- [ ] **Q10 (concurrencia):** estrategia de locking durante dry-run → execute.

## 10. Dependencias

- **SPEC-167** (Downgrade Over-Limit Remediation) — reuso de la política
  grandfather/restrict para el recálculo de entitlements de B.
- Motor de entitlements de billing (`loadEntitlements`, `product_domain`).
- Sistema de revalidación de cache (RevalidationService).

## Revision history

- 2026-06-22 — Spec creada en `draft-exploration` tras discovery con el owner
  (inventario de dominio + 3 tandas de decisiones). Bloqueada para desarrollo
  hasta cerrar §8 y §9.

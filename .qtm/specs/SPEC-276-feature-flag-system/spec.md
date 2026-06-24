---
spec-id: SPEC-276
title: Feature flag system — DB-backed on/off toggles with user & role override (dark launch + kill switch)
type: feature
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
decided: 2026-06-23
model_fit: basic
effort_estimate_hours: 12-18
tags: [feature-flags, infrastructure, admin, api, web, config, kill-switch, db]
---

# SPEC-276: Feature flag system

> ## ✅ SCOPE REALINEADO + DECISIONS RESOLVED (2026-06-23)
>
> El spec original apuntaba a un sistema "enterprise" (rollout por porcentaje,
> targeting por plan de billing, pinta de A/B testing). En conversación con el owner se
> **realineó** a lo que realmente se necesita: un **interruptor de on/off para features**.
> Casos de uso reales:
>
> 1. **Dark launch:** desarrollar una feature nueva (ej: calendar), dejarla **apagada**
>    por flag, ir shipeando código a prod, prenderla cuando esté lista.
> 2. **Kill switch:** una feature en prod rompe algo → **apagarla al toque** desde admin
>    sin redeploy, investigar, volver a prender.
> 3. **Override por usuario/rol:** prender una feature solo para algunos usuarios o solo
>    para staff (testing interno) antes de soltarla a todos.
>
> **Decisiones del owner:**
> - **Tipos soportados:** on/off **global** (fijo) + **override por usuario** (listas
>   force-on / force-off) + **override por rol** (staff testing). **NADA de billing.**
> - **SE DESCARTAN (no diferidos, fuera de scope):** rollout por porcentaje, hash
>   determinístico, targeting por plan, A/B testing, targeting por entorno.
> - **Resolución:** default global + override por-usuario gana sobre global; override por
>   rol gana sobre global; force-off gana sobre todo.
> - **Cache:** in-memory Map TTL 60s (patrón `EntitlementCache`). Kill switch propaga en
>   <60s. **Sin Redis pub/sub** (no se necesita para este caso).
>
> **Resultado: model fit = BÁSICO.** Al descartar porcentaje/plan/pub-sub, todo el
> sistema es CRUD + evaluación por listas + cache simple, con patrón existente para cada
> pieza.

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Sistema de feature flags DB-backed, administrable desde el admin, para
**prender/apagar features en runtime sin redeploy**, con override opcional por usuario y
por rol. Resuelve dark launch (shipear apagado) y kill switch (apagar emergencias).

**Why now:** hoy no hay forma de apagar una feature sin redeploy. Con la plataforma
creciendo, necesitamos toggles runtime para shipear incremental y para reaccionar a
incidentes en prod sin esperar un deploy.

### 2. Out of Scope (descartado, NO diferido)

- **Rollout gradual por porcentaje** + hash determinístico — no se necesita.
- **Targeting por plan de billing** — los entitlements (`CAN_USE_X`) ya cubren plan-gating.
- **A/B testing / experimentation platform** — esto es on/off, no experimentos.
- **Targeting por entorno (staging/prod)** — el dark launch se logra con global-off +
  override por usuario/staff (probás con tu user en cualquier entorno).
- **Redis pub/sub para invalidación instantánea** — el TTL de 60s alcanza para el kill switch.
- Migración automática de env vars a DB (no hay env feature flags hoy; ver R1).

### 3. Recon Findings (código real, no supuestos)

| # | Finding | Archivo:línea | Impacto |
|---|---------|---------------|---------|
| R1 | **No existe NINGÚN `HOSPEDA_FEATURE_*`** — esta es la PRIMERA feature-flag system. La sección "convivirán con env vars" del spec original es falsa | grep `HOSPEDA_FEATURE_` → 0 hits | Greenfield total. El precedente de "env bool" más cercano es `HOSPEDA_DISABLE_AUTH` (`apps/api/src/utils/env.ts:147`), pero es infra, no feature flag. |
| R2 | **Redis SÍ está cableado** (`getRedisClient()` singleton, `ioredis`, con fallback in-memory), usado por rate-limit + notifications. Pero **NO hay pub/sub en ningún lado** | `apps/api/src/utils/redis.ts:17-61`; rate-limit `middlewares/rate-limit.ts`; notif `packages/notifications/src/services/retry.service.ts` | El cache puede usar Redis si se quisiera, pero v1 usa in-memory (decisión owner). Pub/sub sería greenfield → descartado. |
| R3 | **`EntitlementCache`** (Map con TTL + `clearEntitlementCache`) es el patrón in-process a copiar | `apps/api/src/middlewares/entitlement.ts:57-80` | El cache de flags lo espeja 1:1 (TTL 60s en vez de 5min). |
| R4 | **`FEATURE_FLAG_MANAGE` no existe** | `packages/schemas/src/enums/permission.enum.ts` | Agregar el permiso + grant a SUPER_ADMIN (precedente: `MAINTENANCE_MODE_WRITE:827`, `AI_SETTINGS_MANAGE:833`, ambos SUPER_ADMIN-only). |
| R5 | `actor.role` **ya está en el context** de cada request | `apps/api/src/middlewares/actor.ts:223`, `types.ts:47` | El override por rol es barato (sin lookup extra). |
| R6 | `PlatformSettings` (key/value jsonb, upsert-only) es **referencia**, no clon (no tiene `id`/audit/soft-delete) | `packages/db/src/schemas/platform/platform-settings.dbschema.ts:18-25`, service `platform-settings.service.ts:74` | El `feature_flags` necesita `id` (para audit/relaciones), así que es un superset, no un clon. |
| R7 | Patrón de **audit append-only** existe: `ai_credential_audit` | `packages/db/src/schemas/ai/ai_credential_audit.dbschema.ts:29-84` | El `feature_flag_audit` lo espeja (immutable, `action` varchar, sin `updatedAt`/`deletedAt`). No hay tabla de audit genérica. |
| R8 | Patrón de **admin CRUD** completo a copiar: host-trades | `apps/admin/src/routes/_authed/platform/host-trades/{index,$id,$id_.edit,new}.tsx` | El admin de flags clona esta estructura file-based. |
| R9 | Sidebar admin se edita en `menu.ts` (`menuTree`, gate por permiso) | `apps/admin/src/lib/menu.ts:233-246` | Agregar entry `/platform/feature-flags` con gate `FEATURE_FLAG_MANAGE`. |
| R10 | `BaseCrudService` da soft-delete (`deletedAt`) gratis | `packages/service-core/src/base/base.crud.service.ts:40,118` | El `FeatureFlagService` extiende `BaseCrudService`. |

### 4. Data Model

#### 4.1 Tabla `feature_flags`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK defaultRandom | |
| key | varchar(100) unique | `calendar`, `ai_image_enhance`, `new_search_ui` |
| description | text | qué hace la feature |
| enabled | boolean default false | **default global** (on/off). Dark launch → arranca `false`. |
| isActive | boolean default true | **master switch / kill switch**. `false` = la feature está OFF para todos, ignora overrides. |
| forceOnUserIds | jsonb (string[]) default `[]` | usuarios para quienes está forzada ON |
| forceOffUserIds | jsonb (string[]) default `[]` | usuarios para quienes está forzada OFF |
| enabledForRoles | jsonb (Role[]) default `[]` | roles para quienes está ON (staff testing) |
| createdById / updatedById | uuid FK users | |
| createdAt / updatedAt | timestamptz | |
| deletedAt | timestamptz nullable | soft delete (BaseCrudService) |

- **Unique:** `key`.
- Sin enum de `type`: el comportamiento sale de los campos (global + listas + roles), no de un discriminador. Más simple.

#### 4.2 Tabla `feature_flag_audit` (espeja `ai_credential_audit`, R7)

| Columna | Tipo | Notas |
|---------|------|-------|
| id | uuid PK defaultRandom | |
| flagId | uuid FK feature_flags | |
| action | varchar(20) | `created` / `updated` / `toggled` / `deleted` |
| oldValue / newValue | jsonb nullable | snapshot del flag |
| actorId | uuid FK users (set null) | quién lo cambió |
| reason | varchar(500) nullable | por qué (ej: "kill switch: rompía el checkout") |
| createdAt | timestamptz defaultNow | append-only (sin updatedAt/deletedAt) |

#### 4.3 Permiso

- Agregar `FEATURE_FLAG_MANAGE = 'platform.featureFlag.manage'` a `PermissionEnum`.
- Grant a **SUPER_ADMIN** (seed/extras SQL, fila `('SUPER_ADMIN', 'platform.featureFlag.manage')`).

### 5. Evaluation Logic

```ts
type FlagContext = { userId?: string; role?: RoleEnum };

function evaluate(flag: FeatureFlag, ctx: FlagContext): boolean {
    if (!flag.isActive) return false;                              // 1. kill switch (master)
    if (ctx.userId && flag.forceOffUserIds.includes(ctx.userId))   // 2. force-off gana sobre todo
        return false;
    if (ctx.userId && flag.forceOnUserIds.includes(ctx.userId))    // 3. force-on por usuario
        return true;
    if (ctx.role && flag.enabledForRoles.includes(ctx.role))       // 4. on por rol (staff)
        return true;
    return flag.enabled;                                            // 5. default global
}
```

**Precedencia (de mayor a menor):** `isActive` master → force-off user → force-on user →
rol → default global. Sin hash, sin porcentaje, sin plan. Para un visitante anónimo
(`userId`/`role` undefined) el resultado es el **default global** (`flag.enabled`).

**Ejemplos:**

```jsonc
// Dark launch de calendar: apagado para todos, prendido para el owner mientras desarrolla
{ "key": "calendar", "enabled": false, "isActive": true,
  "forceOnUserIds": ["<owner-user-id>"], "forceOffUserIds": [], "enabledForRoles": [] }

// Testing interno: prendido solo para staff
{ "key": "new_search_ui", "enabled": false, "isActive": true,
  "forceOnUserIds": [], "forceOffUserIds": [], "enabledForRoles": ["SUPER_ADMIN","ADMIN","EDITOR"] }

// Kill switch disparado: feature que estaba GA, ahora OFF para todos
{ "key": "ai_image_enhance", "enabled": true, "isActive": false, ... }

// GA total
{ "key": "external_reviews", "enabled": true, "isActive": true, ... }
```

### 6. API Routes

| Route | Tier | Auth | Descripción |
|-------|------|------|-------------|
| `GET /api/v1/admin/feature-flags` | Admin | `FEATURE_FLAG_MANAGE` | Listar flags |
| `POST /api/v1/admin/feature-flags` | Admin | `FEATURE_FLAG_MANAGE` | Crear |
| `PATCH /api/v1/admin/feature-flags/:id` | Admin | `FEATURE_FLAG_MANAGE` | Editar (default, listas, roles) |
| `POST /api/v1/admin/feature-flags/:id/toggle` | Admin | `FEATURE_FLAG_MANAGE` | Kill switch (`isActive` on/off) + `reason` |
| `DELETE /api/v1/admin/feature-flags/:id` | Admin | `FEATURE_FLAG_MANAGE` | Soft delete |
| `GET /api/v1/admin/feature-flags/:id/audit` | Admin | `FEATURE_FLAG_MANAGE` | Audit log del flag |
| `GET /api/v1/protected/feature-flags/me` | Protected | User | Flags evaluados para el usuario actual (solo `{ key: boolean }`) |
| `GET /api/v1/public/feature-flags/me` | Public | None | Flags evaluados para anónimo (solo default global; solo `{ key: boolean }`) |

> **Nunca exponer internals** (listas de userIds, roles) en `/me` — solo el booleano resuelto.

### 7. Integration

#### 7.1 Server-side (helper)

```ts
import { featureFlagService } from '@repo/service-core';

const on = await featureFlagService.isEnabled('calendar', {
    userId: actor.id, role: actor.role
});
if (!on) return c.json({ error: 'Feature not available' }, 404);
```

`isEnabled()` lee del cache (in-memory TTL 60s), evalúa con `## 5`, y devuelve boolean.

#### 7.2 Client-side (web/admin)

- `/protected/feature-flags/me` (o `/public/...` para anónimo) devuelve `{ key: boolean }`.
- Cliente cachea con TanStack Query (`useFeatureFlag(key)`), TTL corto.
- Solo recibe booleanos resueltos — nunca internals.

### 8. Caching (in-memory, patrón EntitlementCache — R3)

- `Map<flagKey, { flag, timestamp }>` con TTL 60s. Mirror de `entitlement.ts:57-80`.
- En `POST .../toggle`, `PATCH`, `DELETE`: llamar `clearFeatureFlagCache(key)` (como
  `clearEntitlementCache`) para invalidar al instante en esa instancia; las demás
  instancias expiran por TTL en ≤60s.
- Sin Redis, sin pub/sub.

### 9. Admin Panel

- Rutas file-based en `apps/admin/src/routes/_authed/platform/feature-flags/`
  (`index.tsx` lista, `new.tsx`, `$id.tsx`, `$id_.edit.tsx`) — clonar host-trades (R8).
- **List:** tabla con key, description, default (`enabled`), estado (`isActive`),
  #overrides. TanStack Table.
- **Create/Edit:** form (TanStack Form + Zod) con key, description, default toggle,
  listas de user IDs force-on/force-off, multi-select de roles.
- **Kill switch:** un switch `isActive` con confirm modal + campo `reason`.
- **Audit:** sección con el log del flag.
- **Sidebar:** entry en `menu.ts` bajo platform, gate `FEATURE_FLAG_MANAGE` (R9).
- Gate `beforeLoad` con `FEATURE_FLAG_MANAGE`.

### 10. User Stories (con checks testeables)

#### US-1 — Dark launch

- **GIVEN** un flag `calendar` con `enabled=false`, `forceOnUserIds=[owner]`
  **WHEN** el owner pega a una route gateada por `calendar`
  **THEN** la ve (force-on); cualquier otro usuario NO la ve (default global off).

#### US-2 — Kill switch

- **GIVEN** un flag `ai_image_enhance` GA (`enabled=true`, `isActive=true`)
  **WHEN** un admin hace `POST .../toggle` con `isActive=false` + reason
  **THEN** en ≤60s `isEnabled('ai_image_enhance', *)` devuelve `false` para TODOS
  (ignora overrides), y queda una fila en `feature_flag_audit` con action `toggled` + reason.

#### US-3 — Override por usuario (force-off)

- **GIVEN** un flag `enabled=true` con `forceOffUserIds=[U]`
  **WHEN** el usuario U evalúa el flag
  **THEN** lo ve OFF, aunque para el resto esté ON (force-off gana).

#### US-4 — Override por rol (staff)

- **GIVEN** un flag `enabled=false`, `enabledForRoles=['SUPER_ADMIN','ADMIN','EDITOR']`
  **WHEN** un EDITOR evalúa
  **THEN** lo ve ON; un CLIENT (no listado) lo ve OFF.

#### US-5 — Permiso

- **GIVEN** un usuario sin `FEATURE_FLAG_MANAGE`
  **WHEN** intenta listar/editar flags o ve el sidebar
  **THEN** 403 / el item no aparece.

### 11. Tasks

| Task | Title | Fit |
|---|---|---|
| T-276-01 | Schemas: `FeatureFlagSchema` + create/update + `FlagContext` en @repo/schemas | BÁSICO |
| T-276-02 | Permiso: `FEATURE_FLAG_MANAGE` + migración enum + grant SUPER_ADMIN (seed/extras) | BÁSICO |
| T-276-03 | DB: dbschema `feature_flags` + `feature_flag_audit` + `pnpm db:generate` | BÁSICO |
| T-276-04 | Service: `FeatureFlagService extends BaseCrudService` (CRUD + `isEnabled` + audit write) | BÁSICO |
| T-276-05 | Cache: in-memory Map TTL 60s + `clearFeatureFlagCache` (mirror EntitlementCache) | BÁSICO |
| T-276-06 | API: admin CRUD + toggle + audit endpoints (gate `FEATURE_FLAG_MANAGE`) | BÁSICO |
| T-276-07 | API: protected + public `/feature-flags/me` (solo booleanos resueltos) | BÁSICO |
| T-276-08 | Admin: lista + create/edit form (default, listas user, roles) — clonar host-trades | BÁSICO |
| T-276-09 | Admin: kill-switch toggle con confirm + reason + audit view + sidebar entry | BÁSICO |
| T-276-10 | Web/Admin: hook `useFeatureFlag(key)` (TanStack Query) | BÁSICO |
| T-276-11 | i18n es/en/pt (admin UI) | BÁSICO |
| T-276-12 | Tests: service (evaluación + precedencia + cache invalidation) + API + admin | BÁSICO |
| T-276-13 | Docs: cuándo crear un flag + cleanup policy (flags huérfanos) | BÁSICO |

### 12. Acceptance Criteria

- [ ] Admin (SUPER_ADMIN) puede crear/editar/eliminar flags.
- [ ] Kill switch (`isActive` toggle) apaga la feature para todos en ≤60s (cache TTL) + audit.
- [ ] Default global on/off funciona.
- [ ] Override por usuario: force-on prende para users listados; force-off apaga (force-off gana).
- [ ] Override por rol: solo roles listados ven la feature.
- [ ] Precedencia correcta: isActive → force-off → force-on → rol → default global.
- [ ] Anónimo recibe solo el default global; `/me` nunca expone internals.
- [ ] Audit log registra created/updated/toggled/deleted con actor + reason.
- [ ] Gate `FEATURE_FLAG_MANAGE` (SUPER_ADMIN) en API + sidebar + route.
- [ ] i18n completo.

### 13. Risks

| Risk | Mitigation |
|---|---|
| Cache stale → cambio no se refleja | TTL 60s + `clearFeatureFlagCache(key)` on write (instant en esa instancia). |
| Flag check en hot path → latency | Cache in-memory, <1ms; mirror del EntitlementCache ya probado. |
| Flags huérfanos (code removido, flag queda) | Audit + doc de cleanup policy (T-276-13). |
| Listas de userIds crecen | OK para targeting puntual (staff/beta); no es para rollout masivo (eso sería otra cosa, fuera de scope). |
| Flag depende de flag (anidados) | v1 no soporta; documentar limitación. |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "sistema de feature flag". **Realineado 2026-06-23** en
conversación con el owner: el caso de uso real es on/off (dark launch + kill switch) con
override por usuario/rol, **sin billing/porcentaje/A-B**. Recon de código real + 3
decisiones owner (ver banner).

### Reference (verificado en recon)

- Redis (cableado, sin pub/sub): `apps/api/src/utils/redis.ts:17-61`.
- Cache pattern a copiar: `apps/api/src/middlewares/entitlement.ts:57-80` (`EntitlementCache`).
- Permiso SUPER_ADMIN-only pattern: `packages/schemas/src/enums/permission.enum.ts:827,833`; grant en role_permission seed/extras.
- Actor.role en context: `apps/api/src/middlewares/actor.ts:223`, `apps/api/src/types.ts:47`.
- PlatformSettings (referencia key/value): `packages/db/src/schemas/platform/platform-settings.dbschema.ts:18-25`.
- Audit pattern: `packages/db/src/schemas/ai/ai_credential_audit.dbschema.ts:29-84`.
- Admin CRUD clon: `apps/admin/src/routes/_authed/platform/host-trades/{index,$id,$id_.edit,new}.tsx`.
- Sidebar: `apps/admin/src/lib/menu.ts:233-246`.
- BaseCrudService (soft-delete): `packages/service-core/src/base/base.crud.service.ts:40,118`.

### Cross-spec dependencies

- Todas las features nuevas (calendar/SPEC-272, AI/SPEC-273, etc.) son candidatas a
  gatearse con un flag para dark launch.
- SPEC-180 (Sentry) — opcional: capturar toggles de kill switch en Sentry.

---

## Model Fit Verdict

**BÁSICO.** Al realinear el scope a la visión real del owner (on/off + override por
usuario/rol, sin billing/porcentaje/A-B), desaparecen TODAS las partes potentes que tenía
el spec original:
- **Sin hash determinístico ni porcentaje** → la evaluación es comparar listas (`includes`).
- **Sin plan-targeting** → no hace falta plumbing de plan en el context (los entitlements
  ya cubren plan-gating).
- **Sin Redis pub/sub** → el cache es un `Map` con TTL 60s, clon del `EntitlementCache`
  que ya existe y está probado.

Cada pieza tiene un patrón existente a copiar: tabla + `BaseCrudService` (soft-delete
gratis), audit que espeja `ai_credential_audit`, admin CRUD que clona host-trades, permiso
SUPER_ADMIN-only con precedente, cache que clona `EntitlementCache`. La evaluación es una
función pura de 5 líneas con precedencia clara y testeable. Criterios de aceptación
cerrados. Un modelo chico lo implementa de corrido.

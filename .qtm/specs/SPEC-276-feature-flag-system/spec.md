---
spec-id: SPEC-276
title: Feature flag system — DB-backed, admin-managed, per-environment, gradual rollout
type: feature
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 16-24
tags: [feature-flags, infrastructure, admin, api, web, config, gradual-rollout, db]
---

# SPEC-276: Feature flag system

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Crear un sistema de feature flags DB-backed, administrable desde el admin panel, que permita: (a) togglear features sin redeploy, (b) rollout gradual por porcentaje de usuarios, (c) targeting por rol/plan, (d) kill switches para desactivar features en producción rápidamente.

**Why now:** Actualmente los feature flags son env vars (`HOSPEDA_FEATURE_*`) que requieren redeploy para cambiar. Con la plataforma creciendo, necesitamos toggles runtime sin deploy. Casos de uso: dark launch, gradual rollout, A/B testing, kill switches de emergencies.

**Current state:** Los "feature flags" actuales son env vars booleanas (ej: `HOSPEDA_FEATURE_ADDON_LIFECYCLE`, `HOSPEDA_FEATURE_SUBSCRIPTION_CANCEL`). Requieren cambiar env + redeploy. No hay targeting ni rollout gradual.

### 2. Out of Scope

- A/B testing con metrics/analytics integrados (esta spec es flags + targeting, no experimentation platform)
- Client-side flags persistentes (los flags se evalúan server-side, client recibe el resultado)
- Flags por usuario individual (targeting es por rol/plan/percentage, no user-ID)
- Migration automática de env var flags a DB (convivirán, los nuevos van a DB)

### 3. Requirements

#### 3.1 Flag types

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| Boolean | On/Off global | `ai_image_enhance_enabled` |
| Percentage | % de usuarios que ven la feature | `new_search_ui` (50% rollout) |
| Role-targeted | On para roles específicos | `commerce_dashboard` (HOST, COMMERCE_OWNER) |
| Plan-targeted | On para planes específicos | `ai_chat_unlimited` (PRO plans) |
| Environment | On en staging, off en prod | `experimental_feature` |

#### 3.2 Flag lifecycle

1. **Created** (off by default) — admin crea flag con metadata
2. **Dark launch** (off) — deploy code con flag check, flag off
3. **Internal testing** (on, role: STAFF) — activar solo para staff
4. **Gradual rollout** (percentage: 10% → 50% → 100%) — incrementar gradual
5. **General availability** (on, all) — flag on para todos
6. **Deprecated** — flag removido del code (cleanup, puede ser post-merge)

#### 3.3 Kill switch

Cualquier flag se puede apagar instantaneamente desde admin sin deploy. Casos:

- Feature causa bugs en prod → kill switch
- Performance degradation → kill switch
- Security issue → kill switch

### 4. Data Model

#### 4.1 Nueva tabla: `feature_flags`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| key | varchar(100) unique | `ai_image_enhance`, `new_search_ui` |
| description | text | Qué hace la feature |
| type | enum | BOOLEAN / PERCENTAGE / ROLE_TARGETED / PLAN_TARGETED |
| value | jsonb | `{ enabled: true }` o `{ percentage: 50 }` o `{ roles: ['HOST'] }` o `{ plans: ['pro'] }` |
| environment | enum | ALL / STAGING / PRODUCTION |
| isActive | boolean | Flag master on/off (separate from value) |
| createdById | UUID FK users | |
| updatedById | UUID FK users | |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |
| deletedAt | timestamptz nullable | Soft delete |

#### 4.2 Nueva tabla: `feature_flag_audit`

| Columna | Tipo | Notas |
|---------|------|-------|
| id | UUID PK | |
| flagId | UUID FK feature_flags | |
| action | enum | CREATED / UPDATED / TOGGLED / DELETED |
| oldValue | jsonb nullable | |
| newValue | jsonb nullable | |
| actorId | UUID FK users | Admin que hizo el cambio |
| reason | varchar(500) nullable | Por qué se cambió |
| createdAt | timestamptz | |

### 5. Evaluation Logic

```ts
async function evaluateFlag(key: string, context: FlagContext): Promise<boolean> {
    const flag = await flagService.get(key);
    if (!flag || !flag.isActive) return false;
    if (!flag.matchesEnvironment(env)) return false;
    
    switch (flag.type) {
        case 'BOOLEAN': return flag.value.enabled;
        case 'PERCENTAGE': return hashUserId(context.userId) % 100 < flag.value.percentage;
        case 'ROLE_TARGETED': return flag.value.roles.includes(context.role);
        case 'PLAN_TARGETED': return flag.value.plans.includes(context.plan);
    }
}
```

**Hash function:** Deterministic hash del userId para que el mismo usuario siempre vea el mismo resultado (consistencia durante rollout).

### 6. API Routes

| Route | Tier | Auth | Descripción |
|-------|------|------|-------------|
| `GET /api/v1/admin/feature-flags` | Admin | FEATURE_FLAG_MANAGE | Listar todos los flags |
| `POST /api/v1/admin/feature-flags` | Admin | FEATURE_FLAG_MANAGE | Crear flag |
| `PATCH /api/v1/admin/feature-flags/:id` | Admin | FEATURE_FLAG_MANAGE | Update flag |
| `DELETE /api/v1/admin/feature-flags/:id` | Admin | FEATURE_FLAG_MANAGE | Soft delete flag |
| `POST /api/v1/admin/feature-flags/:id/toggle` | Admin | FEATURE_FLAG_MANAGE | Toggle on/off (kill switch) |
| `GET /api/v1/admin/feature-flags/audit` | Admin | FEATURE_FLAG_MANAGE | Audit log |
| `GET /api/v1/public/feature-flags/evaluate` | Public | None | Evaluar flags para contexto actual (sin exponer internals) |
| `GET /api/v1/protected/feature-flags/me` | Protected | User | Flags para el usuario actual |

### 7. Admin Panel

- **List**: `/platform/feature-flags/` — tabla con key, type, value, environment, status
- **Create/Edit**: form con key, description, type, value (dynamic based on type), environment
- **Toggle**: switch on/off con confirm modal (kill switch)
- **Audit**: tab de audit log por flag
- **Permission**: `PermissionEnum.FEATURE_FLAG_MANAGE` (SUPER_ADMIN only inicialmente)

### 8. Integration

#### 8.1 Server-side (API)

```ts
import { flagService } from '@repo/service-core';

// En una route:
const isEnabled = await flagService.evaluate('ai_image_enhance', {
    userId: user.id,
    role: user.role,
    plan: user.plan
});
if (!isEnabled) return c.json({ error: 'Feature not available' }, 403);
```

#### 8.2 Client-side (Web/Admin)

- API endpoint `/protected/feature-flags/me` devuelve flags evaluados para el usuario
- Client cachea flags (TanStack Query) con TTL
- No exponer internals del flag (percentage, roles) — solo boolean

#### 8.3 Env var migration

Los flags existentes (env vars) NO se migran automáticamente. Convivirán:

- Env vars: para flags que necesitan deploy-time config (seguridad, infra)
- DB flags: para feature toggles runtime (product, UX, gradual rollout)

### 9. Caching

- Flags se cachean en Redis (o in-memory) con TTL de 60s
- Kill switch: cache invalidation inmediata via pub/sub o purge
- No impactar latencia de requests normales

### 10. Tasks

| Task | Title | Status |
|---|---|---|
| T-276-01 | DB migration: `feature_flags` + `feature_flag_audit` tables | pending |
| T-276-02 | Schemas: flag Zod schemas en @repo/schemas | pending |
| T-276-03 | Service: FeatureFlagService en @repo/service-core | pending |
| T-276-04 | Service: evaluate logic (hash, targeting, env) | pending |
| T-276-05 | Cache: Redis/in-memory con TTL + invalidation | pending |
| T-276-06 | API: admin CRUD + toggle + audit endpoints | pending |
| T-276-07 | API: protected/public evaluate endpoints | pending |
| T-276-08 | Admin: flag list + create/edit + toggle UI | pending |
| T-276-09 | Admin: audit log view | pending |
| T-276-10 | Admin: permission FEATURE_FLAG_MANAGE + sidebar | pending |
| T-276-11 | Integration: helper function para usar en routes | pending |
| T-276-12 | Web: hook useFeatureFlag (TanStack Query) | pending |
| T-276-13 | Tests: service + API + admin | pending |
| T-276-14 | Docs: cuando usar DB flags vs env vars | pending |

### 11. Acceptance Criteria

- [ ] Admin puede crear/editar/eliminar feature flags
- [ ] Admin puede toggle on/off (kill switch) instantaneamente
- [ ] Boolean flag: on/off global funciona
- [ ] Percentage flag: rollout gradual consistente (mismo user = mismo resultado)
- [ ] Role-targeted flag: solo roles especificados ven la feature
- [ ] Plan-targeted flag: solo planes especificados ven la feature
- [ ] Environment: flag puede ser staging-only o production-only
- [ ] Audit log: todos los cambios quedan registrados
- [ ] Cache: flags se evalúan en <1ms (cached)
- [ ] Kill switch: toggle desactiva en <60s (cache TTL)
- [ ] Permission: solo SUPER_ADMIN puede gestionar flags

### 12. Risks

| Risk | Mitigation |
|---|---|
| Cache stale → flag cambio no se refleja | TTL corto (60s) + purge on toggle |
| Flag check en hot path → latency | Cache en Redis/in-memory, <1ms |
| Flags orphaned (code removido, flag queda) | Audit + dashboard de flags sin uso |
| Percentage hash no uniforme | Usar hash distribuido (ej: xxHash) |
| Too many flags → complejidad | Docs: "cuando crear un flag vs no", cleanup policy |
| Flag depende de flag → flags anidados | V1: no soportar, documentar limitación |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "sistema de feature flag"

### Reference

- Current env var flags: `packages/config/src/env-registry.hospeda.ts` — `HOSPEDA_FEATURE_*`
- Platform settings: `packages/db/src/schemas/platform/platform-settings.dbschema.ts` — pattern de key/value DB
- Admin entity pattern: SPEC-185 (admin entity lists v2)
- Cache pattern: Redis o in-memory (verificar si Redis ya está en el stack)
- Permission pattern: `PermissionEnum` en `packages/schemas/src/enums/permission.enum.ts`

### Cross-spec dependencies

- Todas las specs nuevas (267-275) son candidates para usar feature flags
- SPEC-180 (sentry observability) — auditar flag toggles en Sentry
- SPEC-211 (AI monetization) — AI features pueden usar flags para rollout gradual

---
specId: SPEC-296
title: Feature Flags Audit & Toggle System
type: feat
complexity: medium
status: draft
created: 2026-06-27
tags: [feature-flags, config, billing, devops, admin]
---

# SPEC-296 — Feature Flags Audit & Toggle System

> Audit every current platform feature, classify which ones should be gated
> behind a flag, and wire those flags into the relevant code paths. The flag
> infrastructure is already built (SPEC-276). This spec is about using it
> correctly.

## 1. Summary

SPEC-276 (completed 2026-06-25) delivered a full DB-backed feature-flag
infrastructure: `feature_flags` table, `FeatureFlagService.evaluateFlag()`,
admin CRUD + kill-switch routes (`/api/v1/admin/flags`), per-user/per-role
override evaluation, and an in-memory cache (TTL 60s). Despite this, **zero
flags are seeded or wired in any code path today**. The system exists but is
not connected to anything.

This spec answers the owner's question:

> "Analizar todas las features actuales y ver a cuáles les podemos setear
> feature flag para prenderlas y apagarlas de manera fácil."

Phase 1 is a **discovery/audit phase**: survey every feature module across
`apps/web`, `apps/admin`, and `apps/api`; classify each by flag candidacy and
urgency; and decide the relationship between operational feature flags and the
existing billing entitlement system. No design is frozen until the owner
reviews the audit output.

## 2. Current State / Key Files

The flag infrastructure that already exists (not to be rebuilt):

- **DB tables** (applied via extras carril):
  `packages/db/src/migrations/extras/022-feature-flags-tables.table.sql` —
  `feature_flags` + `feature_flag_audit_log`.
- **DB model**: `packages/db/src/models/feature-flags/feature-flags.model.ts`
  — `findActiveFlags`, `findByKey`, `toggleActive`, `createAuditLog`.
- **Service**: `packages/service-core/src/services/feature-flags/feature-flags.service.ts`
  — `evaluateFlag(key, { userId, role })`, `getAllFlags()`, CRUD + kill-switch.
  In-memory cache (`Map<key, {flag, ts}>`), TTL 60s, invalidated on write via
  `clearFeatureFlagCache(key)`.
- **API routes**: `apps/api/src/routes/feature-flags/` — admin (list, create,
  update, toggle, delete, auditLog), protected (`/me` — resolved booleans for
  the logged-in user), public (`/getAll`, `/getMe` — resolved booleans for
  anonymous).
- **Permission**: `FEATURE_FLAG_MANAGE = 'platform.featureFlag.manage'`
  in `packages/schemas/src/enums/permission.enum.ts` (SUPER_ADMIN-only).
- **Billing entitlements** (parallel system, distinct purpose):
  `packages/billing/src/config/entitlements.config.ts` — 36 `EntitlementKey`
  values gating per-plan access (`AI_CHAT`, `AI_SEARCH`, `CUSTOM_BRANDING`,
  `CAN_USE_CALENDAR`, etc.). Evaluated per subscription, not as operational
  toggles.

### Current gap

`FeatureFlagService.evaluateFlag()` is never called from any route, middleware,
page, or component. The flag admin UI routes exist in the API but the admin
app (TanStack Start) has no flag management pages yet (SPEC-276 T-276-08/09
may be incomplete — verification needed). No flags are seeded.

## 3. Problem

Without a registry of "which features can be flagged" and without wiring flag
checks into the actual code paths, the flag system is dead infrastructure. Two
practical scenarios are blocked:

1. **Dark launch**: shipping a new feature (e.g., availability calendar, map
   view improvements) to prod while off by default, enabling only for internal
   testing before GA.
2. **Kill switch**: turning off a broken GA feature without a redeploy — the
   primary safety net in incident response.

Additionally, the relationship between feature flags and billing entitlements
is undefined. Both can hide a feature from a user. Without a clear decision
tree, the team risks implementing both for the same feature or using the wrong
layer for the wrong problem.

## 4. Goals (Provisional — pending audit + owner alignment)

- **G-1** Produce a comprehensive audit matrix of all current platform features
  classified by flag candidacy (dark-launch candidate, kill-switch candidate,
  entitlement-only, not flaggable).
- **G-2** Decide and document the boundary between operational feature flags
  and billing entitlements (the "flag vs entitlement" decision tree).
- **G-3** Seed the initial set of agreed flags in the database (one TypeScript
  seed file in `packages/seed/`).
- **G-4** Wire flag evaluation into the relevant server-side code paths
  (API middleware or route-level `evaluateFlag()` calls).
- **G-5** Define and document a governance policy: when to create a flag, who
  approves it, and how/when to retire it (cleanup policy).
- **G-6** Verify or complete the admin panel UI for flag management (SPEC-276
  T-276-08/09) so the owner can operate flags without a developer.

## 5. Non-Goals

- **Not** rebuilding the flag infrastructure (SPEC-276 is done and deployed).
- **Not** introducing rollout-by-percentage or A/B testing (explicitly
  out of scope per SPEC-276 owner decision).
- **Not** replacing the billing entitlement system with feature flags — both
  systems serve different purposes (see OQ-1).
- **Not** flagging auth, core routing, or database schema (infrastructure,
  not features).

## 6. Provisional Feature Inventory

The following modules were identified from `apps/web/src/pages/` and the
billing entitlements list. This is a starting point for the audit — not a
final classification.

### 6.1 AI features

| Feature | Entitlement key | Flag candidate? |
|---------|----------------|-----------------|
| AI semantic search (`/busqueda`) | `AI_SEARCH` | Yes — kill switch |
| AI chat assistant | `AI_CHAT` | Yes — kill switch + dark launch |
| AI text improvement (admin) | `AI_TEXT_IMPROVE` | Yes — kill switch |
| AI support assistant | `AI_SUPPORT` | Yes — kill switch |
| AI content translation | `AI_TRANSLATE` | Yes — dark launch |
| AI accommodation import | `AI_ACCOMMODATION_IMPORT` | Yes — dark launch |
| AI social post generation (SPEC-223) | none | Yes — dark launch |

AI features already have billing entitlements per plan AND per-model limits
(SPEC-283). Feature flags would add a **global kill switch** orthogonal to
entitlements. This is the clearest dual-layer use case — see OQ-1.

### 6.2 Content / publishing modules

| Feature | Flag candidate? |
|---------|----------------|
| Blog posts / publicaciones (`/publicaciones/`) | Yes — can be turned off |
| Events (`/eventos/`) | Yes |
| Social hub / colaborar (`/colaborar/`) | Yes |
| Newsletter (`/newsletter/`, `/mi-cuenta/newsletter`) | Yes — kill switch |
| Partners page (`/partners/`) | Low — mostly static |

### 6.3 Host owner features

| Feature | Entitlement / notes | Flag candidate? |
|---------|---------------------|-----------------|
| Availability calendar | `CAN_USE_CALENDAR` | Yes — dark launch |
| Owner promotions (`/mi-cuenta/promociones/`) | `CREATE_PROMOTIONS` | Maybe |
| Custom branding | `CUSTOM_BRANDING` | Low — already entitlement-gated |
| Consultas / inquiries | none | Yes — can be killed |
| Host dashboard | none | Low |

### 6.4 Tourist features

| Feature | Entitlement / notes | Flag candidate? |
|---------|---------------------|-----------------|
| Favorites + collections | `SAVE_FAVORITES` | Low — already entitlement-gated |
| Reviews / reseñas | `WRITE_REVIEWS` | Yes — kill switch |
| Map views (accommodations, destinations) | none | Yes — dark launch |
| Vendor directory (`/directorio-proveedores/`) | none | Yes — new feature |
| What's new / novedades | none | Low |
| Price alerts | `PRICE_ALERTS` | Low — entitlement |

### 6.5 Commerce listings

| Feature | Notes | Flag candidate? |
|---------|-------|-----------------|
| Commerce listing (`/mi-cuenta/comercio/`) | SPEC-239, separate domain | Yes — dark launch |
| Restaurant publishing (`/publicar-restaurante/`) | | Yes |

## 7. First Steps / Discovery Plan

This spec is **discovery-first**. The implementation phases below are
provisional. The FIRST phase is research and owner alignment — no code is
written before the audit output is reviewed.

### Phase 0 — Research (do before writing any code)

1. **Complete the audit matrix.** For every feature in §6, decide: (a) flag or
   not, (b) default-on or default-off for existing GA features, (c) kill-switch
   only or also dark-launch, (d) overlaps with billing entitlement.
2. **Decide OQ-1** (flag vs entitlement boundary). Present the decision tree to
   the owner with examples.
3. **Verify SPEC-276 completeness.** Check whether T-276-08/09 (admin panel
   pages) are actually implemented in `apps/admin/src/routes/`. If not, scope
   them into SPEC-296.
4. **Inventory zero-flag state.** Confirm `feature_flags` table is empty on
   staging; confirm `FeatureFlagService.evaluateFlag()` is called nowhere.

### Phase 1 — Seed initial flags (after owner alignment)

1. Write seed file `packages/seed/src/required/featureFlags.seed.ts` with the
   agreed initial set of flags (idempotent via `onConflictDoUpdate`).
2. Run `pnpm db:seed` on staging and verify flags appear in the admin UI.

### Phase 2 — Wire flag checks into code paths

For each flagged feature:
- Server-side route: add `evaluateFlag(key, { userId, role })` and return
  appropriate HTTP status (404 or 503) when disabled.
- Optionally: client-side `useFeatureFlag(key)` hook in admin/web components.

### Phase 3 — Admin panel verification / completion

Ensure the admin panel has working flag management UI. If SPEC-276 T-276-08/09
are not complete, implement them here before declaring the system operational.

### Phase 4 — Governance docs

Write `docs/guides/feature-flags.md` covering: when to create a flag, naming
conventions (`kebab-case`, e.g. `ai-search`), default-off policy for new
features, cleanup process for retired flags.

## 8. Open Questions

- **OQ-1 — Flag vs entitlement: when to use which?** The billing entitlement
  system already gates AI, calendar, favorites, etc. per plan. Should AI
  features have BOTH a flag (operational kill switch) AND an entitlement (plan
  gate)? Or do we treat them as mutually exclusive layers? The candidate
  decision tree: (a) entitlement = "does the user's plan allow this?"; (b) flag
  = "is this feature even on globally?". A feature can be entitlement-gated
  (per plan) AND flag-gated (global on/off). Flags fire FIRST (if flag is off,
  skip entitlement check). Owner decision needed.

- **OQ-2 — Default-on for existing GA features?** Every feature currently live
  in prod is effectively "flag = on." When we create flags for them, should we
  seed them as `enabled: true, isActive: true` (keep behavior unchanged) or
  `enabled: false, isActive: false` (dark launch posture)? The safe default is
  `enabled: true` for GA features and `enabled: false` only for new in-progress
  ones. Owner confirmation needed.

- **OQ-3 — Client-side propagation.** The `GET /api/v1/protected/feature-flags/me`
  route already returns resolved booleans `{ key: boolean }`. Should the web
  app (`apps/web`, Astro SSR) read flags server-side per request, or cache them
  client-side with a `useFeatureFlag` TanStack Query hook? Server-side is
  simpler but adds one API call per page render; client-side is async but
  avoids SSR coupling. Decision impacts how feature-gated pages render.

- **OQ-4 — Granularity: page-level vs component-level gating?** Some features
  (e.g., AI search) span a whole page (`/busqueda`). Others are UI components
  inside a page (the AI improve button inside the accommodation editor). Where
  does flag evaluation live — at the route/page level (redirect on disabled) or
  at the component level (hide element)? A mix is possible but needs a clear
  rule to avoid inconsistency.

- **OQ-5 — Admin panel completion status.** SPEC-276 tasks T-276-08 (admin
  list + create/edit form) and T-276-09 (kill-switch UI + audit view + sidebar)
  were scoped but may not be implemented. Verify before claiming the admin
  panel works. If missing, who scopes and tracks the fix — absorb into
  SPEC-296 or reopen SPEC-276?

- **OQ-6 — Naming convention for flag keys.** The DB schema allows `varchar(100)`.
  Should keys mirror entitlement keys (`ai-chat`, `ai-search`), feature module
  slugs (`availability-calendar`, `newsletter`), or follow a different
  convention? A consistent naming scheme is needed before seeding.

- **OQ-7 — Who can create/retire flags in prod?** SPEC-276 gates flag
  management behind `FEATURE_FLAG_MANAGE` (SUPER_ADMIN only). Is that still
  the right gate, or should `ADMIN` role also be able to toggle (but not
  create/delete) flags? And what is the process for retiring a flag — how do we
  ensure the wired code checks are removed when a feature is permanently GA?

- **OQ-8 — Interaction with Sentry / observability.** Should a kill-switch
  toggle create a Sentry breadcrumb or alert? SPEC-276 noted SPEC-180 (Sentry)
  as an optional integration. In an incident (kill switch fired), knowing that
  a flag was toggled would be useful context in the Sentry timeline.

- **OQ-9 — Seed vs admin-created flags.** Should the initial flags live in the
  seed (reproducible on any fresh DB) or be created manually in the admin UI
  (operator-owned, not code-tracked)? Seed is safer for reproducibility and CI,
  but means flag changes require a code PR. Admin-created is faster but makes
  staging/prod diverge. A hybrid may work: core system flags in seed, ephemeral
  dark-launch flags created ad hoc in admin.

- **OQ-10 — Flag dependency ordering.** When evaluating a flagged feature
  server-side, what HTTP status should the API return when a flag is off: `404`
  (feature does not exist for you), `503` (temporarily unavailable), or a
  custom application error code? The web app and admin need consistent
  behavior.

## 9. Relationship to Existing Systems

- **SPEC-276** — delivered the flag infrastructure this spec operates on. Status:
  completed 2026-06-25. All infrastructure (DB, service, API, cache, permission)
  is in place.
- **Billing entitlements** (`packages/billing/src/config/entitlements.config.ts`)
  — 36 keys gating per-plan access. Orthogonal to feature flags; OQ-1 decides
  the interaction model.
- **SPEC-283** (graduated AI limits) — AI feature entitlements already have
  per-tier usage caps. Feature flags add a global kill-switch layer on top.
- **SPEC-295** (versioned seed data migrations) — if flags are seeded, changes
  to flag defaults over time should flow through versioned seed migrations, not
  manual DB edits.
- **SPEC-180** (Sentry) — optional integration for flag-toggle observability
  (OQ-8).

## 10. Risks

- **R-1 — Over-flagging.** Putting every minor feature behind a flag creates
  maintenance overhead and cognitive load. The audit must apply a clear
  "is this worth the flag?" threshold.
- **R-2 — Default mismatch.** Seeding a GA feature as `enabled: false` by
  mistake would silently break it for all users. The seeding phase needs a
  careful review (OQ-2).
- **R-3 — Cache TTL on kill switch.** The in-memory cache TTL is 60s per
  instance. In a multi-instance deployment, a kill switch fires instantly on
  the toggling instance but propagates in up to 60s on others. This is
  acceptable per the SPEC-276 decision but must be documented as a known
  latency in incident runbooks.
- **R-4 — Flag/entitlement confusion.** Without a clear documented boundary
  (OQ-1), future contributors will use the wrong layer and create redundant
  gates or gaps. The governance docs (Phase 4) must be written before any code
  is shipped.
- **R-5 — Admin panel gap.** If T-276-08/09 are not implemented, the flags
  cannot be operated by the owner without a developer. Discovery must confirm
  this before claiming the system is operational.

## 11. Revision History

- 2026-06-27 — Initial draft (allocated SPEC-296). Discovery-first: design
  locked only after Phase 0 audit + owner alignment. Key findings from
  codebase recon: SPEC-276 infrastructure is fully built but zero flags are
  wired or seeded; billing entitlements (36 keys) are a parallel system whose
  interaction with flags must be decided (OQ-1); the admin panel completeness
  of SPEC-276 T-276-08/09 is unverified (OQ-5). Ten open questions deferred to
  the discovery phase.

---
specId: SPEC-152
title: Plans, Limits & Entitlements Editable Without Deploy
status: draft
complexity: high
owner: qazuor
created: 2026-05-21
parent: (none)
related:
  - SPEC-143 (billing testing coverage — surfaced the config-vs-DB drift gap)
  - SPEC-145 (billing entitlements + limits enforcement — adjacent surface, may inform design)
---

# SPEC-152 — Plans, Limits & Entitlements Editable Without Deploy

> **Status**: DRAFT — base scope captured during smoke session 2026-05-21. Multiple architectural decisions still open; document includes explicit discussion sections (Q1-Q8) for owner alignment before tasks generation.

## 1. Origin

During the SPEC-143 manual smoke session on 2026-05-21, the owner identified a fundamental architectural friction:

- The admin UI exposes "edit plan" controls that go to `billing_plans` DB rows.
- But the canonical source of plans in code is `ALL_PLANS` from `@repo/billing` (a static TypeScript constant compiled into the bundle).
- Three display surfaces (web pricing page, admin plans page, public listPlans API) read from `ALL_PLANS` directly — bypassing the DB rows admins just edited.
- "Fallback to config when DB fails" was the original justification, but if the DB fails the whole site is down anyway — the fallback adds zero resilience while creating a "what you see is not what gets charged" risk.

Owner's stated goal: **"editar los planes sin depender de un deploy"** + same desire for limits and entitlements.

## 2. Current state — code references

### 2.1 Display surfaces using `ALL_PLANS` (5 files — target for DB-fication)

| File | Role | Notes |
|------|------|-------|
| `apps/api/src/routes/billing/public/listPlans.ts` | Public list endpoint (web pricing page) | Filters `ALL_PLANS` by `isActive` |
| `apps/api/src/routes/billing/admin/plans.ts` | Admin list endpoint | Returns `[...ALL_PLANS]` mapped to response shape |
| `apps/web/src/pages/[lang]/suscriptores/planes/index.astro` | Public pricing page (SSG) | Reads `ALL_PLANS` at build time |
| `apps/web/src/pages/[lang]/suscriptores/turistas/...` | Tourist pricing page (SSG, parallel to planes) | Same pattern |
| `apps/admin/src/routes/_authed/billing/plans.tsx` | Admin plans table | Falls back to `ALL_PLANS` when API response Zod-fails |

### 2.2 Internal logic using `ALL_PLANS` (6 files — SHOULD STAY in config)

These references are for type-safety, synchronous lookups, or correctness invariants. They do NOT display to users and should remain on config:

| File | Why it stays |
|------|--------------|
| `apps/api/src/services/addon.checkout.ts` (2 spots) | Derives plan limits at checkout time; needs synchronous lookup; canonical source per security model |
| `apps/api/src/services/addon-entitlement.service.ts` | Comment line 51 explicitly: "reads the base plan limit from canonical config rather than [DB]" — intentional |
| `apps/api/src/routes/user/protected/subscription.ts:179` | Display name + price resolution from canonical |
| `apps/admin/src/features/billing-subscriptions/ChangePlanDialog.tsx` | UI list of available plans for change-plan operation |
| `apps/admin/src/features/billing-subscriptions/SubscriptionFilters.tsx` | Filter dropdown with plan categories |
| `apps/admin/src/features/billing-subscriptions/utils.ts:68` | Synchronous `find(p => p.slug === slug)` for display name lookup |

The internal-logic references are inherent to having a `PlanDefinition` type at compile time. Removing them requires either (a) async lookups everywhere, or (b) replacing the typed `PlanDefinition` import with `string` slugs + runtime lookups — both break type-safety and add latency.

### 2.3 DB schema today

`billing_plans` (per `\d billing_plans`):

```
id            uuid (PK)
name          varchar(255) NOT NULL   ← used for slug-based lookup post-PR #1215
description   text
active        boolean NOT NULL
features      jsonb (legacy — unused?)
entitlements  text[]                  ← list of entitlement KEYS
limits        jsonb                   ← Record<limitKey, number>
metadata      jsonb                   ← all extra fields (slug, displayName, category, sortOrder, monthlyPriceArs, etc.)
livemode      boolean
version       uuid
created_at    timestamptz
updated_at    timestamptz
deleted_at    timestamptz
```

`billing_prices` (queryable separately, joined via plan_id) — the actual price source-of-truth for checkout.

**Observation**: the DB already has `entitlements` (text array) and `limits` (jsonb). They're populated from `ALL_PLANS` at seed time, but the runtime checkout/entitlement-grant code reads from the config — not from the DB. So **the data is there, just not used**.

## 3. Goal

Allow the admin UI to edit:

1. **Plan attributes** (name, description, active flag, sort order, prices, trial config) — **easy**, no type-safety concerns.
2. **Plan-level limits** (e.g., `max_accommodations: 10`) — **medium**, limit KEYS are type-safe but VALUES can be DB-driven.
3. **Plan-level entitlements** (e.g., `featured_listing`, `priority_support`) — **harder**, entitlement KEYS are also type-safe; values are presence/absence.

Editing without redeploy means:
- Admin saves change → DB write → cache invalidate
- Next entitlement load / checkout reads new value
- No code change, no CI, no deploy required

## 4. Scope decision points (Q1-Q8 — owner must answer)

### Q1 — Should plan ATTRIBUTES (name, description, active, prices, trial) be DB-editable?

**This is the no-brainer scope.** Answer expected: **yes**. These are display + commercial fields with no type-safety risk.

Affected: web pricing + admin plans + public listPlans + admin plans.tsx (5 display surfaces).

### Q2 — Plan-level limit VALUES editable from DB? (e.g., bump `max_accommodations` from 10 to 15 on the Pro plan without deploy)

Limit KEYS are an enum (`LimitKey` type, type-safe). VALUES are numbers.

Options:
- **A**: Yes, values from DB. Keep KEYS as type-safe enum. Editing UI: dropdown of known LimitKey + numeric input. Backend reads from `billing_plans.limits` jsonb.
- **B**: No, limits stay in config. Editing values requires deploy.

**Owner's stated preference**: YES (A). Implication: the `addon-entitlement.service.ts` line 160 lookup needs to change from `ALL_PLANS.find(...)` to a DB lookup. Latency + caching considerations apply.

### Q3 — Plan-level entitlement KEYS editable from DB?

Entitlement KEYS are an enum (`EntitlementKey` type). Each represents a feature flag (e.g., `can_create_featured_listing`).

Options:
- **A**: Yes, but only TOGGLING which keys are on a plan. The KEY universe stays as a code-defined enum.
- **B**: No, keep on config.
- **C**: Full DB-driven entitlement model — KEYS themselves can be added in DB. Requires defining what each new entitlement actually gates (impossible without code).

**Recommendation**: A. C is impossible without code changes anyway — a new entitlement key has no effect unless code checks it somewhere.

**Owner's stated preference**: YES (A) — "buscar una forma" for entitlements too. A is the workable approach.

### Q4 — Where does `billing_prices` fit?

The `billing_prices` table is the runtime source for checkout pricing. Currently admin UI doesn't seem to edit it directly (verify).

Options:
- **A**: Admin edits both `billing_plans.metadata.monthlyPriceArs` AND inserts/updates `billing_prices` row atomically.
- **B**: Admin edits only `billing_plans.metadata.*PriceArs`; a sync job propagates to `billing_prices`.
- **C**: Decouple display price from checkout price. Display from `metadata`, checkout from `billing_prices`. Document the divergence policy.

**Recommendation**: A (atomic, no async sync, single transaction).

### Q5 — Web pricing pages: SSG vs SSR vs SSG-with-revalidation?

Currently `apps/web/src/pages/[lang]/suscriptores/planes/index.astro` has `export const prerender = true` — SSG.

Options for fetching DB plans:
- **A**: Keep SSG. Build-time fetch from API. Deploy → fresh build → fresh prices. Defeats the "no deploy" goal partially (price changes need a build, not necessarily a redeploy).
- **B**: SSR (default Astro). Every request hits API. Always fresh but slower.
- **C**: SSR + Cloudflare cache + on-demand revalidation. Per `apps/web/CLAUDE.md` this is the existing pattern for content-heavy pages. Admin saves plan → API triggers `/api/revalidate` → CF cache purges → next request re-renders. Fresh + fast.

**Recommendation**: C. Already wired via `HOSPEDA_REVALIDATION_SECRET` + `initializeRevalidationService()` in `apps/api/src/index.ts:84`.

### Q6 — What happens to `@repo/billing.ALL_PLANS` config?

After DB-fication:

- **A**: Delete `ALL_PLANS`. Force every internal-logic ref (section 2.2) to do DB lookups. Async + cache pressure.
- **B**: Keep `ALL_PLANS` as the "shape definition" + entitlement/limit key enums. Internal logic stays sync. Display reads from DB. Drift between config and DB on prices/active/etc. is OK because display NEVER reads config (after this spec).
- **C**: Delete only the DB-target fields from `ALL_PLANS` (name, description, prices, active, sortOrder) and keep the type-safe parts (slug, category, entitlement+limit key bindings).

**Recommendation**: B. Pragmatic: type-safety + sync lookups stay where they need to; user-editable fields move to DB. Drift is by design — display is DB, code is config.

### Q7 — Cache invalidation strategy

When admin edits a plan, what needs to invalidate?

- Entitlement cache (per-customer, in-memory) — yes, for users on that plan.
- Web Cloudflare cache for `/suscriptores/planes/` — yes (per Q5).
- Admin app TanStack Query cache — yes (refetch on mutation).
- API in-memory plan cache? Currently doesn't exist — would need to add if we want DB reads to be fast.

**Open question**: do we add a plan-cache layer at the API to avoid hitting DB on every checkout? Default qzpay calls (`billing.plans.list()`) already hit DB but qzpay-core has its own caching layer.

### Q8 — Migration strategy

Existing DB has 9 plans (post our PR #1215 SQL update — `name = metadata->>'slug'`). After this spec:

- Existing rows STAY (no DROP).
- Schema may need extension (e.g., `display_name`, `sort_order` as top-level columns instead of `metadata` jsonb) — debate.
- Seed remains for "first install" / "reset to known good" — the same seed file becomes the bootstrap, not the authoritative source.
- Admin UI gains "Reset to defaults" button that overwrites DB from `ALL_PLANS`? Or only via re-running seed?

**Open question for the discussion**: should we promote `metadata` jsonb fields to top-level columns (typed) or stay jsonb (flexible)? Tradeoff: typed columns give validation + query support; jsonb gives schema-less iteration.

## 5. Out of scope (explicit)

- New entitlement KEY definitions via admin UI (Q3 option C). Code must define what an entitlement actually gates.
- New limit KEY definitions via admin UI. Same constraint.
- Per-customer overrides (already covered by SPEC-143 customer override flow).
- Plan-level promo codes (separate concept, SPEC-143 already covers).
- Sponsorship plans (separate, SPEC-151 area).

## 6. Proposed phases (placeholder — depends on Q1-Q8)

Once Q1-Q8 are answered, phases will look approximately:

1. **Phase 1** — Backend admin list reads from DB (resolves bug #8 from smoke).
2. **Phase 2** — Backend public list reads from DB.
3. **Phase 3** — Frontend admin drops fallback, expects DB shape.
4. **Phase 4** — Frontend web pricing page switches SSG → SSR-with-revalidation (per Q5 = C).
5. **Phase 5** — Admin "Edit plan" UI for attributes (Q1 scope: name, description, prices, active, sortOrder, trial).
6. **Phase 6** — Admin "Edit limits" UI (Q2 scope).
7. **Phase 7** — Admin "Toggle entitlements" UI (Q3 scope).
8. **Phase 8** — Revalidation triggers wired from admin save → web cache purge.
9. **Phase 9** — Cache invalidation strategy for entitlement load (Q7).

Estimated total: **2-3 weeks** of focused work.

## 7. Risk + tradeoffs

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Admin edits wrong price → checkout charges wrong amount | High | Confirm dialog + audit log + 24h "preview" mode? |
| Drift between `ALL_PLANS` config and DB on values | Medium | Display always from DB; internal logic always from config; document the policy clearly |
| Cache invalidation gaps → users see stale prices | Medium | Q7 design; integration tests |
| Schema migration to promote metadata fields | Medium | Drizzle migration; backwards-compatible seed |
| Admin UI complexity (edit limits + entitlements is a lot of surface) | High | Phase iteratively; start with attributes only |
| Type-safety loss from removing `ALL_PLANS` entirely | High | Per Q6 recommendation B, keep config as shape definition |

## 8. Cross-references

- `docs/billing/ui-audit-2026.md` — surfaced display vs internal logic separation
- `apps/api/src/services/subscription-checkout.service.ts:72` — `resolvePlanBySlug` (already uses DB via qzpay)
- `apps/api/src/routes/billing/admin/plans.ts` — current config-driven admin endpoint
- `apps/api/src/routes/billing/public/listPlans.ts` — current config-driven public endpoint
- `apps/web/CLAUDE.md` SSR+Cloudflare cache pattern section
- PR #1215 (fix branch with #8 bug deferred to here) — engram `bugs/admin-billing-list-pages-shape-mismatches`
- Engram session 2026-05-21 — full context of why this spec exists

## 9. Next action

**Owner**: schedule a 30-60 min review session to walk through Q1-Q8. With answers I can:

- Generate task breakdown (`/task-master:task-from-spec`)
- Update this spec from `draft` to `in-progress`
- Cut a worktree + branch (`spec/SPEC-152-plans-limits-entitlements-editable`)
- Begin Phase 1 implementation

Until Q1-Q8 are answered, scope and effort remain estimates. The phasing above assumes Q1=yes, Q2=A, Q3=A, Q4=A, Q5=C, Q6=B, Q7=cache layer, Q8=keep metadata jsonb.

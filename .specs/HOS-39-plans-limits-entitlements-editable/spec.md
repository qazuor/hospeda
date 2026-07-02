---
title: Plans, Limits & Entitlements Editable Without Deploy
linear: HOS-39
statusSource: linear
created: 2026-07-01
type: improvement
areas:
  - billing
  - admin
  - db
---

# Plans, Limits & Entitlements Editable Without Deploy

> Migrated from `.qtm/specs/SPEC-152-plans-limits-entitlements-editable/spec.md` on 2026-07-01 as part of the Linear tracking migration. Canonical tracking is now HOS-39.
>
> **Status**: Q1-Q8 RESOLVED (2026-07-02) — see decisions inline in section 4. Ready for task breakdown.
>
> **⚠ MAJOR DRIFT FOUND (2026-07-02, spec-realign)**: this spec's "Origin" (section 1) and
> "Current state" (section 2) describe the codebase as of 2026-05-21. Since then, SPEC-168,
> SPEC-192, and SPEC-211 shipped and already implemented most of what this spec asked for — see
> Revision History at the bottom of this document before trusting sections 1-2 or the original
> 9-phase plan in section 6. 13 of the original 23 generated tasks were cancelled as already-done.

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

### Q0 — Model C conflict (discovered 2026-07-02, resolved)

Mid-implementation-planning, found that `packages/billing/src/config/model-c-field-split.ts`
(SPEC-211, already in production) already classifies every seed-controlled `billing_plans`
field into `'commercial'` (DB wins, operator-editable, seed never overwrites) or
`'capability'` (config wins, seed propagates on every deploy). This is a DIFFERENT axis than
the original Q1-Q8 framing (which predates/ignored SPEC-211) and it directly contradicts three
of the original answers below:

- `entitlements` = `capability` → contradicts the original Q3 answer (admin-togglable).
- `metadata.sortOrder` = `capability` → contradicts the original Q1/Q8 (admin-editable, promote to column).
- `metadata.hasTrial` / `metadata.trialDays` = `capability` → contradicts the original Q1 (trial config admin-editable).

**Resolution (option A, chosen over extending Model C)**: HOS-39 scope is narrowed to respect
the existing Model C classification as-is. Only fields already classified `'commercial'` become
admin-editable / DB-read-on-display: `description`, `active`, `metadata.displayName`,
`metadata.monthlyPriceArs`, `metadata.annualPriceArs`, `limitsValues`, `billing_prices.unitAmount`.
Entitlement toggling, `sortOrder` editing, and trial-config editing are OUT OF SCOPE — they stay
config-only (`capability` layer), requiring a deploy to change, exactly as Model C already
designed. Q1, Q3, and Q8 below are revised accordingly; extending Model C to reclassify these
fields is explicitly deferred, not rejected — it would be its own follow-up spec if ever needed.

### Q1 — Should plan ATTRIBUTES be DB-editable? (REVISED per Q0)

**Answer: yes, but narrowed to the Model C `'commercial'` fields only**: `description`, `active`,
`metadata.displayName`, `metadata.monthlyPriceArs`, `metadata.annualPriceArs`. `name` (the slug)
is immutable post-creation (unrelated to Model C, a separate existing invariant) and stays
non-editable. `sortOrder` and trial config (`hasTrial`/`trialDays`) are OUT OF SCOPE per Q0 —
they remain `capability`-layer, config-only.

Affected: web pricing + admin plans + public listPlans + admin plans.tsx (5 display surfaces).

### Q2 — Plan-level limit VALUES editable from DB? (e.g., bump `max_accommodations` from 10 to 15 on the Pro plan without deploy)

Limit KEYS are an enum (`LimitKey` type, type-safe). VALUES are numbers.

Options:

- **A**: Yes, values from DB. Keep KEYS as type-safe enum. Editing UI: dropdown of known LimitKey + numeric input. Backend reads from `billing_plans.limits` jsonb.
- **B**: No, limits stay in config. Editing values requires deploy.

**Owner's stated preference**: YES (A). Implication: the `addon-entitlement.service.ts` line 160 lookup needs to change from `ALL_PLANS.find(...)` to a DB lookup. Latency + caching considerations apply.

### Q3 — Plan-level entitlement KEYS editable from DB? (REVISED per Q0 — now OUT OF SCOPE)

Entitlement KEYS are an enum (`EntitlementKey` type). Each represents a feature flag (e.g., `can_create_featured_listing`).

Options:

- **A**: Yes, but only TOGGLING which keys are on a plan. The KEY universe stays as a code-defined enum.
- **B**: No, keep on config.
- **C**: Full DB-driven entitlement model — KEYS themselves can be added in DB. Requires defining what each new entitlement actually gates (impossible without code).

**Original recommendation was A**, but `entitlements` is classified `'capability'` in
`MODEL_C_FIELD_SPLIT` (config wins, seed propagates on every deploy) — building an admin toggle
UI without also reclassifying it to `'commercial'` would mean admin edits get silently
overwritten on the next deploy. Per Q0 resolution (option A: respect Model C as-is), this is now
**B — out of scope**. No admin entitlement-toggle UI in this spec. Revisit as a follow-up spec if
entitlements need to move to the commercial layer.

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

**RESOLVED (2026-07-02)**: the original framing ("qzpay-core has its own caching layer") was verified false — `@qazuor/qzpay-core@^1.12.0`'s `billing.plans.list/get/getActive` are pure pass-throughs to the storage adapter, with no TTL, no invalidation, no cross-request memoization. Our Drizzle adapter (`packages/db/src/billing/drizzle-adapter.ts`) adds nothing on top either. So every plan read today is already a live DB round-trip — there is no staleness problem to solve, only a per-request DB query cost that is unconfirmed to be a real bottleneck.

**Decision**: **no plan-cache layer at the API.** Do not add one as part of this spec. Rationale: adding a cache would trade a confirmed-non-issue (staleness — currently zero, since reads are always live) for a real one (cache invalidation correctness, worse if the API ever moves off single-instance-per-env, since in-process TTL/invalidation wouldn't reach other replicas without pub/sub). If checkout-path DB load is later measured to be a real bottleneck, a short-TTL cache can be added incrementally outside this spec's scope.

### Q8 — Migration strategy

Existing DB has 9 plans (post our PR #1215 SQL update — `name = metadata->>'slug'`). After this spec:

- Existing rows STAY (no DROP).
- Schema may need extension (e.g., `display_name`, `sort_order` as top-level columns instead of `metadata` jsonb) — debate.
- Seed remains for "first install" / "reset to known good" — the same seed file becomes the bootstrap, not the authoritative source.
- Admin UI gains "Reset to defaults" button that overwrites DB from `ALL_PLANS`? Or only via re-running seed?

**Open question for the discussion**: should we promote `metadata` jsonb fields to top-level columns (typed) or stay jsonb (flexible)? Tradeoff: typed columns give validation + query support; jsonb gives schema-less iteration.

**RESOLVED (2026-07-02), REVISED per Q0**: **option A — promote to typed top-level columns**, but
narrowed by the Model C conflict resolution. `description` and `active` already ARE top-level
Drizzle columns today (verified against `@qazuor/qzpay-drizzle`'s `plans.schema.ts` — not jsonb,
no migration needed for those). Of the remaining `'commercial'`-layer metadata fields, only
`metadata.displayName`, `metadata.monthlyPriceArs`, and `metadata.annualPriceArs` are
admin-edited per the revised Q1 — those three get promoted to typed columns
(`display_name varchar`, `monthly_price_ars integer`, `annual_price_ars integer nullable`).
`metadata.sortOrder`, `metadata.category`, `metadata.isDefault`, `metadata.hasTrial`,
`metadata.trialDays` are `'capability'`-layer (config-only, out of scope per Q0) and STAY in
`metadata` jsonb — no migration needed for them. Existing rows stay (no DROP); additive structural
migration via the standard carril (`packages/db/src/migrations/` + `pnpm db:generate` +
`pnpm db:migrate`), not `extras/`. `entitlements` (text[]) and `limits` (jsonb) already have their
own top-level columns and are unaffected. **Follow-up required**: after the migration,
`MODEL_C_FIELD_SPLIT` in `packages/billing/src/config/model-c-field-split.ts` must be updated to
point at the new column names instead of the `metadata.*` dot-paths for these three fields (its
exhaustiveness guard test will fail otherwise — the seed sync logic reads/writes by these keys).

## 5. Out of scope (explicit)

- New entitlement KEY definitions via admin UI (Q3 option C). Code must define what an entitlement actually gates.
- **Entitlement TOGGLING via admin UI at all** (added per Q0) — `entitlements` stays `'capability'`-layer (config-only) in Model C; reclassifying it to `'commercial'` is deferred to a possible follow-up spec.
- **`sortOrder` editing via admin UI** (added per Q0) — stays `'capability'`-layer, config-only.
- **Trial config (`hasTrial`/`trialDays`) editing via admin UI** (added per Q0) — stays `'capability'`-layer, config-only.
- New limit KEY definitions via admin UI. Same constraint as entitlement keys.
- Per-customer overrides (already covered by SPEC-143 customer override flow).
- Plan-level promo codes (separate concept, SPEC-143 already covers).
- Sponsorship plans (separate, SPEC-151 area).

## 6. Proposed phases

Q1-Q8 are resolved (section 4), narrowed by the Model C conflict resolution (Q0). Phases:

1. **Phase 1** — Schema migration: promote only the three admin-edited `metadata` jsonb fields (`display_name`, `monthly_price_ars`, `annual_price_ars`) to typed top-level columns on `billing_plans` (Q8 = A, revised). `description`/`active` are already top-level columns. Update `MODEL_C_FIELD_SPLIT` to point at the new columns. Standard migration carril, additive, existing rows stay.
2. **Phase 2** — Backend admin list reads from DB (resolves bug #8 from smoke).
3. **Phase 3** — Backend public list reads from DB.
4. **Phase 4** — Frontend admin drops `ALL_PLANS` fallback, expects DB shape.
5. **Phase 5** — Frontend web pricing page switches SSG → SSR-with-revalidation (Q5 = C).
6. **Phase 6** — Admin "Edit plan" UI for attributes, narrowed to Model C `'commercial'` fields only (Q1 revised: description, active, displayName, monthlyPriceArs, annualPriceArs — NOT sortOrder, NOT trial config), with `billing_prices` written atomically in the same transaction (Q4 = A).
7. **Phase 7** — Admin "Edit limits" UI (Q2 scope: values from DB, keys stay type-safe enum).
8. ~~Admin "Toggle entitlements" UI~~ — **REMOVED per Q0/Q3 revision.** Entitlements stay config-only.
9. **Phase 8** (renumbered) — Revalidation triggers wired from admin save → web Cloudflare cache purge + admin TanStack Query refetch (Q7 = no API plan-cache layer; no entitlement-cache trigger since entitlements aren't admin-edited anymore).

Estimated total: **1.5-2 weeks** of focused work (reduced from 2-3 weeks after Q0 scope narrowing).

## 7. Risk + tradeoffs

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Admin edits wrong price → checkout charges wrong amount | High | Confirm dialog + audit log + 24h "preview" mode? |
| Drift between `ALL_PLANS` config and DB on values | Medium | Display always from DB; internal logic always from config; document the policy clearly |
| Cache invalidation gaps → users see stale prices | Low | Q7 = no API plan-cache; reads are always live. Only Cloudflare/TanStack caches need invalidation (Phase 8) |
| Schema migration to promote metadata fields | Medium | Additive Drizzle migration (Q8 = A, narrowed to 3 fields); backwards-compatible seed; `MODEL_C_FIELD_SPLIT` update required in the same PR or its guard test fails |
| Admin UI complexity (edit limits is a lot of surface) | Medium | Phase iteratively; start with attributes only. Entitlements UI removed from scope (Q0), reducing surface vs original estimate |
| Type-safety loss from removing `ALL_PLANS` entirely | High | Per Q6 recommendation B, keep config as shape definition |
| Model C sync overwrites promoted columns unexpectedly | Medium | `MODEL_C_FIELD_SPLIT` guard test (AC-2.3) must pass after Phase 1's migration — verify the seed sync still respects the `'commercial'` layer against the new column names, not just the old `metadata.*` paths |

## 8. Cross-references

- `docs/billing/ui-audit-2026.md` — surfaced display vs internal logic separation
- `apps/api/src/services/subscription-checkout.service.ts:72` — `resolvePlanBySlug` (already uses DB via qzpay)
- `apps/api/src/routes/billing/admin/plans.ts` — current config-driven admin endpoint
- `apps/api/src/routes/billing/public/listPlans.ts` — current config-driven public endpoint
- `apps/web/CLAUDE.md` SSR+Cloudflare cache pattern section
- PR #1215 (fix branch with #8 bug deferred to here) — engram `bugs/admin-billing-list-pages-shape-mismatches`
- Engram session 2026-05-21 — full context of why this spec exists

## 9. Next action

Q1-Q8 answered 2026-07-02 (worktree + branch already cut for HOS-39). Next:

- Generate task breakdown (`/task-master:task-from-spec`)
- Begin Phase 1 implementation (schema migration)

Final decisions: Q0=A (respect Model C as-is, narrow scope), Q1=yes-narrowed (commercial fields only: description/active/displayName/monthlyPriceArs/annualPriceArs), Q2=A, Q3=B-out-of-scope (entitlements stay config-only per Q0), Q4=A, Q5=C, Q6=B, Q7=no API plan-cache layer, Q8=A-narrowed (promote only displayName/monthlyPriceArs/annualPriceArs; sortOrder/trial config stay in metadata jsonb, config-only).

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-07-02 | spec-realign | **Bucket A (already done, tasks cancelled)**: `apps/api/src/routes/billing/admin/plans.ts` and `.../public/listPlans.ts` are fully DB-backed via `PlanService` (no `ALL_PLANS`) — T-010/T-011 cancelled. `apps/web/.../suscriptores/planes/index.astro` and `.../turistas/index.astro` are already SSR (`prerender=false`) fetching `/api/v1/public/plans` at request time — T-013/T-014 cancelled. `apps/admin/src/routes/_authed/billing/plans.tsx` has zero `ALL_PLANS` refs, drives full CRUD via `apps/admin/src/features/billing-plans/components/PlanDialog.tsx` — T-012/T-015 cancelled. `PlanService` exists at `packages/service-core/src/services/billing/plan/{plan.service,plan.crud,plan.types,plan.audit}.ts` — T-006 cancelled. `plan.crud.ts`'s `updatePlan()` already does atomic `billing_plans` + `billing_prices` writes — T-007 cancelled. `UpdatePlanInput` (`plan.types.ts:56-79`) already accepts `entitlements`, `limits`, `sortOrder`, `hasTrial`, `trialDays` as editable fields, all wired through `PlanDialog.tsx` — T-008/T-016 cancelled. `addon.checkout.ts` and `addon-entitlement.service.ts` already resolve via `PlanService.getById` (SPEC-192 T-025), not `ALL_PLANS` — T-009 cancelled. Every `PlanService` mutation already calls `getRevalidationService().revalidatePaths()` (SPEC-168 T-017) — T-017 cancelled. `apps/api/src/index.ts`'s revalidation-service init is at line 263, not 84 as originally cited. T-018 also cancelled (TanStack Query invalidation is part of the same already-shipped admin UI). **Bucket C (still valid)**: T-001-T-005 (typed-column migration for `displayName`/`monthlyPriceArs`/`annualPriceArs`) — these 3 fields are confirmed still stored in `metadata` jsonb, not typed columns. **Bucket D (new, not covered by any task — DECISION PENDING)**: a LIVE BUG was found — `MODEL_C_FIELD_SPLIT` classifies `entitlements`/`sortOrder`/`hasTrial`/`trialDays` as `'capability'` (config wins, seed silently reverts), but `PlanDialog.tsx`/`PlanService.update()` already let admins edit those exact fields today — any such edit is silently undone by the next `db:apply-extras`/seed sync. This is NOT hypothetical (unlike the original Q0 framing assumed) — it is an active correctness bug in production. Also found: `apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts`, `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts`, and `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts` still reference `ALL_PLANS` and were never covered by section 2 or any task — scope of T-023's audit expanded to include them. T-019/T-020/T-021 (integration tests) had their descriptions revised: they must verify EXISTING shipped behavior, not assume they're testing new code. | 13/23 tasks cancelled (already shipped); 10/23 remain pending; awaiting owner decision on the live Model-C bug before continuing |
| 2026-07-02 | owner decision (live Model-C bug fix) | Chose the "more robust" fix over a UI-only patch: (1) reclassify `entitlements`/`metadata.sortOrder`/`metadata.hasTrial`/`metadata.trialDays` from `'capability'` to `'commercial'` in `MODEL_C_FIELD_SPLIT` (T-024), matching what the admin UI already implies. (2) Update `buildCapabilitySyncPayload()` in `billingPlans.seed.ts` to stop overwriting these 4 fields — its `META_CAPABILITY_FIELDS` list is hand-maintained separately from `MODEL_C_FIELD_SPLIT` and does not update automatically (T-025). (3) Found the SAME bug surface also covers `category`/`isDefault` (both present in `UpdatePlanInput` per `plan.types.ts:62,74`, both `'capability'` in Model C, editability via `PlanDialog.tsx` unconfirmed) — decided to remove them from `UpdatePlanInput` entirely rather than reclassify, since nobody requested them as admin-editable (T-026). (4) Root cause is structural: `UpdatePlanInput`'s field set and `MODEL_C_FIELD_SPLIT`'s classification are two independently hand-maintained lists that silently drifted apart — added a runtime guard in `PlanService.update()` rejecting any `'capability'`-classified key, so this bug class cannot recur for a future field addition (T-027). Added T-024..T-027 (4 new tasks, all complexity ≤3); T-022 (docs) now also depends on T-027 and covers documenting the fix. | 14/23-original-equivalent tasks now active (10 carried over + 4 new); ready to start implementation |

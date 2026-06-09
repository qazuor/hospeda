---
id: SPEC-211
slug: ai-monetization-model
title: AI Monetization Model
status: draft
owner: qazuor
created: 2026-06-09
parentSpec: SPEC-200
relatedSpecs:
  - SPEC-200
  - SPEC-173
  - SPEC-168
  - SPEC-143
tags:
  - ai
  - billing
  - entitlements
  - monetization
  - cost-control
---

# SPEC-211 — AI Monetization Model

> **DECISION PROTOCOL:** In every single case — without exception — if a change
> or decision is not *extremely* clear-cut, if there is even the slightest
> ambiguity, or if there is more than one viable option, **STOP and consult the
> owner (qazuor)**. Do not decide autonomously. See SPEC-173 §12.

## 1. Summary

This spec fixes the **monetization model** for the AI features built by SPEC-173
(foundation) and SPEC-200 (accommodation chat), and closes a structural gap in
how billing capabilities propagate from code config to the runtime database.

It carries two owner-approved decisions plus the work needed to make them real:

1. **Decision 1 — billing entitlement model becomes "Model C" (hybrid layered).**
   Capabilities (entitlements + which features a plan grants) become
   config-driven and auto-propagate to existing DB plans on deploy. Commercial /
   numeric values (price, quota numbers) stay DB overrides editable by the
   operator. Today it is the opposite for capabilities (DB is the runtime source
   of truth and the seed never overwrites existing rows), so a capability added
   to `plans.config.ts` never reaches existing paid subscribers. This applies to
   **all** billing features, not just AI.

2. **Decision 2 — AI monetization rules.** HOST pays for all AI (it is ROI for
   their business); TOURIST pays nothing directly. Per-sub-feature entitlements,
   not a bundle. `ai_chat` is paid and governed by the **listing owner** (not the
   tourist). `ai_search` becomes a free platform feature governed by rate-limit +
   a USD ceiling (not a plan entitlement). `ai_support` becomes an addon or
   top-tier-only. "AI visibility in search" (host ranking boost) becomes an
   addon. A mandatory cost guardrail removes every `-1` (unlimited) value from AI
   features.

The work is sequenced into five phases (§5). **Phase 0 is the minimal,
low-risk slice that unblocks SPEC-200 for production** (cost mitigation). The
remaining phases land the full monetization model and the Model C billing
refactor.

---

## 2. Context & Diagnosis

### 2.1 Corrected diagnosis — the chat feature is NOT broken

The accommodation chat shipped by SPEC-200 **works**: the route streams, the
quota middleware enforces, persistence runs. There is **no functional bug** to
fix in the chat code path itself. What is wrong is:

1. **The monetization model is wrong** for who pays and who is metered. `ai_chat`
   is granted to every plan (including tourist plans) and metered against the
   *tourist* who sends the message. Per Decision 2 it must be governed and paid
   by the *listing owner*.
2. **The propagation model is inverted.** Capabilities live in DB JSONB columns
   that are the runtime source of truth, and the seed refuses to overwrite
   existing rows (it warns only). So changing `plans.config.ts` does not reach
   existing paid subscribers — the model change cannot ship by editing config
   alone.
3. **There is a cost exposure.** Several AI features carry `-1` (unlimited)
   quotas on top-tier plans, and the only backstop is the optional global USD
   ceiling. A single abusive top-tier account can run unbounded token cost until
   the global ceiling (if configured) trips.

### 2.2 Verified runtime seams (reconnaissance)

| Concern | Where it lives (verified) |
|---------|---------------------------|
| Entitlement resolution | `apps/api/src/middlewares/entitlement.ts` → `loadEntitlements(customerId, actorRole)` reads the active subscription's plan via `billing.plans.get(...)`, builds `Set<EntitlementKey>` + `Map<LimitKey, number>` from the plan's `entitlements`/`limits` JSONB, merges customer-level overrides (`billing.entitlements.getByCustomerId` / `billing.limits.getByCustomerId`), caches 5 min keyed by `billingCustomerId`. |
| Staff / fallback resolution | Staff (`SUPER_ADMIN/ADMIN/EDITOR/CLIENT_MANAGER`) get config-derived unlimited via `getUnlimitedEntitlements()`. HOST with no active sub falls back to the **`owner-basico` DB row** via `buildHostDraftDefaultsResult()`. Everyone else falls back to `TOURIST_FREE_PLAN` **config** via `getDefaultEntitlements()`. |
| AI feature → key mapping | `apps/api/src/middlewares/ai-quota.ts` exports `AI_ENTITLEMENT_BY_FEATURE` (`chat → AI_CHAT`, `search → AI_SEARCH`, `text_improve → AI_TEXT_IMPROVE`, `support → AI_SUPPORT`) and `AI_LIMIT_BY_FEATURE` (`chat → MAX_AI_CHAT_PER_MONTH`, etc.). |
| Chat gate (the problem) | `createAiQuotaMiddleware('chat')` resolves the gate + quota against the **request actor** (the tourist). It calls `hasEntitlement(c, AI_CHAT)`, `getRemainingLimit(c, MAX_AI_CHAT_PER_MONTH)` on `c.get('userEntitlements')`/`c.get('userLimits')`, and meters via `getMonthlyCallCount({ userId: actor.id, feature, now })` (`@repo/ai-core`). `recordAiUsage` is also keyed by `userId`. |
| Owner-resolution seam (the fix) | `apps/api/src/middlewares/owner-entitlement.ts` (shipped by SPEC-200/198 work) already resolves `accommodationId → ownerId → customerId → plan`. It exposes `ownerEntitlementMiddleware` (param-based) and `resolveOwnerEntitlementsForOwnerId(ownerId)` (direct, for body/slug routes). **It returns ENTITLEMENTS only — no limits.** |
| Plans config | `packages/billing/src/config/plans.config.ts` — `ALL_PLANS` (9 plans), slugs `owner-basico/pro/premium`, `complex-basico/pro/premium`, `tourist-free/plus/vip`. |
| Entitlement / limit keys | `packages/billing/src/types/entitlement.types.ts` (`EntitlementKey.AI_TEXT_IMPROVE/AI_CHAT/AI_SEARCH/AI_SUPPORT`), `packages/billing/src/types/plan.types.ts` (`LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH/MAX_AI_CHAT_PER_MONTH/MAX_AI_SEARCH_PER_MONTH/MAX_AI_SUPPORT_PER_MONTH`). |
| Addons config | `packages/billing/src/config/addons.config.ts` + `packages/billing/src/types/addon.types.ts` (`grantsEntitlement: EntitlementKey \| null`, `affectsLimitKey`, `limitIncrease`). 5 addons exist; none grant AI. Addon entitlements reach the runtime via customer-level overrides (`billing.entitlements.getByCustomerId`). |
| Seed (the inversion) | `packages/seed/src/required/billingPlans.seed.ts` — `ensurePlan()` matches by `name === plan.slug`; on an existing row it calls `detectDivergences()` and, on any diff, **logs a warning and does NOT overwrite** (divergence policy SPEC-168 T-018). New config-only capability changes never land in existing rows. |
| Cost ceilings | `packages/schemas/src/entities/ai/ai-settings.schema.ts` → `AiCostCeilingsSchema` (`globalMonthlyMicroUsd` + `perFeatureMonthlyMicroUsd`, both integer µUSD, both optional). Enforced by the engine cost-ceiling checker in `packages/ai-core/src/usage/ceiling.ts`. |
| DB | `billing_plans` (`entitlements`/`limits` JSONB + `metadata`), `billing_prices`, `billing_addons`. Structural migrations via the versioned carril (`packages/db/src/migrations/`). |

### 2.3 Current AI grant matrix (facts to change)

These are the **current** values in `plans.config.ts` and the seeded DB. Decision 2
changes them.

| Plan | `ai_text_improve` | `ai_chat` | `ai_search` | `ai_support` |
|------|-------------------|-----------|-------------|--------------|
| owner-basico | yes (20/mo) | yes (20/mo) | yes (50/mo) | no |
| owner-pro | yes (100/mo) | yes (100/mo) | yes (200/mo) | no |
| owner-premium | yes (**-1**) | yes (**-1**) | yes (**-1**) | no |
| complex-basico | yes (30/mo) | yes (30/mo) | yes (50/mo) | no |
| complex-pro | yes (150/mo) | yes (150/mo) | yes (200/mo) | no |
| complex-premium | yes (**-1**) | yes (**-1**) | yes (**-1**) | no |
| tourist-free | no | yes (10/mo) | yes (30/mo) | no |
| tourist-plus | no | yes (50/mo) | yes (150/mo) | no |
| tourist-vip | no | yes (**-1**) | yes (**-1**) | no |

`ai_support` is deliberately ungranted everywhere (the seed comment says "pending
SPEC-200 audience decision" — that decision is this spec).

### 2.4 Target AI model (Decision 2)

| Feature | Consumed by | Governed/paid by | Where it lives after this spec |
|---------|-------------|------------------|--------------------------------|
| `ai_text_improve` | HOST (editing own listing) | the HOST | host + complex plans (unchanged) — but `-1` removed |
| `ai_chat` | TOURIST (on a listing detail page) | the **listing OWNER** | host + complex plans only; **removed from all tourist plans**; gated + metered against the owner |
| `ai_search` | TOURIST | the **platform** (free) | NOT a plan entitlement; rate-limit + USD ceiling; **removed from all plans** |
| `ai_support` | (audience TBD, see §10 OQ-3) | addon or top-tier-only | an addon and/or only `*-premium` plans |
| AI visibility boost | HOST (marketing upside) | the HOST (purchase) | a new **addon**, like `visibility-boost-*` |

**Packaging rule (owner):** *hygiene → plan; upside → addon.* A feature every
host needs to operate (text improve, chat on their listing) belongs in the plan.
A discretionary marketing/extra (AI ranking boost, possibly support) belongs in
an addon.

**Cost guardrail (mandatory):** no real `-1` (unlimited) on any AI feature with
marginal token cost. Replace every `-1` AI quota with a high-but-finite number.
The global + per-feature USD ceiling in `ai_settings` is the **last-resort**
backstop, never the only one.

---

## 3. Goals

- **G-1** Remove the cost exposure: no `-1` quotas on AI features; confirm a
  global + per-feature USD ceiling exists; propagate the new finite limits to
  existing prod `billing_plans` rows. (Phase 0 — unblocks SPEC-200 to prod.)
- **G-2** Make `ai_chat` governed and metered against the listing **owner**, not
  the tourist; remove `ai_chat` from tourist plans; keep a per-tourist
  anti-abuse rate limit. (Phase 1.)
- **G-3** Implement Model C: a deterministic mechanism so config-defined
  **capabilities** propagate to existing DB plans on deploy, while **price/quota
  numbers stay DB-editable**. Applies to all billing features. (Phase 2.)
- **G-4** Make `ai_search` a free platform feature governed by rate-limit + USD
  ceiling; remove it from all plans. (Phase 3.)
- **G-5** Package `ai_support` and "AI visibility boost" per the
  hygiene-vs-upside rule (addons / top-tier). (Phase 4.)

## 4. Non-Goals

- No change to the AI engine, providers, prompt system, or streaming protocol
  (`@repo/ai-core`, `streaming-route-factory.ts` untouched).
- No change to the chat UX/widget behaviour from the tourist's point of view
  beyond what removing the tourist-level entitlement implies (§7.4).
- No new payment-processor integration. AI features are not separately purchasable
  by tourists; AI cost is bundled into host plans/addons.
- No real-time availability, no cross-property chat (those remain SPEC-200
  non-goals).
- No admin UI redesign for plan editing — Model C reuses the existing admin plan
  management surface (SPEC-168) for the DB-editable numeric values.
- No migration of historical `ai_usage` rows. Metering changes are forward-only.

---

## 5. Phased Plan

Phases are independently shippable and ordered by risk/value. Phase 0 ships
first and alone unblocks SPEC-200 production promotion.

### Phase 0 — Cost mitigation (unblocks SPEC-200 to prod)

**Why first:** SPEC-200 cannot safely go to prod while top-tier AI quotas are
`-1` and the only backstop is an optional global ceiling. This phase is the
minimal change that closes the open cost hole.

**Scope:**

- Replace every `-1` AI quota in `plans.config.ts` with a high-but-finite value
  (the four AI limit keys, on every plan that currently uses `-1`). Proposed
  values in §6.1 (owner to confirm, see OQ-1).
- Confirm/define the global + per-feature USD ceiling in `ai_settings`
  (`AiCostCeilingsSchema.globalMonthlyMicroUsd` and
  `perFeatureMonthlyMicroUsd`). If unset in prod, set sane values (OQ-2).
- **Propagate the new finite limits to existing prod `billing_plans` rows.** The
  seed will NOT do this (divergence policy). Phase 0 ships a deterministic,
  idempotent **limits-sync step** (script or migration, run on deploy) that
  updates the `limits` JSONB on existing rows for the four AI limit keys only,
  leaving operator-set price and non-AI limits untouched. This is a narrow,
  AI-limit-only forerunner of the general Model C sync (Phase 2); it must not
  clobber anything else.

**Out of scope for Phase 0:** changing who pays for chat, removing entitlements,
the general Model C mechanism. Phase 0 only changes numbers + propagates them.

### Phase 1 — Owner-governed chat (the real fix)

**Scope:**

- Build `resolveOwnerLimitsForOwnerId(ownerId): Promise<Map<LimitKey, number>>`
  in `apps/api/src/middlewares/owner-entitlement.ts`, mirroring the existing
  `resolveOwnerEntitlementsForOwnerId` but returning limits.
- Change the chat route (`apps/api/src/routes/ai/protected/chat.ts`) so the
  `ai_chat` **entitlement gate** and **monthly quota** evaluate the
  accommodation **owner's** entitlement + limit, and so `getMonthlyCallCount` /
  `recordAiUsage` are keyed by the **owner's** `userId`, not the tourist's.
- Remove `ai_chat` (and `MAX_AI_CHAT_PER_MONTH`) from the three tourist plans in
  `plans.config.ts`; ship a DB migration that drops `ai_chat` from existing
  tourist subscribers' plan rows (Model C capability removal, see §7.6).
- Keep a per-tourist + per-IP anti-abuse rate limit on the chat route
  (`createAiRateLimitMiddlewares('chat')` already does this — preserve it).

### Phase 2 — Model C (config-driven capability propagation)

**Scope:**

- Implement the deterministic capability-sync mechanism so that
  config-defined **capabilities** (the set of `EntitlementKey`s a plan grants,
  and the *presence* of limit keys) reach existing DB plan rows on deploy, while
  **numeric values** (price in `billing_prices`, quota numbers in the `limits`
  JSONB) remain operator-editable in DB.
- Define the precise split: which fields are "capability" (config wins, synced)
  vs "commercial" (DB wins, never clobbered). See §8.2.
- Replace the seed's silent divergence-warn-only behaviour for **capability**
  fields with an explicit sync; keep warn-only (or DB-wins) for **commercial**
  fields.
- Generalize the Phase 0 AI-limit sync into the full Model C sync.

### Phase 3 — `ai_search` → platform feature

**Scope:**

- Remove `ai_search` + `MAX_AI_SEARCH_PER_MONTH` from all 9 plans in
  `plans.config.ts`; ship a DB migration removing them from existing rows.
- Make the search route a free, authenticated (or anonymous, OQ-4) platform
  feature governed by per-user/IP rate-limit + the `ai_settings` USD ceiling for
  the `search` feature — NOT by `createAiQuotaMiddleware('search')`'s
  entitlement/limit gate.
- Keep metering (`recordAiUsage`) for cost visibility and the USD-ceiling check.

### Phase 4 — Addons + `ai_support` packaging

**Scope:**

- Add an **AI visibility boost** addon to `addons.config.ts` (host ranking boost),
  following the `visibility-boost-*` shape. Decide whether it grants a new
  `EntitlementKey` or sets a limit (OQ-5).
- Package `ai_support` per the hygiene-vs-upside rule: an addon (`grantsEntitlement:
  AI_SUPPORT`) and/or only on `*-premium` plans, with a finite
  `MAX_AI_SUPPORT_PER_MONTH` (OQ-3).
- Finalize the full grant matrix (§6.2) and assert it with a config test.

---

## 6. Target Configuration

### 6.1 Phase 0 — finite AI quotas (replace `-1`)

Proposed replacement values for the `-1` AI quotas (owner confirms, OQ-1). All
other plans keep their current finite values.

| Plan | `MAX_AI_TEXT_IMPROVE_PER_MONTH` | `MAX_AI_CHAT_PER_MONTH` | `MAX_AI_SEARCH_PER_MONTH` |
|------|---------------------------------|-------------------------|---------------------------|
| owner-premium | 1000 | 2000 | 2000 |
| complex-premium | 2000 | 5000 | 2000 |
| tourist-vip | n/a | 1000 (removed in Phase 1) | 1000 (removed in Phase 3) |

These are deliberately "high but finite": generous enough that a legitimate
premium user never hits them, low enough that a single compromised account
cannot run unbounded cost before the per-user limit OR the USD ceiling trips.

### 6.2 Final grant matrix (after all phases)

| Plan | `ai_text_improve` | `ai_chat` | `ai_search` | `ai_support` |
|------|-------------------|-----------|-------------|--------------|
| owner-basico | yes (20/mo) | yes (20/mo, owner-metered) | — (platform) | no |
| owner-pro | yes (100/mo) | yes (100/mo, owner-metered) | — | no |
| owner-premium | yes (1000/mo) | yes (2000/mo, owner-metered) | — | OQ-3 |
| complex-basico | yes (30/mo) | yes (30/mo, owner-metered) | — | no |
| complex-pro | yes (150/mo) | yes (150/mo, owner-metered) | — | no |
| complex-premium | yes (2000/mo) | yes (5000/mo, owner-metered) | — | OQ-3 |
| tourist-free | no | **no** | — (platform) | no |
| tourist-plus | no | **no** | — | no |
| tourist-vip | no | **no** | — | no |

`ai_search` is `—` for everyone: it is a platform feature, not a plan
entitlement. AI visibility boost and `ai_support` (if addon-based) appear via
addon-level customer overrides, not in this plan matrix.

---

## 7. Technical Design

### 7.1 Phase 0 — limits-sync mechanism

The seed (`billingPlans.seed.ts`) will not update existing rows. Phase 0 needs a
separate, deterministic, idempotent step that:

- Reads the target AI limit values from `ALL_PLANS` config (single source of
  truth for the numbers being pushed).
- For each existing `billing_plans` row (matched by `name === slug`), updates
  ONLY the four AI keys in the `limits` JSONB (`max_ai_text_improve_per_month`,
  `max_ai_chat_per_month`, `max_ai_search_per_month`, `max_ai_support_per_month`)
  to the config value, leaving every other limit key and `metadata.*PriceArs`
  untouched.
- Is safe to re-run (idempotent) and logs what it changed.
- After running, invalidate the entitlement cache (5-min TTL) for affected
  customers, or accept up to 5 min of staleness (the cache is keyed by
  `billingCustomerId`; a deploy restart clears it anyway).

**Carril decision (OQ-6):** this can be a hand-written idempotent SQL/extras
migration (`packages/db/src/migrations/extras/`) run by `db:apply-extras`, or a
one-shot ops script invoked on deploy. The Phase 2 Model C sync will subsume it,
so prefer the lowest-ceremony option that is re-runnable and prod-safe.

### 7.2 Phase 1 — `resolveOwnerLimitsForOwnerId`

Add to `apps/api/src/middlewares/owner-entitlement.ts`, alongside the existing
`resolveOwnerEntitlementsForOwnerId`:

```ts
/**
 * Resolves the accommodation owner's usage limits (Map<LimitKey, number>) by
 * ownerId. Mirrors resolveOwnerEntitlementsForOwnerId but returns the limits
 * half of the plan. Used by the chat route to gate + meter ai_chat against the
 * listing owner instead of the requesting tourist (SPEC-211 Phase 1).
 *
 * Resolution path: ownerId → billing customer → active subscription → plan
 * limits JSONB (+ customer-level limit overrides). Falls back to the same
 * role-appropriate defaults loadEntitlements uses when the owner has no active
 * subscription (HOST → owner-basico DB row).
 */
export async function resolveOwnerLimitsForOwnerId(
  ownerId: string
): Promise<Map<LimitKey, number>>;
```

Implementation reuses the same QZPay calls `loadEntitlements` uses
(`billing.subscriptions.getByCustomerId`, `billing.plans.get`,
`billing.limits.getByCustomerId`). Factor the shared owner→plan resolution so
entitlements and limits come from one lookup where practical (avoid two round
trips per chat request). Cache consistent with the existing 5-min entitlement
cache philosophy.

### 7.3 Phase 1 — chat route gate + metering against the owner

The chat route is a POST with `accommodationId` in the body (SPEC-200 §6.1), so
it cannot use the param-based `ownerEntitlementMiddleware`. The route handler
must, BEFORE streaming:

1. Resolve `ownerId` from `accommodationId` (the accommodation is already
   fetched as a pre-stream 404 guard in SPEC-200 §6.2 — reuse `accommodation.ownerId`).
2. Resolve the owner's entitlements (`resolveOwnerEntitlementsForOwnerId`) and
   limits (`resolveOwnerLimitsForOwnerId`).
3. Gate: if the owner lacks `AI_CHAT` → return 403 `ENTITLEMENT_REQUIRED` (the
   tourist sees "chat not available for this listing", see §7.4).
4. Quota: compute `getMonthlyCallCount({ userId: ownerId, feature: 'chat', now })`;
   if `>= ownerLimit` (and `ownerLimit !== -1`, which no longer occurs after
   Phase 0) → return 403 `LIMIT_REACHED`.
5. On success, `recordAiUsage({ userId: ownerId, feature: 'chat', ... })` —
   metered against the owner.

**Important:** `createAiQuotaMiddleware('chat')` resolves everything against the
request actor and CANNOT be reused as-is for owner-governed metering. Phase 1
replaces that middleware on the chat route with an **owner-scoped equivalent**.
Options (OQ-7): (a) a new `createAiOwnerQuotaMiddleware('chat')` that reads
`ownerId` from a context value the route sets before it runs, or (b) inline the
gate/quota/meter logic in the route handler. The anti-abuse rate limit
(`createAiRateLimitMiddlewares('chat')`, per-tourist + per-IP) STAYS and remains
keyed by the requesting tourist — it is a burst guard, not a quota.

### 7.4 Phase 1 — tourist-facing behaviour when chat is unavailable

After `ai_chat` is removed from tourist plans, the gate no longer reads the
tourist's plan at all. Whether a tourist can chat depends solely on the listing
owner's plan + remaining owner quota. The widget already maps a pre-stream 403 to
a generic error (SPEC-200 §11). Decide the copy (OQ-8): "AI chat is not available
for this accommodation" vs a generic error. The FAB visibility rule
(authenticated-only) is unchanged.

### 7.5 Phase 2 — Model C mechanism

Model C splits each plan into two layers:

- **Capability layer (config wins, auto-propagated):** which `EntitlementKey`s a
  plan grants; which `LimitKey`s a plan *has* (presence, not value);
  active/default/category metadata that is structural.
- **Commercial layer (DB wins, operator-editable, never clobbered):** numeric
  quota values inside the `limits` JSONB; prices in `billing_prices` and
  `metadata.*PriceArs`.

The propagation runs deterministically on deploy. Replace the seed's
warn-only-on-divergence with a per-field policy:

- Capability-layer divergence → **sync DB to config** (config is source of truth).
- Commercial-layer divergence → **leave DB as-is** (operator edits win; still
  log for visibility).

This requires the field-split table (§8.2) to be exhaustive over the columns the
seed controls, so no field is silently in the wrong layer. The mechanism must be
idempotent and prod-safe (run via the migration/extras carril or an ops step,
OQ-6), and must invalidate the entitlement cache for touched customers.

### 7.6 Capability removal migrations (Phases 1 & 3)

Removing an entitlement from existing subscribers (`ai_chat` from tourist plans
in Phase 1; `ai_search` from all plans in Phase 3) is a Model C
capability-layer change. Until Phase 2 lands, ship explicit idempotent
migrations that strip the key from the `entitlements` array and the matching
`limits` key from the `limits` JSONB on the affected existing rows. After Phase 2,
this is just config + sync.

### 7.7 Phase 3 — `ai_search` as a platform feature

The search route stops using the entitlement/limit gate. It keeps:

- Auth (or anonymous, OQ-4).
- A per-user/IP rate-limit (`createAiRateLimitMiddlewares('search')`).
- The `ai_settings` USD ceiling for `feature: 'search'`
  (`perFeatureMonthlyMicroUsd.search`) enforced by the engine ceiling checker
  (`packages/ai-core/src/usage/ceiling.ts`) — the global ceiling still applies.
- Metering via `recordAiUsage` for cost visibility.

The `AI_SEARCH` entitlement key and `MAX_AI_SEARCH_PER_MONTH` limit key are NOT
deleted from the enums (additive-only enum policy); they simply stop being granted
by any plan. `AI_ENTITLEMENT_BY_FEATURE`/`AI_LIMIT_BY_FEATURE` keep their entries
for type completeness, but the search route no longer invokes the quota
middleware.

### 7.8 Phase 4 — addons

AI visibility boost addon (config-only, `addons.config.ts`):

```ts
export const AI_VISIBILITY_BOOST_ADDON: AddonDefinition = {
  slug: 'ai-visibility-boost-30d',
  name: 'AI Visibility Boost (30 days)',
  description: '...',
  billingType: 'one_time',           // or 'recurring' (OQ-5)
  priceArs: /* OQ-5 */,
  durationDays: 30,
  affectsLimitKey: null,
  limitIncrease: null,
  grantsEntitlement: /* a new EntitlementKey, OQ-5 */,
  targetCategories: ['owner', 'complex'],
  isActive: true,
  sortOrder: 6
};
```

`ai_support`, if addon-based, grants `EntitlementKey.AI_SUPPORT` and the customer
override flows in via `billing.entitlements.getByCustomerId`. A finite
`MAX_AI_SUPPORT_PER_MONTH` must be defined (no `-1`).

---

## 8. Data & Config Changes

### 8.1 Files touched (summary)

| File | Phase | Change |
|------|-------|--------|
| `packages/billing/src/config/plans.config.ts` | 0,1,3 | finite AI quotas; remove `ai_chat`/`ai_search` from the right plans |
| `apps/api/src/middlewares/owner-entitlement.ts` | 1 | add `resolveOwnerLimitsForOwnerId` |
| `apps/api/src/routes/ai/protected/chat.ts` | 1 | owner-scoped gate/quota/meter |
| `apps/api/src/middlewares/ai-quota.ts` | 1 (maybe) | new owner-scoped quota middleware variant (OQ-7) |
| `apps/api/src/routes/ai/...search...` | 3 | drop quota gate; rely on rate-limit + USD ceiling |
| `packages/billing/src/config/addons.config.ts` | 4 | AI visibility boost (+ maybe ai_support) addon |
| `packages/billing/src/types/entitlement.types.ts` | 4 (maybe) | new entitlement key for AI visibility (OQ-5) |
| `packages/seed/src/required/billingPlans.seed.ts` | 2 | capability-layer sync replaces warn-only |
| `packages/db/src/migrations/extras/` or ops script | 0,1,2,3 | limits sync + capability-removal migrations |

### 8.2 Model C field-split (to be made exhaustive in Phase 2)

| Field on `billing_plans` | Layer | Behaviour |
|--------------------------|-------|-----------|
| `entitlements` (JSONB array) | capability | config wins → synced |
| `limits` keys present (which keys) | capability | config wins → synced (presence) |
| `limits` values (the numbers) | commercial | DB wins → never clobbered |
| `metadata.monthlyPriceArs` / `annualPriceArs` | commercial | DB wins |
| `billing_prices.unitAmount` | commercial | DB wins |
| `active`, `metadata.isDefault`, `metadata.category`, `sortOrder`, trial fields | capability/structural | config wins (OQ-9 — confirm `active`) |
| `description`, `metadata.displayName` | capability/structural | config wins (OQ-9 — operator may have localized these) |

The `active`/`description`/`displayName` rows are flagged OQ-9 because an operator
may have edited them via the admin UI (SPEC-168), in which case treating them as
"config wins" would clobber an intentional edit. Owner to confirm the exact line
between capability and commercial for these.

---

## 9. Risks

### R-1 — Billing migration in prod (HIGH IMPACT)

Phases 0/1/2/3 all mutate `billing_plans` JSONB in prod. A wrong sync can strip a
capability from paying customers or overwrite an operator's deliberate quota/price
edit.

**Mitigation:** every mutation step is idempotent and scoped to named keys only
(never a blind row overwrite). Phase 0 touches ONLY the four AI limit keys.
Capability removals (Phases 1/3) strip ONLY the named key. The Model C sync
(Phase 2) is governed by the exhaustive field-split table (§8.2) and must have a
dry-run / log-only mode plus a verified `billing_plans` backup before running in
prod (reuse the SPEC-187 manual-table-backup runbook step). Test the full sync
against a `db:fresh-dev` snapshot and the 13 SPEC-143 test users before prod.

### R-2 — Changing who-can-use-chat in prod (MEDIUM-HIGH IMPACT)

Phase 1 flips chat governance from tourist to owner. After the migration, a
tourist on a listing whose owner is on a plan/quota that excludes or exhausts
`ai_chat` will lose chat — a visible behaviour change. Owners who relied on
tourists' own quotas (there were none in practice; tourists were always gated on
their own plan) are unaffected, but owners now bear the metered cost.

**Mitigation:** ship Phase 1 behind awareness, not a flag (the model change is the
point). Confirm owner-plan AI_CHAT grants cover all currently-live listings before
migrating (every host/complex plan grants `ai_chat`, so the only at-risk listings
are those owned by accounts with no active host subscription — they fall back to
`owner-basico` defaults which DO grant `ai_chat`). Define the tourist-facing copy
(OQ-8). Run the staging billing smoke (CLAUDE.md billing rule) covering an
owner-at-quota chat request → 403.

### R-3 — Cost (the reason for the spec)

Even after Phase 0, AI token cost scales with usage. Owner-metered chat means an
owner with many listings and high tourist traffic can run real cost against their
quota.

**Mitigation:** finite per-owner quotas (Phase 0/6.1) + the `ai_settings` global
and per-feature USD ceilings (last-resort backstop) + per-tourist/IP rate limit
(burst guard). The existing AI cost-threshold alert
(`packages/notifications/.../ai-cost-threshold-alert`) fires before the ceiling.

### R-4 — Cache staleness after a sync

Entitlements cache 5 min keyed by `billingCustomerId`. A sync that changes a
plan's capabilities won't be visible to in-flight cached customers for up to 5
min.

**Mitigation:** call `clearEntitlementCache(customerId)` for touched customers (or
accept the 5-min window; a deploy restart clears the in-memory cache anyway).
Document the chosen behaviour.

### R-5 — Search abuse once it's free (MEDIUM IMPACT)

Making `ai_search` free + platform-governed removes the per-plan quota. Without a
strong rate-limit + USD ceiling, abuse cost is unbounded.

**Mitigation:** Phase 3 mandates a per-user/IP rate-limit AND a per-feature USD
ceiling for `search`. Confirm anonymous access policy (OQ-4) — anonymous + free +
AI is the highest-abuse surface.

### R-6 — Two-source-of-truth confusion (MEDIUM IMPACT)

Model C deliberately makes config win for some fields and DB win for others.
Getting the split wrong (or leaving it implicit) reintroduces the exact drift this
spec fixes.

**Mitigation:** the §8.2 field-split table is the single source of truth and must
be exhaustive over seed-controlled columns; a guard test asserts every controlled
column is classified. Document in `packages/billing/CLAUDE.md` and the
`adding-an-entitlement` doc.

---

## 10. Open Questions (for the owner)

- **OQ-1 (Phase 0 quotas):** Confirm the finite replacement values in §6.1 for the
  `-1` AI quotas (owner-premium, complex-premium, tourist-vip). Are 1000–5000/mo
  the right order of magnitude?
- **OQ-2 (USD ceilings):** What `globalMonthlyMicroUsd` and per-feature
  (`chat`/`search`/`text_improve`/`support`) ceilings should prod use? Are any
  already set in the prod `ai_settings` blob?
- **OQ-3 (`ai_support`):** Addon, top-tier-only plan grant, or both? What finite
  `MAX_AI_SUPPORT_PER_MONTH`? Who is the audience (host support? tourist support?)
  — this drives whether it's owner-metered like chat.
- **OQ-4 (`ai_search` auth):** Free for authenticated users only, or anonymous
  too? Anonymous + free + AI is the highest-abuse surface.
- **OQ-5 (AI visibility addon):** One-time or recurring? Price? Does it grant a new
  `EntitlementKey` (e.g. `AI_SEARCH_BOOST`) consumed by the ranking layer, or set a
  limit/flag? Is the ranking-boost consumer even built yet?
- **OQ-6 (migration carril):** For the limits-sync (Phase 0) and Model C sync
  (Phase 2) — versioned migration, hand-written `extras` migration, or an ops
  script run on deploy? They mutate JSONB on existing rows, which the structural
  carril doesn't naturally express.
- **OQ-7 (owner-quota middleware):** New `createAiOwnerQuotaMiddleware('chat')`
  reading `ownerId` from context, or inline the owner gate/quota/meter in the chat
  route handler?
- **OQ-8 (tourist copy):** When chat is unavailable because the owner's plan/quota
  excludes it, show a specific "not available for this accommodation" message or
  the generic error?
- **OQ-9 (Model C field split):** Confirm the capability/commercial classification
  for `active`, `description`, and `metadata.displayName` (§8.2) — operators may
  have edited these via the SPEC-168 admin UI.
- **OQ-10 (rollout order):** Ship Phase 0 to prod first and alone (unblocking
  SPEC-200), then 1→2→3→4? Or hold SPEC-200 until Phase 1 (owner-governed chat)
  is also ready, so chat never ships tourist-metered even briefly?

---

## 11. Acceptance Criteria

### Phase 0

- **AC-0.1** No `-1` value remains for any of the four AI limit keys in
  `ALL_PLANS` (asserted by a `plans.config` test iterating all plans).
- **AC-0.2** `ai_settings` defines a `globalMonthlyMicroUsd` and per-feature
  ceilings for every AI feature in the target prod blob (verified by the settings
  smoke / a config check).
- **AC-0.3** The limits-sync step, run against a seeded DB whose AI limits were
  manually set to `-1`, updates ONLY the four AI limit keys to the config values
  and leaves all other limit keys and `metadata.*PriceArs` byte-identical
  (integration test on a real DB).
- **AC-0.4** The limits-sync step is idempotent: a second run reports zero
  changes.

### Phase 1

- **AC-1.1** `resolveOwnerLimitsForOwnerId(ownerId)` returns the owner's plan
  limits map; for a host with no active subscription it returns the `owner-basico`
  fallback limits (unit test with a stubbed billing client).
- **AC-1.2** A chat request on a listing whose owner has `AI_CHAT` and remaining
  quota succeeds, and `recordAiUsage` is called with `userId === ownerId`, NOT the
  tourist's id (integration test, spy on `recordAiUsage`).
- **AC-1.3** A chat request on a listing whose owner is at their
  `MAX_AI_CHAT_PER_MONTH` quota returns 403 `LIMIT_REACHED`, regardless of the
  tourist's own (now nonexistent) chat entitlement.
- **AC-1.4** After the Phase 1 migration, no tourist plan in `ALL_PLANS` lists
  `AI_CHAT` or `MAX_AI_CHAT_PER_MONTH`; existing tourist subscriber rows in DB no
  longer carry them (migration integration test).
- **AC-1.5** The per-tourist + per-IP rate limit still applies to the chat route
  (burst guard preserved).

### Phase 2

- **AC-2.1** Adding a new `EntitlementKey` to a plan in config and running the
  Model C sync grants that entitlement on the existing DB row for that plan
  (integration test).
- **AC-2.2** An operator-edited quota number in the DB `limits` JSONB is NOT
  overwritten by the sync when config and DB disagree on a commercial-layer value
  (integration test).
- **AC-2.3** A guard test asserts every seed-controlled `billing_plans` column is
  classified in the §8.2 field-split (no unclassified column).

### Phase 3

- **AC-3.1** No plan in `ALL_PLANS` grants `AI_SEARCH` or `MAX_AI_SEARCH_PER_MONTH`
  after Phase 3 (config test); existing rows no longer carry them (migration test).
- **AC-3.2** A search request from a user with no AI entitlements succeeds (free
  platform feature), subject only to the rate-limit and USD ceiling (integration
  test).
- **AC-3.3** When the `search` per-feature USD ceiling is exceeded, search returns
  the ceiling-hit response (503 `CEILING_HIT`), exercising the engine ceiling
  checker.

### Phase 4

- **AC-4.1** The AI visibility boost addon exists in `ALL_ADDONS` and, when
  purchased, surfaces its granted entitlement via customer-level overrides
  (integration test).
- **AC-4.2** `ai_support`, if granted, has a finite `MAX_AI_SUPPORT_PER_MONTH` (no
  `-1`) and follows the chosen packaging (config test).
- **AC-4.3** The final grant matrix (§6.2) is asserted by a config snapshot test.

---

## 12. Test Plan

- **Config tests** (`packages/billing/test/plans.test.ts`,
  `addons.test.ts`): assert the no-`-1`-on-AI invariant, the final grant matrix,
  the addon shape, and `ai_support` finiteness.
- **Unit tests**: `resolveOwnerLimitsForOwnerId` with a stubbed billing client
  (active sub, no sub → owner-basico fallback, customer-override merge).
- **Route integration tests** (`apps/api/test/integration/ai/`): owner-metered
  chat (AC-1.2/1.3) using `StubProvider` + mock-actor headers + seeded billing,
  free search (AC-3.2/3.3).
- **Migration/sync integration tests** (real DB via `testDb.setup/clean`):
  limits-sync idempotence + scoping (AC-0.3/0.4), capability removal (AC-1.4/3.1),
  Model C sync (AC-2.1/2.2), field-split guard (AC-2.3).
- **Manual staging billing smoke** (mandatory per root CLAUDE.md billing rule):
  owner-at-quota chat → 403; tourist chat on a healthy owner → success; free
  search → success; search ceiling-hit. File the sign-off in the SPEC-143
  staging-smoke checklist sections this touches.

---

## 13. Dependencies

### Internal

- `@repo/billing` — `ALL_PLANS`, `ALL_ADDONS`, `EntitlementKey`, `LimitKey`,
  `AddonDefinition`, `getUnlimitedEntitlements`, `getDefaultEntitlements`.
- `@repo/ai-core` — `getMonthlyCallCount`, `recordAiUsage`, ceiling checker
  (`usage/ceiling.ts`). No engine changes.
- `@repo/schemas` — `AiCostCeilingsSchema`, `AiSettingsValueSchema`.
- `@repo/db` — `billing_plans` / `billing_prices` / `billing_addons` tables;
  migration carril.
- `apps/api` — `entitlement.ts` (`loadEntitlements`, `clearEntitlementCache`),
  `owner-entitlement.ts`, `ai-quota.ts`, `ai-rate-limit.ts`, chat + search routes.
- `packages/seed` — `billingPlans.seed.ts` (Model C sync).

### External

None. No new providers, no new payment integration.

---

## 14. References

- SPEC-200 — AI Accommodation Chat (the feature this monetizes; chat route, owner
  resolution seam).
- SPEC-173 — AI foundation (engine, quota/rate-limit middleware, `ai_settings`,
  cost ceilings, usage metering).
- SPEC-168 — Admin-editable plans (DB is runtime source of truth for plans;
  divergence policy; admin plan-management UI reused for the commercial layer).
- SPEC-143 — Billing testing coverage (test users, staging/prod smoke checklists,
  the mandatory billing smoke rule).
- `docs/billing/adding-an-entitlement.md`, `packages/billing/CLAUDE.md` — the flow
  Model C must update.

---

## Key Learnings

1. The chat feature is functionally correct; the defect is the **monetization
   model** (tourist-granted + tourist-metered) and the **config→DB propagation
   gap**, not the streaming/route code.
2. Capabilities are DB-driven at runtime (`billing_plans.entitlements`/`limits`
   JSONB read by `loadEntitlements`), and the seed (`billingPlans.seed.ts`)
   **never overwrites** existing rows — it only warns on divergence (SPEC-168
   T-018). So config-only capability changes cannot reach existing paid
   subscribers without a dedicated sync step. This is the inversion Model C fixes.
3. The owner-resolution seam already exists:
   `apps/api/src/middlewares/owner-entitlement.ts` →
   `resolveOwnerEntitlementsForOwnerId(ownerId)` resolves
   accommodation→owner→plan but returns **entitlements only**. A sibling
   `resolveOwnerLimitsForOwnerId(ownerId): Map<LimitKey, number>` is the Phase 1
   build. The chat route is a body-POST, so it uses the direct `...ForOwnerId`
   functions, not the param-based middleware.
4. Metering is keyed by `userId` everywhere (`getMonthlyCallCount({ userId })`,
   `recordAiUsage({ userId })` in `@repo/ai-core`). Owner-governed chat means
   calling these with the **owner's** `userId`, not the requesting tourist's.
   `createAiQuotaMiddleware('chat')` resolves the request actor and cannot be
   reused as-is for owner metering.
5. The cost backstop is `AiCostCeilingsSchema` in
   `packages/schemas/src/entities/ai/ai-settings.schema.ts` (`globalMonthlyMicroUsd`
   + `perFeatureMonthlyMicroUsd`, integer µUSD), enforced by
   `packages/ai-core/src/usage/ceiling.ts`. It is the **last resort**, not the
   only guardrail — the owner rule forbids `-1` AI quotas so per-user limits trip
   first.
6. Phase 0 (remove `-1`, set ceilings, propagate limits) is the minimal,
   independently-shippable slice that unblocks SPEC-200 for prod. The full model
   change (owner-governed chat, Model C, platform search, addons) follows in
   Phases 1–4.
7. Removing an entitlement from existing subscribers (`ai_chat` from tourist
   plans, `ai_search` from all plans) is a Model C capability-layer mutation —
   config alone won't do it; it needs an explicit idempotent migration until the
   Phase 2 sync generalizes it.
8. Any PR touching this surface triggers the mandatory billing smoke rule (root
   CLAUDE.md). Plan the staging smoke (owner-at-quota chat → 403, free search) and
   a verified `billing_plans` backup before any prod sync (reuse the SPEC-187
   manual-table-backup runbook).

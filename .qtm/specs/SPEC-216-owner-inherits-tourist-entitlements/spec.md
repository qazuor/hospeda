---
spec-id: SPEC-216
title: Owner plans inherit tourist entitlements & limits (owner = superset of tourist)
type: improvement
complexity: medium
status: draft
created: 2026-06-10T22:15:00Z
---

# SPEC-216 — Owner plans inherit tourist entitlements & limits

## Overview

**Goal.** Make every owner/complex billing plan a **superset of the tourist tier**: an
owner is also a tourist, so owner plans must grant the full tourist-side entitlements and
limits in addition to their owner-specific ones.

**Motivation.** Today no owner/complex plan includes any tourist entitlement. Concretely,
`owner-basico` lacks `SAVE_FAVORITES`, `WRITE_REVIEWS`, `READ_REVIEWS`,
`CAN_VIEW_RECOMMENDATIONS` and the `MAX_FAVORITES` limit — so an owner literally cannot
save favorites or write reviews. A user holds exactly one active plan at a time, so the
inheritance must live in the owner plan itself.

**Success criteria.** Every owner and complex plan grants at least the full tourist-VIP
entitlement + limit set, on top of its own. No change to the runtime entitlement resolver.
Existing subscribers get the new entitlements as soon as `billing_plans` is re-seeded.

**Locked design decisions (user, 2026-06-10).**
1. Mechanism: **shared constant** — `TOURIST_VIP_ENTITLEMENTS` / `TOURIST_VIP_LIMITS` in
   `plans.config.ts`, spread into all owner/complex plan definitions (Option B). No runtime
   resolver change.
2. Depth: **all owner/complex plans inherit the full tourist-VIP set** (not progressive).
3. Scope addition (user, 2026-06-11): this spec also **audits the full entitlement
   catalog** and prunes entitlements that don't make sense on the Hospeda platform
   (e.g. `AIRPORT_TRANSFERS`) BEFORE defining the inherited tourist set. The cleaned
   catalog is what feeds `TOURIST_VIP_ENTITLEMENTS`.

**Baseline.** File refs verified against `origin/staging` @ 446aa9152 on 2026-06-10.

---

## User Stories & Acceptance Criteria

### US-1 — Owner can use tourist features

GIVEN a user on any owner/complex plan (incl. `owner-basico`),
WHEN they use tourist features (save favorites, write/read reviews, recommendations,
ad-free, price alerts, compare, search history, early access, exclusive deals),
THEN the entitlement gate passes (no 403) and the corresponding limits apply at tourist-VIP
levels (e.g. unlimited favorites).

### US-2 — Owner-specific entitlements preserved

GIVEN an owner plan,
WHEN its effective entitlements are resolved,
THEN it still grants all of its owner-specific entitlements/limits, with no duplicates.

### US-3 — Superset invariant holds for every owner/complex plan

GIVEN the full tourist-VIP entitlement set E_vip and limit set L_vip,
WHEN any owner/complex plan P is inspected,
THEN `P.entitlements ⊇ E_vip` and `P.limits` contains every key in `L_vip`.

### US-4 — Existing subscribers updated without per-subscription migration

GIVEN active owner subscriptions,
WHEN `billing_plans` is re-seeded from the updated config,
THEN those subscribers' effective entitlements include the tourist-VIP set immediately
(the resolver reads `billing.plans.get(planId)` at runtime).

### US-5 — Entitlement catalog audited and pruned

GIVEN the full entitlement catalog (`ENTITLEMENT_DEFINITIONS`) and every plan's entitlement
list,
WHEN we review each entitlement against what Hospeda actually offers,
THEN entitlements that don't make sense on the platform (e.g. `AIRPORT_TRANSFERS`) are
flagged with a keep/remove/rename decision, removed entitlements are deleted from the enum,
config, plans and any gates that reference them, and the inherited tourist set excludes them.

---

## Technical Approach

### Part 0 — Entitlement catalog audit (do FIRST)

Before defining the inherited set, review the entire entitlement catalog against the
Hospeda product. This is a prerequisite: a pruned catalog is what the `TOURIST_VIP_ENTITLEMENTS`
constant is built from.

**Process.**
1. Enumerate every key in `EntitlementKey` (`packages/billing/src/types/entitlement.types.ts`)
   with its metadata from `ENTITLEMENT_DEFINITIONS` (`packages/billing/src/config/entitlements.config.ts`)
   and which plans grant it (`plans.config.ts`).
2. For each, assign a verdict: **keep** / **remove** (no platform meaning) / **rename**
   (real but mislabeled). Present the full table to the user for sign-off — removals are a
   product decision, not an autonomous one.
3. Known candidates to question (the user named airport transfers; the rest are concrete
   paid-service perks that may not exist on Hospeda): `AIRPORT_TRANSFERS`, `CONCIERGE_SERVICE`,
   `VIP_SUPPORT`, `DEDICATED_MANAGER`, `WHITE_LABEL`, `MULTI_CHANNEL_INTEGRATION`,
   `API_ACCESS`, `SOCIAL_MEDIA_INTEGRATION`. (Candidates only — final verdict from the audit.)

**Removal mechanics (per removed key).** Deleting an entitlement is cross-cutting:
- Remove from `EntitlementKey` enum + `ENTITLEMENT_DEFINITIONS`.
- Remove from every plan in `plans.config.ts`.
- Remove any gate/usage: `git grep` the key across `apps/api` (entitlement gates in
  `tourist-entitlements.ts` / `accommodation-entitlements.ts`), `apps/web`, `apps/admin`,
  `@repo/i18n` (`billing.entitlement.<key>` labels).
- Re-seed `billing_plans` so DB rows drop the removed key.
- A test asserting the removed key is absent from the enum and from all plans.

The audit verdict gates the rest of the spec: `TOURIST_VIP_ENTITLEMENTS` is assembled from
the **kept** tourist entitlements only.

### Mechanism (Option B — shared constant)

**File:** `packages/billing/src/config/plans.config.ts`

1. Define two shared constants representing the **full cumulative tourist-VIP tier**:
   ```ts
   const TOURIST_VIP_ENTITLEMENTS: EntitlementKey[] = [
     // tourist-free
     EntitlementKey.SAVE_FAVORITES, EntitlementKey.WRITE_REVIEWS,
     EntitlementKey.READ_REVIEWS, EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
     // tourist-plus
     EntitlementKey.AD_FREE, EntitlementKey.PRICE_ALERTS,
     EntitlementKey.EARLY_ACCESS_EVENTS, EntitlementKey.EXCLUSIVE_DEALS,
     EntitlementKey.CAN_COMPARE_ACCOMMODATIONS, EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
     EntitlementKey.CAN_VIEW_SEARCH_HISTORY, EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
     // tourist-vip
     EntitlementKey.VIP_SUPPORT, EntitlementKey.CONCIERGE_SERVICE,
     EntitlementKey.AIRPORT_TRANSFERS, EntitlementKey.VIP_PROMOTIONS_ACCESS,
     EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
   ];

   const TOURIST_VIP_LIMITS: LimitDefinition[] = [
     { key: LimitKey.MAX_FAVORITES, value: -1 },
     { key: LimitKey.MAX_ACTIVE_ALERTS, value: -1 },
     { key: LimitKey.MAX_COMPARE_ITEMS, value: -1 },
   ];
   ```
   (Reuse these same constants to define the `tourist-vip` plan itself, so there is a single
   source of truth and the tourist tier and owner inheritance can never drift.)

2. Spread into every owner + complex plan definition, de-duplicated:
   ```ts
   entitlements: dedupe([...TOURIST_VIP_ENTITLEMENTS, ...ownerSpecificEntitlements]),
   limits: mergeLimits(TOURIST_VIP_LIMITS, ownerSpecificLimits), // owner-specific wins on key clash
   ```
   Dedup matters because a few keys already coincide (`CAN_CONTACT_WHATSAPP_DISPLAY`,
   `CAN_CONTACT_WHATSAPP_DIRECT`). Limit keys do not overlap between tourist and owner today,
   but `mergeLimits` keeps owner-specific values authoritative if they ever do.

3. **No runtime change.** `apps/api/src/middlewares/entitlement.ts` remains a flat per-plan
   consumer. It reads the materialized list from `billing.plans.get(planId)`.

### Seeding / propagation

- Plans are seeded to the `billing_plans` table (seed package) and served by QZPay at runtime.
- After the config change, **re-seed / sync `billing_plans`** so DB rows carry the new
  entitlement/limit lists. This is the propagation step — no per-subscription data migration
  is needed (effective entitlements resolve from the plan row at request time).
- Identify the exact plan-seed/sync entry point in the seed package and document the command
  to run (local: `pnpm db:seed` path that seeds plans; staging/prod: the plan-sync routine).

### Tests

- Unit test asserting the **superset invariant** (US-3): for each owner/complex plan,
  `Set(plan.entitlements) ⊇ Set(TOURIST_VIP_ENTITLEMENTS)` and every `TOURIST_VIP_LIMITS`
  key is present.
- Unit test asserting **no duplicates** in any plan's entitlement list.
- Unit test asserting owner-specific entitlements/limits are still present.
- Integration test (optional): an owner-plan actor passes a tourist-entitlement gate
  (e.g. `SAVE_FAVORITES`) that previously 403'd.

### Patterns / constraints
- Config-driven (ADR-030 / SPEC-192) — the plan config stays the sole source of truth; do
  not push category logic into the runtime resolver.
- No `any`; named exports; `as const` where applicable.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Inheriting entitlements that don't fit the platform (e.g. AIRPORT_TRANSFERS) or paid service perks | Medium (cost/UX) | Part 0 catalog audit prunes them before the inherited set is built; removals get user sign-off |
| Removing an entitlement breaks a gate/usage still referencing it | Medium | `git grep` each removed key across api/web/admin/i18n before deleting; absence test |
| Forgetting to re-seed billing_plans → config and DB diverge | Medium | Make plan re-seed/sync part of the task + document it; superset test runs against config, a seed/sync check verifies DB |
| Limit key clash in the future | Low | `mergeLimits` keeps owner-specific values authoritative |
| QZPay plan sync semantics on staging/prod | Low | Follow the existing plan-seed/sync routine; verify on staging before prod |

## Out of Scope

- Progressive inheritance (owner-basico→tourist-free, owner-pro→tourist-plus, …) — explicitly
  rejected; all owner plans get the full tourist-VIP set.
- Runtime resolver category/union logic (Option C) — rejected.
- Multi-plan (holding tourist + owner simultaneously) — a user has one active plan; unchanged.
- Changing tourist plan tiers themselves (only refactor tourist-vip to reuse the shared const).

## Suggested Tasks (phased)

- **Audit (first)**: build the entitlement-catalog table (key → metadata → granting plans), assign keep/remove/rename verdicts, get user sign-off.
- **Audit (apply)**: remove each greenlit entitlement across enum, config, all plans, gates, i18n labels (one task per removal or grouped) + absence test.
- **Core**: define `TOURIST_VIP_ENTITLEMENTS` + `TOURIST_VIP_LIMITS` (from the pruned catalog); refactor `tourist-vip` to use them; add `dedupe`/`mergeLimits` helpers if not present.
- **Core**: spread the constants into all 3 owner + 3 complex plans.
- **Testing**: superset invariant + no-duplicates + owner-specific-preserved tests.
- **Integration**: owner actor passes a previously-403 tourist gate.
- **Seed/propagation**: re-seed/sync `billing_plans`; document the command.
- **Docs**: note the owner-superset rule in the billing plan docs.

## Internal Review Notes

- **Verified on staging:** 9 plans in `plans.config.ts` (owner/complex/tourist); flat
  per-plan resolver in `apps/api/src/middlewares/entitlement.ts` (no inheritance); owner
  plans currently grant zero tourist entitlements; one active plan per user;
  `getDefaultEntitlements()` = tourist-free fallback.
- **Catalog audit (user, 2026-06-11):** this now subsumes the earlier concierge/airport
  question. The Part 0 audit reviews EVERY entitlement for platform fit and removes the ones
  that don't apply (airport transfers is the confirmed example). The inherited tourist set is
  built from the kept entitlements only. Removals need user sign-off before applying.
- **Open question for impl:** exact plan-seed/sync entry point + the staging/prod propagation
  command for `billing_plans`.

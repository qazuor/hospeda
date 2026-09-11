---
title: Four commerce entitlement keys for editing and publishing, with the grant always ahead of the gate
linear: HOS-1074
statusSource: linear
created: 2026-09-02
type: feature
areas:
  - billing
  - api
  - db
  - web
---

# Four commerce entitlement keys for editing and publishing

## 1. Summary

HOS-974's verdict for `EDIT_ACCOMMODATION_INFO` and `PUBLISH_ACCOMMODATIONS`
across the two commerce verticals. Owner decision (2026-09-01): **replicate
accommodation, same internal mechanism, everything standardised.**

Four new `EntitlementKey` members, granted on **all three tiers** of their own
vertical:

| Vertical | Keys |
|---|---|
| gastronomy | `EDIT_GASTRONOMY_INFO`, `PUBLISH_GASTRONOMY` |
| experience | `EDIT_EXPERIENCE_INFO`, `PUBLISH_EXPERIENCE` |

…with the gate mounted on the commerce routes exactly as
`accommodation/protected/patch.ts` mounts its own.

This is the first real key a commerce plan has ever granted. It is the
unblocking work for the twelve wave-1 issues of epic HOS-1071.

## 2. Why four new keys and not a reuse

`loadEntitlements` resolves against the **accommodation** subscription
(`apps/api/src/middlewares/entitlement.ts:441-445`). Reusing an accommodation
key on a commerce route breaks in both directions at once:

- a commerce owner with no accommodation plan is refused, always;
- an owner who holds both is allowed, always — for the wrong reason, and the
  allow would look perfectly correct.

The two catalogues are separate billing domains by construction (ADR-035), and
a shared key would quietly re-merge them at the only point that matters.

## 3. The alternative that was rejected

Gate on an active subscription alone — which is what
`commerceVerticalTier()`'s own comment described as the design of the day:

> *"Commerce visibility is driven by the subscription status through
> `commerce_listing_subscriptions` + the reconciler, not by the entitlement
> engine — there is simply nothing to put in the first half of that pattern."*

It costs zero new keys. **Parity was chosen over economy: one mechanism across
the whole platform, not two.**

The precedent is exact and measured: in accommodation,
`EDIT_ACCOMMODATION_INFO` and `PUBLISH_ACCOMMODATIONS` are **already granted by
all six plans**. A key that is uniform across a catalogue's tiers is not an
exception invented here — it is the convention that already exists.

## 4. The ordering hazard, and how it was removed rather than sequenced

Commerce plans declared `entitlements: []`. **If the gate ships before the
grant reaches an environment, every commerce owner loses the ability to edit
their own listing.** That is not hypothetical: there was no `requireEntitlement`
anywhere under `routes/gastronomy/` or `routes/experience/`, and that absence is
what made the product work. It was not a leak to plug.

The issue asks for the grant and the gate in the SAME release, grant first.
Sequencing alone is not enough, because two ordinary states sit outside any
sequence:

1. **The owner mid-funnel has no subscription at all.**
   `commerce/protected/create.ts` creates a `PRIVATE`/`DRAFT` listing and the
   owner fills it in BEFORE paying. Gating that on a live subscription means
   nobody can ever reach the checkout — the HOS-687 lockout shape, where the
   only path to a capability runs through the thing that capability gates.
2. **`ensureCommercePlan` INSERTS ONLY.** An existing plan row is skipped
   wholesale, so every already-seeded environment carries `entitlements: []`
   on all six commerce rows until the data-migration runs. A gate reading the
   database alone would refuse everyone for the whole deploy→migrate window.

**D-1 — the entitlement floor comes from CODE, and the plan row can only add to
it.** `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`
(`packages/billing/src/config/commerce-entitlements.config.ts`) is read by both
`plans.config.ts` (what the seeder writes) and
`commerceVerticalEntitlementMiddleware` (what the gate resolves). The
subscription plan row's own `entitlements` are UNIONED on top, never
substituted.

This is Model C's capability rule applied literally — an entitlement set is a
`'capability'` field, so **config wins and the database follows**, the exact
inverse of a price or a cap where the database wins because an operator decided
it. The consequence is the point: the grant and the gate are ONE artifact, and
the ordering hazard cannot occur because there is no window in which one exists
without the other.

Note the asymmetry with the sibling half of the same middleware, which is
deliberate. The **cap** fails toward a number because an absent limit key reads
as *unlimited* — silently giving the product away. An **entitlement** fails the
other way: an absent key is a refusal. Both failures are invisible to whoever
wired them and loud to the customer, so both branches end at a value that is
known to be right rather than at whatever a lookup returned.

## 5. What shipped

### 5.1 `@repo/billing`

- `EntitlementKey` — four new members (39 → 43).
- `ENTITLEMENT_DEFINITIONS` — four definitions, appended as their own trailing
  section so the category-slice length assertions in `entitlements.test.ts` do
  not silently reclassify an accommodation key.
- `commerce-entitlements.config.ts` (new) —
  `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`, exhaustive over `CommerceVertical`,
  plus `ALL_COMMERCE_ENTITLEMENT_KEYS`.
- `commerceVerticalTier()` — takes `vertical` instead of `limitKey`, and derives
  BOTH the cap key and the entitlement pair from it, so a tier cannot name one
  vertical's cap and another's keys, and a seventh tier cannot be added with an
  empty set by omission.

### 5.2 `apps/api`

- `commerceVerticalEntitlementMiddleware` — publishes the vertical's entitlement
  set instead of an empty one, resolved as floor ∪ subscription-plan.
  `resolveCommerceVerticalGrants` returns both halves in one pass;
  `resolveCommerceVerticalCap` stays as a thin wrapper for the checkout route,
  which must read the same number the create route was gated on.
- Gates mounted on four routes:

| Route | Key |
|---|---|
| `POST /api/v1/protected/commerce/listings/gastronomy` | `PUBLISH_GASTRONOMY` |
| `POST /api/v1/protected/commerce/listings/experience` | `PUBLISH_EXPERIENCE` |
| `PATCH /api/v1/protected/gastronomies/{id}` | `EDIT_GASTRONOMY_INFO` |
| `PATCH /api/v1/protected/experiences/{id}` | `EDIT_EXPERIENCE_INFO` |

  On the create routes the gate sits between the loader and the limit check,
  mirroring `requireEntitlement(PUBLISH_ACCOMMODATIONS)` +
  `enforceAccommodationLimit()`. On the patch routes the loader is new: without
  it the gate reads the ACCOMMODATION set, which never carries a commerce key,
  and refuses everyone.

### 5.3 Seed

`0077-hos-1074-commerce-edit-publish-entitlements` — the dual-write counterpart.
Inserts the four `billing_entitlements` lookup rows and unions the vertical's
pair into all six commerce plan rows' `entitlements`.

Worth stating because it inverts the usual reading: the API does **not** depend
on this migration having run (see D-1). What it fixes is everything that reads
the plan row directly and cannot see the code floor — the admin plan editor's
checkboxes, `config-drift-check`, an operator inspecting `billing_plans`.
Leaving those describing a state the platform is not in is the HOS-789 shape the
dual-write rule exists to prevent.

### 5.4 Surfaces

- Admin plan editor — a `commerce` entitlement group (both verticals in one
  group: the editor is a flat per-plan checklist and a commerce plan belongs to
  one vertical, so two single-pair groups would add a header that is empty on
  every plan an operator opens).
- i18n — `billing.entitlement.<key>` in es/en/pt (guarded by
  `entitlement-label-coverage.test.ts`) and
  `admin-billing…entitlementGroups.commerce` in es/en/pt.

## 6. Verification — R-2, end to end against the real route

HOS-973 R-2 is the acceptance criterion: the engine resolves an unknown key
permissively across five layers without raising, so the four keys are asserted
**end to end against the real route** — never with `checkLimit` and a hand-built
context, where the answer is always green.

Two files, because `vi.mock` is file-scoped and hoisted, and because neither
half is sufficient alone — an allow test passes on a route with no gate
whatsoever, and a block test passes on a route that refuses everybody.

- `apps/api/test/commerce/edit-publish-entitlements.e2e.test.ts` — ALLOW. Fails
  if the loader is dropped or mounted after its gate.
- `apps/api/test/commerce/edit-publish-entitlements-block.e2e.test.ts` — BLOCK.
  Narrows the vertical's keys to nothing (the pre-HOS-1074 catalogue, not an
  invented state), asserts 403 `ENTITLEMENT_REQUIRED` on all four routes naming
  the RIGHT key each, and asserts the counter was never queried — the documented
  "gate precedes limit check" invariant, asserted rather than assumed.

**Vacuity was measured, not assumed.** The first draft of the allow test was
green against requests that never reached a gate at all: an invalid
mock-permission string answered 400 on all four routes and every
`not.toBe(403)` assertion passed. The load-bearing assertion is therefore a spy
on the first observable call AFTER each route's gate — `count()` on the create
routes (the handler re-parses through the full admin schema before reaching the
service, so a minimal body dies past the gate but short of it), `updateOwn()` on
the patch routes.

Both files were then mutation-checked, and each mutation failed exactly the
test that should catch it:

| Mutation | Result |
|---|---|
| drop `requireEntitlement(EDIT_GASTRONOMY_INFO)` from the gastronomy patch route | block test fails on that route only |
| swap loader and gate on the experience create route | allow test fails on that route only |

## 7. The three surfaces (HOS-1071 rule)

**Vertical presentation** — `presentacion/gastronomia` and
`presentacion/experiencias` **already describe this capability**, at length:
*"Creás tu cuenta y armás la ficha"*, *"Le das publicar"*, *"Armar la ficha es
gratis… recién decidís cuando la querés publicar"*. Both files also carry an
explicit in-file instruction that the copy is a verbatim owner-approved artifact
and must not be rewritten. Nothing was added; nothing is missing.

**Comparison table and plan card** — **no row added, deliberately.**
`plan-comparison-rows.ts` feeds the two accommodation-domain comparison pages
(`suscriptores/planes/comparar`, `suscriptores/turistas/comparar`), which render
`ALL_PLANS` — and every commerce plan is excluded from `ALL_PLANS` by design, so
the accommodation seed loop, the public plan list and the grant-matrix snapshot
stay accommodation-only. A `RowConfig` keyed on `EDIT_GASTRONOMY_INFO` would
therefore derive **"not included" on every plan the table can render**, which is
both false and worse than absent: HOS-329's own lesson is that an all-no mistake
under-sells and an all-yes mistake over-promises. There is no commerce
comparison table today to put the row in.

**Audience pricing pages** — built by HOS-1032. Nothing to do here. When that
lands, the row question should be re-asked against the commerce table it builds.

## 8. Deliberately out of scope

- **The FAQ and media edit routes** of both verticals (`addFaq`, `updateFaq`,
  `reorderFaqs`, `addMedia`, `reorderMedia`, `setFeaturedMedia`) keep their
  service-level `COMMERCE_EDIT_OWN` permission gate and gain no entitlement
  gate. Accommodation does gate its equivalents, so this is a real gap against
  full parity — but each one would need its own `commerceVerticalEntitlementMiddleware`
  (two to three billing round-trips per request) on routes that are called far
  more often than the patch route, and the issue names the patch route as the
  precedent to mirror. Worth revisiting as a follow-up, with the perf cost
  measured first.
- **No structural migration.** Nothing here needs a new column: `entitlements`
  is an existing `billing_plans` column.
- **No change to how commerce VISIBILITY works.** It still runs through
  `commerce_listing_subscriptions` + the reconciler. This spec adds a gate on
  editing and creating, not on being publicly visible.

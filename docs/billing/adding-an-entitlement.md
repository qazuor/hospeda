# Adding a New Entitlement — Contributor Guide

> Spec reference: SPEC-145 T-145-20 | Authored: 2026-06-05

This guide walks through every step required to add a new entitlement key
end-to-end. Follow all six steps; skipping any one of them will break CI.

---

## Step 1: Add the enum member

File: `packages/billing/src/types/entitlement.types.ts`

Add a new `EntitlementKey` member:

```ts
export enum EntitlementKey {
    // ...existing members...
    MY_NEW_FEATURE = 'my_new_feature',
}
```

The two runtime guards live in `packages/billing/src/types/guards.ts` and each
builds a `ReadonlySet` at module load, so no manual update is needed — the new key
is automatically valid. They read **different enums**: `isEntitlementKey` from
`Object.values(EntitlementKey)`, `isLimitKey` from `Object.values(LimitKey)`. This
paragraph claimed both iterate `EntitlementKey` (HOS-1302); adding a `LimitKey`
would then look covered by a guard that never sees it.

---

## Step 2: Add the human-readable definition

File: `packages/billing/src/config/entitlements.config.ts`

Append an entry to `ENTITLEMENT_DEFINITIONS`:

```ts
{
    key: EntitlementKey.MY_NEW_FEATURE,
    name: 'My new feature',
    description: 'One-sentence description for the admin plan editor and billing UI',
},
```

This array is the seeder's source of truth for the `billing_entitlements` lookup
table. See the **Seed sync** note below.

---

## Step 3: Grant the entitlement in plan config (and understand DB sync)

File: `packages/billing/src/config/plans.config.ts`

Add the new key to the `entitlements` array of each plan that should receive it:

```ts
export const OWNER_PRO_PLAN: PlanDefinition = {
    // ...
    entitlements: [
        // ...existing keys...
        EntitlementKey.MY_NEW_FEATURE,
    ],
};
```

### How plan grants reach the billing DB (seed sync — Model C)

`plans.config.ts` is the **code-level config**. The billing DB (`billing_plans`
table managed by QZPay) is the **runtime source of truth** after initial seeding
(SPEC-168 / SPEC-192 / SPEC-211). The two are kept in sync as follows:

1. `packages/seed/src/required/billingEntitlements.seed.ts` reads
   `ENTITLEMENT_DEFINITIONS` and upserts rows in `billing_entitlements`. It is
   idempotent: existing rows are skipped (skip-by-key).

2. `packages/seed/src/required/billingPlans.seed.ts` reads `ALL_PLANS` and
   upserts rows in `billing_plans` (matched by `name`). On first run it inserts;
   on subsequent runs it applies the **Model C** per-field policy (SPEC-211):

   - **Capability fields** (`entitlements`, limit-key presence, and structural
     metadata — see `MODEL_C_FIELD_SPLIT` in
     `packages/billing/src/config/model-c-field-split.ts`) → the DB row is
     updated to match config. A new entitlement grant added to `plans.config.ts`
     **reaches existing DB rows automatically** on the next seed run.

   - **Commercial fields** (limit numeric values, `active`, `description`,
     `metadata.displayName`, prices) → DB wins; a log notice is emitted but
     the row is never overwritten. These reflect operator decisions made via the
     SPEC-168 admin UI.

   This means: if a plan was already seeded and you add an entitlement to
   `plans.config.ts`, running the seed on the target environment propagates the
   change to the existing row. For new environments, the seed covers everything
   in one pass. For production environments where you cannot run the seed
   directly, the extras migration provides the one-pass sync (see below).

   For dev, `pnpm db:fresh` (wipes and re-seeds from scratch) is still the
   fastest path.

   **If you are adding a new `billing_plans` column** (not just granting an
   existing key), you must also classify it in `MODEL_C_FIELD_SPLIT`
   (`packages/billing/src/config/model-c-field-split.ts`) as `'capability'`
   or `'commercial'`. The seed's fail-fast guard throws at startup if any
   seed-controlled field is missing from that table, and the guard test
   (`packages/billing/test/model-c-field-split.test.ts`) will fail CI.

---

## Step 4: Gate the route

Import `requireEntitlement` and pass it in `options.middlewares` — that is the
only supported wiring point. Do **not** call `requireEntitlement` inside the
handler body.

File example: `apps/api/src/routes/accommodation/protected/create.ts`

```ts
import { EntitlementKey } from '@repo/billing';
import { requireEntitlement } from '../../../middlewares/entitlement';

export const protectedCreateAccommodationRoute = createProtectedRoute({
    // ...
    options: {
        middlewares: [
            requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS),
            // limit check (if needed) comes after the entitlement gate
        ],
    },
});
```

The middleware chain order on every protected route is:

```
auth → actor → billing → billingCustomer → entitlement → trial → [options.middlewares]
```

The `entitlement` step (`entitlementMiddleware()`, registered at
`apps/api/src/utils/create-app.ts:176`) is easy to miss and used to be absent
from this diagram: it is the LOADER that populates `userEntitlements` /
`userLimits` on the context, and it runs BEFORE `trial`. It is not the gate.
The gate is `requireEntitlement(key)`, which lives in `[options.middlewares]`
and therefore still runs after `trial` — which is why the first invariant below
holds despite the loader's position.

Key ordering invariants:

- `trialMiddleware` fires **before** `requireEntitlement`. An expired-trial user
  receives HTTP 402 before ever reaching the 403 entitlement gate (T-019 learning).
- Entitlement gate (403) always precedes limit check. Check the entitlement first
  so the limit counter is never queried for users who lack the feature entirely.
- Staff roles (`SUPER_ADMIN`, `ADMIN`, `EDITOR`, `CLIENT_MANAGER`) bypass
  entitlement checks via INV-6: `entitlementMiddleware` grants them the unlimited
  set before the route middleware runs. `requireEntitlement` sees their key in the
  set and passes.

### Error contract

`requireEntitlement` throws `ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED)`.
The global `createErrorHandler()` maps this to HTTP 403 with body:

```json
{
  "success": false,
  "error": {
    "code": "ENTITLEMENT_REQUIRED",
    "message": "Access denied. This feature requires the 'my_new_feature' entitlement.",
    "details": { "requiredEntitlement": "my_new_feature", "upgradeUrl": "/billing/plans" }
  }
}
```

Never throw `HTTPException(403)` directly from a gate. Always use `ServiceError`.

---

## Step 5: Add a test pair (block + allow)

Pattern: `apps/api/test/e2e/flows/billing/enforcement-gates.test.ts`

Add one BLOCK case (a plan that lacks the key) and one ALLOW case (a plan that
has it). Both must exercise the real middleware stack end-to-end — no mocking of
`requireEntitlement` or `entitlementMiddleware`.

```ts
// Gate N: MY_NEW_FEATURE
//   Route:   POST /api/v1/protected/my-route
//   BLOCK:   tourist-free (lacks MY_NEW_FEATURE)
//   ALLOW:   owner-pro    (has  MY_NEW_FEATURE)

it('blocks when MY_NEW_FEATURE is absent (tourist-free)', async () => {
    // ... setup actor with tourist-free plan
    const res = await app.request('/api/v1/protected/my-route', { method: 'POST', ... });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('ENTITLEMENT_REQUIRED');
});

it('passes when MY_NEW_FEATURE is present (owner-pro)', async () => {
    // ... setup actor with owner-pro plan
    const res = await app.request('/api/v1/protected/my-route', { method: 'POST', ... });
    // Gate must not fire — downstream 4xx for missing data is acceptable
    expect(res.status).not.toBe(403);
});
```

---

## Step 6: Add a row to the gate matrix

File: `docs/billing/endpoint-gate-matrix.md`

Add a row to the **Route Gate Matrix** table under the appropriate section:

```
| `POST /api/v1/protected/my-route` | `my-entity/protected/create.ts` | gate | `my_new_feature` | wired | requireEntitlement(MY_NEW_FEATURE) middleware wired (SPEC-NNN) |
```

The snapshot guard test (`apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts`,
SPEC-145 T-022) parses this table on every CI run. If a protected or admin route
handler file exists on disk without a matching matrix row, CI fails with an
explicit error message listing the missing file. Conversely, a matrix row that
points at a non-existent file also fails.

**New route with no gate:** set Decision = `none` and write a clear Reason —
the guard requires it.

---

## Gating an existing previously-ungated route

If you are adding an entitlement gate to a **route that already exists and was
previously ungated**, callers on plans that lack the key will start receiving
HTTP 403 where they previously got 2xx. This is a behavior change; document it
in `docs/billing/spec-145-behavior-changes.md` following the existing inventory
format. Cite the blocked tiers and link the owner decision if the lockout is
intentional (example: the WRITE_REVIEWS host-lockout documented in that file).

---

## Checklist

- [ ] `EntitlementKey` member added in `entitlement.types.ts`
- [ ] `ENTITLEMENT_DEFINITIONS` entry added in `entitlements.config.ts`
- [ ] `plans.config.ts` updated for every plan that should receive the grant
- [ ] DB sync executed: `pnpm db:fresh` for dev; seed run on staging/prod propagates
      the capability-layer change automatically (Model C). Commercial-layer changes
      still require the admin UI or API.
- [ ] If adding a new `billing_plans` column: classified in `MODEL_C_FIELD_SPLIT`
      (`packages/billing/src/config/model-c-field-split.ts`)
- [ ] `requireEntitlement(...)` wired via `options.middlewares` in the route
- [ ] BLOCK + ALLOW test pair added in `enforcement-gates.test.ts`
- [ ] Matrix row added in `endpoint-gate-matrix.md` with correct Status
- [ ] Behavior-change entry added in `spec-145-behavior-changes.md` (only if gating an existing route)

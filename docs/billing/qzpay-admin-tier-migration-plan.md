# QZPay Admin Tier Migration Plan

> **Status**: SHIPPED — qzpay-hono v1.3.0 published, Hospeda PR open.
> **Authored**: 2026-05-20
> **Context**: Outcome of the Phase 3 deep-dive that started as a "compliance migration" (move 10 admin hooks from `/protected/` → `/admin/`) and ended as a "do it properly" rewrite using qzpay-hono v1.3 with lifecycle hooks.
> **Replaces**: Phase 3 of `ui-audit-2026.md` (still valid for Phase 1/2/4).

---

## 1. Why this plan exists

Phase 1 of the billing UI remediation shipped in PR #1204 (`fix/billing-ui-endpoints`): the real-blocker endpoint mismatches between admin/web UI and the current API surface. While analyzing Phase 3 ("migrate 10 remaining admin hooks from `/protected/billing/*` to `/admin/billing/*`"), the original assumption — *"the admin equivalents exist; just rename the path"* — was disproved on inspection.

What was actually discovered:

1. **The Hospeda backend only mounts QZPay routes under `/protected/billing/*`.** Admin routes under `/admin/billing/*` only include Hospeda-specific custom files (metrics, settings, notifications, customer-addons, subscription-cancel, subscription-events, addons, plans).
2. **The admin panel was working "by accident" against `/protected/`.** List endpoints pass through because `billingOwnershipMiddleware` does not enforce ownership when the path lacks a resource `:id`. Detail/refund/pay/void operations either silently return 403 (when the resource doesn't belong to the admin) or expose data inconsistently. No full admin smoke had ever caught this.
3. **`qzpay-hono` already has `createAdminRoutes`** (`packages/hono/src/routes/admin.routes.ts`, 530 lines). It exposes 16 admin endpoints with `force-cancel`, `force-refund`, `change-plan`, `mark-paid`, `void`, dashboard, entitlements/limits management, plans/promo-codes listing, etc.
4. **`createAdminRoutes` is NOT exposed in the package's public API.** It is exported from `routes/index.ts` (line 6) but missing from `packages/hono/src/index.ts` line 90, which only re-exports `createBillingRoutes`. That's the literal reason Hospeda can't import it today.
5. **Both Hospeda and qzpay are owned by us.** This is decisive: there is no external coordination cost for adding to qzpay. Code that is generic billing logic SHOULD live in qzpay; code that is Hospeda-specific stays in Hospeda. The mental model is "what would I want if I were starting another billing-powered SaaS tomorrow?"

That last point is what makes "the correct path" feasible: ~6-7h of focused work instead of the 20-30h that was implied when we thought of qzpay as a third-party black box.

---

## 2. End-state architecture (what we are building toward)

### qzpay-hono v1.3 (new)

```
@qazuor/qzpay-hono
├── createBillingRoutes (existing, /protected-style, ownership-filtered)
│
├── createAdminRoutes (existing factory, EXTENDED with hooks)
│   ├── GET    /admin/dashboard                                  [existing]
│   ├── GET    /admin/customers                                  [existing]
│   ├── GET    /admin/customers/:id/full                         [existing]
│   ├── GET    /admin/subscriptions                              [existing]
│   ├── GET    /admin/subscriptions/:id                          [NEW]
│   ├── POST   /admin/subscriptions/:id/cancel                   [NEW — supports immediate + reason; honors hooks]
│   ├── POST   /admin/subscriptions/:id/force-cancel             [existing — raw, no hooks, kept for parity]
│   ├── POST   /admin/subscriptions/:id/change-plan              [existing — honors hooks]
│   ├── POST   /admin/subscriptions/:id/extend-trial             [NEW]
│   ├── GET    /admin/payments                                   [existing]
│   ├── GET    /admin/payments/:id                               [NEW]
│   ├── POST   /admin/payments/:id/refund                        [NEW — honors hooks; force-refund stays]
│   ├── POST   /admin/payments/:id/force-refund                  [existing — raw, no hooks]
│   ├── GET    /admin/invoices                                   [existing]
│   ├── GET    /admin/invoices/:id                               [NEW]
│   ├── POST   /admin/invoices/:id/pay                           [NEW — honors hooks; mark-paid stays]
│   ├── POST   /admin/invoices/:id/mark-paid                     [existing — raw, no hooks]
│   ├── POST   /admin/invoices/:id/void                          [existing — honors hooks now]
│   ├── POST   /admin/customers/:id/entitlements                 [existing]
│   ├── DELETE /admin/customers/:id/entitlements/:key            [existing]
│   ├── POST   /admin/customers/:id/limits/:key/set              [existing]
│   ├── POST   /admin/customers/:id/limits/:key/reset            [existing]
│   ├── GET    /admin/promo-codes                                [existing]
│   └── GET    /admin/plans                                      [existing]
│
├── Lifecycle hooks (NEW)
│   QZPayAdminLifecycleHooks interface — onBefore/onAfter for cancel,
│   change-plan, extend-trial, refund, invoice-pay, invoice-void.
│
└── Cherry-pick factories (NEW, opt-in)
    createAdminListSubscriptionsRoute, createAdminGetSubscriptionRoute,
    createAdminCancelSubscriptionRoute, etc. — for hosts that want to
    mount only a subset.
```

### Hospeda admin/billing routes (post-migration)

```
apps/api/src/routes/billing/admin/
├── index.ts                          ← mounts qzpay createAdminRoutes + Hospeda-specific
├── metrics.ts                        ← KEEPS (Hospeda-specific: system-usage, approaching-limits)
├── settings.ts                       ← KEEPS (Hospeda billing_settings)
├── notifications.ts                  ← KEEPS (Hospeda billing_notifications)
├── customer-addons.ts                ← KEEPS (Hospeda addons concept)
├── subscription-events.ts            ← KEEPS (Hospeda audit log read)
├── usage.ts                          ← KEEPS (Hospeda usage tracking)
├── addons.ts                         ← KEEPS (Hospeda addons catalog)
├── plans.ts                          ← KEEPS (Hospeda plan view; superset of qzpay's)
│
├── subscription-cancel.ts            ← DELETE (lifecycle moves to qzpay hooks)
├── (no separate plan-change file)    ← removed: qzpay covers it; hooks audit
└── hooks/                            ← NEW directory
    ├── on-before-subscription-cancel.ts   ← revoke linked addons
    ├── on-after-subscription-cancel.ts    ← audit log → billing_subscription_events
    ├── on-after-subscription-change-plan.ts
    ├── on-after-subscription-trial-extended.ts
    ├── on-after-payment-refund.ts
    ├── on-after-invoice-pay.ts
    └── on-after-invoice-void.ts
```

### Hospeda protected/billing routes (unchanged)

```
apps/api/src/routes/billing/
├── index.ts                          ← still mounts qzpay createBillingRoutes for /protected
├── start-paid.ts                     ← Hospeda checkout orchestration (stays)
├── subscription-status.ts            ← Hospeda polling (stays)
├── plan-change.ts                    ← /protected/billing/subscriptions/change-plan (user's own; stays)
├── trial.ts                          ← /protected/billing/trial/extend (kept — see note 1 below)
├── promo-codes.ts                    ← Hospeda promo redeem (stays)
├── addons.ts                         ← Hospeda addons list/purchase (stays)
└── usage.ts                          ← Hospeda usage (stays)
```

**Note 1**: `/protected/billing/trial/extend` is admin-only by permission today even though it's under `/protected/`. After migration it stays where it is — if we want a `/admin/` equivalent we can also mount via qzpay's new `extend-trial`. Both can coexist; the `/admin/` one is used from admin panel, `/protected/` may be removed later if nothing references it.

### Frontend hooks (post-migration)

All admin hooks call `/admin/billing/*`. Specifically:

- `apps/admin/src/features/billing-subscriptions/hooks.ts`
- `apps/admin/src/features/billing-payments/hooks.ts`
- `apps/admin/src/features/billing-invoices/hooks.ts`

The `changePlan` mutation that was disabled in PR #1204 gets re-enabled, pointing at `/admin/billing/subscriptions/:id/change-plan`.

The `web` admin/protected hooks (`apps/web/src/lib/api/endpoints-protected.ts`) are NOT touched in this migration — web is user-facing and stays on `/protected/`.

---

## 3. Design decisions (locked in unless overridden)

### D1 — Hooks are optional and isolation-safe

Hooks are typed as optional. If `hooks` is undefined or a specific hook is undefined, qzpay does the raw operation. If `onBeforeX` throws or returns `{ ok: false, reason }`, the operation is aborted with that reason (5xx + reason in the error body). If `onAfterX` throws, the operation already committed in qzpay — the hook error is logged but does NOT roll back; the route still returns success. This separation is intentional because rollback is impossible after MP-side commit.

### D2 — `cancel` vs `force-cancel`, `refund` vs `force-refund`, `pay` vs `mark-paid`

We expose BOTH variants:

- **`/cancel`** (NEW) — honors `cancelAtPeriodEnd: true` by default (= end-of-period). Invokes `onBeforeCancel` (can abort) and `onAfterCancel` (audit). Accepts `{ immediate?: boolean, reason?: string }`.
- **`/force-cancel`** (existing) — always immediate, no hooks. Kept for parity with current callers and for emergency raw operations.
- **`/refund`** (NEW) — honors hooks. Accepts `{ amount?: number, reason?: string }`.
- **`/force-refund`** (existing) — raw, no hooks. Kept.
- **`/pay`** (NEW) — honors hooks. Accepts `{ paymentId?: string }`.
- **`/mark-paid`** (existing) — raw, no hooks. Kept.

Hospeda admin panel migrates to the new (`/cancel`, `/refund`, `/pay`) variants because they carry the audit log + addon-revocation side effects via hooks. The `force-*` variants stay available for tooling/CLI use.

### D3 — Auth is fully delegated to the host app

QZPay does NOT enforce admin permission. The host app must wire the right middleware in `authMiddleware: MiddlewareHandler`. QZPay's contract: any request that passes `authMiddleware` is authorized to operate on any customer. Hospeda binds `authMiddleware` to a function that checks `actor.permissions.includes(PermissionEnum.BILLING_READ_ALL)` (or stricter for writes).

For per-route granularity, Hospeda can wrap individual routes via the cherry-pick factories (D6) with different permission checks. The full-factory `createAdminRoutes` uses a single `authMiddleware` for all routes.

### D4 — Hooks receive Hono `Context`

Every hook receives `ctx: Context` so Hospeda can read actor info, set Sentry tags, log structured events, etc. This is the bridge that lets Hospeda do anything it needs without qzpay knowing the details.

### D5 — Backwards compatibility

v1.3 is **fully additive**:

- All existing routes keep their behavior unchanged.
- `force-cancel`, `force-refund`, `mark-paid` remain at their current paths.
- New `cancel`, `refund`, `pay`, get-by-id, extend-trial are added.
- `hooks?` field is optional on `createAdminRoutesConfig`.
- The barrel export adds `createAdminRoutes`; this is a missing export, not a renamed one.

No callers break. No breaking change. Version bump is **1.3.0**, not 2.0.0.

### D6 — Cherry-pick factories (lower priority, can defer)

Per user request, each route also exposed as its own factory:

```typescript
export const createAdminListSubscriptionsRoute = (config: BaseConfig) => Hono;
export const createAdminGetSubscriptionRoute = (config: BaseConfig) => Hono;
export const createAdminCancelSubscriptionRoute = (config: BaseConfig & { hooks? }) => Hono;
// etc.
```

The full-factory `createAdminRoutes` internally calls these. Hosts that want partial mounting use them directly. We'll ship this in v1.3 since it's the same code reorganized but **deprioritize** the work-time: build full factory first, refactor into cherry-pick second if time allows.

### D7 — `prefix` defaults to `/admin`, but Hospeda passes `prefix: ''`

QZPay's `createAdminRoutes` defaults to `prefix: '/admin'`. Hospeda mounts under `/api/v1/admin/billing` already, so we pass `prefix: ''` to avoid `/admin/admin/subscriptions`.

---

## 4. Phase-by-phase plan

### Phase Q1 — Design types + interfaces (qzpay) [~30min]

Files touched:

- `packages/hono/src/routes/admin.routes.ts` — add type exports

Deliverables:

```typescript
export interface QZPayAdminLifecycleHookContext {
    readonly ctx: Context;
}

export interface QZPayAdminLifecycleHooks {
    onBeforeSubscriptionCancel?: (params: {
        readonly subscriptionId: string;
        readonly immediate: boolean;
        readonly reason?: string;
    } & QZPayAdminLifecycleHookContext) => Promise<{ ok: true } | { ok: false; reason: string }>;

    onAfterSubscriptionCancel?: (params: {
        readonly subscription: Subscription;
        readonly immediate: boolean;
    } & QZPayAdminLifecycleHookContext) => Promise<void>;

    onAfterSubscriptionChangePlan?: (params: {
        readonly subscription: Subscription;
        readonly previousPlanId: string;
        readonly newPlanId: string;
    } & QZPayAdminLifecycleHookContext) => Promise<void>;

    onAfterSubscriptionTrialExtended?: (params: {
        readonly subscription: Subscription;
        readonly additionalDays: number;
    } & QZPayAdminLifecycleHookContext) => Promise<void>;

    onAfterPaymentRefund?: (params: {
        readonly payment: Payment;
        readonly amount?: number;
        readonly reason?: string;
    } & QZPayAdminLifecycleHookContext) => Promise<void>;

    onAfterInvoicePay?: (params: {
        readonly invoice: Invoice;
    } & QZPayAdminLifecycleHookContext) => Promise<void>;

    onAfterInvoiceVoid?: (params: {
        readonly invoice: Invoice;
    } & QZPayAdminLifecycleHookContext) => Promise<void>;
}

export interface QZPayAdminRoutesConfig {
    billing: QZPayBilling;
    prefix?: string;
    authMiddleware: MiddlewareHandler;
    hooks?: QZPayAdminLifecycleHooks;
}
```

Acceptance: typecheck passes in qzpay-hono with new types declared (no implementations yet).

### Phase Q2 — Add missing routes (qzpay) [~1-1.5h]

Files touched:

- `packages/hono/src/routes/admin.routes.ts` — add 4 new handlers
- Validators if needed in `packages/hono/src/schemas/`

New endpoints:

1. **`GET /admin/subscriptions/:id`** — straightforward `billing.subscriptions.get(id)` wrapped in `QZPayApiResponse`.
2. **`GET /admin/payments/:id`** — `billing.payments.get(id)`.
3. **`GET /admin/invoices/:id`** — `billing.invoices.get(id)`.
4. **`POST /admin/subscriptions/:id/extend-trial`** — body `{ additionalDays: number, reason?: string }`. Calls `billing.subscriptions.extendTrial(id, additionalDays)` if the qzpay-core API supports it (verify); otherwise call `billing.subscriptions.update(id, { trialEndsAt: newDate })`.

Plus the new `/cancel`, `/refund`, `/pay` variants per D2 (which use `cancelAtPeriodEnd: true` by default).

Acceptance: existing tests still green + new endpoints respond correctly with manual sanity checks via curl.

### Phase Q3 — Wire lifecycle hooks (qzpay) [~1-1.5h]

Files touched:

- `packages/hono/src/routes/admin.routes.ts` — modify cancel, change-plan, extend-trial, refund, invoice-pay, invoice-void handlers to invoke hooks.

Pattern (for cancel as example):

```typescript
router.post(`${prefix}/subscriptions/:id/cancel`, async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const immediate = body.immediate === true;
        const reason = body.reason;
        const id = c.req.param('id');

        // BEFORE hook — can abort
        if (hooks?.onBeforeSubscriptionCancel) {
            const result = await hooks.onBeforeSubscriptionCancel({
                subscriptionId: id, immediate, reason, ctx: c
            });
            if (!result.ok) {
                return c.json({ success: false, error: result.reason }, 422);
            }
        }

        // Core cancel
        const subscription = await billing.subscriptions.cancel(id, {
            cancelAtPeriodEnd: !immediate,
            reason: reason ?? 'Admin cancellation'
        });

        // AFTER hook — fire-and-log
        if (hooks?.onAfterSubscriptionCancel) {
            try {
                await hooks.onAfterSubscriptionCancel({ subscription, immediate, ctx: c });
            } catch (hookError) {
                console.error('onAfterSubscriptionCancel hook failed:', hookError);
                // Do NOT fail the response — the cancel already committed
            }
        }

        return c.json({ success: true, data: subscription });
    } catch (error) {
        const [errorResponse, statusCode] = createErrorResponse(error);
        return c.json(errorResponse, statusCode as ContentfulStatusCode);
    }
});
```

Same pattern for the other 5 hookable operations. The `force-*` variants do NOT invoke hooks.

Acceptance: hooks are optional (passing `hooks: undefined` doesn't break anything); when provided, they fire in the right order; `onBefore` abort works.

### Phase Q4 — Fix barrel export + cherry-pick factories (qzpay) [~30min]

Files touched:

- `packages/hono/src/index.ts` — add exports
- `packages/hono/src/routes/admin.routes.ts` — refactor each route into its own factory function

Changes:

```typescript
// packages/hono/src/index.ts (around line 90)
export {
    createWebhookRouter,
    createSimpleWebhookHandler,
    createBillingRoutes,
    createAdminRoutes,                            // ← NEW
    createAdminListSubscriptionsRoute,            // ← NEW (cherry-pick)
    createAdminGetSubscriptionRoute,              // ← NEW
    createAdminCancelSubscriptionRoute,           // ← NEW
    // ... etc for cherry-pick exports
    type QZPayAdminRoutesConfig,                  // ← NEW
    type QZPayAdminLifecycleHooks,                // ← NEW
} from './routes/index.js';
```

The cherry-pick portion is optional for this iteration. If time-constrained, skip cherry-pick and ship `createAdminRoutes` only.

Acceptance: in a fresh consumer (Hospeda is the test), `import { createAdminRoutes } from '@qazuor/qzpay-hono'` works.

### Phase Q5 — Tests + version bump (qzpay) [~1h]

Files touched:

- `packages/hono/test/admin.routes.test.ts` (new or extended)
- `packages/hono/package.json` — version 1.2.0 → 1.3.0
- `CHANGELOG.md` — entry
- `.changeset/` — add changeset file

Tests to add:

1. `createAdminRoutes` mounts and responds with the 17 endpoints (smoke).
2. New endpoints respond correctly (4 new + 3 hooked variants).
3. Hook invocation order:
   - `onBeforeCancel` fires before `billing.subscriptions.cancel`
   - `onAfterCancel` fires after
   - `onBefore` returning `{ ok: false }` aborts with 422
   - `onAfter` throwing does NOT fail the response
4. Hooks are optional: passing `hooks: undefined` works for all endpoints
5. Cherry-pick factories work independently

Acceptance: full test suite green; `pnpm changeset` + `pnpm changeset version` produces 1.3.0 bump.

### Phase H1 — Upgrade dependency (hospeda) [~10min]

Files touched:

- `apps/api/package.json` — `@qazuor/qzpay-hono`: `^1.3.0` (use `link:../../qzpay/packages/hono` first for local testing, then publish + switch)

Decision: do we publish 1.3.0 to npm before consuming in Hospeda, or use a workspace link? **Recommendation**: workspace link (`file:` or `link:`) during dev iterations; publish 1.3.0 to npm before merging the Hospeda PR.

Acceptance: `pnpm install` resolves; typecheck on hospeda passes.

### Phase H2 — Build hooks (hospeda) [~1h]

Files touched (new):

- `apps/api/src/routes/billing/admin/hooks/on-before-subscription-cancel.ts`
- `apps/api/src/routes/billing/admin/hooks/on-after-subscription-cancel.ts`
- `apps/api/src/routes/billing/admin/hooks/on-after-subscription-change-plan.ts`
- `apps/api/src/routes/billing/admin/hooks/on-after-subscription-trial-extended.ts`
- `apps/api/src/routes/billing/admin/hooks/on-after-payment-refund.ts`
- `apps/api/src/routes/billing/admin/hooks/on-after-invoice-pay.ts`
- `apps/api/src/routes/billing/admin/hooks/on-after-invoice-void.ts`
- `apps/api/src/routes/billing/admin/hooks/index.ts`

`onBeforeSubscriptionCancel` does what Phase 1 of the current `subscription-cancel.ts` does:

1. Query active addon purchases for the subscription.
2. Revoke each addon's QZPay entitlements/limits in parallel via `Promise.allSettled`.
3. If ANY revocation fails, return `{ ok: false, reason: 'addon revocation failed: ...' }` so qzpay aborts.
4. Compensating event insert (to record which addons were revoked before the cancel attempt).

`onAfterSubscriptionCancel` does what Phase 2 + post-tx does:

1. Mark addon purchases as `canceled` in DB.
2. Insert `billing_subscription_events` audit row (`triggerSource: 'admin-cancel'`, includes `metadata`).
3. Clear entitlement cache.

`onAfterSubscriptionChangePlan` — insert audit row with `triggerSource: 'admin-change-plan'`, metadata includes previousPlanId/newPlanId.

`onAfterPaymentRefund` — insert audit row + Sentry tag.

`onAfter{InvoicePay,InvoiceVoid}` — audit row.

Acceptance: each hook is independently unit-tested (call it with a mock subscription, assert the side effects).

### Phase H3 — Mount qzpay admin routes (hospeda) [~30min]

Files touched:

- `apps/api/src/routes/billing/admin/index.ts` — add mount of `createAdminRoutes`
- `apps/api/src/routes/billing/admin/subscription-cancel.ts` — DELETE (logic moved to hooks)

New `admin/index.ts` shape:

```typescript
import { createAdminRoutes } from '@qazuor/qzpay-hono';
import { adminBillingHooks } from './hooks';

// Existing custom Hospeda mounts (KEEP):
app.route('/usage', getAdminCustomerUsageSummaryRoute);
app.route('/settings', settingsRouter);
app.route('/notifications', listNotificationLogsRoute);
app.route('/notifications', notificationsRouter);
app.route('/customer-addons', listCustomerAddonsRoute);
app.route('/customer-addons', expireCustomerAddonRoute);
app.route('/customer-addons', activateCustomerAddonRoute);
app.route('/metrics', adminMetricsRouter);
app.route('/subscriptions', subscriptionEventsRoute);     // /subscriptions/:id/events (read audit)
app.route('/addons', adminAddonsRouter);
app.route('/plans', adminPlansRouter);

// NEW: qzpay admin routes (mounted last; order = lower precedence on collision)
const billing = getQZPayBilling();
if (billing) {
    const adminAuthForBilling: MiddlewareHandler = async (c, next) => {
        const actor = c.get('actor');
        if (!actor?.permissions?.includes(PermissionEnum.BILLING_READ_ALL)) {
            throw new HTTPException(403, { message: 'Admin billing access required' });
        }
        await next();
    };
    const qzpayAdmin = createAdminRoutes({
        billing,
        prefix: '',
        authMiddleware: adminAuthForBilling,
        hooks: adminBillingHooks
    });
    app.route('/', qzpayAdmin);
}
```

Custom Hospeda routes are mounted FIRST so they take precedence on path collisions (none expected but defense-in-depth: `/subscriptions/:id/events` is Hospeda-only, `/subscriptions/:id/cancel` only exists at qzpay now, etc.).

Acceptance: `pnpm typecheck` clean; manual sanity via `curl /api/v1/admin/billing/subscriptions` returns list (with admin session); `curl /api/v1/admin/billing/subscriptions/:id/cancel` triggers the hooks.

### Phase H4 — Migrate admin frontend hooks (hospeda) [~30min]

Files touched:

- `apps/admin/src/features/billing-subscriptions/hooks.ts`
- `apps/admin/src/features/billing-payments/hooks.ts`
- `apps/admin/src/features/billing-invoices/hooks.ts`
- `apps/admin/src/features/billing-subscriptions/CancelSubscriptionDialog.tsx` (re-enable immediate toggle if needed)
- `apps/admin/src/routes/_authed/billing/subscriptions.tsx` (re-enable changePlan)

Changes:

1. `/api/v1/protected/billing/{subscriptions,payments,invoices,trial}/*` → `/api/v1/admin/billing/{...}/*` (10 paths).
2. `cancelSubscription` hook updates: path → `/admin/billing/subscriptions/:id/cancel`, body now supports `{ immediate, reason }` (which we removed in PR #1204 because the previous Hospeda custom route didn't accept it — qzpay's new `/cancel` does).
3. `changePlan` mutation: re-enabled, throws removed; calls `POST /admin/billing/subscriptions/:id/change-plan` with `{ newPlanId, billingInterval? }` (verify qzpay's payload shape).
4. `extendTrial` hook: path → `/admin/billing/subscriptions/:id/extend-trial` body `{ additionalDays, reason? }`.

Acceptance: typecheck clean; `CancelSubscriptionDialog` re-instated with immediate toggle.

### Phase H5 — Cleanup + docs (hospeda) [~30min]

Files touched:

- `docs/billing/ui-audit-2026.md` — update §3 Phase 3 to mark this work as the actual delivery
- `docs/billing/qzpay-admin-tier-migration-plan.md` (this file) — mark `Status: shipped`
- `apps/api/src/routes/billing/admin/subscription-cancel.ts` — DELETE if not already done in H3
- Commit message standards: prefix `feat(billing): ...` for the migration, conventional commits as usual

Acceptance: docs reflect reality; no dead code references.

---

## 5. Testing strategy

### qzpay-hono tests (Phase Q5)

```
packages/hono/test/admin.routes.test.ts (extended)
├── createAdminRoutes — smoke 17 endpoints respond
├── New endpoint contracts:
│   ├── GET /admin/subscriptions/:id returns subscription shape
│   ├── GET /admin/payments/:id returns payment shape
│   ├── GET /admin/invoices/:id returns invoice shape
│   ├── POST /admin/subscriptions/:id/extend-trial
│   ├── POST /admin/subscriptions/:id/cancel (with immediate flag)
│   ├── POST /admin/payments/:id/refund
│   └── POST /admin/invoices/:id/pay
├── Hook behavior:
│   ├── onBeforeCancel fires before billing.cancel
│   ├── onBeforeCancel returning { ok: false } aborts (422)
│   ├── onAfterCancel fires after billing.cancel
│   ├── onAfterCancel throwing does NOT fail the response (logged)
│   └── all hooks optional (passing hooks: undefined works)
└── Cherry-pick factories work independently (if shipped)
```

### Hospeda tests

```
apps/api/test/routes/billing/admin/
├── hooks/
│   ├── on-before-subscription-cancel.test.ts — addon revocation logic
│   ├── on-after-subscription-cancel.test.ts — audit log insert
│   └── ... (one per hook)
└── admin-routes-integration.test.ts — end-to-end via Hono app instance
    ├── GET /admin/billing/subscriptions (list)
    ├── POST /admin/billing/subscriptions/:id/cancel triggers hooks
    ├── POST /admin/billing/payments/:id/refund triggers hook
    └── ...
```

Manual smoke after each Phase H#:

- H3: curl with admin session against staging-like local env
- H4: open admin panel locally, exercise: list subs → click detail → cancel → verify addon revocation in DB → verify audit log entry

---

## 6. Risk + rollback

### Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| qzpay 1.3.0 breaks Hospeda's existing `createBillingRoutes` usage | Low | High | All changes additive (D5); test full suite before publish |
| Hook order subtle bugs (e.g., onBefore aborts but addon revocation half-done) | Medium | High | Phase 1+2 pattern from current cancel preserved; idempotent revocation; compensating event |
| Frontend hooks call wrong shape after migration (e.g., body `{ planId }` vs `{ newPlanId }`) | Medium | Low | Each frontend hook gets a typecheck + a unit test pinning payload |
| QZPay's existing `force-cancel` callers (if any) break | Low | Medium | `force-cancel` UNCHANGED in v1.3; no caller migration forced |
| Cherry-pick factories add complexity without users | Low | Low | Defer if time-constrained (D6) |
| Workspace link doesn't reflect dev changes | Medium | Low | `pnpm install` + restart api after each qzpay change in dev |

### Rollback plan per phase

- **Q1-Q5 (qzpay-side)**: All changes in a single branch in `/home/qazuor/projects/PACKAGES/qzpay`. If something breaks: `git reset --hard origin/main`; don't publish.
- **H1-H5 (hospeda-side)**: PR-based. If something breaks after merge: revert the PR; admin panel goes back to status quo (working-by-accident `/protected/` calls). NOT optimal but functional.
- **Frontend**: Once H2/H3 ship to qzpay 1.3.0, H4 frontend can be a separate PR for clean rollback.

### Recommended PR strategy

**Option A — Single PR per repo**:

- qzpay: 1 PR `feat: admin routes with lifecycle hooks (v1.3)` → merge → publish 1.3.0
- hospeda: 1 PR `feat(billing): migrate admin to qzpay-hono v1.3 admin tier`

**Option B — Split by concern**:

- qzpay: 1 PR per phase (Q1+Q2 design+routes, Q3 hooks, Q4 exports, Q5 tests) — overkill probably
- hospeda: 1 PR for H2+H3 (backend), 1 PR for H4 (frontend), 1 PR for H5 (cleanup)

**Recommendation: Option A**, simpler and faster review cycle.

---

## 7. Acceptance criteria (definition of done)

This work is "done" when all of the following are true:

- [ ] qzpay-hono v1.3.0 published to npm with `createAdminRoutes` in the public API
- [ ] qzpay test suite green; new tests cover hooks + new endpoints
- [ ] Hospeda `apps/api` consumes qzpay-hono ^1.3.0
- [ ] All 7 lifecycle hooks implemented in Hospeda with unit tests
- [ ] `apps/api/src/routes/billing/admin/index.ts` mounts qzpay's `createAdminRoutes` with hooks
- [ ] `apps/api/src/routes/billing/admin/subscription-cancel.ts` DELETED (logic in hooks)
- [ ] All 10 admin frontend hooks call `/admin/billing/*` paths
- [ ] `changePlan` mutation re-enabled and functional
- [ ] `CancelSubscriptionDialog` immediate toggle re-instated (since backend now supports it)
- [ ] Manual smoke green: list subs → cancel one → verify addon revocation + audit log entry
- [ ] `docs/billing/ui-audit-2026.md` updated: Phase 3 marked as delivered via this migration
- [ ] This document updated to `Status: shipped`
- [ ] CLAUDE.md rule violations (admin → /protected) reduced to zero

---

## 8. Time estimates summary

| Phase | Description | Est. |
|---|---|---|
| Q1 | qzpay design types | 30min |
| Q2 | qzpay new routes | 1-1.5h |
| Q3 | qzpay lifecycle hooks | 1-1.5h |
| Q4 | qzpay barrel + cherry-pick | 30min |
| Q5 | qzpay tests + version bump | 1h |
| **qzpay subtotal** | | **~4-5h** |
| H1 | Hospeda upgrade dep | 10min |
| H2 | Hospeda hooks | 1h |
| H3 | Hospeda mount admin | 30min |
| H4 | Hospeda frontend migration | 30min |
| H5 | Hospeda cleanup + docs | 30min |
| **hospeda subtotal** | | **~3h** |
| **TOTAL** | | **~7-8h** |

Realistic with debugging: **8-10h**. Single session feasible if focused.

---

## 9. Cross-references

- [`docs/billing/ui-audit-2026.md`](./ui-audit-2026.md) — original Phase 1-4 plan (Phase 3 superseded by this doc)
- [`apps/api/src/routes/billing/admin/index.ts`](../../apps/api/src/routes/billing/admin/index.ts) — current admin mount
- `apps/api/src/routes/billing/admin/subscription-cancel.ts` — deleted; lifecycle was moved to `qzpay-admin-hooks.ts`
- [`apps/api/src/middlewares/billing-ownership.middleware.ts`](../../apps/api/src/middlewares/billing-ownership.middleware.ts) — stays for `/protected/`
- [`apps/api/src/middlewares/billing-admin-guard.middleware.ts`](../../apps/api/src/middlewares/billing-admin-guard.middleware.ts) — stays for `/protected/`; new `/admin/` mount uses its own simpler check
- qzpay-hono repo: `/home/qazuor/projects/PACKAGES/qzpay/packages/hono/src/routes/admin.routes.ts`
- qzpay-hono barrel: `/home/qazuor/projects/PACKAGES/qzpay/packages/hono/src/index.ts` (line 90 — missing `createAdminRoutes`)
- PR #1204 — Phase 1 of UI remediation (already merged or open at time of writing)
- Engram topic: `billing/qzpay-admin-tier-migration` — checkpoint of this plan

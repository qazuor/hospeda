/**
 * @file protected-plans-list.ts
 * @description Custom override for `GET /plans` (protected billing tier) —
 * billing-interval-override tooling.
 *
 * qzpay-hono's prebuilt `GET /plans` (mounted via the qzpay wrapper in
 * `routes/billing/index.ts`) returns EVERY storage plan to any authenticated
 * user, unfiltered by `active` or anything else — including the hidden daily
 * test plan (`TEST_DAILY_PLAN` in `@repo/billing`, slug `owner-test-daily`),
 * exposing its test cadence and price to end users.
 *
 * This module is mounted (see `routes/billing/index.ts`) BEFORE the qzpay
 * wrapper — Hono first-match routing means it wins for the EXACT `GET /plans`
 * path. `POST /plans`, `GET /plans/:id`, `PUT /plans/:id`, `DELETE /plans/:id`
 * are NOT registered here, so they fall through unchanged to the qzpay
 * wrapper. Same ordering precedent as the soft-cancel / downgrade-preview /
 * promo-codes overrides in `routes/billing/index.ts`.
 *
 * The response reproduces qzpay-hono's `GET /plans` shape byte-for-byte (see
 * its `dist/index.js` `GET ${prefix}/plans` handler) — `ResponseFactory` is
 * deliberately NOT used here, since that would change the envelope shape and
 * break existing consumers of this endpoint.
 *
 * @module routes/billing/protected-plans-list
 */

import type { Context } from 'hono';
import { getQZPayBilling } from '../../middlewares/billing';
import { billingAuthMiddleware } from '../../middlewares/billing-auth.middleware';
import { createRouter } from '../../utils/create-app';

/**
 * Returns `true` for a plan flagged as a testing-only tool via
 * `metadata.testPlan === true` (stamped by `seedTestDailyPlan` in
 * `@repo/seed` — see `TEST_DAILY_PLAN` in `@repo/billing`).
 *
 * Deliberately keyed on the metadata marker, NOT on `active` or the slug —
 * robust to how the plan is otherwise configured. `TEST_DAILY_PLAN` is
 * currently seeded `active: false` (so it stays off the PUBLIC plans list),
 * but that is an independent, changeable detail; this filter must keep
 * working even if a future test plan needs `active: true` for some reason.
 */
export function isTestPlan(plan: { readonly metadata?: Record<string, unknown> }): boolean {
    return plan.metadata?.testPlan === true;
}

/**
 * Handler for the `GET /plans` override. See file JSDoc for the full
 * rationale.
 *
 * @param c - Hono context. Requires an authenticated actor —
 *   {@link billingAuthMiddleware} is applied on {@link protectedPlansListRouter}.
 */
export async function handleProtectedPlansList(c: Context): Promise<Response> {
    const billing = getQZPayBilling();
    if (!billing) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Billing service is not available'
                }
            },
            503
        );
    }

    // Mirrors qzpay-hono's `?active=true` branch exactly (no pagination
    // envelope on that branch either).
    const activeOnly = c.req.query('active') === 'true';
    if (activeOnly) {
        const active = await billing.plans.getActive();
        return c.json({ success: true, data: active.filter((p) => !isTestPlan(p)) });
    }

    // Mirrors qzpay-hono's default (paginated) branch exactly. `total`/`hasMore`
    // are passed through as qzpay-core computed them (pre-filter) — the same
    // way any other post-fetch filter would behave; the one hidden test plan
    // this ever excludes is not worth an extra query to recompute an exact count.
    const limit = Number(c.req.query('limit')) || 50;
    const offset = Number(c.req.query('offset')) || 0;
    const result = await billing.plans.list({ limit, offset });
    return c.json({
        success: true,
        data: result.data.filter((p) => !isTestPlan(p)),
        pagination: {
            limit,
            offset,
            hasMore: result.hasMore,
            total: result.total
        }
    });
}

/**
 * Router exposing ONLY `GET /` (mounted at `/plans` by
 * `routes/billing/index.ts`), so every other `/plans*` method/sub-path is
 * untouched and falls through to the qzpay wrapper mounted after this one.
 */
export const protectedPlansListRouter = createRouter();
protectedPlansListRouter.get('/', billingAuthMiddleware, handleProtectedPlansList);

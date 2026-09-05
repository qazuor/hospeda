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
 * HOS-1062 F1 widened what this override withholds. The endpoint answers ANY
 * authenticated user — an ordinary tourist account included — with full prices,
 * so a negotiated plan reaching it publishes that agreement just as surely as
 * the public endpoint would. `metadata.testPlan` was never the only mark worth
 * filtering here; `metadata.publicListing` is filtered too now, on BOTH
 * branches, since `?active=true` is the one a consumer reaches for by default.
 *
 * The response reproduces qzpay-hono's `GET /plans` envelope shape (see its
 * `dist/index.js` `GET ${prefix}/plans` handler) — same `{ success, data,
 * pagination }` / `{ success, data }` (active-only) fields, same pagination
 * defaults (limit 20, clamped [1,100]). Two intentional divergences: invalid
 * `limit`/`offset` fall back to defaults here instead of qzpay's HTTP 400, and
 * paging is applied to the SERVABLE catalogue rather than delegated to qzpay
 * (see {@link loadServableCatalog}). `ResponseFactory` is deliberately NOT used,
 * since that would change the envelope and break existing consumers.
 *
 * @module routes/billing/protected-plans-list
 */

import { isPubliclyListedPlan, resolvePlanPublicListing } from '@repo/schemas';
import type { Context } from 'hono';
import { getQZPayBilling } from '../../middlewares/billing';
import { billingAuthMiddleware } from '../../middlewares/billing-auth.middleware';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';

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
 * Returns `true` for a raw storage plan positively marked as publicly listed
 * (HOS-1062 F1).
 *
 * The plans reaching this handler come straight from qzpay storage, not from
 * `mapDbToPlan`, so they carry raw `metadata` and no resolved `publicListing`
 * field. This adapts the SHAPE and nothing else: `resolvePlanPublicListing`
 * returns exactly the object `isPubliclyListedPlan` takes, so the two compose
 * and the verdict is made in the same single place the public endpoint uses.
 *
 * Written as a composition rather than as `.publicListing === 'listed'` on
 * purpose. An earlier draft spelled the comparison out here, and a mutation
 * flipping it to `!== 'unlisted'` survived all fifteen route tests and the CI
 * guard — correctly, because the resolver is total over two values, so at this
 * call site the two forms are the same expression. A second comparison that
 * cannot be told apart from its own inverse is not a safety check; it is a copy
 * of one, free to drift the day the resolver gains a third value. Delegating
 * leaves ONE comparison in the codebase, and mutating THAT one turns four tests
 * red across `@repo/schemas` and `apps/api` — measured, both ways.
 */
export function isPubliclyListedStoragePlan(plan: {
    readonly metadata?: Record<string, unknown>;
}): boolean {
    return isPubliclyListedPlan(resolvePlanPublicListing({ metadata: plan.metadata }));
}

/**
 * The plans this endpoint may hand to an ordinary authenticated user: neither a
 * testing tool nor a plan withheld from the catalogue.
 *
 * One function, called by both branches, so `?active=true` and the paginated
 * default cannot diverge in what they withhold — which is exactly how the
 * `publicListing` mark would otherwise have been added to one and not the other.
 *
 * @param plans - Raw storage plans as qzpay returned them
 * @returns The subset that may be served, in the order received
 */
export function servablePlans<T extends { readonly metadata?: Record<string, unknown> }>(
    plans: readonly T[]
): T[] {
    return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));
}

/**
 * qzpay's own `PaginationSchema` ceiling — the largest page it will return.
 */
const CATALOG_PAGE_SIZE = 100;

/**
 * How many `CATALOG_PAGE_SIZE` pages {@link loadServableCatalog} will walk
 * before giving up. A billing catalogue of 1000 plans is a different problem
 * than this endpoint; the bound exists so a paging bug cannot spin forever.
 */
const CATALOG_MAX_PAGES = 10;

/**
 * Loads the whole catalogue and returns only the servable plans.
 *
 * Why the whole catalogue rather than the caller's page: `pagination.total` and
 * `hasMore` used to be qzpay's PRE-filter numbers, passed through with a comment
 * arguing that one hidden test plan was not worth an extra query. With
 * negotiated plans in the table that stops being true — the total would announce
 * the existence of plans the array deliberately does not carry, and a client
 * paging to the end would find fewer rows than it was promised. Filtering before
 * paging makes both numbers describe exactly what is returned.
 *
 * Cost: ONE query today, the same as before, because the catalogue fits in a
 * single 100-row page (single digits of plans, plus one per negotiated
 * agreement). It becomes N queries only once the catalogue exceeds 100 plans,
 * and it is bounded by {@link CATALOG_MAX_PAGES} so it can never loop.
 *
 * @param billing - The resolved QZPay billing facade
 * @returns Every servable plan, in catalogue order
 */
async function loadServableCatalog(billing: {
    plans: {
        list: (args: { limit: number; offset: number }) => Promise<{
            data: ReadonlyArray<{ readonly metadata?: Record<string, unknown> }>;
            hasMore: boolean;
            total: number;
        }>;
    };
}): Promise<Array<{ readonly metadata?: Record<string, unknown> }>> {
    const collected: Array<{ readonly metadata?: Record<string, unknown> }> = [];

    for (let page = 0; page < CATALOG_MAX_PAGES; page++) {
        const result = await billing.plans.list({
            limit: CATALOG_PAGE_SIZE,
            offset: page * CATALOG_PAGE_SIZE
        });
        collected.push(...result.data);

        if (!result.hasMore) {
            break;
        }

        if (page === CATALOG_MAX_PAGES - 1) {
            // Truncation is announced rather than silent: past this point the
            // response describes the first CATALOG_MAX_PAGES * CATALOG_PAGE_SIZE
            // plans only.
            apiLogger.error(
                { fetched: collected.length, maxPages: CATALOG_MAX_PAGES },
                'Billing catalogue exceeded the protected /plans fetch bound — response is truncated'
            );
        }
    }

    // ONE exit, and it filters. A second `return` that answered `collected`
    // would be a raw qzpay catalogue leaving this function, which is what the
    // whole override exists to prevent — the CI guard rejects one outright.
    return servablePlans(collected);
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
    // envelope on that branch either). This is the branch a consumer reaches for
    // by default, so it withholds exactly what the paginated one does.
    const activeOnly = c.req.query('active') === 'true';
    if (activeOnly) {
        const active = await billing.plans.getActive();
        return c.json({ success: true, data: servablePlans(active) });
    }

    // Mirrors qzpay-hono's default (paginated) branch. Pagination defaults match
    // qzpay's `PaginationSchema` (default limit 20, clamped to [1,100]; offset >= 0)
    // — invalid values fall back to the defaults rather than qzpay's 400, which
    // is acceptable for this internal catalog shadow.
    //
    // The window is applied to the SERVABLE catalogue rather than delegated to
    // qzpay, so `total` and `hasMore` describe what the response actually
    // carries. Before HOS-1062 they were qzpay's pre-filter numbers: harmless
    // while the only withheld plan was a test tool, a leak of the EXISTENCE of
    // negotiated plans once those are in the table.
    const rawLimit = Number(c.req.query('limit'));
    const limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
    const rawOffset = Number(c.req.query('offset'));
    const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    const servable = await loadServableCatalog(billing);
    return c.json({
        success: true,
        data: servable.slice(offset, offset + limit),
        pagination: {
            limit,
            offset,
            hasMore: offset + limit < servable.length,
            total: servable.length
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

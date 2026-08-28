/**
 * HOS-854 — `listAll()` pagination and filter contract.
 *
 * ## Why this file exists
 *
 * HOS-854 had two independent causes. One was a `Math.max(..., 1)` clamp that
 * flattened negative day counts to 1. The other — the one this file covers —
 * was that every whole-table read went through `list()`, which returns the
 * FIRST PAGE ONLY (20 rows by default) and, before qzpay 5.0, accepted a
 * `filters` option that the Drizzle adapter silently discarded.
 *
 * Both failures are invisible below 21 rows. That is exactly why the existing
 * billing e2e suite never caught them: not one of its 55 files creates more
 * than a handful of subscriptions, so `list()` and `listAll()` return the same
 * array and no assertion can tell them apart. A green suite was compatible with
 * the bug being fully present.
 *
 * ## The two-guard problem this file is careful about
 *
 * The cron jobs keep a JS post-filter on `status` as defence in depth, layered
 * on top of the filter now applied by qzpay. With both guards in place a test
 * that only checks the job's output cannot say WHICH one produced the correct
 * answer — if qzpay stopped filtering tomorrow, the JS post-filter would absorb
 * it and the test would stay green.
 *
 * So the filter assertions here call `billing.subscriptions.listAll()` DIRECTLY,
 * with no job in between. What comes back is qzpay's answer and nothing else.
 * The call-site tests in the companion describe block then verify that the jobs
 * consume the full result rather than a truncated one.
 *
 * ## What mutation testing showed (measured, not assumed)
 *
 * Three mutations were applied and re-run against this file:
 *
 * 1. `listAll()` → `list({ limit: 20 })` in the TEST's own direct calls —
 *    kills "returns all 25 rows" and "returns only past_due rows". The file
 *    can tell the two APIs apart.
 * 2. `listAll({ filters })` → `list({ limit: 20 })` in `dunning.job.ts`
 *    (production) — kills both dunning call-site tests. A truncated read at a
 *    real call site is caught.
 * 3. Dropping ONLY the `filters` argument in `dunning.job.ts`, keeping
 *    `listAll()` — kills NOTHING. Every test still passes.
 *
 * Mutation 3 is not a gap to fix; it is the two-guard problem made visible.
 * The job's JS post-filter genuinely produces the right answer without qzpay's
 * filter, so no assertion on the job's OUTPUT can distinguish the two. That is
 * precisely why the direct-call filter tests above exist and must not be
 * rewritten to go through a job: they are the only assertions in the codebase
 * that would fail if qzpay stopped filtering.
 *
 * @module test/e2e/flows/billing/hos-854-listall-pagination
 */

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { dunningJob } from '../../../../src/cron/jobs/dunning.job.js';
import { getQZPayBilling, resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createTestPlan, createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

/**
 * Row count used for every "more than one page" scenario.
 *
 * `list()`'s default page size is 20, so 25 is the smallest round number that
 * makes a truncated read observable: a regression to `list()` returns 20 and
 * the assertion fails by 5. Keep this above 20 — dropping it to 20 or below
 * makes every test in this file vacuous.
 */
const ROWS_BEYOND_ONE_PAGE = 25;

/**
 * Minimal `CronJobContext` for invoking a job handler outside the scheduler.
 * Mirrors the shape `dunning-cron.test.ts` uses; logging is discarded.
 */
function buildCronContext(): Parameters<typeof dunningJob.handler>[0] {
    return {
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined
        },
        startedAt: new Date(),
        dryRun: false
    };
}

/** Resolve the billing instance, failing loudly instead of returning null. */
function requireBillingInstance() {
    const billing = getQZPayBilling();
    if (!billing) {
        throw new Error('QZPay billing instance unavailable — initApp() did not wire it');
    }
    return billing;
}

describe('HOS-854 — listAll() pagination and filter contract', () => {
    let customerId: string;
    let cheapPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;

        const user = await createTestUser({
            email: `hos854-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_${randomUUID()}` }
        });
        customerId = customer.customerId;
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Create `count` subscriptions for the shared customer, all with the given
     * status. Rows are created sequentially: the factory derives a unique
     * provider subscription id per call, and a UNIQUE index on
     * `billing_subscriptions.mp_subscription_id` (extras/031) rejects
     * collisions, so this must not be parallelised into a shared id space.
     */
    async function seedSubscriptions(input: {
        readonly count: number;
        readonly status: 'past_due' | 'active' | 'trialing';
    }): Promise<readonly string[]> {
        const ids: string[] = [];
        for (let i = 0; i < input.count; i += 1) {
            const sub = await createTestSubscription({
                customerId,
                planId: cheapPlanId,
                status: input.status,
                providerSubscriptionId: `mp_sub_${randomUUID()}`
            });
            ids.push(sub.subscriptionId);
        }
        return ids;
    }

    describe('subscriptions.listAll() reads past the first page', () => {
        it(`returns all ${ROWS_BEYOND_ONE_PAGE} rows, not the first 20`, async () => {
            // ARRANGE — more rows than one page holds.
            const created = await seedSubscriptions({
                count: ROWS_BEYOND_ONE_PAGE,
                status: 'past_due'
            });

            // ACT
            const billing = requireBillingInstance();
            const all = await billing.subscriptions.listAll();

            // ASSERT — every seeded row comes back. The assertion names the
            // MISSING ids rather than comparing a total, because the test
            // database carries a handful of rows from the base seed and an
            // exact-count assertion would break on an unrelated seed change
            // while proving nothing extra. A read capped at one page drops at
            // least 5 of these ids, so the failure is still unambiguous.
            const returnedIds = new Set(all.map((s) => s.id));
            const missing = created.filter((id) => !returnedIds.has(id));
            expect(missing).toEqual([]);

            // Guard against the test going vacuous: if the fixture ever stops
            // crossing the page boundary, `list()` and `listAll()` agree and the
            // assertion above proves nothing.
            expect(all.length).toBeGreaterThan(20);
        });

        it('returns a plain array, not a paginated envelope', async () => {
            // ARRANGE
            await seedSubscriptions({ count: 3, status: 'past_due' });

            // ACT
            const billing = requireBillingInstance();
            const all = await billing.subscriptions.listAll();

            // ASSERT — every call site indexes and filters this directly. A
            // `{ data, hasMore, total }` envelope would make `.filter` throw at
            // runtime, which is precisely what the migration had to get right.
            expect(Array.isArray(all)).toBe(true);
            expect(all).not.toHaveProperty('data');
            expect(all).not.toHaveProperty('hasMore');
        });
    });

    describe('subscriptions.listAll() applies the status filter in the database', () => {
        it('returns only past_due rows when filtered, across more than one page', async () => {
            // ARRANGE — a mixed table where the wanted set alone exceeds one
            // page. If the filter were dropped and the whole table paginated,
            // the count would be 30, not 25.
            const pastDue = await seedSubscriptions({
                count: ROWS_BEYOND_ONE_PAGE,
                status: 'past_due'
            });
            const active = await seedSubscriptions({ count: 5, status: 'active' });

            // ACT — called directly on the billing instance. No cron job runs
            // here, so the JS post-filter that the jobs keep as defence in depth
            // cannot contribute to this result.
            const billing = requireBillingInstance();
            const filtered = await billing.subscriptions.listAll({
                filters: { status: 'past_due' }
            });
            const returnedIds = new Set(filtered.map((s) => s.id));

            // ASSERT — three separate claims, because each fails on a different
            // defect. Missing past_due ids mean the read was truncated; a
            // returned `active` id means the filter never reached SQL; a foreign
            // status in the result means it reached SQL and was wrong.
            expect(pastDue.filter((id) => !returnedIds.has(id))).toEqual([]);
            expect(active.filter((id) => returnedIds.has(id))).toEqual([]);
            expect(filtered.every((s) => s.status === 'past_due')).toBe(true);
        });

        it('an unmatched filter returns empty rather than the unfiltered table', async () => {
            // ARRANGE — a table with rows, none of them matching.
            const pastDue = await seedSubscriptions({
                count: ROWS_BEYOND_ONE_PAGE,
                status: 'past_due'
            });

            // ACT
            const billing = requireBillingInstance();
            const filtered = await billing.subscriptions.listAll({
                filters: { status: 'trialing' }
            });
            const returnedIds = new Set(filtered.map((s) => s.id));

            // ASSERT — the negative control for the test above. A discarded
            // filter hands back all 25 past_due rows; an applied one hands back
            // none of them. Without this case, "the filter works" and "the
            // filter is ignored but every row happened to match anyway" are
            // indistinguishable.
            expect(pastDue.filter((id) => returnedIds.has(id))).toEqual([]);
            expect(filtered.every((s) => s.status === 'trialing')).toBe(true);
        });
    });

    describe('listAll() refuses to truncate', () => {
        it('throws when the result set exceeds maxItems instead of returning a short array', async () => {
            // ARRANGE
            await seedSubscriptions({ count: ROWS_BEYOND_ONE_PAGE, status: 'past_due' });

            // ACT + ASSERT — the deliberate contract: silently returning fewer
            // rows than exist is the failure mode HOS-854 was, so exceeding the
            // cap is an error, never a truncation.
            const billing = requireBillingInstance();
            await expect(
                billing.subscriptions.listAll({ maxItems: ROWS_BEYOND_ONE_PAGE - 5 })
            ).rejects.toThrow();
        });
    });

    describe('the dunning cron reports every past_due row, not the first page', () => {
        it(`counts all ${ROWS_BEYOND_ONE_PAGE} past_due subscriptions`, async () => {
            // ARRANGE — the pre-existing dunning-cron.test.ts asserts
            // `pastDueCount >= 1`, which one fixture row satisfies and which a
            // read truncated at 20 satisfies just as happily. This is the same
            // observable pinned to an exact number, above the page boundary,
            // so under-reporting fails.
            await seedSubscriptions({ count: ROWS_BEYOND_ONE_PAGE, status: 'past_due' });

            // ACT
            const result = await dunningJob.handler(buildCronContext());

            // ASSERT
            expect(result.success).toBe(true);
            const details = result.details as { readonly pastDueCount?: number } | undefined;
            expect(details?.pastDueCount).toBe(ROWS_BEYOND_ONE_PAGE);
        });

        it('does not count subscriptions in other statuses', async () => {
            // ARRANGE — the negative half. Without it, "the filter works" and
            // "the filter is ignored and every row happens to be past_due" both
            // produce the same number in the test above.
            await seedSubscriptions({ count: ROWS_BEYOND_ONE_PAGE, status: 'past_due' });
            await seedSubscriptions({ count: 5, status: 'active' });

            // ACT
            const result = await dunningJob.handler(buildCronContext());

            // ASSERT — 25, never 30.
            const details = result.details as { readonly pastDueCount?: number } | undefined;
            expect(details?.pastDueCount).toBe(ROWS_BEYOND_ONE_PAGE);
        });
    });

    describe('plans.listAll() reads the whole catalogue', () => {
        it(`resolves a plan sitting beyond the first page of ${ROWS_BEYOND_ONE_PAGE} plans`, async () => {
            // ARRANGE — the checkout, reactivation guard and start-paid route all
            // resolve ONE plan out of the catalogue. Under `list()` a catalogue
            // larger than one page hid every plan past row 20, so those lookups
            // threw "unknown plan" for a plan that plainly exists.
            const createdIds: string[] = [];
            for (let i = 0; i < ROWS_BEYOND_ONE_PAGE; i += 1) {
                const plan = await createTestPlan({
                    name: `hos854-catalogue-plan-${i}`,
                    description: `HOS-854 catalogue fixture ${i}`,
                    entitlements: ['publish_accommodations'],
                    limits: { max_accommodations: 1 },
                    metadata: { slug: `hos854-catalogue-plan-${i}`, sortOrder: i }
                });
                createdIds.push(plan.planId);
            }

            // ACT
            const billing = requireBillingInstance();
            const all = await billing.plans.listAll();
            const returnedIds = new Set(all.map((p) => p.id));

            // ASSERT — every seeded plan is reachable, including the ones a
            // single-page read would have dropped.
            const missing = createdIds.filter((id) => !returnedIds.has(id));
            expect(missing).toEqual([]);
        });
    });
});

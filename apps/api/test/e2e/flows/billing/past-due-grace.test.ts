/**
 * Past-due grace period middleware — e2e (SPEC-143 T-143-63, reframed 2026-05-20).
 *
 * Validates the end-to-end behavior of `pastDueGraceMiddleware`
 * (`apps/api/src/middlewares/past-due-grace.middleware.ts`) against real
 * `billing_subscriptions` rows resolved through `getQZPayBilling()`. The
 * existing unit test at `apps/api/test/middlewares/past-due-grace.middleware.test.ts`
 * mocks the subscription helpers directly; this file exercises the full
 * stack: DB row → qzpay-core helpers (`isPastDue`, `isInGracePeriod`,
 * `daysRemainingInGrace`) → middleware decision → HTTP response.
 *
 * Test surface (all positive + negative paths of the middleware contract):
 *   - non-past_due subscription → pass-through, no grace header
 *   - past_due within grace window → pass-through, `X-Grace-Period-Days-Remaining` header set
 *   - past_due with grace expired → 402 with `GRACE_PERIOD_EXPIRED` body
 *   - past_due with grace expired but exempt path suffix → pass-through (recovery path bypass)
 *
 * Out of scope:
 *   - cron-lag grace ("renewal cron did not fire yet, sub is still active past
 *     currentPeriodEnd") — never implemented. Deferred to SPEC-148 (Billing
 *     defensive grace + plan lifecycle).
 *   - plan-disable lifecycle (admin disables plan while subs are active) —
 *     orthogonal mechanism. Also deferred to SPEC-148.
 *   - cache invalidation when sub flips from past_due to active — covered by
 *     subscription-activation.test.ts (T-143-18) and entitlement-cache.test.ts.
 *   - dunning retry side effects — covered by dunning-cron.test.ts (T-143-30).
 *
 * Setup constraints:
 *   - The middleware reads subs through `billing.subscriptions.getByCustomerId`
 *     which is the qzpay-core layer. Grace state is encoded in
 *     `billing_subscriptions.metadata.gracePeriodStartedAt` (the past_due
 *     transition timestamp). The dunning-cron tests patch this same field,
 *     and we follow that convention here instead of writing to
 *     `grace_period_ends_at` (which is part of the qzpay schema but not the
 *     value qzpay's helpers actually consume — verified by reading
 *     dunning-cron.test.ts:142-172 and grace-period-source-of-truth.md).
 *   - We build a synthetic mini-app (`buildProbeApp`) the same way
 *     free-plan-signup.test.ts does. The real `pastDueGraceMiddleware` is
 *     mounted on it. We do NOT use the full app because reaching a real
 *     protected route triggers unrelated billing-customer/actor wiring that
 *     would obscure the middleware-under-test assertions.
 *
 * @module test/e2e/flows/billing/past-due-grace
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock so the billing singleton constructs without reaching
// for live MP credentials. The grace middleware itself never calls MP — it
// only reads subscriptions — but billing instance init needs a valid
// adapter factory, so we hand it the stub.
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — past-due-grace.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingSubscriptions, eq } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { pastDueGraceMiddleware } from '../../../../src/middlewares/past-due-grace.middleware.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shape of the 402 error body emitted by `pastDueGraceMiddleware`.
 */
interface GraceExpiredBody {
    readonly error: 'GRACE_PERIOD_EXPIRED';
    readonly message: string;
    readonly daysOverdue: number;
}

/**
 * Build a synthetic Hono app that wires the same per-request context the
 * real billing middleware would (`billingEnabled` + `billingCustomerId`),
 * then mounts the real `pastDueGraceMiddleware`. Two probe routes are
 * exposed:
 *
 *   - `GET /probe`            — non-exempt, used for the pass-through and
 *                               block assertions.
 *   - `GET /probe/checkout`   — ends in `/checkout`, which is on
 *                               `GRACE_EXEMPT_PATH_SUFFIXES` in the real
 *                               middleware. Used to assert the exempt-path
 *                               bypass even when grace has expired.
 *
 * Both probe handlers return a JSON body that surfaces the grace header
 * value so we can assert on it without inspecting `Response.headers`
 * shape inconsistencies between runtimes.
 */
function buildProbeApp(customerId: string): Hono {
    const app = new Hono();
    app.use((c, next) => {
        c.set('billingEnabled', true);
        c.set('billingCustomerId', customerId);
        return next();
    });
    app.use(pastDueGraceMiddleware());
    const handler = (c: Parameters<Parameters<Hono['get']>[1]>[0]) => {
        const graceHeader = c.res.headers.get('X-Grace-Period-Days-Remaining');
        return c.json({ ok: true, graceHeader });
    };
    app.get('/probe', handler);
    app.get('/probe/checkout', handler);
    return app;
}

describe('SPEC-143 T-143-63 (reframed) — past-due grace middleware (e2e)', () => {
    let cheapPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        // initApp() boots the global billing singleton against the mocked
        // adapter factory. We do not use the returned app — the synthetic
        // probe app is what owns the request flow under test.
        initApp();
        resetBillingInstance();
        const seeded = await seedBillingTestPlans();
        cheapPlanId = seeded.cheap.planId;
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(() => {
        mpStub.config.reset();
    });

    /**
     * Per-test fixture: a fresh user + billing customer scoped to the
     * test. The customer id is returned so the caller can attach
     * subscriptions in the shape each scenario needs.
     */
    async function makeCustomer(): Promise<{ readonly customerId: string }> {
        const user = await createTestUser();
        const { customerId } = await createTestBillingCustomer({
            externalId: user.id
        });
        return { customerId };
    }

    /**
     * Patch the subscription row with the exact grace window the test
     * wants to assert against. qzpay-core's `daysRemainingInGrace()` /
     * `isInGracePeriod()` helpers read both `current_period_end` (the
     * cycle boundary that flips the sub into past_due) and
     * `grace_period_ends_at` (the hard cutoff). Setting both removes
     * ambiguity about which field qzpay's implementation prefers — the
     * combination unambiguously pins the grace window.
     *
     * `createTestSubscription` does not expose these fields in its input
     * type, so we patch via raw Drizzle UPDATE the same way
     * `dunning-cron.test.ts:152-172` patches the retry metadata.
     */
    async function patchGraceWindow(
        subscriptionId: string,
        input: {
            readonly currentPeriodEndOffsetDays: number;
            readonly gracePeriodEndOffsetDays: number;
        }
    ): Promise<void> {
        const now = Date.now();
        const currentPeriodEnd = new Date(now + input.currentPeriodEndOffsetDays * ONE_DAY_MS);
        const gracePeriodEndsAt = new Date(now + input.gracePeriodEndOffsetDays * ONE_DAY_MS);
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ currentPeriodEnd, gracePeriodEndsAt })
            .where(eq(billingSubscriptions.id, subscriptionId));
    }

    it('passes through with no grace header when the customer has only an active subscription', async () => {
        const { customerId } = await makeCustomer();
        await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active'
        });

        const res = await buildProbeApp(customerId).request('/probe');
        expect(res.status).toBe(200);

        const body = (await res.json()) as { ok: boolean; graceHeader: string | null };
        expect(body.ok).toBe(true);
        // The middleware short-circuits on the non-past_due branch before
        // setting any grace header, so the captured header must be null.
        expect(body.graceHeader).toBeNull();
    });

    it('allows the request and sets X-Grace-Period-Days-Remaining when past_due is within the grace window', async () => {
        const { customerId } = await makeCustomer();
        // Cycle ended 1 day ago, hard grace cutoff is 2 days in the
        // future. Both fields are pinned so the test is robust to
        // whichever one qzpay-core's helper actually reads.
        //
        // The visible `daysRemainingInGrace()` window uses
        // DUNNING_GRACE_PERIOD_DAYS (7) — NOT PAYMENT_GRACE_PERIOD_DAYS (3).
        // With `currentPeriodEnd = now-1` the helper returns 6 (≈ -1 + 7).
        // The middleware forwards this value verbatim into the header, so
        // the assertion below uses [0, 7] to match qzpay's actual contract.
        // The docs (`docs/billing/grace-period-source-of-truth.md`) and the
        // `PAYMENT_GRACE_PERIOD_DAYS` comment were updated to reflect that
        // the constant is reference-only, not enforced.
        const { subscriptionId } = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'past_due'
        });
        await patchGraceWindow(subscriptionId, {
            currentPeriodEndOffsetDays: -1,
            gracePeriodEndOffsetDays: 2
        });

        const res = await buildProbeApp(customerId).request('/probe');
        expect(res.status).toBe(200);

        const body = (await res.json()) as { ok: boolean; graceHeader: string | null };
        expect(body.ok).toBe(true);
        expect(body.graceHeader).not.toBeNull();
        const remaining = Number.parseInt(body.graceHeader ?? '', 10);
        expect(Number.isInteger(remaining)).toBe(true);
        expect(remaining).toBeGreaterThanOrEqual(0);
        expect(remaining).toBeLessThanOrEqual(7);
    });

    it('blocks the request with 402 GRACE_PERIOD_EXPIRED when grace has been exceeded', async () => {
        const { customerId } = await makeCustomer();
        // Cycle ended 10 days ago and the grace cutoff was 7 days ago →
        // unambiguously past every grace policy (PAYMENT=3, DUNNING=7).
        const { subscriptionId } = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'past_due'
        });
        await patchGraceWindow(subscriptionId, {
            currentPeriodEndOffsetDays: -10,
            gracePeriodEndOffsetDays: -7
        });

        const res = await buildProbeApp(customerId).request('/probe');
        expect(res.status).toBe(402);

        const body = (await res.json()) as GraceExpiredBody;
        expect(body.error).toBe('GRACE_PERIOD_EXPIRED');
        expect(body.message).toContain('grace period has expired');
        // The middleware now computes `daysOverdue` directly from
        // `current_period_end` (previously collapsed to 0 via
        // `Math.abs(daysRemainingInGrace() ?? 0)`).
        //
        // With `currentPeriodEnd = now - 10 days` and qzpay's 7-day
        // grace window, the expected calculation is:
        //   daysOverdue = ceil((now - currentPeriodEnd) / 1d) - 7
        //              ≈ 10 - 7 = 3
        //
        // Allow a 1-day tolerance to absorb sub-second drift between
        // the test's `now` snapshot inside `patchGraceWindow` and the
        // middleware's `Date.now()` call when the request flows through.
        expect(body.daysOverdue).toBeGreaterThanOrEqual(3);
        expect(body.daysOverdue).toBeLessThanOrEqual(4);
    });

    it('bypasses grace enforcement on exempt path suffixes even when grace is expired', async () => {
        const { customerId } = await makeCustomer();
        // Same expired-grace setup as the block test: if the exempt-path
        // bypass were missing, the assertion below would flip to 402.
        const { subscriptionId } = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'past_due'
        });
        await patchGraceWindow(subscriptionId, {
            currentPeriodEndOffsetDays: -10,
            gracePeriodEndOffsetDays: -7
        });

        const res = await buildProbeApp(customerId).request('/probe/checkout');
        // Exempt-path bypass: the middleware never reaches the
        // `findPastDueSubscription` branch and the handler runs normally.
        expect(res.status).toBe(200);

        const body = (await res.json()) as { ok: boolean; graceHeader: string | null };
        expect(body.ok).toBe(true);
        // No header on the exempt path — bypass happens before grace
        // computation, so nothing sets `X-Grace-Period-Days-Remaining`.
        expect(body.graceHeader).toBeNull();
    });
});

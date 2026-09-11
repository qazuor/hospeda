/**
 * Unit tests for applyPriceIncreaseToPlanSubscribers (HOS-191 F6, HOS-1288).
 *
 * Covers the manual per-subscription price-increase mechanism:
 *  - matched/updated/skipped/failed counts and per-row detail reporting
 *  - dryRun (default true) never calls subscriptions.update
 *  - active-discount subscriptions are skipped, never overwritten
 *  - subscriptions already at the target live amount are skipped (idempotency)
 *  - re-running after a successful apply is a full no-op (idempotent)
 *  - HOS-1288: the increase APPLIES in every business vertical, not just
 *    accommodation — the domain comes from the PLAN row
 *  - HOS-1288: a row whose own domain contradicts its plan's is reported
 *    (`domain_mismatch`), never silently dropped
 *  - HOS-1288: an unknown plan and a non-vertical plan throw, so neither can
 *    report a 200 with `matched: 0`
 *  - live-amount lookup failure → outcome 'failed', does not abort the batch
 *  - mutation retry: transient failure then success → 'updated'
 *  - mutation exhausts retries → 'failed'
 *
 * HOS-991: the live amount is read via `fetchLivePreapprovalAmountMajor`
 * (`GET /preapproval/{id}` directly), NOT via `paymentAdapter.subscriptions.retrieve()`
 * — that typed method never returns `auto_recurring`, so a fixture built on its
 * shape would validate a code path that can never happen against real MercadoPago
 * (exactly the bug this issue fixes). `mockRetrieve` is kept in the adapter stub
 * ONLY so tests can assert it is never called — see the dedicated regression test.
 *
 * Mocking strategy mirrors `subscription-poll.job.test.ts`: `@repo/db`'s typed
 * select chain is mocked at the smallest boundary, `@repo/billing`'s
 * `createMercadoPagoAdapter` returns a stub adapter with a per-test-programmable
 * `subscriptions.update`, and `mp-preapproval-amount-lookup.js`'s
 * `fetchLivePreapprovalAmountMajor` is mocked directly (its own real-response
 * behavior is covered by `test/utils/mp-preapproval-amount-lookup.test.ts`).
 * `@repo/service-core`'s `subscriptionMatchesDomain` is the REAL implementation
 * (pure, no I/O) so the product-domain filter is exercised for real rather than
 * re-implemented in a mock.
 *
 * The `@repo/db` double is DISPATCHED ON THE TABLE (HOS-1288) rather than
 * serving one rows array to every query: the service now issues two reads — the
 * plan's `product_domain` and the plan's subscriptions — and a single-chain
 * double would answer both from the same fixture, which is how a scope test
 * ends up vacuous. Every `.where()` argument is also RECORDED, so the tests can
 * assert the plan lookup is scoped to the requested `planId` instead of trusting
 * a mock that ignores its own predicate.
 *
 * Fake timers are used because the service inserts small sleep+jitter delays
 * between subscriptions and between retry attempts (kept realistic in
 * production for MP rate-limit hygiene) — without them these tests would be slow.
 *
 * @module test/services/billing/apply-price-increase.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (must come before importing the service under test)
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Kept unused by the service under test on purpose — see the module doc above
// and the dedicated regression test asserting it is never called.
const mockRetrieve = vi.fn();
const mockUpdate = vi.fn();
const mockCreateMercadoPagoAdapter = vi.fn((..._args: unknown[]) => ({
    subscriptions: { retrieve: mockRetrieve, update: mockUpdate }
}));
vi.mock('@repo/billing', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/billing')>()),
    createMercadoPagoAdapter: (...args: unknown[]) => mockCreateMercadoPagoAdapter(...args)
}));

vi.mock('../../../src/utils/env.js', () => ({
    env: { HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'TEST-token' }
}));

const mockFetchLiveAmount = vi.fn();
vi.mock('../../../src/utils/mp-preapproval-amount-lookup.js', () => ({
    fetchLivePreapprovalAmountMajor: (...args: unknown[]) => mockFetchLiveAmount(...args)
}));

/**
 * Table sentinels — the `from()` argument the double dispatches on.
 *
 * `vi.hoisted` because the `vi.mock('@repo/db', ...)` factory below references
 * them EAGERLY (they are the returned module's own exports), and `vi.mock` is
 * hoisted above every plain `const` in this file.
 */
const { SUBSCRIPTIONS_TABLE, PLANS_TABLE } = vi.hoisted(() => ({
    SUBSCRIPTIONS_TABLE: {
        __table: 'billing_subscriptions',
        id: 'ID',
        planId: 'PLAN_ID',
        status: 'STATUS',
        mpSubscriptionId: 'MP_SUBSCRIPTION_ID',
        promoCodeId: 'PROMO_CODE_ID',
        promoEffectRemainingCycles: 'PROMO_EFFECT_REMAINING_CYCLES',
        productDomain: 'PRODUCT_DOMAIN',
        deletedAt: 'DELETED_AT'
    },
    PLANS_TABLE: {
        __table: 'billing_plans',
        id: 'PLAN_TABLE_ID',
        productDomain: 'PLAN_PRODUCT_DOMAIN'
    }
}));

/** Rows the double returns for the `billing_subscriptions` read. */
const mockSelectRows = vi.fn();
/** Rows the double returns for the `billing_plans` (product-domain) read. */
const mockPlanRows = vi.fn();

/** Every `.where()` the service issued, tagged with the table it ran against. */
const recordedWhere: { table: unknown; condition: unknown }[] = [];
/** Every `.limit()` the service issued, tagged with the table it ran against. */
const recordedLimit: { table: unknown; value: unknown }[] = [];

const mockFrom = vi.fn((table: unknown) => ({
    where: (condition: unknown) => {
        recordedWhere.push({ table, condition });
        return {
            limit: (value: unknown) => {
                recordedLimit.push({ table, value });
                return table === PLANS_TABLE ? mockPlanRows() : mockSelectRows();
            }
        };
    }
}));
const mockDbSelect = vi.fn(() => ({ from: mockFrom }));
const mockGetDb = vi.fn(() => ({ select: mockDbSelect }));

vi.mock('@repo/db', () => ({
    getDb: () => mockGetDb(),
    // Column-object sentinels for the typed select projection + where clause.
    billingSubscriptions: SUBSCRIPTIONS_TABLE,
    billingPlans: PLANS_TABLE,
    eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
    and: (...args: unknown[]) => ({ _and: args }),
    inArray: (a: unknown, b: unknown) => ({ _inArray: [a, b] }),
    isNotNull: (a: unknown) => ({ _isNotNull: a }),
    isNull: (a: unknown) => ({ _isNull: a })
}));

import { ProductDomainEnum } from '@repo/schemas';
import { applyPriceIncreaseToPlanSubscribers } from '../../../src/services/billing/apply-price-increase.service.js';
import { SubscriptionCheckoutError } from '../../../src/services/billing/subscription-checkout-error.js';
import { mapSubscriptionCheckoutErrorToHttp } from '../../../src/services/billing/subscription-checkout-error-http.js';

/** The `limit()` the service applied to the SUBSCRIPTIONS read, ignoring the plan lookup's. */
function subscriptionLimitCalls(): unknown[] {
    return recordedLimit
        .filter((entry) => entry.table === SUBSCRIPTIONS_TABLE)
        .map((entry) => entry.value);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAN_ID = '11111111-1111-1111-1111-111111111111';

/** A row shape matching the typed select projection in the service under test. */
function buildRow(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'sub-1',
        mpSubscriptionId: 'mp-sub-1',
        promoCodeId: null,
        promoEffectRemainingCycles: null,
        productDomain: 'accommodation',
        ...overrides
    };
}

/**
 * `fetchLivePreapprovalAmountMajor` success fixture. This is the boundary the
 * service actually reads from (a raw `GET /preapproval/{id}` response), not
 * `paymentAdapter.subscriptions.retrieve()`'s output — see the module doc.
 */
function buildLiveAmountLookup(transactionAmountMajor: number) {
    return { kind: 'ok' as const, transactionAmountMajor };
}

/**
 * Runs `applyPriceIncreaseToPlanSubscribers` under fake timers, advancing all
 * pending timers (the service's inter-subscription / retry sleeps) until the
 * returned promise settles.
 */
async function runWithFakeTimers(input: Parameters<typeof applyPriceIncreaseToPlanSubscribers>[0]) {
    const resultPromise = applyPriceIncreaseToPlanSubscribers(input);
    await vi.runAllTimersAsync();
    return resultPromise;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    recordedWhere.length = 0;
    recordedLimit.length = 0;
    mockSelectRows.mockResolvedValue([]);
    // Default: the plan under test is an accommodation plan, as every
    // pre-HOS-1288 test implicitly assumed.
    mockPlanRows.mockResolvedValue([{ productDomain: ProductDomainEnum.ACCOMMODATION }]);
    mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));
    mockUpdate.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('applyPriceIncreaseToPlanSubscribers', () => {
    it('returns all-zero result and never constructs the MP adapter when nothing matches', async () => {
        // Arrange
        mockSelectRows.mockResolvedValue([]);

        // Act
        const result = await runWithFakeTimers({ planId: PLAN_ID, newAmountCentavos: 600000 });

        // Assert
        expect(result).toEqual({
            productDomain: ProductDomainEnum.ACCOMMODATION,
            matched: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            details: []
        });
        expect(mockCreateMercadoPagoAdapter).not.toHaveBeenCalled();
    });

    it('dryRun (default) reports would-update subscriptions without calling subscriptions.update', async () => {
        // Arrange: one eligible sub, currently at 5000, target 6000.
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        // Act
        const result = await runWithFakeTimers({ planId: PLAN_ID, newAmountCentavos: 600000 });

        // Assert
        expect(result.matched).toBe(1);
        expect(result.updated).toBe(1);
        expect(result.skipped).toBe(0);
        expect(result.failed).toBe(0);
        expect(result.details).toEqual([
            {
                subscriptionId: 'sub-1',
                mpSubscriptionId: 'mp-sub-1',
                outcome: 'updated',
                reason: 'dry_run'
            }
        ]);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('dryRun: false performs the real mutation and reports updated', async () => {
        // Arrange
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        // Act
        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        // Assert
        expect(result).toEqual({
            productDomain: ProductDomainEnum.ACCOMMODATION,
            matched: 1,
            updated: 1,
            skipped: 0,
            failed: 0,
            details: [{ subscriptionId: 'sub-1', mpSubscriptionId: 'mp-sub-1', outcome: 'updated' }]
        });
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockUpdate).toHaveBeenCalledWith('mp-sub-1', { transactionAmount: 6000 });
    });

    it('skips a subscription with an active forever discount (promoCodeId set, remainingCycles null)', async () => {
        // Arrange
        mockSelectRows.mockResolvedValue([
            buildRow({
                id: 'sub-discount',
                promoCodeId: 'promo-1',
                promoEffectRemainingCycles: null
            })
        ]);

        // Act
        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        // Assert
        expect(result.matched).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.updated).toBe(0);
        expect(result.details).toEqual([
            {
                subscriptionId: 'sub-discount',
                mpSubscriptionId: 'mp-sub-1',
                outcome: 'skipped',
                reason: 'active_discount'
            }
        ]);
        // Never touches MP for a discounted subscription.
        expect(mockFetchLiveAmount).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('skips a subscription with a finite discount that still has cycles remaining', async () => {
        mockSelectRows.mockResolvedValue([
            buildRow({
                id: 'sub-discount-2',
                promoCodeId: 'promo-2',
                promoEffectRemainingCycles: 2
            })
        ]);

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.skipped).toBe(1);
        expect(result.details[0]?.reason).toBe('active_discount');
    });

    it('does NOT skip a subscription whose discount is exhausted (remainingCycles = 0)', async () => {
        mockSelectRows.mockResolvedValue([
            buildRow({ id: 'sub-exhausted', promoCodeId: 'promo-3', promoEffectRemainingCycles: 0 })
        ]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.updated).toBe(1);
        expect(result.skipped).toBe(0);
        expect(mockUpdate).toHaveBeenCalledWith('mp-sub-1', { transactionAmount: 6000 });
    });

    it('skips a subscription already at the target live amount (idempotent re-run)', async () => {
        // Arrange: live amount already matches target (6000).
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(6000));

        // Act
        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        // Assert
        expect(result.matched).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.updated).toBe(0);
        expect(result.details[0]).toMatchObject({
            outcome: 'skipped',
            reason: 'already_at_target'
        });
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('is idempotent across two runs: second run is a full no-op once amounts are applied', async () => {
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        const firstRun = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });
        expect(firstRun.updated).toBe(1);
        expect(mockUpdate).toHaveBeenCalledTimes(1);

        // Second run: live amount now reflects the applied increase.
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(6000));
        const secondRun = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(secondRun.updated).toBe(0);
        expect(secondRun.skipped).toBe(1);
        // Still only ever called once across both runs.
        expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('respects an explicit limit by forwarding it to the subscriptions query builder', async () => {
        mockSelectRows.mockResolvedValue([]);

        await runWithFakeTimers({ planId: PLAN_ID, newAmountCentavos: 600000, limit: 10 });

        expect(subscriptionLimitCalls()).toEqual([10]);
    });

    it('reports a failed outcome when the live-amount lookup errors, without aborting the batch', async () => {
        mockSelectRows.mockResolvedValue([
            buildRow({ id: 'sub-broken', mpSubscriptionId: 'mp-broken' }),
            buildRow({ id: 'sub-ok', mpSubscriptionId: 'mp-ok' })
        ]);
        mockFetchLiveAmount.mockResolvedValueOnce({ kind: 'error', message: 'MP unreachable' });
        mockFetchLiveAmount.mockResolvedValueOnce(buildLiveAmountLookup(5000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.matched).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.updated).toBe(1);
        const brokenDetail = result.details.find((d) => d.subscriptionId === 'sub-broken');
        expect(brokenDetail?.outcome).toBe('failed');
        expect(brokenDetail?.reason).toMatch(/^retrieve_failed:/);
    });

    it('retries the mutation on a transient failure and succeeds', async () => {
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));
        mockUpdate
            .mockRejectedValueOnce(new Error('transient network error'))
            .mockResolvedValueOnce(undefined);

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.updated).toBe(1);
        expect(result.failed).toBe(0);
        expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('reports failed once all mutation retry attempts are exhausted', async () => {
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));
        mockUpdate.mockRejectedValue(new Error('permanent failure'));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.updated).toBe(0);
        expect(result.failed).toBe(1);
        // 1 initial attempt + 2 retries = 3 total (MAX_MUTATION_ATTEMPTS).
        expect(mockUpdate).toHaveBeenCalledTimes(3);
        expect(result.details[0]).toMatchObject({ outcome: 'failed' });
        expect(result.details[0]?.reason).toMatch(/^mutation_failed:/);
    });

    it('uses a longer backoff for a rate-limit-shaped error but still eventually succeeds', async () => {
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));
        const rateLimitError = Object.assign(new Error('Too Many Requests'), {
            code: 'rate_limit_error'
        });
        mockUpdate.mockRejectedValueOnce(rateLimitError).mockResolvedValueOnce(undefined);

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.updated).toBe(1);
        expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('HOS-991 regression: never reads the live amount via paymentAdapter.subscriptions.retrieve()', async () => {
        // Arrange: `mockRetrieve` is programmed with the REAL shape
        // `subscriptions.retrieve()` returns (qzpay-mercadopago's
        // `mapToProviderSubscription` — a closed set of fields, NO
        // `auto_recurring` key at all). If the service ever read the live
        // amount from `retrieve()` again, it could only ever see `null` here,
        // and the idempotent skip would never fire — the exact bug this issue
        // fixes. `fetchLivePreapprovalAmountMajor` (the correct boundary) is
        // programmed with the live amount already matching the target.
        mockSelectRows.mockResolvedValue([buildRow()]);
        mockRetrieve.mockResolvedValue({
            id: 'mp-sub-1',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            cancelAtPeriodEnd: false,
            canceledAt: null,
            trialStart: null,
            trialEnd: null,
            metadata: {}
        });
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(6000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000, // 6000 ARS — matches the live amount above
            dryRun: false
        });

        // The idempotent skip fires because the amount came from the raw GET,
        // never from subscriptions.retrieve() — which was never even called.
        expect(mockRetrieve).not.toHaveBeenCalled();
        expect(mockFetchLiveAmount).toHaveBeenCalledWith({
            preapprovalId: 'mp-sub-1',
            accessToken: 'TEST-token'
        });
        expect(result.skipped).toBe(1);
        expect(result.updated).toBe(0);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// HOS-1288 — the increase applies in every business vertical
// ---------------------------------------------------------------------------

describe('applyPriceIncreaseToPlanSubscribers — product-domain parity (HOS-1288)', () => {
    /**
     * The regression the issue is actually about: before this change the
     * gastronomy branch ended at `isAccommodationSubscription`, which returned
     * `false` for every one of these rows, so the run answered HTTP 200 with
     * `matched: 0` and MOVED NOTHING.
     *
     * Asserting a successful response would have passed against the bug. What
     * this asserts is the MUTATION: `subscriptions.update` reaching MercadoPago
     * with the new amount, for the right preapproval.
     */
    it('MOVES ROWS for a gastronomy plan — the exact case that used to report success and do nothing', async () => {
        // Arrange: a gastronomy PLAN, with two gastronomy subscribers on the old price.
        mockPlanRows.mockResolvedValue([{ productDomain: ProductDomainEnum.GASTRONOMY }]);
        mockSelectRows.mockResolvedValue([
            buildRow({
                id: 'sub-gastro-1',
                mpSubscriptionId: 'mp-gastro-1',
                productDomain: ProductDomainEnum.GASTRONOMY
            }),
            buildRow({
                id: 'sub-gastro-2',
                mpSubscriptionId: 'mp-gastro-2',
                productDomain: ProductDomainEnum.GASTRONOMY
            })
        ]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        // Act
        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        // Assert — the preapprovals were actually mutated, not merely reported.
        expect(mockUpdate).toHaveBeenCalledTimes(2);
        expect(mockUpdate).toHaveBeenCalledWith('mp-gastro-1', { transactionAmount: 6000 });
        expect(mockUpdate).toHaveBeenCalledWith('mp-gastro-2', { transactionAmount: 6000 });
        expect(result.productDomain).toBe(ProductDomainEnum.GASTRONOMY);
        expect(result.matched).toBe(2);
        expect(result.updated).toBe(2);
        expect(result.skipped).toBe(0);
    });

    it.each([
        [ProductDomainEnum.ACCOMMODATION],
        [ProductDomainEnum.GASTRONOMY],
        [ProductDomainEnum.EXPERIENCE],
        [ProductDomainEnum.PARTNER],
        [ProductDomainEnum.TOURIST]
    ])('mutates the preapproval for a %s plan', async (domain) => {
        mockPlanRows.mockResolvedValue([{ productDomain: domain }]);
        mockSelectRows.mockResolvedValue([
            buildRow({
                id: `sub-${domain}`,
                mpSubscriptionId: `mp-${domain}`,
                productDomain: domain
            })
        ]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(mockUpdate).toHaveBeenCalledWith(`mp-${domain}`, { transactionAmount: 6000 });
        expect(result.productDomain).toBe(domain);
        expect(result.updated).toBe(1);
    });

    it('scopes the plan lookup to the requested planId', async () => {
        // The double records `.where()` arguments precisely so this assertion
        // is not a claim about a predicate the double never read.
        mockPlanRows.mockResolvedValue([{ productDomain: ProductDomainEnum.EXPERIENCE }]);
        mockSelectRows.mockResolvedValue([]);

        await runWithFakeTimers({ planId: PLAN_ID, newAmountCentavos: 600000 });

        const planWhere = recordedWhere.filter((entry) => entry.table === PLANS_TABLE);
        expect(planWhere).toHaveLength(1);
        expect(planWhere[0]?.condition).toEqual({ _eq: ['PLAN_TABLE_ID', PLAN_ID] });
    });

    /**
     * The dual-role owner: a host auto-promoted from tourist, or a host who
     * also runs a restaurant, holds two subscriptions. Their gastronomy row
     * must never be swept into an accommodation plan's increase — and, just as
     * importantly, must not VANISH from the report, which is how a stray row
     * stayed invisible before.
     */
    it('reports a row whose own domain contradicts its plan instead of dropping it, and never mutates it', async () => {
        mockPlanRows.mockResolvedValue([{ productDomain: ProductDomainEnum.ACCOMMODATION }]);
        mockSelectRows.mockResolvedValue([
            buildRow({
                id: 'sub-accom',
                mpSubscriptionId: 'mp-accom',
                productDomain: ProductDomainEnum.ACCOMMODATION
            }),
            buildRow({
                id: 'sub-gastro',
                mpSubscriptionId: 'mp-gastro',
                productDomain: ProductDomainEnum.GASTRONOMY
            })
        ]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.matched).toBe(2);
        expect(result.updated).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.details).toContainEqual({
            subscriptionId: 'sub-gastro',
            mpSubscriptionId: 'mp-gastro',
            outcome: 'skipped',
            reason: 'domain_mismatch'
        });
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockUpdate).toHaveBeenCalledWith('mp-accom', { transactionAmount: 6000 });
    });

    /**
     * A legacy row (`product_domain IS NULL`) reads as accommodation, so under
     * a gastronomy plan it fails CLOSED — the safe direction. It must still be
     * reported rather than silently filtered.
     */
    it('fails closed on a NULL-domain row under a non-accommodation plan, and still reports it', async () => {
        mockPlanRows.mockResolvedValue([{ productDomain: ProductDomainEnum.EXPERIENCE }]);
        mockSelectRows.mockResolvedValue([
            buildRow({ id: 'sub-legacy', mpSubscriptionId: 'mp-legacy', productDomain: null })
        ]);

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.matched).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.updated).toBe(0);
        expect(result.details[0]).toMatchObject({ reason: 'domain_mismatch' });
        expect(mockUpdate).not.toHaveBeenCalled();
        // No eligible row means the MP adapter is never even constructed.
        expect(mockCreateMercadoPagoAdapter).not.toHaveBeenCalled();
    });

    it('a NULL-domain plan row is still accommodation (legacy plan rows keep working)', async () => {
        mockPlanRows.mockResolvedValue([{ productDomain: null }]);
        mockSelectRows.mockResolvedValue([
            buildRow({ id: 'sub-legacy', mpSubscriptionId: 'mp-legacy', productDomain: null })
        ]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.productDomain).toBe(ProductDomainEnum.ACCOMMODATION);
        expect(result.updated).toBe(1);
        expect(mockUpdate).toHaveBeenCalledWith('mp-legacy', { transactionAmount: 6000 });
    });
});

// ---------------------------------------------------------------------------
// HOS-1288 — the unsupported cases are LOUD, never a 200 with zero rows
// ---------------------------------------------------------------------------

describe('applyPriceIncreaseToPlanSubscribers — loud refusals (HOS-1288)', () => {
    it('throws PLAN_NOT_FOUND for an unknown planId, before reading any subscription', async () => {
        mockPlanRows.mockResolvedValue([]);

        // Called directly, not through `runWithFakeTimers`: the refusal happens
        // before any sleep, so there is no timer to advance.
        await expect(
            applyPriceIncreaseToPlanSubscribers({ planId: PLAN_ID, newAmountCentavos: 600000 })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });

        // Nothing was queried or constructed past the refusal.
        expect(recordedWhere.some((entry) => entry.table === SUBSCRIPTIONS_TABLE)).toBe(false);
        expect(mockCreateMercadoPagoAdapter).not.toHaveBeenCalled();
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('throws PLAN_DOMAIN_MISMATCH for a plan outside the business verticals (addon)', async () => {
        mockPlanRows.mockResolvedValue([{ productDomain: ProductDomainEnum.ADDON }]);
        mockSelectRows.mockResolvedValue([
            buildRow({ id: 'sub-addon', productDomain: ProductDomainEnum.ADDON })
        ]);

        await expect(
            applyPriceIncreaseToPlanSubscribers({
                planId: PLAN_ID,
                newAmountCentavos: 600000,
                dryRun: false
            })
        ).rejects.toMatchObject({ code: 'PLAN_DOMAIN_MISMATCH' });

        expect(recordedWhere.some((entry) => entry.table === SUBSCRIPTIONS_TABLE)).toBe(false);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    /**
     * The refusals only count as "loud" if the route turns them into 4xx. The
     * mapping is the shared `mapSubscriptionCheckoutErrorToHttp`, which the
     * route calls verbatim — asserted here so the service's codes and the HTTP
     * statuses this issue promises cannot drift apart in separate files.
     */
    it('maps both refusal codes to 4xx, never to a 200 or a 500', () => {
        expect(
            mapSubscriptionCheckoutErrorToHttp(
                new SubscriptionCheckoutError('PLAN_NOT_FOUND', 'no such plan')
            ).status
        ).toBe(404);
        expect(
            mapSubscriptionCheckoutErrorToHttp(
                new SubscriptionCheckoutError('PLAN_DOMAIN_MISMATCH', 'not a vertical')
            ).status
        ).toBe(422);
    });
});

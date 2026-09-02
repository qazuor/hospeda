/**
 * Unit tests for applyPriceIncreaseToPlanSubscribers (HOS-191 F6).
 *
 * Covers the manual per-subscription price-increase mechanism:
 *  - matched/updated/skipped/failed counts and per-row detail reporting
 *  - dryRun (default true) never calls subscriptions.update
 *  - active-discount subscriptions are skipped, never overwritten
 *  - subscriptions already at the target live amount are skipped (idempotency)
 *  - re-running after a successful apply is a full no-op (idempotent)
 *  - commerce/partner product-domain subscriptions are excluded from `matched`
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
 * select chain is mocked at the smallest boundary (select().from().where().limit()
 * resolves a per-test-programmable rows array), `@repo/billing`'s
 * `createMercadoPagoAdapter` returns a stub adapter with a per-test-programmable
 * `subscriptions.update`, and `mp-preapproval-amount-lookup.js`'s
 * `fetchLivePreapprovalAmountMajor` is mocked directly (its own real-response
 * behavior is covered by `test/utils/mp-preapproval-amount-lookup.test.ts`).
 * `@repo/service-core`'s `isAccommodationSubscription` is the REAL implementation
 * (pure, no I/O) so the product-domain filter is exercised for real rather than
 * re-implemented in a mock.
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

const mockSelectRows = vi.fn();
const mockLimit = vi.fn((..._args: unknown[]) => mockSelectRows());
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockDbSelect = vi.fn(() => ({ from: mockFrom }));
const mockGetDb = vi.fn(() => ({ select: mockDbSelect }));

vi.mock('@repo/db', () => ({
    getDb: () => mockGetDb(),
    // Column-object sentinels for the typed select projection + where clause.
    billingSubscriptions: {
        id: 'ID',
        planId: 'PLAN_ID',
        status: 'STATUS',
        mpSubscriptionId: 'MP_SUBSCRIPTION_ID',
        promoCodeId: 'PROMO_CODE_ID',
        promoEffectRemainingCycles: 'PROMO_EFFECT_REMAINING_CYCLES',
        productDomain: 'PRODUCT_DOMAIN',
        deletedAt: 'DELETED_AT'
    },
    eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
    and: (...args: unknown[]) => ({ _and: args }),
    inArray: (a: unknown, b: unknown) => ({ _inArray: [a, b] }),
    isNotNull: (a: unknown) => ({ _isNotNull: a }),
    isNull: (a: unknown) => ({ _isNull: a })
}));

import { applyPriceIncreaseToPlanSubscribers } from '../../../src/services/billing/apply-price-increase.service.js';

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
    mockSelectRows.mockResolvedValue([]);
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
        expect(result).toEqual({ matched: 0, updated: 0, skipped: 0, failed: 0, details: [] });
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

    it('excludes commerce-domain subscriptions from matched (isAccommodationSubscription filter)', async () => {
        mockSelectRows.mockResolvedValue([
            buildRow({ id: 'sub-accom', productDomain: 'accommodation' }),
            buildRow({
                id: 'sub-commerce',
                mpSubscriptionId: 'mp-sub-2',
                productDomain: 'commerce'
            })
        ]);
        mockFetchLiveAmount.mockResolvedValue(buildLiveAmountLookup(5000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.matched).toBe(1);
        expect(result.details).toHaveLength(1);
        expect(result.details[0]?.subscriptionId).toBe('sub-accom');
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

    it('respects an explicit limit by forwarding it to the query builder', async () => {
        mockSelectRows.mockResolvedValue([]);

        await runWithFakeTimers({ planId: PLAN_ID, newAmountCentavos: 600000, limit: 10 });

        expect(mockLimit).toHaveBeenCalledWith(10);
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

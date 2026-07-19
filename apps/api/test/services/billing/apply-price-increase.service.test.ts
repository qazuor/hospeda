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
 *  - retrieve failure → outcome 'failed', does not abort the batch
 *  - mutation retry: transient failure then success → 'updated'
 *  - mutation exhausts retries → 'failed'
 *
 * Mocking strategy mirrors `subscription-poll.job.test.ts`: `@repo/db`'s typed
 * select chain is mocked at the smallest boundary (select().from().where().limit()
 * resolves a per-test-programmable rows array), and `@repo/billing`'s
 * `createMercadoPagoAdapter` returns a stub adapter with per-test-programmable
 * `subscriptions.retrieve` / `subscriptions.update`. `@repo/service-core`'s
 * `isAccommodationSubscription` is the REAL implementation (pure, no I/O) so the
 * product-domain filter is exercised for real rather than re-implemented in a mock.
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

const mockRetrieve = vi.fn();
const mockUpdate = vi.fn();
const mockCreateMercadoPagoAdapter = vi.fn((..._args: unknown[]) => ({
    subscriptions: { retrieve: mockRetrieve, update: mockUpdate }
}));
vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: (...args: unknown[]) => mockCreateMercadoPagoAdapter(...args)
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

/** Live MP preapproval fixture with `auto_recurring.transaction_amount`. */
function buildLivePreapproval(transactionAmountMajor: number) {
    return { auto_recurring: { transaction_amount: transactionAmountMajor } };
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
    mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));
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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));

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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));

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
        expect(mockRetrieve).not.toHaveBeenCalled();
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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));

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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(6000));

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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));

        const firstRun = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });
        expect(firstRun.updated).toBe(1);
        expect(mockUpdate).toHaveBeenCalledTimes(1);

        // Second run: live amount now reflects the applied increase.
        mockRetrieve.mockResolvedValue(buildLivePreapproval(6000));
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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));

        const result = await runWithFakeTimers({
            planId: PLAN_ID,
            newAmountCentavos: 600000,
            dryRun: false
        });

        expect(result.matched).toBe(1);
        expect(result.details).toHaveLength(1);
        expect(result.details[0]?.subscriptionId).toBe('sub-accom');
    });

    it('reports a failed outcome when retrieving the live preapproval throws, without aborting the batch', async () => {
        mockSelectRows.mockResolvedValue([
            buildRow({ id: 'sub-broken', mpSubscriptionId: 'mp-broken' }),
            buildRow({ id: 'sub-ok', mpSubscriptionId: 'mp-ok' })
        ]);
        mockRetrieve.mockImplementationOnce(() => Promise.reject(new Error('MP unreachable')));
        mockRetrieve.mockResolvedValueOnce(buildLivePreapproval(5000));

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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));
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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));
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
        mockRetrieve.mockResolvedValue(buildLivePreapproval(5000));
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
});

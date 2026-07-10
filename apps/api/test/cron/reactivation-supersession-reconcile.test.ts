/**
 * Unit Tests: reactivation-supersession-reconcile cron job (HOS-114 T-016,
 * second adversarial-review pass).
 *
 * The job's own responsibility is narrow: find candidate `(N, S)` pairs
 * (active `N` carrying a `supersedesSubscriptionId` marker) and skip ones
 * already audited, cheaply, BEFORE paying for the shared, provider-consulting
 * `completeSupersessionPairing` (mocked here) — see
 * `test/services/billing/reactivation-supersession-complete.test.ts` for
 * coverage of that logic itself, including the provider-vs-local re-verify
 * branching and the terminal ALLOW-list.
 *
 * Coverage:
 * 1. Matured orphan → completeSupersessionPairing called, corrected, and
 *    clearEntitlementCache fires exactly once for the customer (INV-1).
 * 2. LAPSED-flow orphan regression (blocker fix): a candidate whose
 *    superseded subscription is LOCALLY `canceled` (not active/trialing) is
 *    STILL passed to completeSupersessionPairing — the old local-status
 *    pre-gate that used to skip this case entirely is gone.
 * 3. Already-correctly-superseded (audit row exists) → left alone, no call.
 * 4. Plain subscription with no supersessor metadata → untouched.
 * 5. Idempotent across repeated runs (second run sees the audit row and skips).
 * 6. Dry-run mode → counts without calling the shared completion function.
 * 7. Billing not configured → skips entirely.
 * 8. MercadoPago adapter construction failure → skips gracefully.
 * 9. Multiple comma-joined superseded ids on one candidate row.
 * 10. `cancel-did-not-take` / `error` outcomes counted as errors, not
 *     corrected, and do NOT clear the entitlement cache.
 *
 * @module test/cron/reactivation-supersession-reconcile
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before vi.mock() factories reference them
// ---------------------------------------------------------------------------

const {
    mockGetQZPayBilling,
    mockCompleteSupersessionPairing,
    mockDbSelect,
    mockCreateMercadoPagoAdapter,
    mockClearEntitlementCache
} = vi.hoisted(() => ({
    mockGetQZPayBilling: vi.fn(),
    mockCompleteSupersessionPairing: vi.fn(),
    mockDbSelect: vi.fn(),
    mockCreateMercadoPagoAdapter: vi.fn(),
    mockClearEntitlementCache: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    billingSubscriptions: {
        id: 'id',
        status: 'status',
        customerId: 'customer_id',
        planId: 'plan_id',
        metadata: 'metadata',
        deletedAt: 'deleted_at'
    },
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'subscription_id',
        metadata: 'metadata'
    },
    getDb: vi.fn(() => ({ select: mockDbSelect })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col }))
}));

vi.mock('@repo/schemas', () => ({
    SubscriptionStatusEnum: {
        ACTIVE: 'active',
        TRIALING: 'trialing',
        CANCELLED: 'cancelled',
        EXPIRED: 'expired'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: { strings, values } })
}));

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: mockCreateMercadoPagoAdapter
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: {}
}));

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

vi.mock('../../src/services/billing/reactivation-supersession-complete.js', () => ({
    completeSupersessionPairing: mockCompleteSupersessionPairing
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { reactivationSupersessionReconcileJob } from '../../src/cron/jobs/reactivation-supersession-reconcile.job';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal CronJobContext for tests. */
function buildCtx(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        } as unknown as CronJobContext['logger'],
        startedAt: new Date('2026-07-10T06:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

/**
 * A `.where()` result that is BOTH directly awaitable (the candidate query,
 * which never calls `.limit()`) AND supports `.limit()` (the per-pairing
 * audit-row peek). Built from a real `Promise` (not a hand-rolled thenable
 * object literal, which biome's `noThenProperty` rule flags) with `.limit`
 * attached as an extra property.
 */
function makeWhereResult(
    rows: unknown[]
): Promise<unknown[]> & { limit: ReturnType<typeof vi.fn> } {
    const promise = Promise.resolve(rows) as Promise<unknown[]> & {
        limit: ReturnType<typeof vi.fn>;
    };
    promise.limit = vi.fn().mockResolvedValue(rows);
    return promise;
}

/**
 * Queues `db.select()` call results in the exact order the handler issues
 * them: [0] = the candidate-subscriptions query (awaited directly via
 * `.where()`, no `.limit()`), then one entry per subsequent
 * `.select().from().where().limit()` audit-row peek call, in order.
 */
function queueSelectResults(resultsInCallOrder: unknown[][]): void {
    let call = 0;
    mockDbSelect.mockImplementation(() => {
        const rows = resultsInCallOrder[call] ?? [];
        call++;
        return {
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue(makeWhereResult(rows))
            })
        };
    });
}

describe('reactivation-supersession-reconcile cron job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQZPayBilling.mockReturnValue({ subscriptions: {} });
        mockCreateMercadoPagoAdapter.mockReturnValue({ subscriptions: { retrieve: vi.fn() } });
    });

    describe('job metadata', () => {
        it('has the expected name, hourly schedule, and timeout', () => {
            expect(reactivationSupersessionReconcileJob.name).toBe(
                'reactivation-supersession-reconcile'
            );
            expect(reactivationSupersessionReconcileJob.schedule).toBe('0 * * * *');
            expect(reactivationSupersessionReconcileJob.enabled).toBe(true);
            expect(reactivationSupersessionReconcileJob.timeoutMs).toBe(600_000);
        });
    });

    describe('billing not configured', () => {
        it('skips entirely without querying the DB', async () => {
            mockGetQZPayBilling.mockReturnValue(null);

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockDbSelect).not.toHaveBeenCalled();
            expect(mockCompleteSupersessionPairing).not.toHaveBeenCalled();
            expect(mockCreateMercadoPagoAdapter).not.toHaveBeenCalled();
        });
    });

    describe('MercadoPago adapter construction failure', () => {
        it('skips gracefully without querying the DB', async () => {
            mockCreateMercadoPagoAdapter.mockImplementation(() => {
                throw new Error('missing access token');
            });

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockDbSelect).not.toHaveBeenCalled();
            expect(mockCompleteSupersessionPairing).not.toHaveBeenCalled();
        });
    });

    describe('matured orphan (active supersessor, superseded still active, no audit)', () => {
        it('calls completeSupersessionPairing, counts it as corrected, and clears the entitlement cache once (INV-1)', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-001',
                        customerId: 'cust-001',
                        planId: 'plan-001',
                        metadata: {
                            supersedesSubscriptionId: 'sub-old-001',
                            convertedFromTrial: 'true'
                        }
                    }
                ],
                [] // audit peek: none found
            ]);
            mockCompleteSupersessionPairing.mockResolvedValue('completed');

            const ctx = buildCtx();
            const result = await reactivationSupersessionReconcileJob.handler(ctx);

            expect(result.success).toBe(true);
            expect(mockCompleteSupersessionPairing).toHaveBeenCalledOnce();
            expect(mockCompleteSupersessionPairing).toHaveBeenCalledWith(
                expect.objectContaining({
                    newSubscription: {
                        id: 'sub-new-001',
                        customerId: 'cust-001',
                        planId: 'plan-001'
                    },
                    supersededId: 'sub-old-001',
                    triggerSource: 'trial-reactivation',
                    providerEventId: 'reactivation-supersession-reconcile-cron',
                    source: 'reactivation-supersession-reconcile'
                })
            );
            expect(result.details).toMatchObject({ checkedPairs: 1, corrected: 1, errors: 0 });
            // INV-1: a money-mutating cancel via this cron path must clear
            // the customer's entitlement cache.
            expect(mockClearEntitlementCache).toHaveBeenCalledTimes(1);
            expect(mockClearEntitlementCache).toHaveBeenCalledWith('cust-001');
            // The cron itself raises an actionable signal on every completion —
            // finding an orphan means the webhook path failed upstream.
            expect(ctx.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('completed an orphaned pairing'),
                expect.objectContaining({
                    newSubscriptionId: 'sub-new-001',
                    supersededId: 'sub-old-001'
                }),
                { capture: true }
            );
        });
    });

    describe('BLOCKER regression: lapsed-flow orphan (superseded sub locally "canceled")', () => {
        it('still calls completeSupersessionPairing — no local-status pre-gate skips it', async () => {
            // The old (buggy) version required the superseded subscription's
            // LOCAL status to be active/trialing before even attempting a
            // reconcile. The lapsed-reactivation flow supersedes a
            // subscription that is ALREADY `canceled` locally by definition
            // — that pre-gate silently skipped every lapsed-flow orphan
            // forever. This test proves the gate is gone: the cron must pass
            // this pairing to completeSupersessionPairing regardless of the
            // superseded sub's local status (which the shared function's own
            // provider-consulting re-verify — not this cron — decides).
            queueSelectResults([
                [
                    {
                        id: 'sub-new-lapsed',
                        customerId: 'cust-lapsed',
                        planId: 'plan-001',
                        metadata: {
                            reactivatedFromCanceled: 'true',
                            supersedesSubscriptionId: 'sub-old-lapsed'
                        }
                    }
                ],
                [] // audit peek: none found — genuinely orphaned
            ]);
            mockCompleteSupersessionPairing.mockResolvedValue('completed');

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockCompleteSupersessionPairing).toHaveBeenCalledOnce();
            expect(mockCompleteSupersessionPairing).toHaveBeenCalledWith(
                expect.objectContaining({
                    supersededId: 'sub-old-lapsed',
                    triggerSource: 'subscription-reactivation'
                })
            );
            // No superseded-row status lookup happens in the cron anymore —
            // only the audit peek plus a paymentAdapter/db handed to the
            // shared function, which decides provider-vs-local itself.
            expect(mockDbSelect).toHaveBeenCalledTimes(2);
            expect(result.details).toMatchObject({ corrected: 1 });
        });
    });

    describe('already-correctly-superseded (audit row exists)', () => {
        it('leaves the pairing alone without calling completeSupersessionPairing', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-002',
                        customerId: 'cust-002',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-002' }
                    }
                ],
                [{ id: 'existing-audit-row' }] // audit peek: found
            ]);

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockCompleteSupersessionPairing).not.toHaveBeenCalled();
            expect(mockClearEntitlementCache).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({ checkedPairs: 1, corrected: 0, errors: 0 });
        });
    });

    describe('plain subscription with no supersessor metadata', () => {
        it('is untouched — no per-pairing DB call at all', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-plain-001',
                        customerId: 'cust-003',
                        planId: 'plan-001',
                        metadata: {}
                    }
                ]
            ]);

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockCompleteSupersessionPairing).not.toHaveBeenCalled();
            // Only the candidate query ran — no per-pairing audit peek.
            expect(mockDbSelect).toHaveBeenCalledTimes(1);
            expect(result.details).toMatchObject({ checkedPairs: 0, corrected: 0 });
        });
    });

    describe('multiple comma-joined superseded ids on one candidate row', () => {
        it('processes each id independently', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-multi',
                        customerId: 'cust-004',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-a, sub-old-b' }
                    }
                ],
                [], // audit peek for sub-old-a: none
                [] // audit peek for sub-old-b: none
            ]);
            mockCompleteSupersessionPairing.mockResolvedValue('completed');

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockCompleteSupersessionPairing).toHaveBeenCalledTimes(2);
            expect(mockCompleteSupersessionPairing).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ supersededId: 'sub-old-a' })
            );
            expect(mockCompleteSupersessionPairing).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ supersededId: 'sub-old-b' })
            );
            expect(result.details).toMatchObject({ checkedPairs: 2, corrected: 2 });
            expect(mockClearEntitlementCache).toHaveBeenCalledTimes(2);
        });
    });

    describe('outcome counting', () => {
        it('counts "cancel-did-not-take" as an error, not a correction, and does NOT clear the cache', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-005',
                        customerId: 'cust-005',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-005' }
                    }
                ],
                []
            ]);
            mockCompleteSupersessionPairing.mockResolvedValue('cancel-did-not-take');

            const ctx = buildCtx();
            const result = await reactivationSupersessionReconcileJob.handler(ctx);

            expect(result.success).toBe(true);
            expect(result.details).toMatchObject({ checkedPairs: 1, corrected: 0, errors: 1 });
            expect(mockClearEntitlementCache).not.toHaveBeenCalled();
            // No "completed an orphaned pairing" signal when it wasn't actually completed.
            expect(ctx.logger.error).not.toHaveBeenCalledWith(
                expect.stringContaining('completed an orphaned pairing'),
                expect.anything(),
                expect.anything()
            );
        });

        it('counts "error" as an error, not a correction', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-006',
                        customerId: 'cust-006',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-006' }
                    }
                ],
                []
            ]);
            mockCompleteSupersessionPairing.mockResolvedValue('error');

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.details).toMatchObject({ checkedPairs: 1, corrected: 0, errors: 1 });
            expect(mockClearEntitlementCache).not.toHaveBeenCalled();
        });

        it('does not count "already-audited" as an error or a correction', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-007',
                        customerId: 'cust-007',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-007' }
                    }
                ],
                []
            ]);
            mockCompleteSupersessionPairing.mockResolvedValue('already-audited');

            const result = await reactivationSupersessionReconcileJob.handler(buildCtx());

            expect(result.details).toMatchObject({ checkedPairs: 1, corrected: 0, errors: 0 });
        });
    });

    describe('dry-run mode', () => {
        it('counts an orphan without calling completeSupersessionPairing', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-dry',
                        customerId: 'cust-dry',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-dry' }
                    }
                ],
                [] // audit peek: none found
            ]);

            const result = await reactivationSupersessionReconcileJob.handler(
                buildCtx({ dryRun: true })
            );

            expect(result.success).toBe(true);
            expect(mockCompleteSupersessionPairing).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({ corrected: 1, dryRun: true });
            expect(result.message).toMatch(/dry run/i);
        });

        it('does not count a pairing whose audit row already exists', async () => {
            queueSelectResults([
                [
                    {
                        id: 'sub-new-dry2',
                        customerId: 'cust-dry2',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-dry2' }
                    }
                ],
                [{ id: 'existing-audit-row' }] // audit peek: found
            ]);

            const result = await reactivationSupersessionReconcileJob.handler(
                buildCtx({ dryRun: true })
            );

            expect(result.success).toBe(true);
            expect(result.details).toMatchObject({ corrected: 0, dryRun: true });
        });
    });

    describe('idempotent across repeated runs', () => {
        it('a fixed pairing is no longer selected on the next run', async () => {
            // First run: orphan detected and corrected.
            queueSelectResults([
                [
                    {
                        id: 'sub-new-idem',
                        customerId: 'cust-idem',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-idem' }
                    }
                ],
                []
            ]);
            mockCompleteSupersessionPairing.mockResolvedValue('completed');

            const firstResult = await reactivationSupersessionReconcileJob.handler(buildCtx());
            expect(firstResult.details).toMatchObject({ corrected: 1 });
            expect(mockCompleteSupersessionPairing).toHaveBeenCalledTimes(1);

            // Second run: the audit row now exists (the real-world effect of
            // the first run's completion) — the cheap audit-peek skips it
            // before ever calling the shared function again.
            vi.clearAllMocks();
            mockGetQZPayBilling.mockReturnValue({ subscriptions: {} });
            mockCreateMercadoPagoAdapter.mockReturnValue({ subscriptions: { retrieve: vi.fn() } });
            queueSelectResults([
                [
                    {
                        id: 'sub-new-idem',
                        customerId: 'cust-idem',
                        planId: 'plan-001',
                        metadata: { supersedesSubscriptionId: 'sub-old-idem' }
                    }
                ],
                [{ id: 'evt-written-by-first-run' }]
            ]);

            const secondResult = await reactivationSupersessionReconcileJob.handler(buildCtx());
            expect(secondResult.details).toMatchObject({ corrected: 0 });
            expect(mockCompleteSupersessionPairing).not.toHaveBeenCalled();
        });
    });
});

/**
 * Unit tests for the finalize-cancelled-subs cron job (SPEC-147 T-009).
 *
 * RED-FIRST: these tests are written before the implementation. They will
 * fail until `apps/api/src/cron/jobs/finalize-cancelled-subs.ts` is created.
 *
 * Coverage:
 * - Happy path: due soft-cancelled sub → status flipped to 'cancelled' +
 *   addons revoked + entitlement cache cleared + FINALIZE_CANCELLED_SUB event
 *   + result.success true.
 * - Not-yet-due (current_period_end in future) → skipped (zero processed).
 * - Already-cancelled (idempotent re-run) → skipped (zero processed).
 * - Billing not configured → skipped gracefully, success true.
 * - Addon revocation failure → that sub result.success false; loop continues
 *   for other subs (one bad sub doesn't block the rest).
 * - Status-transition guard failure → sub skipped, result.success false.
 * - Due-query failure → result.success false, durationMs present.
 * - Dry-run: lists ids without mutating.
 *
 * @module test/cron/finalize-cancelled-subs
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------

const {
    mockHandleSubscriptionCancellationAddons,
    mockClearEntitlementCache,
    mockGetQZPayBilling,
    mockDbInsert,
    mockDbUpdate,
    mockDbSelectChain,
    mockValidateTransition
} = vi.hoisted(() => ({
    mockHandleSubscriptionCancellationAddons: vi.fn(),
    mockClearEntitlementCache: vi.fn(),
    mockGetQZPayBilling: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbSelectChain: vi.fn(),
    mockValidateTransition: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks (before imports)
// ---------------------------------------------------------------------------

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

vi.mock('../../src/services/addon-lifecycle-cancellation.service.js', () => ({
    handleSubscriptionCancellationAddons: mockHandleSubscriptionCancellationAddons
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        validateSubscriptionStatusTransition: mockValidateTransition
    };
});

// Drizzle DB mock: select chain returns rows fed by `dueRowsState`.
// The update and insert chains are stubs that resolve immediately.
const dueRowsState: { rows: DueRow[] } = { rows: [] };

interface DueRow {
    id: string;
    customerId: string;
    status: string;
}

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    function makeSelectChain() {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => dueRowsState.rows
        };
        return chain;
    }

    const insertValuesStub = { values: vi.fn().mockResolvedValue([]) };
    mockDbInsert.mockReturnValue(insertValuesStub);

    const updateSetStub = {
        set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
        })
    };
    mockDbUpdate.mockReturnValue(updateSetStub);

    mockDbSelectChain.mockImplementation(makeSelectChain);

    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockDbSelectChain,
            update: mockDbUpdate,
            insert: mockDbInsert
        })),
        billingSubscriptions: {
            id: 'ID',
            customerId: 'CUSTOMER_ID',
            status: 'STATUS',
            cancelAtPeriodEnd: 'CANCEL_AT_PERIOD_END',
            currentPeriodEnd: 'CURRENT_PERIOD_END',
            deletedAt: 'DELETED_AT',
            updatedAt: 'UPDATED_AT'
        },
        billingSubscriptionEvents: { _table: 'billing_subscription_events' },
        eq: vi.fn((col, val) => ({ _eq: [col, val] })),
        and: vi.fn((...args) => ({ _and: args })),
        lte: vi.fn((col, val) => ({ _lte: [col, val] })),
        isNull: vi.fn((col) => ({ _isNull: col })),
        sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
            _sql: { strings, values }
        }))
    };
});

// ---------------------------------------------------------------------------
// Import under test (after mocks are set up)
// ---------------------------------------------------------------------------

import {
    _internals,
    finalizeCancelledSubsJob
} from '../../src/cron/jobs/finalize-cancelled-subs.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUB_ID_1 = 'sub-aaa-111';
const SUB_ID_2 = 'sub-bbb-222';
const CUSTOMER_ID_1 = 'cust-aaa-111';
const CUSTOMER_ID_2 = 'cust-bbb-222';

/** Returns a minimal CronJobContext for the handler. */
function makeCronCtx(dryRun = false) {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        startedAt: new Date(),
        dryRun
    };
}

/** Returns a mock billing instance (minimal shape used by finalize). */
function makeBilling() {
    return {
        customers: { get: vi.fn().mockResolvedValue(null) }
    };
}

/** Returns a due soft-cancelled subscription row. */
function makeDueRow(overrides: Partial<DueRow> = {}): DueRow {
    return {
        id: SUB_ID_1,
        customerId: CUSTOMER_ID_1,
        status: 'active',
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
    dueRowsState.rows = [];

    // Reset all spies (clears call history and removes mockReturnValue/mockResolvedValue
    // set in previous tests, then re-set defaults).
    mockGetQZPayBilling.mockReset();
    mockValidateTransition.mockReset();
    mockHandleSubscriptionCancellationAddons.mockReset();
    mockClearEntitlementCache.mockReset();
    mockDbInsert.mockReset();
    mockDbUpdate.mockReset();
    mockDbSelectChain.mockReset();

    // Re-set defaults after reset
    mockGetQZPayBilling.mockReturnValue(makeBilling());
    mockValidateTransition.mockImplementation(() => undefined); // no throw = valid
    mockHandleSubscriptionCancellationAddons.mockResolvedValue({
        subscriptionId: SUB_ID_1,
        customerId: CUSTOMER_ID_1,
        totalProcessed: 0,
        succeeded: [],
        failed: [],
        elapsedMs: 10
    });
    mockClearEntitlementCache.mockImplementation(() => undefined);

    // Rebuild insert and update return values
    const insertValuesStub = { values: vi.fn().mockResolvedValue([]) };
    mockDbInsert.mockReturnValue(insertValuesStub);

    const whereStub = vi.fn().mockResolvedValue([]);
    const setStub = vi.fn().mockReturnValue({ where: whereStub });
    mockDbUpdate.mockReturnValue({ set: setStub });

    const makeSelectChain = () => {
        const chain = {
            from: () => chain,
            where: () => chain,
            limit: async () => dueRowsState.rows
        };
        return chain;
    };
    mockDbSelectChain.mockImplementation(makeSelectChain);
});

// ---------------------------------------------------------------------------
// Job definition shape
// ---------------------------------------------------------------------------

describe('finalizeCancelledSubsJob definition', () => {
    it('has the correct name', () => {
        expect(finalizeCancelledSubsJob.name).toBe('finalize-cancelled-subs');
    });

    it('is scheduled at 30 4 * * * (4:30 AM, avoids the occupied 3 AM slot)', () => {
        expect(finalizeCancelledSubsJob.schedule).toBe('30 4 * * *');
    });

    it('is enabled', () => {
        expect(finalizeCancelledSubsJob.enabled).toBe(true);
    });

    it('has a timeout set', () => {
        expect(typeof finalizeCancelledSubsJob.timeoutMs).toBe('number');
        expect(finalizeCancelledSubsJob.timeoutMs).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

describe('_internals', () => {
    it('exports MAX_ROWS_PER_TICK constant', () => {
        expect(typeof _internals.MAX_ROWS_PER_TICK).toBe('number');
        expect(_internals.MAX_ROWS_PER_TICK).toBeGreaterThan(0);
    });

    it('exports findDueSoftCancelledSubs function', () => {
        expect(typeof _internals.findDueSoftCancelledSubs).toBe('function');
    });

    it('exports finalizeOne function', () => {
        expect(typeof _internals.finalizeOne).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// Billing not configured
// ---------------------------------------------------------------------------

describe('handler: billing not configured', () => {
    it('returns success=true and skips when billing is null', async () => {
        mockGetQZPayBilling.mockReturnValue(null);

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(typeof result.durationMs).toBe('number');
    });
});

// ---------------------------------------------------------------------------
// Happy path: due subscription finalized
// ---------------------------------------------------------------------------

describe('handler: happy path — due soft-cancelled sub', () => {
    it('processes a due sub: flips status, revokes addons, clears cache, writes event', async () => {
        dueRowsState.rows = [makeDueRow()];

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);

        // Status flip via drizzle update
        expect(mockDbUpdate).toHaveBeenCalled();

        // Addon revocation
        expect(mockHandleSubscriptionCancellationAddons).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: SUB_ID_1,
                customerId: CUSTOMER_ID_1
            })
        );

        // Entitlement cache cleared
        expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID_1);

        // FINALIZE event written
        expect(mockDbInsert).toHaveBeenCalled();
        const insertArgs = mockDbInsert.mock.calls[0];
        expect(insertArgs).toBeDefined();
    });

    it('validates the active→cancelled transition via state machine', async () => {
        dueRowsState.rows = [makeDueRow()];

        const ctx = makeCronCtx();
        await finalizeCancelledSubsJob.handler(ctx);

        expect(mockValidateTransition).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'active',
                to: 'cancelled'
            })
        );
    });

    it('processes multiple due subs in a single tick', async () => {
        dueRowsState.rows = [
            makeDueRow({ id: SUB_ID_1, customerId: CUSTOMER_ID_1 }),
            makeDueRow({ id: SUB_ID_2, customerId: CUSTOMER_ID_2 })
        ];
        mockHandleSubscriptionCancellationAddons
            .mockResolvedValueOnce({
                subscriptionId: SUB_ID_1,
                customerId: CUSTOMER_ID_1,
                totalProcessed: 0,
                succeeded: [],
                failed: [],
                elapsedMs: 10
            })
            .mockResolvedValueOnce({
                subscriptionId: SUB_ID_2,
                customerId: CUSTOMER_ID_2,
                totalProcessed: 0,
                succeeded: [],
                failed: [],
                elapsedMs: 10
            });

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(result.errors).toBe(0);
        expect(mockClearEntitlementCache).toHaveBeenCalledTimes(2);
    });
});

// ---------------------------------------------------------------------------
// Not-yet-due: query correctly excludes future-period subs
// ---------------------------------------------------------------------------

describe('handler: not-yet-due (query returns nothing)', () => {
    it('returns success=true, processed=0 when no subs are due', async () => {
        dueRowsState.rows = []; // query returned nothing

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Idempotency: already-cancelled sub is skipped
// ---------------------------------------------------------------------------

describe('handler: idempotency — already-cancelled sub', () => {
    it('skips a sub that is already status=cancelled (query filter excludes it)', async () => {
        // The query filters status='active'. A row with status='cancelled' is
        // excluded by the in-process `.filter()` before finalizeOne is ever called.
        // The sub is NOT in the processed count (it never enters the loop body).
        dueRowsState.rows = [makeDueRow({ status: 'cancelled' })];

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // Filtered out: zero processed, zero errors, success true
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);

        // Transition guard never called (sub was filtered before reaching finalizeOne)
        expect(mockValidateTransition).not.toHaveBeenCalled();
        // Addon revocation was never called
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
    });

    it('handles a re-run after finalization: already-cancelled sub filtered out', async () => {
        // First run: finalize one sub
        dueRowsState.rows = [makeDueRow()];
        const ctx1 = makeCronCtx();
        const first = await finalizeCancelledSubsJob.handler(ctx1);
        expect(first.processed).toBe(1);

        // Second run: same sub now has status='cancelled' and is excluded by the filter
        dueRowsState.rows = [makeDueRow({ status: 'cancelled' })];
        const ctx2 = makeCronCtx();
        const second = await finalizeCancelledSubsJob.handler(ctx2);

        expect(second.success).toBe(true);
        expect(second.processed).toBe(0);
        expect(second.errors).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Addon revocation failure
// ---------------------------------------------------------------------------

describe('handler: addon revocation failure', () => {
    it('marks that sub failed but continues processing the next sub', async () => {
        dueRowsState.rows = [
            makeDueRow({ id: SUB_ID_1, customerId: CUSTOMER_ID_1 }),
            makeDueRow({ id: SUB_ID_2, customerId: CUSTOMER_ID_2 })
        ];

        // First sub: addon revocation throws
        const addonErr = new Error('Addon revocation timeout');
        mockHandleSubscriptionCancellationAddons
            .mockRejectedValueOnce(addonErr)
            .mockResolvedValueOnce({
                subscriptionId: SUB_ID_2,
                customerId: CUSTOMER_ID_2,
                totalProcessed: 0,
                succeeded: [],
                failed: [],
                elapsedMs: 10
            });

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // Second sub processed successfully despite first failing
        expect(mockHandleSubscriptionCancellationAddons).toHaveBeenCalledTimes(2);

        // Overall: one error, one success → result.success=false
        expect(result.success).toBe(false);
        expect(result.errors).toBeGreaterThanOrEqual(1);
        expect(result.processed).toBe(2);
    });

    it('logs the error for the failing sub', async () => {
        dueRowsState.rows = [makeDueRow()];
        mockHandleSubscriptionCancellationAddons.mockRejectedValue(new Error('DB connection lost'));

        const ctx = makeCronCtx();
        await finalizeCancelledSubsJob.handler(ctx);

        expect(ctx.logger.error).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Status-transition guard failure
// ---------------------------------------------------------------------------

describe('handler: transition guard failure', () => {
    it('skips the sub and marks it as error when validateTransition throws', async () => {
        dueRowsState.rows = [makeDueRow()];
        mockValidateTransition.mockImplementation(() => {
            throw new Error('Invalid transition');
        });

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(false);
        expect(result.errors).toBeGreaterThanOrEqual(1);
        // Addon revocation was never reached
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Due-query failure
// ---------------------------------------------------------------------------

describe('handler: due-query failure', () => {
    it('returns success=false when the initial query throws', async () => {
        const queryErr = new Error('DB unavailable');
        mockDbSelectChain.mockImplementation(() => {
            throw queryErr;
        });

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(false);
        expect(result.processed).toBe(0);
        expect(typeof result.durationMs).toBe('number');
    });
});

// ---------------------------------------------------------------------------
// Dry-run
// ---------------------------------------------------------------------------

describe('handler: dry-run mode', () => {
    it('returns ids to be processed without mutating anything', async () => {
        dueRowsState.rows = [makeDueRow({ id: SUB_ID_1 }), makeDueRow({ id: SUB_ID_2 })];

        const ctx = makeCronCtx(true);
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        // Dry-run should not call update/insert/addon revocation
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(mockDbInsert).not.toHaveBeenCalled();
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
        // Should report the count
        expect(result.processed).toBe(2);
    });
});

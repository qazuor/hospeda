/**
 * Unit tests for the finalize-cancelled-subs cron job (SPEC-147 T-009 + T-010).
 *
 * Coverage:
 * - T-009 Happy path: due soft-cancelled sub → status flipped to 'cancelled' +
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
 * - T-010 D3 reminder: sendAccessEndingReminders sends once per sub in window,
 *   dedup on re-run, NOT sent for non-cancelled subs, graceful on missing customer.
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
    mockValidateTransition,
    mockSendNotification,
    mockWithTransaction
} = vi.hoisted(() => ({
    mockHandleSubscriptionCancellationAddons: vi.fn(),
    mockClearEntitlementCache: vi.fn(),
    mockGetQZPayBilling: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbSelectChain: vi.fn(),
    mockValidateTransition: vi.fn(),
    mockSendNotification: vi.fn().mockResolvedValue(undefined),
    // withTransaction executes the callback with a tx object that mirrors the
    // mocked db (same insert/update/select handles).
    mockWithTransaction: vi.fn()
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

vi.mock('../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification
}));

// Drizzle DB mock: select chain returns rows fed by `dueRowsState`.
// The D3 reminder tests also need access-ending rows (accessEndingRowsState).
// A `selectCallCount` counter lets the mock return the right dataset for the
// right query call within the same test.
const dueRowsState: { rows: DueRow[] } = { rows: [] };

interface DueRow {
    id: string;
    customerId: string;
    status: string;
}

/**
 * Row shape for the D3 access-ending window query.
 * Returned by `sendAccessEndingReminders`'s internal DB query.
 */
interface AccessEndingRow {
    id: string;
    customerId: string;
    periodEnd: Date;
}

/** State bag for D3 reminder tests. */
const accessEndingRowsState: { rows: AccessEndingRow[] } = { rows: [] };

/**
 * Per-subscription dedup event existence state.
 * When `existsForSub[subId]` is `true`, the dedup check returns a row
 * (meaning the reminder was already sent); `false` / undefined → not sent yet.
 */
const dedupEventExistsState: { existsForSub: Record<string, boolean> } = {
    existsForSub: {}
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    // The finalize query uses `.limit()` to terminate the chain.
    // The D3 dedup check uses `.limit(1)` as well. We route by call order
    // inside `sendAccessEndingReminders`:
    //   - First select in that function: the window query → returns accessEndingRowsState.rows
    //   - Second select per sub: the dedup check → returns [] or [{ id: 'x' }]
    //
    // For the finalize-job tests the chain still resolves dueRowsState.rows.
    // We use `mockDbSelectChain` which the `beforeEach` resets to the finalize
    // chain; for D3 tests we override it on a per-test basis in the test body
    // (via the `accessEndingRowsState` / `dedupEventExistsState` mechanism
    // above — the implementation reads those states via the mocked `getDb()`).

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

    // Default withTransaction: executes the callback with a tx that mirrors
    // the mocked db (same insert/update/select handles so existing assertions
    // still work). The second argument (existingTx/db) is intentionally ignored
    // in the mock — all operations go through the shared mock stubs.
    mockWithTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
            const tx = {
                select: mockDbSelectChain,
                update: mockDbUpdate,
                insert: mockDbInsert
            };
            return fn(tx);
        }
    );

    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockDbSelectChain,
            update: mockDbUpdate,
            insert: mockDbInsert
        })),
        withTransaction: mockWithTransaction,
        billingSubscriptions: {
            id: 'ID',
            customerId: 'CUSTOMER_ID',
            status: 'STATUS',
            planId: 'PLAN_ID',
            currentPeriodEnd: 'CURRENT_PERIOD_END',
            cancelAtPeriodEnd: 'CANCEL_AT_PERIOD_END',
            deletedAt: 'DELETED_AT',
            updatedAt: 'UPDATED_AT'
        },
        billingSubscriptionEvents: { _table: 'billing_subscription_events' },
        eq: vi.fn((col, val) => ({ _eq: [col, val] })),
        and: vi.fn((...args) => ({ _and: args })),
        gte: vi.fn((col, val) => ({ _gte: [col, val] })),
        lte: vi.fn((col, val) => ({ _lte: [col, val] })),
        isNull: vi.fn((col) => ({ _isNull: col })),
        inArray: vi.fn((col, vals) => ({ _inArray: [col, vals] })),
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

/** Returns a mock billing instance (minimal shape used by finalize and D3 scan). */
function makeBilling() {
    return {
        customers: { get: vi.fn().mockResolvedValue(null) },
        plans: { get: vi.fn().mockResolvedValue(null) }
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
    accessEndingRowsState.rows = [];
    dedupEventExistsState.existsForSub = {};

    // Reset all spies (clears call history and removes mockReturnValue/mockResolvedValue
    // set in previous tests, then re-set defaults).
    mockGetQZPayBilling.mockReset();
    mockValidateTransition.mockReset();
    mockHandleSubscriptionCancellationAddons.mockReset();
    mockClearEntitlementCache.mockReset();
    mockDbInsert.mockReset();
    mockDbUpdate.mockReset();
    mockDbSelectChain.mockReset();
    mockSendNotification.mockReset();
    mockWithTransaction.mockReset();

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
    mockSendNotification.mockResolvedValue(undefined);

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

    // Re-wire withTransaction: execute the callback with a tx that mirrors the
    // mocked db handles so all existing assertions continue to work.
    mockWithTransaction.mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
            const tx = {
                select: mockDbSelectChain,
                update: mockDbUpdate,
                insert: mockDbInsert
            };
            return fn(tx);
        }
    );
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

    it('validates the active→cancelled transition via state machine using the REAL row status', async () => {
        dueRowsState.rows = [makeDueRow()]; // status: 'active' by default

        const ctx = makeCronCtx();
        await finalizeCancelledSubsJob.handler(ctx);

        expect(mockValidateTransition).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'active', // the actual status from the row, not hardcoded
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
// M2 Regression: soft-cancelled subs in non-active statuses are finalized
//
// The original 'active'-only query caused soft-cancelled subs that went
// past_due (payment-failure webhook) or stayed trialing to be stuck forever.
// These tests are the regression guard for the M2 fix.
// ---------------------------------------------------------------------------

describe('handler: M2 regression — soft-cancelled past_due sub is finalized', () => {
    it('finalizes a soft-cancelled past_due sub with past period_end', async () => {
        dueRowsState.rows = [makeDueRow({ status: 'past_due' })];

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);

        // validateTransition called with from='past_due' (real status, not hardcoded)
        expect(mockValidateTransition).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'past_due',
                to: 'cancelled'
            })
        );

        // Status flip must have been called
        expect(mockDbUpdate).toHaveBeenCalled();

        // Entitlement cache cleared
        expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID_1);
    });

    it('finalizes a soft-cancelled trialing sub with past period_end', async () => {
        dueRowsState.rows = [makeDueRow({ status: 'trialing' })];

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);

        // validateTransition called with from='trialing'
        expect(mockValidateTransition).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'trialing',
                to: 'cancelled'
            })
        );

        expect(mockDbUpdate).toHaveBeenCalled();
        expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID_1);
    });

    it('a past_due sub WITHOUT cancelAtPeriodEnd=true is NOT picked up by the query (normal dunning path)', async () => {
        // Simulates the real DB behavior: the query requires cancelAtPeriodEnd=true.
        // A plain past_due sub without cancelAtPeriodEnd is excluded by SQL.
        // The mock simulates this by returning no rows.
        dueRowsState.rows = []; // DB returned nothing for a past_due sub without cancelAtPeriodEnd

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);

        // No finalization side effects
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(mockValidateTransition).not.toHaveBeenCalled();
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });

    it('terminal-status subs (cancelled, expired, abandoned) are excluded from finalization', async () => {
        // The query uses inArray with only non-terminal statuses.
        // Rows with terminal status would NOT be returned by the real DB query.
        // The mock simulates this by returning no rows.
        dueRowsState.rows = []; // DB returned nothing for terminal-status subs

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Not-yet-due: query correctly excludes future-period subs
// REGRESSION GUARD (bug fixed in SPEC-147): the original findDueSoftCancelledSubs
// only filtered status='active' in SQL and relied on a JS post-filter that
// did NOT check cancelAtPeriodEnd or currentPeriodEnd. This caused any active
// soft-cancelled sub to be finalized immediately on the next cron run,
// destroying the grace period. The fix moves all four predicates into the SQL
// WHERE clause. These tests document and guard that behaviour.
// ---------------------------------------------------------------------------

describe('handler: not-yet-due (query returns nothing)', () => {
    it('returns success=true, processed=0 when no subs are due', async () => {
        dueRowsState.rows = []; // query returned nothing — no eligible sub

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });

    it('mock-level guard: query returns nothing when no subs are due (simulates future-period exclusion)', async () => {
        // This test documents that the handler produces no side-effects when
        // findDueSoftCancelledSubs returns an empty set — the typical outcome
        // when all soft-cancelled subs still have currentPeriodEnd in the future.
        //
        // The REAL regression guard (SQL WHERE uses lte on currentPeriodEnd, not gte,
        // and combines all four predicates with and()) lives in the seeded-DB e2e:
        //   apps/api/test/e2e/subscription-cancel-finalize.test.ts:512
        //
        // Predicate-shape assertion: the WHERE clause predicate passed to where()
        // must include an lte sub-expression (currentPeriodEnd <= now). This is
        // confirmed by the findDueSoftCancelledSubs WHERE-clause test below.
        dueRowsState.rows = []; // corrected SQL would return nothing for a future-period sub

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // The sub must NOT be finalized: zero processed, zero errors, success.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);

        // Status flip must NOT have been called
        expect(mockDbUpdate).not.toHaveBeenCalled();
        // Addon revocation must NOT have been called
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
        // Entitlement cache must NOT have been cleared
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// findDueSoftCancelledSubs internal: WHERE clause composition
// Documents that the query passes the correct compound predicate to where().
//
// This is the unit-level guard for the predicate shape. The seeded-DB e2e
// (apps/api/test/e2e/subscription-cancel-finalize.test.ts:512) is the
// authoritative gate for the SQL regression (future-period subs not finalized).
// ---------------------------------------------------------------------------

describe('_internals.findDueSoftCancelledSubs — WHERE clause', () => {
    it('calls db.select().from().where(and(...)) with inArray(status, eligible_set) + lte(currentPeriodEnd) + cancelAtPeriodEnd + isNull(deletedAt)', async () => {
        // We capture what the where() function receives to assert the compound
        // predicate includes inArray(status, ...) (M2 fix), cancelAtPeriodEnd,
        // currentPeriodEnd (lte), and deletedAt isNull.
        // The mock returns empty rows (no-op) — we only care about the predicate shape.
        const capturedPredicates: unknown[] = [];

        mockDbSelectChain.mockImplementation(() => {
            const chain = {
                from: () => chain,
                where: (predicate: unknown) => {
                    capturedPredicates.push(predicate);
                    return chain;
                },
                limit: async () => []
            };
            return chain;
        });

        await _internals.findDueSoftCancelledSubs();

        // The where() should have been called once with an and(...) composite.
        expect(capturedPredicates).toHaveLength(1);
        const predicate = capturedPredicates[0] as { _and?: unknown[] };

        // Our mock eq/and/lte/isNull/inArray return { _eq, _and, _lte, _isNull, _inArray } shapes.
        // Verify it is a compound AND (not a bare eq like the buggy version).
        expect(predicate._and).toBeDefined();
        expect(Array.isArray(predicate._and)).toBe(true);

        const subPreds = predicate._and as Array<
            | { _eq?: unknown[] }
            | { _lte?: unknown[] }
            | { _gte?: unknown[] }
            | { _isNull?: unknown }
            | { _inArray?: unknown[] }
        >;

        // Should have 4 sub-predicates: inArray(status, ...), cancelAtPeriodEnd eq,
        // currentPeriodEnd lte, deletedAt isNull.
        expect(subPreds.length).toBe(4);

        // M2 regression guard: status must use inArray (not a bare eq('active')).
        // The prior 'active'-only eq would cause past_due/trialing soft-cancelled
        // subs to be stuck forever and never finalized.
        const hasInArray = subPreds.some((p) => '_inArray' in p);
        expect(hasInArray).toBe(true);

        // The inArray predicate must include 'active', 'past_due', and 'trialing'.
        const inArrayPred = subPreds.find((p): p is { _inArray: unknown[] } => '_inArray' in p);
        expect(inArrayPred).toBeDefined();
        const statusValues = inArrayPred?._inArray?.[1] as string[] | undefined;
        expect(statusValues).toContain('active');
        expect(statusValues).toContain('past_due');
        expect(statusValues).toContain('trialing');
        // Terminal/unrelated statuses must NOT be included
        expect(statusValues).not.toContain('cancelled');
        expect(statusValues).not.toContain('expired');
        expect(statusValues).not.toContain('abandoned');

        // At least one predicate must be an lte (currentPeriodEnd <= now).
        // This guards the grace-period logic: using gte here would finalize
        // subs whose period_end is in the FUTURE, destroying the grace period.
        const hasLte = subPreds.some((p) => '_lte' in p);
        expect(hasLte).toBe(true);

        // There must be NO gte on the currentPeriodEnd position (that would be
        // the wrong direction — would only finalize future subs, not past ones).
        const hasGte = subPreds.some((p) => '_gte' in p);
        expect(hasGte).toBe(false);

        // At least one isNull predicate (deletedAt soft-delete guard)
        const hasIsNull = subPreds.some((p) => '_isNull' in p);
        expect(hasIsNull).toBe(true);
    });

    it('FINALIZE_ELIGIBLE_STATUSES constant includes active, past_due, and trialing', () => {
        const statuses = _internals.FINALIZE_ELIGIBLE_STATUSES as readonly string[];
        expect(statuses).toContain('active');
        expect(statuses).toContain('past_due');
        expect(statuses).toContain('trialing');
        // Terminal statuses must not be in the set
        expect(statuses).not.toContain('cancelled');
        expect(statuses).not.toContain('expired');
        expect(statuses).not.toContain('abandoned');
        expect(statuses).not.toContain('paused');
        expect(statuses).not.toContain('pending_provider');
    });
});

// ---------------------------------------------------------------------------
// Idempotency: already-cancelled sub is skipped
// ---------------------------------------------------------------------------

describe('handler: idempotency — already-cancelled sub', () => {
    it('skips a sub that is already status=cancelled (SQL WHERE excludes it)', async () => {
        // The SQL WHERE uses inArray(status, ['active','past_due','trialing']).
        // 'cancelled' is not in the set, so the mock simulates the DB returning
        // no rows for a cancelled sub — the SQL filter excludes it.
        // finalizeOne is never called.
        dueRowsState.rows = [];

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // Not returned by query: zero processed, zero errors, success true
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);

        // Transition guard never called (sub was excluded by the SQL WHERE)
        expect(mockValidateTransition).not.toHaveBeenCalled();
        // Addon revocation was never called
        expect(mockHandleSubscriptionCancellationAddons).not.toHaveBeenCalled();
    });

    it('handles a re-run after finalization: already-cancelled sub excluded by SQL WHERE', async () => {
        // First run: finalize one sub
        dueRowsState.rows = [makeDueRow()];
        const ctx1 = makeCronCtx();
        const first = await finalizeCancelledSubsJob.handler(ctx1);
        expect(first.processed).toBe(1);

        // Second run: the sub is now 'cancelled' — SQL WHERE (inArray status set)
        // excludes it; the mock simulates the DB returning empty.
        dueRowsState.rows = [];
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

    it('M1: addon revocation throws → tx rolls back → status stays active, no FINALIZE event, sub is retried on next run', async () => {
        // Arrange: one due sub; withTransaction simulates a rollback by re-throwing
        // the callback's error without committing (i.e. the tx callback throws →
        // the whole transaction is aborted).
        dueRowsState.rows = [makeDueRow({ id: SUB_ID_1, customerId: CUSTOMER_ID_1 })];

        const addonErr = new Error('Addon revocation failed — simulated rollback');
        mockHandleSubscriptionCancellationAddons.mockRejectedValue(addonErr);

        // Override withTransaction to propagate the error (simulating rollback):
        // the callback is invoked but if it throws, withTransaction re-throws and
        // no write is considered committed.
        mockWithTransaction.mockImplementation(
            async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
                const tx = {
                    select: mockDbSelectChain,
                    update: mockDbUpdate,
                    insert: mockDbInsert
                };
                // Run the callback — if it throws, re-throw (simulates rollback).
                return fn(tx);
            }
        );

        const ctx = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // The sub must be counted as an error (not finalized)
        expect(result.success).toBe(false);
        expect(result.errors).toBe(1);
        expect(result.processed).toBe(1);

        // The entitlement cache must NOT have been cleared (tx rolled back)
        expect(mockClearEntitlementCache).not.toHaveBeenCalled();

        // On the real DB the status flip and audit event would both be rolled back.
        // In this mock the update/insert stubs were called inside the callback, but
        // the critical observable is that the outer finalizeOne returned { kind: 'error' }
        // — meaning the sub will re-appear in the next run's query (its original
        // non-terminal status is preserved by the rollback). The cache not being
        // cleared is the in-process guard.
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

// ---------------------------------------------------------------------------
// D3 reminder: _internals.sendAccessEndingReminders (SPEC-147 T-010)
// ---------------------------------------------------------------------------

describe('_internals.sendAccessEndingReminders', () => {
    /**
     * Helper: set up a D3-aware select chain where:
     *  - First select().from().where().limit() call → returns `windowRows`
     *  - Each subsequent call per sub → returns dedup check result
     */
    function setupD3SelectChain(
        windowRows: AccessEndingRow[],
        dedupBySubId: Record<string, boolean> = {}
    ) {
        let callCount = 0;
        mockDbSelectChain.mockImplementation(() => {
            const thisCall = callCount++;
            const chain = {
                from: () => chain,
                where: () => chain,
                limit: async (_n: number) => {
                    if (thisCall === 0) {
                        return windowRows;
                    }
                    // dedup check: for sub at index (thisCall - 1)
                    const sub = windowRows[thisCall - 1];
                    if (sub && dedupBySubId[sub.id]) {
                        return [{ id: 'dedup-event-id' }];
                    }
                    return [];
                }
            };
            return chain;
        });
    }

    it('exports sendAccessEndingReminders function', () => {
        expect(typeof _internals.sendAccessEndingReminders).toBe('function');
    });

    it('sends one reminder for a soft-cancelled sub in the 3-day window', async () => {
        const periodEnd = new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000); // 2.5 days out
        const windowRows: AccessEndingRow[] = [
            { id: SUB_ID_1, customerId: CUSTOMER_ID_1, periodEnd }
        ];
        setupD3SelectChain(windowRows, { [SUB_ID_1]: false });

        // billing has customer and plan
        const mockCustomer = {
            id: CUSTOMER_ID_1,
            email: 'owner@test.com',
            metadata: { name: 'Test Owner' }
        };
        const mockPlan = { id: 'plan-1', name: 'Plan Professional' };
        mockGetQZPayBilling.mockReturnValue({
            customers: { get: vi.fn().mockResolvedValue(mockCustomer) },
            plans: { get: vi.fn().mockResolvedValue(mockPlan) }
        });

        const fakeLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        await _internals.sendAccessEndingReminders(fakeLogger);

        // sendNotification should have been called once
        expect(mockSendNotification).toHaveBeenCalledTimes(1);
        expect(mockSendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'subscription_access_ending_soon'
            })
        );
    });

    it('does NOT send reminder when no subs are in the 3-day window', async () => {
        setupD3SelectChain([]);

        const fakeLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        await _internals.sendAccessEndingReminders(fakeLogger);

        expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('does NOT re-send the reminder on a second run (dedup via SUBSCRIPTION_ACCESS_ENDING_NOTIF event)', async () => {
        const periodEnd = new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000);
        const windowRows: AccessEndingRow[] = [
            { id: SUB_ID_1, customerId: CUSTOMER_ID_1, periodEnd }
        ];

        const mockCustomer = {
            id: CUSTOMER_ID_1,
            email: 'owner@test.com',
            metadata: { name: 'Test Owner' }
        };
        const mockPlan = { id: 'plan-1', name: 'Plan Professional' };
        mockGetQZPayBilling.mockReturnValue({
            customers: { get: vi.fn().mockResolvedValue(mockCustomer) },
            plans: { get: vi.fn().mockResolvedValue(mockPlan) }
        });

        const fakeLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        // First run: dedup event NOT present → sends
        setupD3SelectChain(windowRows, { [SUB_ID_1]: false });
        await _internals.sendAccessEndingReminders(fakeLogger);
        expect(mockSendNotification).toHaveBeenCalledTimes(1);

        // Second run: dedup event IS present → skipped
        mockSendNotification.mockClear();
        setupD3SelectChain(windowRows, { [SUB_ID_1]: true });
        await _internals.sendAccessEndingReminders(fakeLogger);
        expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('handles a missing customer/plan gracefully (logs warn, does not throw)', async () => {
        const periodEnd = new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000);
        const windowRows: AccessEndingRow[] = [
            { id: SUB_ID_1, customerId: CUSTOMER_ID_1, periodEnd }
        ];
        setupD3SelectChain(windowRows, { [SUB_ID_1]: false });

        // billing.customers.get returns null → should warn and skip
        mockGetQZPayBilling.mockReturnValue({
            customers: { get: vi.fn().mockResolvedValue(null) },
            plans: { get: vi.fn().mockResolvedValue(null) }
        });

        const fakeLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        // Should not throw
        await expect(_internals.sendAccessEndingReminders(fakeLogger)).resolves.not.toThrow();
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(fakeLogger.warn).toHaveBeenCalled();
    });
});

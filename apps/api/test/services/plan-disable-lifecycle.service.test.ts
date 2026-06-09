/**
 * Unit tests for disablePlanLifecycle (SPEC-148 T-005).
 *
 * RED-FIRST: written before the service implementation. All tests below FAIL
 * until apps/api/src/services/plan-disable-lifecycle.service.ts is written.
 *
 * Cases:
 *  1. Fan-out happy path — all eligible subs flipped to cancelAtPeriodEnd=true,
 *     PLAN_DISABLED_MIGRATION event written per sub, cache cleared per sub,
 *     PLAN_BEING_RETIRED notification queued per sub.
 *  2. Admin audit event — PLAN_DISABLED_BY_ADMIN written once after fan-out
 *     with actorId, planId and affectedSubCount.
 *  3. Idempotent re-run — all subs already have cancelAtPeriodEnd=true →
 *     no-op, 0 affectedSubCount, no notifications sent.
 *  4. Subs already winding down (cancelAtPeriodEnd=true) are skipped.
 *  5. Non-live statuses (cancelled, expired) are skipped by the query.
 *  6. Per-sub failure — one sub throws inside its transaction → continues
 *     fan-out, audit count reflects only successes.
 *  7. Returns { affectedSubCount } reflecting successful updates.
 *
 * DI/mock pattern: importOriginal-spread, vi.hoisted, mockReset+defaults per
 * beforeEach — mirrors subscription-cancel.service.test.ts.
 *
 * @module test/services/plan-disable-lifecycle.service
 */

import { NotificationType } from '@repo/notifications';
import { ServiceErrorCode } from '@repo/schemas';
import { BILLING_EVENT_TYPES, ServiceError } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------

const {
    mockDbSelectFn,
    mockDbUpdateFn,
    mockDbInsertFn,
    mockDbTransactionFn,
    mockInsertPlanAuditLogFn
} = vi.hoisted(() => {
    // SELECT chain: select().from().where() → resolves rows array
    const mockFromWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn(() => ({ where: mockFromWhere }));
    const mockDbSelectFn = vi.fn(() => ({ from: mockFrom }));

    // UPDATE chain: update().set().where()
    const mockDbUpdateWhere = vi.fn().mockResolvedValue([]);
    const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
    const mockDbUpdateFn = vi.fn(() => ({ set: mockDbUpdateSet }));

    // INSERT chain: insert().values()
    const mockDbInsertValues = vi.fn().mockResolvedValue([]);
    const mockDbInsertFn = vi.fn(() => ({ values: mockDbInsertValues }));

    // Transaction: passes a tx object that mirrors the db mock
    const mockDbTransactionFn = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({
            select: mockDbSelectFn,
            update: mockDbUpdateFn,
            insert: mockDbInsertFn
        });
    });

    const mockInsertPlanAuditLogFn = vi.fn().mockResolvedValue(undefined);

    return {
        mockDbSelectFn,
        mockDbUpdateFn,
        mockDbInsertFn,
        mockDbTransactionFn,
        mockInsertPlanAuditLogFn
    };
});

// ---------------------------------------------------------------------------
// Module mocks (BEFORE imports)
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelectFn,
        update: mockDbUpdateFn,
        insert: mockDbInsertFn,
        transaction: mockDbTransactionFn
    })),
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        cancelAtPeriodEnd: 'cancel_at_period_end',
        currentPeriodEnd: 'current_period_end',
        planId: 'plan_id',
        deletedAt: 'deleted_at',
        updatedAt: 'updated_at'
    },
    billingSubscriptionEvents: {
        subscriptionId: 'subscription_id',
        eventType: 'event_type',
        triggerSource: 'trigger_source',
        metadata: 'metadata'
    },
    eq: vi.fn((_a: unknown, _b: unknown) => ({ _eq: true })),
    and: vi.fn((..._args: unknown[]) => ({ _and: true })),
    inArray: vi.fn((_col: unknown, _vals: unknown) => ({ _inArray: true })),
    isNull: vi.fn((_col: unknown) => ({ _isNull: true }))
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    const { getDb } = await import('@repo/db');
    return {
        ...actual,
        withServiceTransaction: vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const db = getDb() as {
                transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
            };
            return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
        })
    };
});

vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        ServiceErrorCode: {
            ...actual.ServiceErrorCode
        }
    };
});

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/plan-disable-lifecycle.deps', () => ({
    insertPlanAuditLog: mockInsertPlanAuditLogFn
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { getDb } from '@repo/db';
import { withServiceTransaction } from '@repo/service-core';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';
import { disablePlanLifecycle } from '../../src/services/plan-disable-lifecycle.service';
import { sendNotification } from '../../src/utils/notification-helper';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLAN_ID = 'plan-standard-uuid';
const ACTOR_ID = 'admin-user-001';
const CURRENT_PERIOD_END = new Date('2026-08-15T23:59:59.000Z');

/** Eligible subscription row (live, not already winding down). */
interface SubRow {
    readonly id: string;
    readonly customerId: string;
    readonly status: string;
    readonly cancelAtPeriodEnd: boolean;
    readonly currentPeriodEnd: Date;
    readonly planId: string;
}

function buildSubRow(overrides: Partial<SubRow> = {}): SubRow {
    return {
        id: 'sub-001',
        customerId: 'cus-001',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: CURRENT_PERIOD_END,
        planId: PLAN_ID,
        ...overrides
    };
}

/**
 * Sets up the DB select mock to return the given rows for the fan-out query
 * (the query that finds eligible subs).
 */
function setupSelectRows(rows: SubRow[]): void {
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn(() => ({ where }));
    mockDbSelectFn.mockReturnValue({ from } as ReturnType<typeof mockDbSelectFn>);
}

/** Reset update().set().where() chain to success. */
function resetUpdateChain(): void {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    mockDbUpdateFn.mockReturnValue({ set: mockSet });
}

/** Reset insert().values() chain to success. */
function resetInsertChain(): void {
    const mockValues = vi.fn().mockResolvedValue([]);
    mockDbInsertFn.mockReturnValue({ values: mockValues });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('disablePlanLifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Re-wire withServiceTransaction after clearAllMocks so the db mock
        // state is freshly picked up on each test.
        (
            vi.mocked(withServiceTransaction) as unknown as {
                mockImplementation: (
                    fn: (cb: (ctx: unknown) => Promise<unknown>) => Promise<unknown>
                ) => void;
            }
        ).mockImplementation(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const db = getDb() as {
                transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
            };
            return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
        });

        resetUpdateChain();
        resetInsertChain();
        mockInsertPlanAuditLogFn.mockResolvedValue(undefined);

        // Default: one eligible active sub
        setupSelectRows([buildSubRow()]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── 1. Fan-out happy path ─────────────────────────────────────────────────

    describe('fan-out happy path', () => {
        it('returns affectedSubCount=1 for one eligible sub', async () => {
            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result.affectedSubCount).toBe(1);
        });

        it('flips cancelAtPeriodEnd=true on the eligible sub (does NOT flip status)', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(mockDbUpdateFn).toHaveBeenCalled();
            const setCall = mockDbUpdateFn.mock.results[0]?.value;
            expect(setCall.set).toHaveBeenCalledWith(
                expect.objectContaining({ cancelAtPeriodEnd: true })
            );
            // Status must NOT be changed
            const setArg = (setCall.set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<
                string,
                unknown
            >;
            expect(setArg.status).toBeUndefined();
        });

        it('writes a PLAN_DISABLED_MIGRATION event per eligible sub', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(mockDbInsertFn).toHaveBeenCalled();
            const insertResult = mockDbInsertFn.mock.results[0]?.value;
            expect(insertResult.values).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventType: BILLING_EVENT_TYPES.PLAN_DISABLED_MIGRATION,
                    triggerSource: 'plan-disable'
                })
            );
        });

        it('includes planId in PLAN_DISABLED_MIGRATION event metadata', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            const insertResult = mockDbInsertFn.mock.results[0]?.value;
            const valuesArg = (insertResult.values as ReturnType<typeof vi.fn>).mock
                .calls[0]?.[0] as {
                metadata?: { planId?: string };
            };
            expect(valuesArg.metadata?.planId).toBe(PLAN_ID);
        });

        it('calls clearEntitlementCache per eligible sub (after tx)', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(clearEntitlementCache).toHaveBeenCalledWith('cus-001');
        });

        it('queues PLAN_BEING_RETIRED notification (fire-and-forget) per sub', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: NotificationType.PLAN_BEING_RETIRED
                })
            );
        });

        it('includes accessUntil=currentPeriodEnd.toISOString() in notification', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    accessUntil: CURRENT_PERIOD_END.toISOString()
                })
            );
        });

        it('fans out across multiple eligible subs — affectedSubCount=N', async () => {
            setupSelectRows([
                buildSubRow({ id: 'sub-001', customerId: 'cus-001' }),
                buildSubRow({ id: 'sub-002', customerId: 'cus-002', status: 'trialing' }),
                buildSubRow({ id: 'sub-003', customerId: 'cus-003', status: 'past_due' })
            ]);

            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result.affectedSubCount).toBe(3);
            expect(clearEntitlementCache).toHaveBeenCalledTimes(3);
            expect(sendNotification).toHaveBeenCalledTimes(3);
        });
    });

    // ── 2. Admin audit event ──────────────────────────────────────────────────

    describe('admin audit event', () => {
        it('writes exactly one PLAN_DISABLED_BY_ADMIN audit entry after the fan-out', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(mockInsertPlanAuditLogFn).toHaveBeenCalledOnce();
        });

        it('audit entry carries actorId and planId', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(mockInsertPlanAuditLogFn).toHaveBeenCalledWith(
                expect.anything(), // db instance
                expect.objectContaining({
                    actorId: ACTOR_ID,
                    planId: PLAN_ID
                })
            );
        });

        it('audit entry affectedSubCount matches the number of subs updated', async () => {
            setupSelectRows([
                buildSubRow({ id: 'sub-001', customerId: 'cus-001' }),
                buildSubRow({ id: 'sub-002', customerId: 'cus-002' })
            ]);

            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            const auditCall = mockInsertPlanAuditLogFn.mock.calls[0];
            const auditInput = auditCall?.[1] as {
                changes?: { affectedSubCount?: number };
            };
            expect(auditInput.changes?.affectedSubCount).toBe(2);
        });

        it('audit action is plan_disabled', async () => {
            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(mockInsertPlanAuditLogFn).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ action: 'plan_disabled' })
            );
        });
    });

    // ── 3. Idempotent re-run → no-op ──────────────────────────────────────────

    describe('idempotent re-run', () => {
        it('returns affectedSubCount=0 when no eligible subs found', async () => {
            setupSelectRows([]);

            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result.affectedSubCount).toBe(0);
        });

        it('does NOT call update, sendNotification, or clearEntitlementCache on no-op', async () => {
            setupSelectRows([]);

            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(mockDbUpdateFn).not.toHaveBeenCalled();
            expect(sendNotification).not.toHaveBeenCalled();
            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });

        it('still writes the admin audit event even on 0-affected no-op', async () => {
            setupSelectRows([]);

            await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(mockInsertPlanAuditLogFn).toHaveBeenCalledOnce();
            const auditCall = mockInsertPlanAuditLogFn.mock.calls[0];
            const auditInput = auditCall?.[1] as {
                changes?: { affectedSubCount?: number };
            };
            expect(auditInput.changes?.affectedSubCount).toBe(0);
        });
    });

    // ── 4. Already-winding-down subs are excluded from the query ─────────────

    describe('already-winding-down subs skipped', () => {
        it('does not flip a sub that already has cancelAtPeriodEnd=true', async () => {
            // The query WHERE clause excludes cancelAtPeriodEnd=true subs.
            // By returning an empty array, we simulate the query returning nothing
            // (because the only sub is already winding down).
            setupSelectRows([]);

            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result.affectedSubCount).toBe(0);
            expect(mockDbUpdateFn).not.toHaveBeenCalled();
        });
    });

    // ── 5. Non-live statuses are excluded from the query ─────────────────────

    describe('non-live statuses skipped', () => {
        it('returns 0 affected when all subs are in terminal statuses', async () => {
            // Simulates the SQL query returning nothing because cancelled/expired
            // subs are filtered by the WHERE status IN (active, trialing, past_due)
            setupSelectRows([]);

            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result.affectedSubCount).toBe(0);
        });
    });

    // ── 6. Per-sub failure — soft-fail, continue fan-out ─────────────────────

    describe('per-sub failure soft-fail behavior', () => {
        it('continues the fan-out when one sub tx throws — counts only successes', async () => {
            setupSelectRows([
                buildSubRow({ id: 'sub-001', customerId: 'cus-001' }),
                buildSubRow({ id: 'sub-002', customerId: 'cus-002' })
            ]);

            // First call to withServiceTransaction throws; second succeeds
            let callCount = 0;
            (
                vi.mocked(withServiceTransaction) as unknown as {
                    mockImplementation: (
                        fn: (cb: (ctx: unknown) => Promise<unknown>) => Promise<unknown>
                    ) => void;
                }
            ).mockImplementation(async (cb: (ctx: unknown) => Promise<unknown>) => {
                callCount++;
                if (callCount === 1) {
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'db write failed for sub-001'
                    );
                }
                const db = getDb() as {
                    transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
                };
                return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
            });

            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            // Only sub-002 succeeded
            expect(result.affectedSubCount).toBe(1);
        });

        it('does not throw from disablePlanLifecycle when a per-sub tx fails', async () => {
            setupSelectRows([buildSubRow({ id: 'sub-001', customerId: 'cus-001' })]);

            (
                vi.mocked(withServiceTransaction) as unknown as {
                    mockImplementation: (
                        fn: (cb: (ctx: unknown) => Promise<unknown>) => Promise<unknown>
                    ) => void;
                }
            ).mockImplementation(async (_cb: (ctx: unknown) => Promise<unknown>) => {
                throw new Error('unexpected db error');
            });

            await expect(
                disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID })
            ).resolves.toBeDefined();
        });

        it('audit affectedSubCount reflects only the successes when some subs fail', async () => {
            setupSelectRows([
                buildSubRow({ id: 'sub-001', customerId: 'cus-001' }),
                buildSubRow({ id: 'sub-002', customerId: 'cus-002' }),
                buildSubRow({ id: 'sub-003', customerId: 'cus-003' })
            ]);

            let callCount = 0;
            (
                vi.mocked(withServiceTransaction) as unknown as {
                    mockImplementation: (
                        fn: (cb: (ctx: unknown) => Promise<unknown>) => Promise<unknown>
                    ) => void;
                }
            ).mockImplementation(async (cb: (ctx: unknown) => Promise<unknown>) => {
                callCount++;
                if (callCount === 2) {
                    // sub-002 fails
                    throw new Error('write error on sub-002');
                }
                const db = getDb() as {
                    transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
                };
                return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
            });

            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result.affectedSubCount).toBe(2);
            const auditCall = mockInsertPlanAuditLogFn.mock.calls[0];
            const auditInput = auditCall?.[1] as { changes?: { affectedSubCount?: number } };
            expect(auditInput.changes?.affectedSubCount).toBe(2);
        });
    });

    // ── 7. Return shape ───────────────────────────────────────────────────────

    describe('return shape', () => {
        it('returns an object with affectedSubCount', async () => {
            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result).toHaveProperty('affectedSubCount');
            expect(typeof result.affectedSubCount).toBe('number');
        });

        it('notification failure does not abort the fan-out (fire-and-forget)', async () => {
            vi.mocked(sendNotification).mockRejectedValue(new Error('smtp failure'));

            const result = await disablePlanLifecycle({ planId: PLAN_ID, actorId: ACTOR_ID });

            expect(result.affectedSubCount).toBe(1);
        });
    });
});

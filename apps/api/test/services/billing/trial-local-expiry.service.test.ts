/**
 * HOS-1012 T-010 — trial-local-expiry.service unit tests.
 *
 * Proves the Hospeda-owned trial expiry:
 *  - moves an elapsed local trial to `expired` and writes its dedup event in ONE
 *    transaction, stamping `trialConverted: false`.
 *  - refuses a row that carries a provider id — that one belongs to MercadoPago.
 *  - refuses a window that has not elapsed, and a row already expired.
 *  - refuses an illegal status transition.
 *  - drops the entitlement cache, since a local expiry has no webhook behind it.
 *
 * `@repo/service-core` is only PARTIALLY mocked: `withServiceTransaction` is
 * stubbed so no real DB is needed, but `checkSubscriptionStatusTransition` and
 * `BILLING_EVENT_TYPES` are the REAL implementations. Mocking the transition
 * guard would make the illegal-transition test assert its own stub.
 *
 * @module test/services/billing/trial-local-expiry.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const updateSetMock = vi.fn((_row: Record<string, unknown>) => ({ where: updateWhereMock }));

/** The tx handed to the withServiceTransaction callback. */
const txStub = {
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: vi.fn(() => ({ set: updateSetMock }))
};

/** Records the order of writes so "same transaction" can be asserted. */
const withServiceTransactionMock = vi.fn(
    async (cb: (ctx: { tx: typeof txStub }) => Promise<unknown>) => cb({ tx: txStub })
);

const selectLimitMock = vi.fn();
const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));
const selectMock = vi.fn(() => ({ from: selectFromMock }));

vi.mock('@repo/db', () => ({
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    billingSubscriptions: { id: 'id' },
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'subscription_id',
        eventType: 'event_type'
    },
    getDb: vi.fn(() => ({ select: selectMock }))
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        withServiceTransaction: (...args: unknown[]) =>
            (withServiceTransactionMock as (...a: unknown[]) => unknown)(...args)
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const clearEntitlementCacheMock = vi.fn();
vi.mock('../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: (...args: unknown[]) => clearEntitlementCacheMock(...args)
}));

// Import after mocks.
import { expireLocalTrial } from '../../../src/services/billing/trial-local-expiry.service';

const NOW = new Date('2026-09-01T10:00:00.000Z');
const ELAPSED = new Date('2026-08-25T10:00:00.000Z');
const FUTURE = new Date('2026-09-30T10:00:00.000Z');

function localTrial(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub-local-1',
        customerId: 'cust-1',
        status: 'trialing',
        trialEnd: ELAPSED,
        mpSubscriptionId: null,
        ...overrides
    };
}

/** The row handed to `update().set()`. */
function updatedRow(): Record<string, unknown> {
    return updateSetMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

/** The row handed to `insert().values()`. */
function insertedEvent(): Record<string, unknown> {
    return insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('expireLocalTrial', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: no prior TRIAL_EXPIRED event.
        selectLimitMock.mockResolvedValue([]);
    });

    describe('the happy path', () => {
        it('moves an elapsed local trial to expired', async () => {
            const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(result.outcome).toBe('expired');
            expect(updatedRow().status).toBe('expired');
        });

        it('stamps trialConverted false — this trial ended without converting', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            // The whole reason the win-back series exists.
            expect(updatedRow().trialConverted).toBe(false);
        });

        it('writes the TRIAL_EXPIRED dedup event with the previous status', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            const event = insertedEvent();
            expect(event.eventType).toBe('TRIAL_EXPIRED');
            expect(event.previousStatus).toBe('trialing');
            expect(event.newStatus).toBe('expired');
            expect(event.subscriptionId).toBe('sub-local-1');
        });

        it('writes the status and the event in ONE transaction', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            // A status write without its event would let the next tick expire the
            // same trial again and send a second round of emails.
            expect(withServiceTransactionMock).toHaveBeenCalledOnce();
            expect(txStub.update).toHaveBeenCalledOnce();
            expect(txStub.insert).toHaveBeenCalledOnce();
        });

        it('drops the entitlement cache, because no webhook will', async () => {
            await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cust-1');
        });
    });

    describe('rows it must refuse', () => {
        it('refuses a row that carries a provider id', async () => {
            // MercadoPago decides when that one ends. Expiring it on our clock
            // would cut off a customer the provider may be charging right now.
            const result = await expireLocalTrial({
                subscription: localTrial({ mpSubscriptionId: 'mp-preapproval-1' }),
                now: NOW
            });

            expect(result.outcome).toBe('has-provider-id');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses a window that has not elapsed', async () => {
            const result = await expireLocalTrial({
                subscription: localTrial({ trialEnd: FUTURE }),
                now: NOW
            });

            expect(result.outcome).toBe('not-elapsed');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses a row with no trial window at all', async () => {
            const result = await expireLocalTrial({
                subscription: localTrial({ trialEnd: null }),
                now: NOW
            });

            expect(result.outcome).toBe('not-elapsed');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses a row a concurrent run already expired', async () => {
            selectLimitMock.mockResolvedValue([{ id: 'existing-event' }]);

            const result = await expireLocalTrial({ subscription: localTrial(), now: NOW });

            expect(result.outcome).toBe('already-expired');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });

        it('refuses an illegal status transition', async () => {
            // Checked against the REAL transition table: `cancelled` is terminal,
            // so a stale claimed row that has since been cancelled must not be
            // dragged back to `expired`.
            const result = await expireLocalTrial({
                subscription: localTrial({ status: 'cancelled' }),
                now: NOW
            });

            expect(result.outcome).toBe('illegal-transition');
            expect(withServiceTransactionMock).not.toHaveBeenCalled();
        });
    });

    describe('the boundary', () => {
        it('does not expire a trial whose end is exactly now', async () => {
            // `trialEnd > now` is false at the boundary, so the row IS expired.
            // Pinned deliberately: whichever way this goes, it should not move by
            // accident.
            const result = await expireLocalTrial({
                subscription: localTrial({ trialEnd: NOW }),
                now: NOW
            });

            expect(result.outcome).toBe('expired');
        });
    });
});

/**
 * `softCancelRecurringAddon` — the write that keeps a paid period alive
 * (HOS-847 PR 6, owner decision).
 *
 * ## What the assertions are actually about
 *
 * The whole behaviour IS the `set(...)` payload and the `where(...)` clause, so
 * that is what these tests read — the argument handed to Drizzle, not a return
 * value the function could have produced without touching the database.
 *
 * Two absences carry as much weight as the one presence:
 *
 * - `status` must NOT be written. An `active` row is what keeps
 *   `loadEntitlements` granting the benefit; writing `canceled` here would take
 *   away the period the customer already paid for, which is the exact outcome
 *   the owner rejected.
 * - `canceledAt` must NOT be written. Every other reader treats it as the
 *   companion of `status = 'canceled'`, so setting it on a live row would make a
 *   soft-cancelled add-on read as revoked in the places that decide whether it
 *   still counts.
 *
 * @module test/services/addon-soft-cancel
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUpdateSet, mockUpdateWhere, mockSendNotification, mockLoggerError } = vi.hoisted(
    () => ({
        mockUpdateSet: vi.fn(),
        mockUpdateWhere: vi.fn(),
        mockSendNotification: vi.fn().mockResolvedValue(undefined),
        mockLoggerError: vi.fn()
    })
);

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mockLoggerError }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: mockSendNotification
}));

vi.mock('../../src/services/notification-recipient-locale', () => ({
    resolveRecipientLocale: vi.fn().mockResolvedValue('es')
}));

// The member carries its REAL value: the assertion below compares the emitted
// `type` against it, and a stand-in string would make that comparison a check
// of this file's own invention rather than of what the dispatcher receives.
vi.mock('@repo/notifications', () => ({
    NotificationType: { ADDON_CANCELLATION: 'addon_cancellation' }
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        status: 'status',
        cancelAtPeriodEnd: 'cancel_at_period_end',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    }
}));

import { softCancelRecurringAddon } from '../../src/services/addon-soft-cancel.js';

const CUSTOMER_ID = 'cus_soft';
const PURCHASE_ID = 'a1b2c3d4-0000-4000-8000-0000000000ff';
const PERIOD_END = new Date('2026-10-01T00:00:00.000Z');

const billing = {
    customers: {
        get: vi.fn().mockResolvedValue({ email: 'owner@example.com', metadata: { name: 'Ana' } })
    }
} as unknown as QZPayBilling;

/** Drizzle stub whose `update().set().where()` is recorded, or made to throw. */
function createDb(options: { rowCount?: number; throwOnWhere?: Error } = {}) {
    return {
        update: vi.fn(() => ({
            set: vi.fn((payload: unknown) => {
                mockUpdateSet(payload);
                return {
                    where: vi.fn(async (clause: unknown) => {
                        mockUpdateWhere(clause);
                        if (options.throwOnWhere) {
                            throw options.throwOnWhere;
                        }
                        return { rowCount: options.rowCount ?? 1 };
                    })
                };
            })
        }))
    } as never;
}

const baseInput = {
    purchaseId: PURCHASE_ID,
    customerId: CUSTOMER_ID,
    addonSlug: 'extra-accommodations-20',
    addonName: 'Alojamientos extra',
    currentPeriodEnd: PERIOD_END,
    reason: 'too expensive',
    userId: 'user_soft',
    billing
};

describe('softCancelRecurringAddon', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSendNotification.mockResolvedValue(undefined);
    });

    it('flags cancel_at_period_end and writes nothing else about the row', async () => {
        const result = await softCancelRecurringAddon({ ...baseInput, db: createDb() });

        expect(result.success).toBe(true);

        const payload = mockUpdateSet.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(payload.cancelAtPeriodEnd).toBe(true);
        expect(payload.updatedAt).toBeInstanceOf(Date);
        // `objectContaining` would be blind to these two, so they are asserted
        // as explicit absences on the real payload object.
        expect(Object.hasOwn(payload, 'status')).toBe(false);
        expect(Object.hasOwn(payload, 'canceledAt')).toBe(false);
        expect(Object.keys(payload).sort()).toEqual(['cancelAtPeriodEnd', 'updatedAt']);
    });

    it('only touches a row that is still active', async () => {
        await softCancelRecurringAddon({ ...baseInput, db: createDb() });

        // The clause is opaque here, but it must exist: an UPDATE without a
        // status predicate would re-flag a row another path already finished.
        expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
        expect(mockUpdateWhere.mock.calls[0]?.[0]).toBeDefined();
    });

    it('is idempotent: an UPDATE that moved nothing still succeeds', async () => {
        // The customer asked to cancel and has a cancellation; answering with an
        // error would invite them to retry something already done.
        const result = await softCancelRecurringAddon({
            ...baseInput,
            db: createDb({ rowCount: 0 })
        });

        expect(result.success).toBe(true);
    });

    it('does NOT mail the customer when the UPDATE moved no row', async () => {
        // HOS-847 PR 7b. The email used to be unconditional, so every repeat —
        // a MercadoPago redelivery, a cron retry after a partial failure, the
        // orphan sweep meeting a row the webhook already flagged — mailed the
        // customer again about a cancellation they were already told about.
        //
        // Note this is NOT the "row already terminal" case the old docblock
        // described: this function leaves `status = 'active'` on purpose, so the
        // WHERE keeps matching. `rowCount` is the only thing that separates a
        // real transition from a repeat.
        await softCancelRecurringAddon({ ...baseInput, db: createDb({ rowCount: 0 }) });

        expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('reports an error, loudly, when the flag cannot be persisted', async () => {
        const result = await softCancelRecurringAddon({
            ...baseInput,
            db: createDb({ throwOnWhere: new Error('deadlock detected') })
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INTERNAL_ERROR');
        // This is the one genuinely bad state the flow can reach: the
        // preapproval is ALREADY cancelled, so no future charge will correct a
        // row that now grants a benefit with no end date. `{ capture: true }` is
        // not implicit — without it this never reaches Sentry.
        expect(mockLoggerError).toHaveBeenCalledWith(
            expect.objectContaining({ purchaseId: PURCHASE_ID }),
            expect.any(String),
            { capture: true }
        );
    });

    it('emails the customer with the add-on display name, not the slug', async () => {
        await softCancelRecurringAddon({ ...baseInput, db: createDb() });

        expect(mockSendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'addon_cancellation',
                recipientEmail: 'owner@example.com',
                addonName: 'Alojamientos extra',
                addonSlug: 'extra-accommodations-20'
            })
        );
    });

    it('tells the customer the exact date the benefit runs to (HOS-847 PR 7c)', async () => {
        await softCancelRecurringAddon({ ...baseInput, db: createDb() });

        // Read the argument instead of `expect.objectContaining`: that matcher
        // is blind to a MISSING field, which is the only defect worth catching
        // here — the whole point is that the deferred send carries the date the
        // immediate send must not.
        const [payload] = mockSendNotification.mock.calls[0] as [Record<string, unknown>];
        expect(payload.accessUntil).toBe(PERIOD_END.toISOString());
        // And it is not the same instant as "cancelled now", or the email would
        // be promising access up to the moment it was sent.
        expect(payload.accessUntil).not.toBe(payload.canceledAt);
    });

    it('still succeeds when the notification lookup blows up', async () => {
        // Fire-and-forget: the cancellation is already persisted and the
        // customer's charging has already stopped. An email failure must not
        // turn that into an error the caller retries.
        const failing = {
            customers: { get: vi.fn().mockRejectedValue(new Error('qzpay down')) }
        } as unknown as QZPayBilling;

        const result = await softCancelRecurringAddon({
            ...baseInput,
            billing: failing,
            db: createDb()
        });

        expect(result.success).toBe(true);
        expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    });
});

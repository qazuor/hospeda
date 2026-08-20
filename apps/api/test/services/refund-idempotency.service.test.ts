/**
 * Tests for the Refund Idempotency Ledger (HOS-597).
 *
 * Two halves, tested separately:
 *
 * - `buildRefundIdempotencyKey` — pure. Decides WHETHER two deliveries of one
 *   refund collapse. The load-bearing property is that a full refund keys on
 *   the payment's terminal state (so the admin hook and a webhook that never
 *   saw a refund id still agree), while a partial keys on the provider refund
 *   id (so two genuine partials of the same amount stay distinct).
 * - `claimRefundApplication` — storage. Must issue a single atomic
 *   `INSERT ... ON CONFLICT DO NOTHING RETURNING` and read ownership off the
 *   returned rows, never a check-then-act SELECT.
 *
 * This file declares its own `@repo/db` mock rather than leaning on the global
 * one in `test/setup.ts`, so the insert chain is a real spy and the assertions
 * about it are not vacuous.
 *
 * @module test/services/refund-idempotency.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingIdempotencyKeys: {
        key: 'key',
        operation: 'operation',
        requestParams: 'request_params',
        expiresAt: 'expires_at',
        livemode: 'livemode'
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { getDb } from '@repo/db';
import {
    buildRefundIdempotencyKey,
    claimRefundApplication,
    REFUND_KEY_NAMESPACE,
    REFUND_LEDGER_OPERATION
} from '../../src/services/refund-idempotency.service';
import { apiLogger } from '../../src/utils/logger';

const PAYMENT_ID = 'pay_test_0001';

/**
 * Build a db mock whose insert chain is
 * `insert(...).values(...).onConflictDoNothing(...).returning(...)`.
 *
 * @param returnedRows - What RETURNING yields. `[]` means the row already
 *   existed (someone else owns this refund); one row means this caller won.
 */
function buildDbMock(returnedRows: readonly { key: string }[]) {
    const returning = vi.fn().mockResolvedValue(returnedRows);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const select = vi.fn();

    return {
        db: { insert, select },
        spies: { insert, values, onConflictDoNothing, returning, select }
    };
}

describe('buildRefundIdempotencyKey', () => {
    it('keys a full refund on the payment terminal state, ignoring the provider refund id', () => {
        // Both doors must land on the SAME key even though only one of them can
        // resolve a provider refund id — this is what closes the admin/webhook race.
        const withId = buildRefundIdempotencyKey({
            paymentId: PAYMENT_ID,
            paymentAmount: 1000,
            refundAmount: 1000,
            providerRefundId: 'mp_refund_1'
        });
        const withoutId = buildRefundIdempotencyKey({
            paymentId: PAYMENT_ID,
            paymentAmount: 1000,
            refundAmount: undefined,
            providerRefundId: undefined
        });

        expect(withId).toBe(`${REFUND_KEY_NAMESPACE}${PAYMENT_ID}:full`);
        expect(withoutId).toBe(withId);
    });

    it('treats an over-refund (refundAmount > payment.amount) as full', () => {
        expect(
            buildRefundIdempotencyKey({
                paymentId: PAYMENT_ID,
                paymentAmount: 1000,
                refundAmount: 1200,
                providerRefundId: undefined
            })
        ).toBe(`${REFUND_KEY_NAMESPACE}${PAYMENT_ID}:full`);
    });

    it('keys a partial refund on the provider refund id', () => {
        expect(
            buildRefundIdempotencyKey({
                paymentId: PAYMENT_ID,
                paymentAmount: 1000,
                refundAmount: 400,
                providerRefundId: 'mp_refund_7'
            })
        ).toBe(`${REFUND_KEY_NAMESPACE}${PAYMENT_ID}:refund:mp_refund_7`);
    });

    it('gives two genuine partials of the SAME amount distinct keys', () => {
        const a = buildRefundIdempotencyKey({
            paymentId: PAYMENT_ID,
            paymentAmount: 1000,
            refundAmount: 300,
            providerRefundId: 'mp_refund_a'
        });
        const b = buildRefundIdempotencyKey({
            paymentId: PAYMENT_ID,
            paymentAmount: 1000,
            refundAmount: 300,
            providerRefundId: 'mp_refund_b'
        });

        expect(a).not.toBe(b);
    });

    it('returns null for a partial refund with no provider refund id', () => {
        // No identity exists, so the caller must apply without a guard rather
        // than risk dropping a genuine second partial of the same amount.
        expect(
            buildRefundIdempotencyKey({
                paymentId: PAYMENT_ID,
                paymentAmount: 1000,
                refundAmount: 400,
                providerRefundId: undefined
            })
        ).toBeNull();
    });

    it('namespaces every key so it cannot collide with the request-idempotency middleware', () => {
        const key = buildRefundIdempotencyKey({
            paymentId: PAYMENT_ID,
            paymentAmount: 1000,
            refundAmount: undefined,
            providerRefundId: undefined
        });

        expect(key).toMatch(/^hospeda-refund-lifecycle:/);
        expect(key).not.toMatch(/^hospeda-billing:/);
    });
});

describe('claimRefundApplication', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('claims the refund when the insert returns a row', async () => {
        const { db } = buildDbMock([{ key: 'k' }]);
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const result = await claimRefundApplication({
            key: 'k',
            context: { paymentId: PAYMENT_ID }
        });

        expect(result).toEqual({ claimed: true, failOpen: false });
    });

    it('refuses the claim when the insert conflicts and returns no row', async () => {
        const { db } = buildDbMock([]);
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const result = await claimRefundApplication({ key: 'k', context: {} });

        expect(result).toEqual({ claimed: false, failOpen: false });
    });

    it('decides atomically: ON CONFLICT DO NOTHING + RETURNING, never a preceding SELECT', async () => {
        // A check-then-act SELECT would leave a window in which two concurrent
        // deliveries both see "not applied" and both apply.
        const { db, spies } = buildDbMock([{ key: 'k' }]);
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await claimRefundApplication({ key: 'k', context: {} });

        expect(spies.insert).toHaveBeenCalledTimes(1);
        expect(spies.onConflictDoNothing).toHaveBeenCalledTimes(1);
        expect(spies.returning).toHaveBeenCalledTimes(1);
        expect(spies.select).not.toHaveBeenCalled();
    });

    it('persists the operation label and the forensic context on the claim row', async () => {
        const { db, spies } = buildDbMock([{ key: 'k' }]);
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await claimRefundApplication({
            key: 'k',
            context: { paymentId: PAYMENT_ID, source: 'webhook' }
        });

        const row = spies.values.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(row.key).toBe('k');
        expect(row.operation).toBe(REFUND_LEDGER_OPERATION);
        expect(row.requestParams).toEqual({ paymentId: PAYMENT_ID, source: 'webhook' });
        expect(row.expiresAt).toBeInstanceOf(Date);
        expect((row.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());
    });

    it('fails OPEN when the ledger write throws, and says so', async () => {
        // A transient DB error is not evidence of a duplicate; refusing to
        // apply would leave real money unrecorded (the HOS-235 failure mode).
        const insert = vi.fn().mockImplementation(() => {
            throw new Error('connection terminated');
        });
        vi.mocked(getDb).mockReturnValue({ insert } as unknown as ReturnType<typeof getDb>);

        const result = await claimRefundApplication({ key: 'k', context: {} });

        expect(result).toEqual({ claimed: true, failOpen: true });
        expect(vi.mocked(apiLogger.error)).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'k' }),
            expect.stringContaining('fail-open')
        );
    });
});

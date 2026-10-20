import type { DrizzleClient } from '@repo/db';
import { describe, expect, it } from 'vitest';
import { hangPaymentOnMark } from '../../../../src/services/billing/payment/payment-ledger';

/** A transaction double whose single insert rejects with a Drizzle-like wrapped Postgres error. */
function rejectingTx(cause: { readonly code: string; readonly constraint?: string }) {
    const wrapped = new Error('Failed query: insert into "reconciliation_mark_payment"', {
        cause
    });
    const tx = {
        insert: () => ({ values: async () => Promise.reject(wrapped) })
    };
    return { tx: tx as unknown as DrizzleClient, wrapped };
}

const input = {
    markId: '00000000-0000-4000-8000-000000000001',
    payment: { source: 'PAYMENT' as const, id: '00000000-0000-4000-8000-000000000002' },
    hungAt: new Date('2026-10-10T12:00:00.000Z')
};

describe('hangPaymentOnMark — the same payment twice on one mark (AC:B5:37, I-1)', () => {
    it.each([
        'uq_reconciliation_mark_payment_payment',
        'uq_reconciliation_mark_payment_manual_payment'
    ])('translates a 23505 on %s into MARK_PAYMENT_ALREADY_HUNG', async (constraint) => {
        // Arrange
        const { tx } = rejectingTx({ code: '23505', constraint });

        // Act
        const act = hangPaymentOnMark({ ...input, tx });

        // Assert
        await expect(act).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'MARK_PAYMENT_ALREADY_HUNG'
        });
    });

    it.each([
        { code: '23503', constraint: 'fk_reconciliation_mark_payment_payment' },
        { code: '23505', constraint: 'uq_payment_provider_fact' },
        { code: '23505' }
    ])('rethrows any other database error untouched ($code $constraint)', async (cause) => {
        // Arrange
        const { tx, wrapped } = rejectingTx(cause);

        // Act
        const act = hangPaymentOnMark({ ...input, tx });

        // Assert
        await expect(act).rejects.toBe(wrapped);
    });
});

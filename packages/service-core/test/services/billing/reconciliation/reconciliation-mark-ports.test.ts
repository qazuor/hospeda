import { describe, expect, it } from 'vitest';
import { unimplementedReconciliationMarkPayments } from '../../../../src/services/billing/reconciliation/reconciliation-mark-payments.port';

describe('reconciliation mark internal ports', () => {
    it('TEST:B3:40 default payment guard is empty without B5 table', async () => {
        await expect(
            unimplementedReconciliationMarkPayments.countUnresolved({
                markId: crypto.randomUUID(),
                tx: {} as never
            })
        ).resolves.toBe(0);
        await expect(
            unimplementedReconciliationMarkPayments.hang({
                markId: crypto.randomUUID(),
                payment: { source: 'PAYMENT', id: crypto.randomUUID() },
                tx: {} as never
            })
        ).rejects.toMatchObject({
            code: 'INTERNAL_ERROR',
            reason: 'MARK_PAYMENTS_PORT_NOT_REGISTERED'
        });
    });
});

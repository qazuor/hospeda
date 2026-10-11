import { describe, expect, it } from 'vitest';
import {
    noCreditedPayments,
    unimplementedSuccessionCloser
} from '../../../../src/services/billing/subscription/subscription-billing-ports';

describe('subscription billing ports defaults', () => {
    it('reports no credited payments before B5 creates the payment tables', async () => {
        await expect(
            noCreditedPayments.hasCreditedPayment({ subscriptionId: crypto.randomUUID() })
        ).resolves.toBe(false);
    });

    it('fails visibly when the succession closer has not been registered', async () => {
        await expect(
            unimplementedSuccessionCloser.closeSuccession({
                predecessorSubscriptionId: crypto.randomUUID(),
                tx: {} as never
            })
        ).rejects.toMatchObject({ reason: 'SUCCESSION_CLOSER_NOT_REGISTERED' });
    });
});

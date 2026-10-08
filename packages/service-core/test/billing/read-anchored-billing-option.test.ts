import { describe, expect, it, vi } from 'vitest';
import {
    type BillingOptionReader,
    readAnchoredBillingOption
} from '../../src/services/billing/read-anchored-billing-option.ts';

describe('TEST:B2:4 — reads the subscription anchor', () => {
    it('uses the old version even when the plan has a different current version', async () => {
        const oldVersionId = crypto.randomUUID();
        const currentVersionId = crypto.randomUUID();
        const options = [
            {
                id: crypto.randomUUID(),
                planVersionId: oldVersionId,
                cycle: 'monthly',
                amount: 3000,
                currency: 'ARS'
            },
            {
                id: crypto.randomUUID(),
                planVersionId: currentVersionId,
                cycle: 'monthly',
                amount: 4500,
                currency: 'ARS'
            }
        ];
        const findByVersionAndId = vi.fn(
            async ({ planVersionId, billingOptionId }) =>
                options.find(
                    (option) =>
                        option.planVersionId === planVersionId && option.id === billingOptionId
                ) ?? null
        );
        const reader: BillingOptionReader = { findByVersionAndId };

        const result = await readAnchoredBillingOption({
            subscription: { planVersionId: oldVersionId, billingOptionId: options[0]!.id },
            reader
        });

        expect(result?.amount).toBe(3000);
        expect(findByVersionAndId).toHaveBeenCalledWith({
            planVersionId: oldVersionId,
            billingOptionId: options[0]!.id
        });
    });
});

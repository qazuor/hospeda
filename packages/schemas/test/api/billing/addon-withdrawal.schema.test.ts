import { describe, expect, it } from 'vitest';
import { OwnerRecurringAddonSchema } from '../../../src/api/billing/addon-withdrawal.schema';

describe('OwnerRecurringAddonSchema', () => {
    it('preserves the catalog slug in an owner recurring addon', () => {
        const parsed = OwnerRecurringAddonSchema.parse({
            addonInstanceId: '2f0f3f6e-7d0b-4a55-9d0e-3d8f2a4b9c11',
            slug: 'extra-experiences-1',
            name: 'Extra Experience Listing (+1)',
            chargeKind: 'PERIODICO',
            cycle: 'monthly',
            price: 120000,
            currency: 'ARS',
            status: 'ACTIVE',
            targetId: null,
            targetName: null
        });

        expect(parsed.slug).toBe('extra-experiences-1');
    });
});

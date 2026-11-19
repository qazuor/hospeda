import type { SelectSubscription } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readLivePromos, expectedAmount } = vi.hoisted(() => ({
    readLivePromos: vi.fn(),
    expectedAmount: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    readLivePromos,
    createCutExpectedAmountPolicy: () => ({ expectedAmount })
}));

import { readPendingPromo } from '../../../src/routes/billing-subscription/read-pending-promo';

const subscription = { id: '73eb41e6-0000-4000-8000-000000000000' } as SelectSubscription;
const promo = (code: string, remainingCharges: number | null) => ({
    redemptionId: crypto.randomUUID(),
    promoCodeId: crypto.randomUUID(),
    code,
    discountKind: 'PERCENTAGE' as const,
    value: 20,
    remainingCharges,
    redeemedAt: new Date(),
    stackable: false,
    usableWithAnotherActive: false
});

describe('HOS-2382 readPendingPromo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        expectedAmount.mockResolvedValue({
            kind: 'COMPARABLE',
            amountMinor: 1440000,
            currency: 'ARS',
            source: 'ANCHORED'
        });
    });

    it('returns null without asking for an amount when no promo is live', async () => {
        readLivePromos.mockResolvedValue([]);
        expect(await readPendingPromo({ subscription })).toBeNull();
        expect(expectedAmount).not.toHaveBeenCalled();
    });

    it('returns the amount the provider will charge, the codes and the charges left', async () => {
        readLivePromos.mockResolvedValue([promo('SMOKES23', 3)]);
        expect(await readPendingPromo({ subscription })).toEqual({
            codes: ['SMOKES23'],
            amount: 1440000,
            chargesLeft: 3
        });
        expect(expectedAmount).toHaveBeenCalledWith({
            subscription,
            purpose: { kind: 'AUTHORIZATION' }
        });
    });

    it('reports an unlimited promo as null charges left', async () => {
        readLivePromos.mockResolvedValue([promo('FOREVER', null)]);
        expect((await readPendingPromo({ subscription }))?.chargesLeft).toBeNull();
    });

    it('uses the shortest finite duration when promos stack', async () => {
        readLivePromos.mockResolvedValue([promo('A', null), promo('B', 5), promo('C', 2)]);
        const result = await readPendingPromo({ subscription });
        expect(result?.chargesLeft).toBe(2);
        expect(result?.codes).toEqual(['A', 'B', 'C']);
    });

    it('returns null when the amount is not comparable', async () => {
        readLivePromos.mockResolvedValue([promo('X', 1)]);
        expectedAmount.mockResolvedValue({ kind: 'NOT_COMPARABLE', reason: 'NO_ANCHOR' });
        expect(await readPendingPromo({ subscription })).toBeNull();
    });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    type PendingIncreaseAnchor,
    pendingIncreaseAmountForCharge,
    pendingIncreaseOnResumeReaders
} from '../../../../src/services/billing/plan-migration/plan-migration-increase-on-resume.js';

const subscriptionId = '11111111-1111-4111-8111-111111111111';
const announcedAt = new Date('2026-10-11T13:00:00.000Z');

function anchor(overrides: Partial<PendingIncreaseAnchor> = {}): PendingIncreaseAnchor {
    return {
        announcedAt,
        noticeDays: 60,
        targetPlanVersionId: '22222222-2222-4222-8222-222222222222',
        subscriptionId,
        userId: '33333333-3333-4333-8333-333333333333',
        customerName: 'Customer',
        customerEmail: 'customer@example.test',
        billingOptionId: '44444444-4444-4444-8444-444444444444',
        cycle: 'monthly',
        nextChargeAt: null,
        ...overrides
    };
}

afterEach(() => vi.restoreAllMocks());

describe('AC:B8b:4 el monto informado al reanudar cuando el cobro es la fecha del aumento', () => {
    it('returns null when the subscription has no pending price increase', async () => {
        vi.spyOn(pendingIncreaseOnResumeReaders, 'readAnchor').mockResolvedValue(null);
        const priceRow = vi.spyOn(pendingIncreaseOnResumeReaders, 'priceRow');

        expect(
            await pendingIncreaseAmountForCharge({
                subscriptionId,
                chargeAt: new Date('2027-01-15T13:00:00.000Z')
            })
        ).toBeNull();
        expect(priceRow).toHaveBeenCalledTimes(0);
    });

    it('returns null when the charge is not the application day', async () => {
        vi.spyOn(pendingIncreaseOnResumeReaders, 'readAnchor').mockResolvedValue(anchor());
        const priceRow = vi.spyOn(pendingIncreaseOnResumeReaders, 'priceRow').mockResolvedValue({
            currentAmount: 250000,
            newAmount: 350000,
            currency: 'ARS',
            losesPromo: false
        });

        // A charge inside the 60-day notice moves the application date one cycle later.
        expect(
            await pendingIncreaseAmountForCharge({
                subscriptionId,
                chargeAt: new Date('2026-12-05T13:00:00.000Z')
            })
        ).toBeNull();
        expect(priceRow).toHaveBeenCalledTimes(0);
    });

    it('returns the new amount when the charge is exactly the application day', async () => {
        vi.spyOn(pendingIncreaseOnResumeReaders, 'readAnchor').mockResolvedValue(anchor());
        const priceRow = vi.spyOn(pendingIncreaseOnResumeReaders, 'priceRow').mockResolvedValue({
            currentAmount: 250000,
            newAmount: 350000,
            currency: 'ARS',
            losesPromo: false
        });

        expect(
            await pendingIncreaseAmountForCharge({
                subscriptionId,
                chargeAt: new Date('2027-01-15T13:00:00.000Z')
            })
        ).toEqual({ amountMinor: 350000, currency: 'ARS' });
        expect(priceRow).toHaveBeenCalledTimes(1);
        expect(priceRow).toHaveBeenCalledWith(
            expect.objectContaining({
                reason: 'PRICE_INCREASE',
                at: new Date('2027-01-15T13:00:00.000Z')
            })
        );
    });
});

import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import { cancelInheritedTouristVips } from '../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service';

// TEST:B3:28 — the S2 clause re-reads inheritance and skips when it no longer applies.
describe('TEST:B3:28 inherited Tourist VIP S2 clause', () => {
    it('skips without touching the provider or outbox when no title inherits VIP', async () => {
        const clock = { now: () => new Date('2026-10-10T00:00:00.000Z') };
        const provider = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const refund = vi.spyOn(provider, 'refund');
        const beforeCancel = vi.fn(async () => 'SENT' as const);
        const result = await cancelInheritedTouristVips(
            { userId: crypto.randomUUID() },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel },
                touristVipInheritance: { inherits: async () => false }
            }
        );
        expect(result).toEqual({ cancelled: 0, deferred: 0, skipped: 1 });
        expect(beforeCancel).not.toHaveBeenCalled();
        expect(refund).not.toHaveBeenCalled();
    });
});

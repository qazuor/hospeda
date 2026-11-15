import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';
import { afterSubscriptionActivated } from '../../../../src/services/billing/subscription/after-activation-commit.js';

const clock = { now: () => new Date('2026-11-13T12:00:00.000Z') };
const provider = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
const principal = {
    id: '00000000-0000-4000-8000-000000000001',
    class: 'PRINCIPAL',
    userId: null,
    vertical: null,
    succeedsId: null
};

describe('TEST:B8b:8 post-commit succession settlement port', () => {
    it('calls the settler for a principal even after the predecessor link has closed', async () => {
        const successionSettler = vi.fn().mockResolvedValue({});
        await afterSubscriptionActivated(
            { subscription: principal },
            { provider, clock, beforeCancelNotice, successionSettler }
        );
        expect(successionSettler).toHaveBeenCalledWith({ successorSubscriptionId: principal.id });
    });

    it('keeps activation complete if the post-commit settler throws', async () => {
        const successionSettler = vi.fn().mockRejectedValue(new Error('provider unavailable'));
        await expect(
            afterSubscriptionActivated(
                { subscription: principal },
                { provider, clock, beforeCancelNotice, successionSettler }
            )
        ).resolves.toEqual({ touristVipCancelled: 0 });
        expect(successionSettler).toHaveBeenCalledTimes(1);
    });

    it('preserves the optional default and skips complementary rows', async () => {
        const successionSettler = vi.fn();
        expect(
            await afterSubscriptionActivated(
                { subscription: principal },
                { provider, clock, beforeCancelNotice }
            )
        ).toEqual({ touristVipCancelled: 0 });
        await afterSubscriptionActivated(
            { subscription: { ...principal, class: 'COMPLEMENT' } },
            { provider, clock, beforeCancelNotice, successionSettler }
        );
        expect(successionSettler).toHaveBeenCalledTimes(0);
    });
});

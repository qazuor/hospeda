import { touristVipModel } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelInheritedTouristVips } from '../../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service';

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: () => ({ transaction: async (cb: (tx: object) => Promise<unknown>) => cb({}) })
    };
});

afterEach(() => vi.restoreAllMocks());

// HOS-1994: the inherited close must reach the analytics fact sink like every other cancellation.
async function arrange() {
    const clock = { now: () => new Date('2026-10-10T00:00:00.000Z') };
    const provider = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
    const authorization = await provider.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 25000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'VIP',
        returnUrl: 'https://hospeda.example/account'
    });
    await provider.cancel({ authorizationId: authorization.authorizationId });
    const userId = crypto.randomUUID();
    const subscriptionId = crypto.randomUUID();
    vi.spyOn(touristVipModel, 'findCancellableRows').mockResolvedValue([
        {
            subscription: {
                id: subscriptionId,
                userId,
                vertical: 'tourist',
                createdAt: new Date('2026-10-05T00:00:00.000Z')
            } as never,
            providerLink: { providerId: authorization.authorizationId } as never
        }
    ]);
    const emit = vi.fn();
    const ports = {
        provider,
        clock,
        beforeCancelNotice: { beforeCancel: vi.fn(async () => 'SENT' as const) },
        touristVipInheritance: { inherits: async () => true },
        billingFacts: { emit }
    };
    return { userId, subscriptionId, emit, ports };
}

describe('HOS-1994 inherited Tourist VIP cancellation analytics fact', () => {
    it('emits exactly one SUBSCRIPTION_CANCELLED fact when the close wrote', async () => {
        const { userId, subscriptionId, emit, ports } = await arrange();
        vi.spyOn(touristVipModel, 'closeCancelledVip').mockResolvedValue(true);

        await cancelInheritedTouristVips({ userId }, ports);

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'SUBSCRIPTION_CANCELLED',
                userId,
                vertical: 'tourist',
                subscriptionId,
                cancelledBy: 'SYSTEM',
                path: 'INHERITED_BY_PLAN',
                wasScheduled: false,
                lifetimeDays: 5
            })
        );
    });

    it('emits no fact when the close did not write (skipped)', async () => {
        const { userId, emit, ports } = await arrange();
        vi.spyOn(touristVipModel, 'closeCancelledVip').mockResolvedValue(false);

        const result = await cancelInheritedTouristVips({ userId }, ports);

        expect(result.skipped).toBe(1);
        expect(emit).not.toHaveBeenCalled();
    });
});

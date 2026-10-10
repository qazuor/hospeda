import {
    billingOptions,
    plans,
    planVersions,
    subscriptions,
    touristVipModel,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { cancelInheritedTouristVips } from '../../../src/services/billing/subscription/cancel-inherited-tourist-vip.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';

afterAll(closeServiceTestPool);
afterEach(() => vi.restoreAllMocks());

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

    it('closes locally when the provider reread already sees the VIP cancelled', async () => {
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
        const subscriptionId = crypto.randomUUID();
        vi.spyOn(touristVipModel, 'findCancellableRows').mockResolvedValue([
            {
                subscription: { id: subscriptionId } as never,
                providerLink: { providerId: authorization.authorizationId } as never
            }
        ]);
        const close = vi.spyOn(touristVipModel, 'closeCancelledVip').mockResolvedValue(true);
        const beforeCancel = vi.fn(async () => 'SENT' as const);
        const cancel = vi.spyOn(provider, 'cancel');
        const result = await cancelInheritedTouristVips(
            { userId: crypto.randomUUID() },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel },
                touristVipInheritance: { inherits: async () => true }
            }
        );
        expect(result).toEqual({ cancelled: 1, deferred: 0, skipped: 0 });
        expect(close).toHaveBeenCalledWith({ subscriptionId, now: clock.now() });
        expect(cancel).not.toHaveBeenCalled();
        expect(beforeCancel).not.toHaveBeenCalled();
    });

    it('does not touch a pending VIP because it is outside cancellable rows', async () => {
        const clock = { now: () => new Date('2026-10-10T00:00:00.000Z') };
        const provider = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const db = getServiceTestDb();
        const [user] = await db
            .insert(users)
            .values({
                email: `b3-pending-vip-${crypto.randomUUID()}@example.test`,
                displayName: 'Pending VIP',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning();
        const [plan] = await db
            .insert(plans)
            .values({ vertical: 'tourist', slug: `b3-pending-${crypto.randomUUID()}`, name: 'VIP' })
            .returning();
        const [version] = await db
            .insert(planVersions)
            .values({
                planId: plan!.id,
                vertical: 'tourist',
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning();
        const [option] = await db
            .insert(billingOptions)
            .values({
                planVersionId: version!.id,
                cycle: 'monthly',
                amount: 25000,
                currency: 'ARS'
            })
            .returning();
        await db.insert(subscriptions).values({
            userId: user!.id,
            vertical: 'tourist',
            planVersionId: version!.id,
            billingOptionId: option!.id,
            paymentMethod: 'CARD',
            status: 'PENDING_AUTHORIZATION',
            class: 'PRINCIPAL'
        });
        const beforeCancel = vi.fn(async () => 'SENT' as const);
        const cancel = vi.spyOn(provider, 'cancel');
        const result = await cancelInheritedTouristVips(
            { userId: user!.id },
            {
                provider,
                clock,
                beforeCancelNotice: { beforeCancel },
                touristVipInheritance: { inherits: async () => true }
            }
        );
        expect(result).toEqual({ cancelled: 0, deferred: 0, skipped: 0 });
        expect(await touristVipModel.findCancellableRows({ userId: user!.id })).toEqual([]);
        expect(cancel).not.toHaveBeenCalled();
        expect(beforeCancel).not.toHaveBeenCalled();
    });
});

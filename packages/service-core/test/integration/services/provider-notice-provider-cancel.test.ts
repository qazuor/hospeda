import {
    billingDeadlineVersions,
    eq,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { processProviderNotice } from '../../../src/services/billing/notice/process-provider-notice.service.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };
const beforeCancelNotice: BeforeCancelNotice = { beforeCancel: async () => 'SENT' };
const values = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} as const;

async function setup() {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values })
        .onConflictDoNothing();
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `provider-cancel-${crypto.randomUUID()}@example.test`,
            displayName: 'Notice',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('missing user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `provider-cancel-${crypto.randomUUID()}`, 'Plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('missing plan');
    const planVersionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1_000_000_000)]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('missing version');
    const billingOptionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('missing option');
    const provider = new FakePaymentProvider({
        clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [
            { lie: 'M1', why: 'fixture signup must succeed' },
            { lie: 'M6', why: 'the cancellation handle must produce one immediate delivery' }
        ]
    });
    const started = await startSubscription(
        { userId: user.id, billingOptionId, returnUrl: 'https://example.test' },
        {
            provider,
            clock,
            beforeCancelNotice,
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    await provider.approve({ authorizationId: started.authorizationId });
    provider.takeDeliveries();
    await subscriptionModel.activatePendingAuthorization({
        subscriptionId: started.subscriptionId,
        now: clock.now()
    });
    return { provider, started };
}

async function takeAuthorizationDelivery(provider: FakePaymentProvider) {
    for (const delivery of provider.takeDeliveries().deliveries) {
        if ((await provider.decodeNotice(delivery)).resourceKind === 'authorization')
            return delivery;
    }
    return undefined;
}

describe('provider cancellation mirror', () => {
    it('TEST:B3:19 mirrors a payer cancellation immediately without cancelling again', async () => {
        const { provider, started } = await setup();
        await provider.cancel({ authorizationId: started.authorizationId });
        const cancel = vi.spyOn(provider, 'cancel');
        const delivery = await takeAuthorizationDelivery(provider);
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery: delivery ?? { headers: {}, body: '' } },
            {
                provider,
                clock,
                beforeCancelNotice,
                payments: { hasCreditedPayment: async () => true }
            }
        );
        expect(result).toEqual({ ack: 'OK', outcome: 'APPLIED' });
        expect(cancel).not.toHaveBeenCalled();
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        expect(row?.status).toBe('CANCELLED');
        expect(row?.serviceEndsAt).toEqual(now);
    });

    it('TEST:B3:19 waits without writing while the first charge is unknown', async () => {
        const { provider, started } = await setup();
        await provider.cancel({ authorizationId: started.authorizationId });
        const delivery = await takeAuthorizationDelivery(provider);
        if (!delivery) throw new Error('missing cancellation delivery');
        const [before] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery },
            {
                provider,
                clock,
                beforeCancelNotice,
                payments: { hasCreditedPayment: async () => false }
            }
        );
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        const [after] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, started.subscriptionId));
        expect(result).toEqual({ ack: 'OK', outcome: 'WAITING_FIRST_CHARGE_READING' });
        expect(row?.status).toBe('ACTIVE');
        expect(after?.lastAppliedVersion).toBe(before?.lastAppliedVersion);
    });

    it('TEST:B3:19 delegates a rejected first charge to S16', async () => {
        const { provider, started } = await setup();
        const { chargeId } = await provider.declineCharge({
            authorizationId: started.authorizationId,
            declineReason: 'risk'
        });
        await provider.cancel({ authorizationId: started.authorizationId });
        const [delivery] = provider.takeDeliveries().deliveries;
        if (!delivery) throw new Error('missing cancellation delivery');
        const result = await processProviderNotice(
            { channel: 'WEBHOOKS', delivery },
            {
                provider,
                clock,
                beforeCancelNotice,
                payments: { hasCreditedPayment: async () => false },
                firstCharge: { readFirstCharge: async () => ({ outcome: 'REJECTED', chargeId }) }
            }
        );
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        expect(result).toEqual({ ack: 'OK', outcome: 'S16' });
        expect(row?.status).toBe('CHARGE_DECLINED');
    });
});

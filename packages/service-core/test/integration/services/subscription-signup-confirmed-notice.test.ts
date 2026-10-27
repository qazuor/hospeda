import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    plans,
    planVersions,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import type { NoticeDelivery, PaymentProvider } from '@repo/payments';
import { encodeFakeNotice, FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { receiveProviderDelivery } from '../../../src/services/billing/notice/receive-provider-delivery.service.js';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);

const deadlines = {
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
} satisfies BillingDeadlineValues;

const activatedAt = new Date('2026-10-09T02:00:00.000Z');
const clock = { now: () => activatedAt };
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
});

async function startPending(
    provider: PaymentProvider,
    input: { readonly userId?: string; readonly vertical?: 'accommodation' | 'venue' } = {}
) {
    const db = getServiceTestDb();
    let userId = input.userId;
    if (!userId) {
        const [user] = await db
            .insert(users)
            .values({
                email: `b3-signup-notice-${crypto.randomUUID()}@example.test`,
                displayName: 'B3 signup notice user',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning();
        if (!user) throw new Error('No user');
        userId = user.id;
    }
    const vertical = input.vertical ?? 'accommodation';
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `b3-signup-${crypto.randomUUID()}`,
            name: 'Plan real'
        })
        .returning();
    if (!plan) throw new Error('No plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('No plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning();
    if (!option) throw new Error('No billing option');
    const started = await startSubscription(
        {
            userId,
            billingOptionId: option.id,
            returnUrl: 'https://hospeda.example/account'
        },
        {
            provider,
            clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            beforeCancelNotice,
            touristVipInheritance: noTouristVip
        }
    );
    return { started, userId };
}

function newProvider() {
    return new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M1', why: 'TEST:B3:34 signup notice fixture' }]
    });
}

async function noticesFor(subscriptionIds: string[]) {
    const result = await getServiceTestPool().query<{
        template: string;
        payload: Record<string, unknown>;
    }>(
        `SELECT template, payload FROM email_outbox
         WHERE template = $1 AND payload->>'subscriptionId' = ANY($2::text[])`,
        ['billing.signup-confirmed', subscriptionIds]
    );
    return result.rows;
}

async function expectConfirmed(subscriptionId: string) {
    const rows = await noticesFor([subscriptionId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
        template: 'billing.signup-confirmed',
        payload: {
            subscriptionId,
            vertical: 'accommodation',
            planName: 'Plan real',
            firstChargeDate: '2026-10-08'
        }
    });
}

describe('TEST:B3:34 (soporte) signup-confirmed outbox notice', () => {
    it('enqueues once when activateSubscription authorizes S2, using the market date', async () => {
        const provider = newProvider();
        const { started } = await startPending(provider);
        await provider.approve({ authorizationId: started.authorizationId });
        const ports = { provider, clock, beforeCancelNotice, touristVipInheritance: noTouristVip };

        expect((await activateSubscription(started.subscriptionId, ports)).activated).toBe(true);
        expect((await activateSubscription(started.subscriptionId, ports)).activated).toBe(false);
        await expectConfirmed(started.subscriptionId);
    });

    it('enqueues when S3 re-reads an approved authorization before expiring it', async () => {
        const provider = newProvider();
        const { started } = await startPending(provider);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ authorizationWindowEndsAt: new Date(activatedAt.getTime() - 1) })
            .where(eq(subscriptions.id, started.subscriptionId));
        await provider.approve({ authorizationId: started.authorizationId });
        const original = subscriptionModel.findExpiredAuthorizationWindows;
        const spy = vi.spyOn(subscriptionModel, 'findExpiredAuthorizationWindows');
        spy.mockImplementation(async (input) => {
            const rows = await original({ ...input, limit: 10_000 });
            return rows.filter((row) => row.subscription.id === started.subscriptionId);
        });
        try {
            const summary = await expireAuthorizationWindows(10, {
                provider,
                clock,
                beforeCancelNotice,
                touristVipInheritance: noTouristVip
            });
            expect(summary.activated).toBe(1);
            await expectConfirmed(started.subscriptionId);
        } finally {
            spy.mockRestore();
        }
    });

    it('enqueues when the provider delivery processes approved authorization by re-read', async () => {
        const provider = newProvider();
        const { started } = await startPending(provider);
        await provider.approve({ authorizationId: started.authorizationId });
        const encoded = encodeFakeNotice({
            notice: {
                resourceKind: 'authorization',
                resourceId: started.authorizationId,
                version: '1'
            },
            format: 'json'
        });
        const delivery: NoticeDelivery = {
            headers: { 'content-type': encoded.contentType },
            body: encoded.body
        };
        const result = await receiveProviderDelivery(
            {
                url: `https://api.example.test/api/v1/webhooks/mercadopago?source_news=webhooks&t=${crypto.randomUUID()}`,
                delivery
            },
            { provider, clock, beforeCancelNotice }
        );
        expect(result.ack).toBe('OK');
        await expectConfirmed(started.subscriptionId);
    });

    it('does not enqueue a confirmed notice when S3 abandons the authorization', async () => {
        const provider = newProvider();
        const { started } = await startPending(provider);
        await getServiceTestDb()
            .update(subscriptions)
            .set({ authorizationWindowEndsAt: new Date(activatedAt.getTime() - 1) })
            .where(eq(subscriptions.id, started.subscriptionId));
        const original = subscriptionModel.findExpiredAuthorizationWindows;
        const spy = vi.spyOn(subscriptionModel, 'findExpiredAuthorizationWindows');
        spy.mockImplementation(async (input) => {
            const rows = await original({ ...input, limit: 10_000 });
            return rows.filter((row) => row.subscription.id === started.subscriptionId);
        });
        try {
            const summary = await expireAuthorizationWindows(10, {
                provider,
                clock,
                beforeCancelNotice,
                touristVipInheritance: noTouristVip
            });
            expect(summary.abandoned).toBe(1);
            expect(await noticesFor([started.subscriptionId])).toHaveLength(0);
        } finally {
            spy.mockRestore();
        }
    });

    it('deduplicates by subscription for the same user across two verticals', async () => {
        const provider = newProvider();
        const first = await startPending(provider);
        const second = await startPending(provider, {
            userId: first.userId,
            vertical: 'venue'
        });
        await provider.approve({ authorizationId: first.started.authorizationId });
        await provider.approve({ authorizationId: second.started.authorizationId });
        const ports = { provider, clock, beforeCancelNotice, touristVipInheritance: noTouristVip };

        expect((await activateSubscription(first.started.subscriptionId, ports)).activated).toBe(
            true
        );
        expect((await activateSubscription(second.started.subscriptionId, ports)).activated).toBe(
            true
        );
        const rows = await noticesFor([
            first.started.subscriptionId,
            second.started.subscriptionId
        ]);
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.payload.subscriptionId).sort()).toEqual(
            [first.started.subscriptionId, second.started.subscriptionId].sort()
        );
        expect(rows.map((row) => row.payload.vertical).sort()).toEqual(['accommodation', 'venue']);
    });
});

import {
    billingDeadlineVersions,
    billingOptions,
    plans,
    planVersions,
    subscriptionModel,
    users
} from '@repo/db';
import { registerCaptureHook, unregisterCaptureHook } from '@repo/logger';
import { PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip';

const clock = { now: () => new Date('2026-10-08T20:00:00.000Z') };
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

beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
});
afterAll(closeServiceTestPool);
afterEach(unregisterCaptureHook);

async function attempt(error: PaymentProviderError) {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `provider-rejection-${crypto.randomUUID()}@example.test`,
            displayName: 'Provider rejection',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: 'accommodation',
            slug: `provider-rejection-${crypto.randomUUID()}`,
            name: 'Basic'
        })
        .returning();
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan!.id,
            vertical: 'accommodation',
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
            amount: 100000,
            currency: 'ARS'
        })
        .returning();
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    vi.spyOn(fake, 'authorize').mockRejectedValueOnce(error);
    const captured: { error: unknown; extra: Record<string, unknown> }[] = [];
    registerCaptureHook((caught, extra) => captured.push({ error: caught, extra }));
    const promise = startSubscription(
        {
            userId: user!.id,
            billingOptionId: option!.id,
            returnUrl: 'https://example.test',
            payerEmail: user!.email
        },
        {
            provider: namespaceFake(fake),
            clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            beforeCancelNotice: { beforeCancel: async () => 'SENT' },
            touristVipInheritance: noTouristVip
        }
    );
    return { promise, captured, user: user! };
}

describe('TEST:1746:3 authorize rejection logging', () => {
    it.each([
        new PaymentProviderError({
            code: 'REJECTED',
            capability: 'authorize',
            message: 'Mercado Pago request failed (400)',
            cause: { status: 400, body: { message: 'invalid payer_email', error: 'bad_request' } }
        }),
        new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'authorize',
            message: 'Mercado Pago request failed (503)',
            cause: { status: 503, body: '' }
        })
    ])('captures the provider error and its cause', async (error) => {
        const { promise, captured, user } = await attempt(error);
        await expect(promise).rejects.toBe(error);
        const row = await subscriptionModel.findLiveCommitment({
            userId: user.id,
            vertical: 'accommodation'
        });
        expect(captured).toHaveLength(1);
        expect(captured[0]?.error).toBe(error);
        if (error.code === 'REJECTED')
            expect(error.cause).toMatchObject({ body: { message: 'invalid payer_email' } });
        expect(captured[0]?.extra.label).toContain(row?.subscription.id);
    });
});
